import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { useStore } from "../store";
import { HelpBox } from "./HelpBox";
import { pointsForRoom } from "../utils/geometry";
import { uid } from "../utils/id";
import { analyzeVmc, DIAMS, deviceFlow, emptyVmcPlan, type Status } from "../utils/vmcPlan";
import type { VmcDevice, VmcRun } from "../types";

type Tool = "select" | "caisson" | "extraction" | "insufflation" | "te" | "gaine" | "delete";
type Sel = { t: "dev" | "run"; id: string } | null;
type Draft = { fromId: string; pts: { floorId: string; x: number; y: number }[] } | null;

const btn = "rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-black/5 disabled:opacity-40";
const btnOn = "rounded-lg border border-black bg-black px-3 py-1.5 text-xs font-semibold text-white";
const card = "rounded-xl border border-black/10 bg-white p-4";
const inp = "w-full rounded-lg border border-black/15 bg-white px-2 py-1 text-sm";
const COL: Record<Status, string> = { ok: "#16a34a", warn: "#d97706", error: "#dc2626" };
const TOOLS: [Tool, string][] = [
  ["select", "Sélection / déplacer"],
  ["caisson", "+ Caisson (moteur)"],
  ["extraction", "+ Bouche d'extraction"],
  ["insufflation", "+ Bouche d'insufflation"],
  ["te", "+ Té (piquage)"],
  ["gaine", "Tracer une gaine"],
  ["delete", "Supprimer"],
];

