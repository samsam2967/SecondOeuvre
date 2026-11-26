import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Plus, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import type { Floor, Stair } from "../types";
import { uid } from "../utils/id";
import { defaultStair, stairCheck, STAIR_KINDS, STAIR_MATERIALS } from "../utils/stairs";
import { Btn, Card, Field, Num, Select } from "./ui";

const DIRS: [string, number][] = [
  ["→ vers la droite", 0],
  ["↓ vers le bas", 90],
  ["← vers la gauche", 180],
  ["↑ vers le haut", 270],
];

/** Escaliers de l'étage : type, sens, marches, hauteur, matière, couleur, carrelage. Le résultat est visible en 3D. */
export function StairsPanel({
  floor,
  selStair,
  setSelStair,
  onChange,
}: {
  floor: Floor;
  selStair: string | null;
  setSelStair: (id: string | null) => void;
  onChange: (stairs: Stair[]) => void;
}) {
  const stairs = floor.stairs ?? [];
  const sel = stairs.find((s) => s.id === selStair) ?? null;
  const scale = floor.planScale || 40;
  const patch = (id: string, p: Partial<Stair>) => onChange(stairs.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const add = () => {
    const room = floor.rooms[0];
    const cx = room ? room.x + room.width * scale * 0.25 : floor.planWidth / 2;
    const cy = room ? room.y + room.length * scale * 0.25 : floor.planHeight / 2;
    const st = { ...defaultStair(cx, cy, floor.height + 0.3), id: uid(), name: `Escalier ${stairs.length + 1}` };
    onChange([...stairs, st]);
    setSelStair(st.id);
  };
  const move = (dx: number, dy: number) => sel && patch(sel.id, { x: sel.x + dx * scale, y: sel.y + dy * scale });
  const chk = sel ? stairCheck(sel) : null;

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Escaliers</h2>
        <Btn variant="ghost" onClick={add}>
          <Plus size={14} /> Ajouter
        </Btn>
      </div>
      {stairs.length === 0 && <p className="text-xs text-stone-500">Aucun escalier sur cet étage. Ajoute-en un, glisse-le sur le plan, puis règle-le ici : il apparaît dans toutes les vues 3D.</p>}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {stairs.map((s) => (
          <button key={s.id} onClick={() => setSelStair(s.id)} className={`rounded-full px-3 py-1 text-xs font-semibold ${s.id === selStair ? "bg-terra text-white" : "border border-rule"}`}>
            {s.name}
          </button>
        ))}
      </div>

      {sel && chk && (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom">
              <input className="w-full rounded-lg border border-rule bg-white px-2 py-2 text-sm" value={sel.name} onChange={(e) => patch(sel.id, { name: e.target.value })} />
            </Field>
            <Field label="Type d'escalier">
              <Select value={sel.kind} onChange={(e) => { const k = e.target.value as Stair["kind"]; patch(sel.id, k === "droit" ? { kind: k } : { kind: k, landing: "palier" }); }}>
                {Object.entries(STAIR_KINDS).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Sens de la montée">
              <Select value={DIRS.some(([, a]) => a === ((sel.angle % 360) + 360) % 360) ? String(((sel.angle % 360) + 360) % 360) : "custom"} onChange={(e) => e.target.value !== "custom" && patch(sel.id, { angle: Number(e.target.value) })}>
                {DIRS.map(([l, a]) => (
                  <option key={a} value={a}>{l}</option>
                ))}
                <option value="custom">Angle libre ({Math.round(sel.angle)}°)</option>
              </Select>
            </Field>
            {sel.kind !== "droit" ? (
              <Field label={sel.kind === "demi" ? "Sens du demi-tour" : "Sens du tournant"}>
                <Select value={sel.turn} onChange={(e) => patch(sel.id, { turn: e.target.value as Stair["turn"] })}>
                  <option value="droite">Vers la droite</option>
                  <option value="gauche">Vers la gauche</option>
                </Select>
              </Field>
            ) : (
              <Field label="Montée">
                <Select value={sel.landing} onChange={(e) => patch(sel.id, { landing: e.target.value as Stair["landing"] })}>
                  <option value="continu">En continu</option>
                  <option value="palier">Avec un palier</option>
                </Select>
              </Field>
            )}
          </div>
          {sel.kind !== "droit" && (
            <Field label="Palier au tournant">
              <Select value={sel.landing} onChange={(e) => patch(sel.id, { landing: e.target.value as Stair["landing"] })}>
                <option value="palier">Avec palier (plateforme plane)</option>
                <option value="continu">Sans palier (marches balancées en éventail)</option>
              </Select>
            </Field>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Tourner</span>
            <Btn variant="ghost" onClick={() => patch(sel.id, { angle: sel.angle - 90 })}><RotateCcw size={14} /> 90°</Btn>
            <Btn variant="ghost" onClick={() => patch(sel.id, { angle: sel.angle + 90 })}><RotateCw size={14} /> 90°</Btn>
            <Btn variant="ghost" onClick={() => patch(sel.id, { angle: sel.angle - 5 })}>−5°</Btn>
            <Btn variant="ghost" onClick={() => patch(sel.id, { angle: sel.angle + 5 })}>+5°</Btn>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Déplacer de 10 cm</span>
            <Btn variant="ghost" onClick={() => move(-0.1, 0)}><ArrowLeft size={14} /></Btn>
            <Btn variant="ghost" onClick={() => move(0.1, 0)}><ArrowRight size={14} /></Btn>
            <Btn variant="ghost" onClick={() => move(0, -0.1)}><ArrowUp size={14} /></Btn>
            <Btn variant="ghost" onClick={() => move(0, 0.1)}><ArrowDown size={14} /></Btn>
            <span className="text-[11px] text-stone-400">ou glisse-le directement sur le plan</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre de marches">
              <Num value={sel.steps} onChange={(n) => patch(sel.id, { steps: Math.max(3, Math.round(n)) })} step={1} />
            </Field>
            <Field label="Hauteur à monter">
              <Num value={sel.rise} onChange={(n) => patch(sel.id, { rise: Math.max(0.5, n) })} suffix="m" step={0.05} />
            </Field>
            <Field label="Largeur des marches">
              <Num value={Math.round(sel.width * 100)} onChange={(n) => patch(sel.id, { width: Math.max(50, n) / 100 })} suffix="cm" step={5} />
            </Field>
            <Field label="Profondeur (giron)">
              <Num value={Math.round(sel.tread * 100)} onChange={(n) => patch(sel.id, { tread: Math.max(15, n) / 100 })} suffix="cm" step={1} />
            </Field>
            {(sel.kind !== "droit" || sel.landing === "palier") && (
              <>
                <Field label={sel.landing === "continu" ? "Marches avant le tournant" : "Marches avant le palier"}>
                  <Num value={sel.landingAfter} onChange={(n) => patch(sel.id, { landingAfter: Math.max(1, Math.round(n)) })} step={1} />
                </Field>
                {sel.kind !== "quart" && sel.landing === "palier" && (
                  <Field label="Profondeur du palier">
                    <Num value={Math.round(sel.landingDepth * 100)} onChange={(n) => patch(sel.id, { landingDepth: Math.max(60, n) / 100 })} suffix="cm" step={5} />
                  </Field>
                )}
              </>
            )}
            {sel.kind === "demi" && (
              <Field label="Jour entre les volées">
                <Num value={Math.round(sel.gap * 100)} onChange={(n) => patch(sel.id, { gap: Math.max(2, n) / 100 })} suffix="cm" step={1} />
              </Field>
            )}
          </div>

          <div className={`rounded-lg px-3 py-2 text-xs ${chk.ok ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
            Hauteur de marche <b>{(chk.riser * 100).toFixed(1).replace(".", ",")} cm</b> · Blondel <b>{chk.blondel.toFixed(0)} cm</b> (idéal 60–64) · emprise ≈ {chk.horiz.toFixed(2).replace(".", ",")} m
            {chk.issues.map((i) => (
              <div key={i}>⚠ {i}</div>
            ))}
            {chk.ok && <div>✓ Dimensions confortables.</div>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Matière">
              <Select
                value={sel.material}
                onChange={(e) => {
                  const m = e.target.value as Stair["material"];
                  patch(sel.id, { material: m, color: STAIR_MATERIALS[m].color });
                }}
              >
                {Object.entries(STAIR_MATERIALS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Couleur">
              <input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-rule bg-white" value={sel.color} onChange={(e) => patch(sel.id, { color: e.target.value })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={sel.tiled} onChange={(e) => patch(sel.id, { tiled: e.target.checked })} /> Carrelage sur les marches
          </label>
          {sel.tiled && (
            <Field label="Couleur du carrelage">
              <input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-rule bg-white" value={sel.tileColor} onChange={(e) => patch(sel.id, { tileColor: e.target.value })} />
            </Field>
          )}

          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => {
              const c = { ...sel, id: uid(), name: sel.name + " (copie)", x: sel.x + scale * 0.5, y: sel.y + scale * 0.5 };
              onChange([...stairs, c]);
              setSelStair(c.id);
            }}>
              <Copy size={14} /> Dupliquer
            </Btn>
            <Btn variant="ghost" className="text-red-700" onClick={() => { onChange(stairs.filter((s) => s.id !== sel.id)); setSelStair(null); }}>
              <Trash2 size={14} /> Supprimer
            </Btn>
          </div>
        </div>
      )}
    </Card>
  );
}