export function VmcPlan() {
  const { project, updateFloor, setVmcPlan, patchSettings } = useStore();
  const floors = project.floors;
  const [floorId, setFloorId] = useState(floors[0]?.id ?? "");
  const [tool, setTool] = useState<Tool>("select");
  const [sel, setSel] = useState<Sel>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [msg, setMsg] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);

  const floor = floors.find((f) => f.id === floorId) ?? floors[0];
  const plan = project.vmcPlan ?? emptyVmcPlan();
  const an = useMemo(() => analyzeVmc(project), [project]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDraft(null);
        setTool("select");
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  if (!floor) return <div className={card}>Ajoute d'abord un étage dans « Plans & pièces ».</div>;

  const devices = floor.vmcDevices ?? [];
  const allDevs = floors.flatMap((f) => (f.vmcDevices ?? []).map((d) => ({ d, f })));
  const pw = floor.planWidth || 1000;
  const ph = floor.planHeight || 700;
  const scale = floor.planScale || 40;

  const svgPt = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const r = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: r.x, y: r.y };
  };

  const setDevices = (fn: (d: VmcDevice[]) => VmcDevice[]) => updateFloor(floor.id, (f) => ({ ...f, vmcDevices: fn(f.vmcDevices ?? []) }));
  const patchDev = (id: string, patch: Partial<VmcDevice>) => setDevices((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const patchRun = (id: string, patch: Partial<VmcRun>) => setVmcPlan((p) => ({ ...p, runs: p.runs.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const delDev = (id: string) => {
    updateFloor(floor.id, (f) => ({ ...f, vmcDevices: (f.vmcDevices ?? []).filter((d) => d.id !== id) }));
    setVmcPlan((p) => ({ ...p, runs: p.runs.filter((r) => r.fromId !== id && r.toId !== id) }));
    setSel(null);
  };
  const delRun = (id: string) => {
    setVmcPlan((p) => ({ ...p, runs: p.runs.filter((r) => r.id !== id) }));
    setSel(null);
  };
  const setLimit = (patch: Record<string, unknown>) => setVmcPlan((p) => ({ ...p, limits: { ...p.limits, ...patch } }));

  const onBgDown = (e: RPointerEvent<SVGSVGElement>) => {
    const p = svgPt(e);
    setMsg("");
    if (tool === "caisson" || tool === "extraction" || tool === "insufflation" || tool === "te") {
      const d: VmcDevice = { id: uid(), kind: tool, x: p.x, y: p.y };
      setDevices((ds) => [...ds, d]);
      setSel({ t: "dev", id: d.id });
      setTool("select");
    } else if (tool === "gaine" && draft) setDraft({ ...draft, pts: [...draft.pts, { floorId: floor.id, x: p.x, y: p.y }] });
    else if (tool === "select") setSel(null);
  };

  const onDevDown = (e: RPointerEvent, d: VmcDevice) => {
    e.stopPropagation();
    if (tool === "delete") return delDev(d.id);
    if (tool === "gaine") {
      if (!draft) {
        if (d.kind === "caisson" || d.kind === "te") setDraft({ fromId: d.id, pts: [] });
        else setMsg("Une gaine part du caisson ou d'un té, et arrive à une bouche ou à un té.");
        return;
      }
      if (d.id === draft.fromId) return;
      if (d.kind === "caisson") return setMsg("Une gaine ne peut pas se terminer sur le caisson.");
      const run: VmcRun = { id: uid(), fromId: draft.fromId, toId: d.id, points: draft.pts, diameter: d.kind === "te" ? 125 : 80, flexible: true, ortho: false };
      setVmcPlan((p) => ({ ...p, runs: [...p.runs, run] }));
      setDraft(null);
      setSel({ t: "run", id: run.id });
      return;
    }
    if (tool === "select") {
      setSel({ t: "dev", id: d.id });
      svgRef.current?.setPointerCapture(e.pointerId);
      setDrag({ id: d.id, x: d.x, y: d.y });
    }
  };
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    const p = svgPt(e);
    setMouse(p);
    if (drag) setDrag({ ...drag, x: p.x, y: p.y });
  };
  const onUp = () => {
    if (drag) {
      patchDev(drag.id, { x: drag.x, y: drag.y });
      setDrag(null);
    }
  };

  const pos = (d: VmcDevice) => (drag && drag.id === d.id ? { x: drag.x, y: drag.y } : { x: d.x, y: d.y });
  const startOf = draft ? allDevs.find((x) => x.d.id === draft.fromId) : undefined;
  const selDev = sel?.t === "dev" ? allDevs.find((x) => x.d.id === sel.id) : undefined;
  const selRun = sel?.t === "run" ? plan.runs.find((r) => r.id === sel.id) : undefined;
  const selInfo = selRun ? an.runs[selRun.id] : undefined;
  const totalM = an.totals[80] + an.totals[125] + an.totals[160];
  const f1 = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

  const shape = (d: VmcDevice) => {
    const { x, y } = pos(d);
    const st = an.devStatus[d.id];
    const stroke = st ? COL[st] : "#111";
    const picked = sel?.t === "dev" && sel.id === d.id;
    const common = { onPointerDown: (e: RPointerEvent) => onDevDown(e, d), style: { cursor: tool === "select" ? "move" : "pointer" } };
    if (d.kind === "caisson")
      return (
        <g key={d.id} {...common}>
          <rect x={x - 16} y={y - 16} width={32} height={32} rx={4} fill="#1e293b" stroke={picked ? "#2563eb" : stroke} strokeWidth={picked ? 3 : 2} />
          <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fill="#fff" fontWeight={700} style={{ pointerEvents: "none" }}>VMC</text>
        </g>
      );
    if (d.kind === "te")
      return <rect key={d.id} {...common} x={x - 8} y={y - 8} width={16} height={16} transform={`rotate(45 ${x} ${y})`} fill="#fff" stroke={picked ? "#2563eb" : "#111"} strokeWidth={picked ? 3 : 2} />;
    const ext = d.kind === "extraction";
    const q = deviceFlow(d, floors.find((f) => (f.vmcDevices ?? []).some((z) => z.id === d.id)) ?? floor);
    return (
      <g key={d.id} {...common}>
        <circle cx={x} cy={y} r={11} fill={ext ? "#fecaca" : "#bfdbfe"} stroke={picked ? "#2563eb" : stroke} strokeWidth={picked ? 3 : 2} />
        <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={700} style={{ pointerEvents: "none" }}>{ext ? "E" : "I"}</text>
        <text x={x} y={y + 26} textAnchor="middle" fontSize={10} fill="#334155" style={{ pointerEvents: "none" }}>{q} m³/h</text>
      </g>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl uppercase">Plan des gaines VMC</h1>
        <p className="text-sm text-black/60">
          Place le caisson, les bouches et les tés, trace les gaines : le site mesure les longueurs, les coudes et les vitesses d'air, et te dit si c'est bien fait.
        </p>
      </div>

      <HelpBox id="vmcplan">
        <ol>
          <li><b>Place le matériel</b> : choisis un outil (« + Caisson », « + Bouche d'extraction », « + Bouche d'insufflation », « + Té »), puis clique sur le plan. Une bouche d'extraction va dans une pièce humide (cuisine, salle de bain, WC, buanderie) ; l'insufflation sert au double flux, dans les pièces sèches.</li>
          <li><b>Trace les gaines</b> : outil « Tracer une gaine ». Clique d'abord sur le <b>caisson</b> (ou un <b>té</b>), ajoute si besoin des points de passage en cliquant sur le plan, puis termine sur une <b>bouche</b> ou un <b>té</b>. Échap annule. Pour plusieurs bouches sur un même tronc : caisson → té, puis une gaine par bouche depuis le té.</li>
          <li><b>Plusieurs étages</b> : change d'étage en cours de tracé et continue. La hauteur entre les deux planchers est ajoutée à la longueur de la gaine.</li>
          <li><b>Règle chaque gaine</b> : clique dessus (outil « Sélection »). Choisis le diamètre (Ø80, Ø125, Ø160), souple ou rigide, trajet droit ou à angle droit. « Ø conseillé » applique le diamètre adapté au débit.</li>
          <li><b>Lis le diagnostic</b> (à droite) : trait vert = conforme, orange = proche de la limite, rouge = hors limite. Il vérifie la longueur équivalente (coudes inclus), la vitesse d'air, le trajet total caisson → bouche, les bouches non reliées, les pièces humides sans bouche et l'équilibre des débits en double flux. Clique sur une ligne du diagnostic pour sélectionner l'élément concerné.</li>
          <li><b>Débit d'une bouche</b> : automatique selon la pièce (cuisine 90 m³/h, salle de bain 45, WC 30…). Pour le modifier, sélectionne la bouche et saisis ton débit.</li>
          <li><b>Déplacer / supprimer</b> : en « Sélection », glisse un élément pour le déplacer. L'outil « Supprimer » efface l'élément cliqué (et les gaines qui y sont reliées).</li>
          <li><b>Chiffrage</b> : coche « Utiliser ces longueurs dans le chiffrage VMC » pour que les mètres de gaine du poste VMC viennent du plan au lieu d'une estimation par bouche.</li>
        </ol>
        <p>Les limites (longueur maxi par diamètre, vitesse d'air…) sont des repères prudents, modifiables en bas de page. En cas de doute, la notice du caisson et le DTU 68.3 font foi.</p>
      </HelpBox>

      <div className={`${card} flex flex-wrap items-end gap-3`}>
        <label className="text-xs font-semibold">
          Étage
          <select className={inp} value={floor.id} onChange={(e) => { setFloorId(e.target.value); setSel(null); }}>
            {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {TOOLS.map(([t, l]) => (
            <button key={t} className={tool === t ? btnOn : btn} onClick={() => { setTool(t); setDraft(null); setMsg(""); }}>{l}</button>
          ))}
        </div>
      </div>
      {/* Hauteur réservée : le plan ne doit pas bouger quand le message apparaît. */}
      <div className={`min-h-[34px] rounded-lg px-3 py-2 text-xs ${msg || draft ? "bg-amber-50 text-amber-900" : "text-black/40"}`}>
        {msg ||
          (draft
            ? "Clique pour poser des points de passage, puis sur une bouche ou un té pour terminer. Échap pour annuler."
            : tool === "gaine"
              ? "Clique d'abord sur le caisson ou un té pour démarrer une gaine."
              : "Choisis un outil, puis clique sur le plan.")}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className={`${card} p-2`}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${pw} ${ph}`}
            className="w-full touch-none select-none rounded-lg bg-[#f4f3ee]"
            style={{ cursor: tool === "select" ? "default" : "crosshair" }}
            onPointerDown={onBgDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            {floor.planImage && <image href={floor.planImage} x={0} y={0} width={pw} height={ph} opacity={0.5} preserveAspectRatio="none" />}
            {floor.rooms.map((r) => {
              const pts = pointsForRoom(r, scale);
              const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
              const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
              return (
                <g key={r.id} style={{ pointerEvents: "none" }}>
                  <polygon points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill={r.color} fillOpacity={0.15} stroke="#475569" strokeWidth={1.5} />
                  <text x={cx} y={cy} textAnchor="middle" fontSize={12} fill="#334155">{r.name}</text>
                </g>
              );
            })}

            {plan.runs.map((r) => {
              const i = an.runs[r.id];
              if (!i) return null;
              const segs: { a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
              for (let k = 1; k < i.path.length; k++)
                if (i.path[k - 1].floorId === floor.id && i.path[k].floorId === floor.id) segs.push({ a: i.path[k - 1], b: i.path[k] });
              if (!segs.length) return null;
              const picked = sel?.t === "run" && sel.id === r.id;
              const mid = segs[0];
              const sw = r.diameter === 160 ? 7 : r.diameter === 125 ? 5 : 3.5;
              return (
                <g key={r.id}>
                  {segs.map((s, k) => (
                    <g key={k}>
                      <line x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke={COL[i.status]} strokeWidth={sw} strokeLinecap="round" strokeDasharray={r.flexible ? "10 4" : undefined} opacity={picked ? 1 : 0.85} />
                      <line
                        x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke="transparent" strokeWidth={16}
                        style={{ cursor: "pointer" }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          if (tool === "delete") delRun(r.id);
                          else if (tool === "select") setSel({ t: "run", id: r.id });
                        }}
                      />
                    </g>
                  ))}
                  <text x={(mid.a.x + mid.b.x) / 2} y={(mid.a.y + mid.b.y) / 2 - 6} fontSize={11} fontWeight={700} fill={COL[i.status]} textAnchor="middle" style={{ pointerEvents: "none" }}>
                    Ø{r.diameter} · {f1(i.leq)} m
                  </text>
                </g>
              );
            })}

            {draft && startOf && (
              <polyline
                points={[
                  `${startOf.d.x},${startOf.d.y}`,
                  ...draft.pts.filter((p) => p.floorId === floor.id).map((p) => `${p.x},${p.y}`),
                  `${mouse.x},${mouse.y}`,
                ].join(" ")}
                fill="none" stroke="#2563eb" strokeWidth={3} strokeDasharray="6 4" style={{ pointerEvents: "none" }}
              />
            )}
            {devices.map(shape)}
          </svg>
          <p className="px-2 pt-1 text-[11px] text-black/50">
            Trait vert = conforme · orange = proche de la limite · rouge = hors limite. Pointillé = gaine souple. Pour changer d'étage en cours de tracé, passe sur l'autre étage et continue : la hauteur entre planchers est comptée.
          </p>
        </div>

        <div className="space-y-3">
          <div className={card}>
            <div className="mb-2 text-sm font-semibold">Diagnostic</div>
            <ul className="space-y-1.5 text-xs">
              {an.issues.length === 0 && <li className="text-black/50">Place un caisson, des bouches et trace les gaines.</li>}
              {an.issues.map((i, k) => (
                <li
                  key={k}
                  className="cursor-pointer rounded-md px-2 py-1"
                  style={{ background: `${COL[i.level]}18`, color: i.level === "ok" ? "#166534" : "#1f2937" }}
                  onClick={() => i.ref && setSel(plan.runs.some((r) => r.id === i.ref) ? { t: "run", id: i.ref } : { t: "dev", id: i.ref })}
                >
                  <b style={{ color: COL[i.level] }}>{i.level === "ok" ? "✓" : i.level === "warn" ? "!" : "✗"}</b> {i.text}
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-black/10 pt-2 text-xs">
              Gaines mesurées : Ø80 {f1(an.totals[80])} m · Ø125 {f1(an.totals[125])} m · Ø160 {f1(an.totals[160])} m (total {f1(totalM)} m, {an.bends} coudes)
              <br />Extraction {an.flowOut} m³/h · Insufflation {an.flowIn} m³/h
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!project.settings.vmc.useMeasured} onChange={() => patchSettings("vmc", (v) => ({ ...v, useMeasured: !v.useMeasured }))} />
              Utiliser ces longueurs dans le chiffrage VMC
            </label>
          </div>

          {selRun && selInfo && (
            <div className={`${card} space-y-2 text-xs`}>
              <div className="text-sm font-semibold">Gaine sélectionnée</div>
              <div>Longueur {f1(selInfo.length)} m · {selInfo.bends} coude(s) · équivalent {f1(selInfo.leq)} m · {selInfo.flow} m³/h · {f1(selInfo.velocity)} m/s</div>
              <div className="flex gap-2">
                <select className={inp} value={selRun.diameter} onChange={(e) => patchRun(selRun.id, { diameter: Number(e.target.value) as VmcRun["diameter"] })}>
                  {DIAMS.map((d) => <option key={d} value={d}>Ø{d} mm</option>)}
                </select>
                <button className={btn} onClick={() => patchRun(selRun.id, { diameter: selInfo.recDiam as VmcRun["diameter"] })}>Ø conseillé : {selInfo.recDiam}</button>
              </div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={selRun.flexible} onChange={(e) => patchRun(selRun.id, { flexible: e.target.checked })} /> Gaine souple (sinon rigide)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={selRun.ortho} onChange={(e) => patchRun(selRun.id, { ortho: e.target.checked })} /> Trajet à angle droit (suit les murs)</label>
              <div className="flex gap-2">
                <button className={btn} onClick={() => patchRun(selRun.id, { points: [] })}>Retirer les points de passage</button>
                <button className={btn} onClick={() => delRun(selRun.id)}>Supprimer</button>
              </div>
            </div>
          )}

          {selDev && (
            <div className={`${card} space-y-2 text-xs`}>
              <div className="text-sm font-semibold">{{ caisson: "Caisson", extraction: "Bouche d'extraction", insufflation: "Bouche d'insufflation", te: "Té" }[selDev.d.kind]}</div>
              <label className="block font-semibold">Nom
                <input className={inp} value={selDev.d.label ?? ""} onChange={(e) => patchDev(selDev.d.id, { label: e.target.value })} />
              </label>
              {(selDev.d.kind === "extraction" || selDev.d.kind === "insufflation") && (
                <label className="block font-semibold">Débit (m³/h) — vide = automatique selon la pièce
                  <input
                    className={inp} type="number" min={0}
                    placeholder={String(deviceFlow({ ...selDev.d, flow: undefined }, selDev.f))}
                    value={selDev.d.flow ?? ""}
                    onChange={(e) => patchDev(selDev.d.id, { flow: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                </label>
              )}
              <button className={btn} onClick={() => delDev(selDev.d.id)}>Supprimer</button>
            </div>
          )}

          <div className={`${card} space-y-2 text-xs`}>
            <div className="text-sm font-semibold">Limites de contrôle</div>
            <p className="text-black/50">Valeurs indicatives : la référence reste la notice du fabricant et le DTU 68.3.</p>
            <div className="grid grid-cols-3 gap-2">
              {DIAMS.map((d) => (
                <label key={d} className="font-semibold">Ø{d} max (m)
                  <input className={inp} type="number" min={1} value={plan.limits.maxLen[d]} onChange={(e) => setLimit({ maxLen: { ...plan.limits.maxLen, [d]: Number(e.target.value) } })} />
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="font-semibold">Trajet caisson → bouche max (m)
                <input className={inp} type="number" min={1} value={plan.limits.maxTotal} onChange={(e) => setLimit({ maxTotal: Number(e.target.value) })} />
              </label>
              <label className="font-semibold">Vitesse d'air max (m/s)
                <input className={inp} type="number" min={1} step={0.5} value={plan.limits.vMax} onChange={(e) => setLimit({ vMax: Number(e.target.value) })} />
              </label>
              <label className="font-semibold">Coude = n × Ø
                <input className={inp} type="number" min={0} value={plan.limits.bendK} onChange={(e) => setLimit({ bendK: Number(e.target.value) })} />
              </label>
              <label className="font-semibold">Facteur gaine souple
                <input className={inp} type="number" min={1} step={0.1} value={plan.limits.flexFactor} onChange={(e) => setLimit({ flexFactor: Number(e.target.value) })} />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
