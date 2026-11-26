import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { PLAQUE_INFO, ROOM_TYPES } from "../data/catalogs";
import { useStore } from "../store";
import type { Floor, Opening, Partition, PlaqueType, Pt, Room, RoomType, SolType } from "../types";
import { analyzeFloorPlan } from "../utils/analyzePlan";
import { fmtD } from "../utils/format";
import { orthogonalize, pointsForRoom, setEdgeLength, syncFromPoints } from "../utils/geometry";
import { uid } from "../utils/id";
import { labelDetectedRooms, makeFloor, makeRoom, parseRoomText } from "../utils/rooms";
import { roomMaterials } from "../utils/calc";
import { POSTS } from "../data/catalogs";
import { roomEdges, roomSurfaces } from "../utils/surfaces";
import { StairsPanel } from "./StairsPanel";
import { PlacoAuditCard } from "./PlacoAuditCard";
import { alignFloor, insertVertex, removeFlatVertices, removeVertexRemap, sharedWalls, wallInsulated, withAdjacencyFloor } from "../utils/adjacency";
import { isWallOpening, OPENING_NAMES, OPENING_PRESET, OPENING_TYPES, placeOpenings, planEdges } from "../utils/openings";
import { PlanCanvas, type PlanTool } from "./PlanCanvas";
import { Btn, Card, Field, H, Input, Num, Select, TableWrap, Td, Th, Toggle } from "./ui";

export function Plans() {
  const { project, addFloor, updateFloor, removeFloor, addRoom, updateRoom, removeRoom, addPartition, updatePartition, removePartition } =
    useStore();
  const [floorId, setFloorId] = useState(project.floors[0]?.id ?? "");
  const floor = project.floors.find((f) => f.id === floorId) ?? project.floors[0];
  const [sel, setSel] = useState<{ kind: "room" | "part"; id: string } | null>(null);
  const [hoverEdge, setHoverEdge] = useState<number | null>(null);
  const [selOpening, setSelOpening] = useState<string | null>(null);
  const [selStair, setSelStair] = useState<string | null>(null);
  const [tool, setTool] = useState<PlanTool>("select");
  const [text, setText] = useState("Salon 6.2x4.8, Cuisine 4.2x3.4, Chambre 4x3.5, SDB 3.2x2.4");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [opacity, setOpacity] = useState(55);

  useEffect(() => {
    if (!project.floors.some((f) => f.id === floorId) && project.floors[0]) setFloorId(project.floors[0].id);
  }, [project.floors, floorId]);

  // Les ouvertures encore « automatiques » de la pièce sélectionnée sont fixées à leur position affichée :
  // ce que tu vois sur le plan est exactement ce que montrent les vues 3D de tous les postes.
  const selRoomId = sel?.kind === "room" ? sel.id : "";
  useEffect(() => {
    if (!selRoomId) return;
    const f = project.floors.find((x) => x.id === floorId);
    const r = f?.rooms.find((x) => x.id === selRoomId);
    if (!f || !r) return;
    const auto = placeOpenings(r, f.planScale || 40).filter((p) => p.auto);
    if (!auto.length) return;
    const byId = new Map(auto.map((p) => [p.o.id, p]));
    updateRoom(f.id, r.id, { openings: r.openings.map((o) => (byId.has(o.id) ? { ...o, edge: byId.get(o.id)!.edge, t: byId.get(o.id)!.t } : o)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selRoomId, floorId]);

  // Alignement des coins et détection des cloisons : appelé après chaque modification du plan.
  const floorRef = useRef(floor);
  floorRef.current = floor;
  const settle = () => {
    const f = floorRef.current;
    if (!f) return;
    // on part toujours de l'état le plus récent du projet, et une erreur de données ne doit jamais bloquer la page
    updateFloor(f.id, (cur) => {
      try {
        const next = withAdjacencyFloor(cur);
        return next === cur ? cur : { ...cur, rooms: next.rooms };
      } catch {
        return cur;
      }
    });
  };
  const settled = useRef("");
  useEffect(() => {
    if (!floor || settled.current === floor.id) return;
    settled.current = floor.id;
    settle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorId]);

  if (!floor) {
    return (
      <div>
        <H kicker="Plans" title="Aucun étage" />
        <Btn
          onClick={() => {
            const f = makeFloor("Rez-de-chaussée", 0);
            addFloor(f);
            setFloorId(f.id);
          }}
        >
          <Plus size={16} /> Créer un étage
        </Btn>
      </div>
    );
  }

  const scale = floor.planScale || 40;
  const room = sel?.kind === "room" ? floor.rooms.find((r) => r.id === sel.id) : undefined;
  const part = sel?.kind === "part" ? floor.partitions.find((p) => p.id === sel.id) : undefined;

  const applyScale = (px: number, meters: number) => {
    if (meters <= 0 || px <= 0) return;
    const next = px / meters;
    updateFloor(floor.id, (f) => ({
      ...f,
      planScale: next,
      rooms: f.rooms.map((r) => syncFromPoints(r, pointsForRoom(r, f.planScale || next), next)),
    }));
    setMsg(`Échelle : ${fmtD(next, 1)} px/m — toutes les cotes sont recalculées.`);
    setTool("select");
  };

  const runAnalyze = async (src: string, replace: boolean) => {
    setBusy(true);
    setMsg("Analyse du plan… détection des pièces.");
    try {
      const res = await analyzeFloorPlan(src);
      updateFloor(floor.id, (f) => {
        const sc = f.planScale || 40;
        const raw = res.rooms.map((d) => {
          const r = makeRoom(f.id, "Pièce", "autre", { height: f.height, points: d.points });
          return syncFromPoints(r, d.points, sc);
        });
        const labels = labelDetectedRooms(
          raw.map((r) => ({ area: r.areaM2 || r.length * r.width, length: r.length, width: r.width })),
        );
        const detected = raw.map((r, i) =>
          makeRoom(f.id, labels[i].name, labels[i].type, {
            color: labels[i].color,
            points: r.points,
            height: f.height,
            x: r.x,
            y: r.y,
            length: r.length,
            width: r.width,
            areaM2: r.areaM2,
            perimeterM: r.perimeterM,
            exteriorWallLength: Math.round((r.perimeterM || 2 * (r.length + r.width)) * 0.45 * 10) / 10,
          }),
        ).map((r, i) => syncFromPoints(r, raw[i].points, sc));
        return {
          ...f,
          planImage: src,
          planWidth: res.width,
          planHeight: res.height,
          rooms: replace ? detected : [...f.rooms, ...detected],
        };
      });
      setTool("scale");
      setMsg(
        res.rooms.length
          ? `${res.rooms.length} pièce(s) lues sur le plan et créées. Cliquez deux points d'une cote du plan (ex. 4,52 m) pour caler l'échelle.`
          : "Aucune pièce fermée détectée — tracez les formes, puis indiquez une cote.",
      );
    } catch {
      setMsg("Impossible d'analyser cette image. Tracez les pièces manuellement.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <H
        kicker="Calepinage"
        title="Plans & pièces"
        sub="Importez le plan : les pièces sont détectées automatiquement. Caler une cote (deux clics + longueur réelle) met tout à l'échelle. Tracez des polygones pour les formes irrégulières, déplacez les sommets, cliquez une arête pour saisir sa longueur."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {project.floors.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setFloorId(f.id);
              setSel(null);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${f.id === floor.id ? "bg-ink text-paper" : "border border-rule bg-white/50"}`}
          >
            {f.name}
          </button>
        ))}
        <Btn
          variant="ghost"
          onClick={() => {
            const f = makeFloor(project.floors.length === 1 ? "Étage" : `Niveau ${project.floors.length}`, project.floors.length);
            addFloor(f);
            setFloorId(f.id);
          }}
        >
          <Plus size={14} /> Étage
        </Btn>
      </div>

      {project.floors.length > 1 && <FloorAlign floors={project.floors} floorId={floor.id} onPatch={(patch) => updateFloor(floor.id, patch)} />}

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {floor.rooms.length > 0 && (
                <Btn
                  variant="ghost"
                  onClick={() => {
                    updateFloor(floor.id, (f) => ({
                      ...f,
                      rooms: f.rooms.map((r) => {
                        const pts = orthogonalize(pointsForRoom(r, f.planScale || 40));
                        return syncFromPoints(r, pts, f.planScale || 40);
                      }),
                    }));
                    setMsg("Murs alignés à 90°.");
                  }}
                >
                  Aligner 90°
                </Btn>
              )}
              {msg && <span className="text-sm font-semibold text-forest">{msg}</span>}
            </div>
            <PlanCanvas
              floor={floor}
              tool={tool}
              setTool={setTool}
              sel={sel}
              setSel={setSel}
              hoveredEdge={sel?.kind === "room" ? hoverEdge : null}
              selOpening={selOpening}
              setSelOpening={setSelOpening}
              selStair={selStair}
              setSelStair={setSelStair}
              onSettle={settle}
              onRemovePoint={(roomId, index) => {
                const r = floor.rooms.find((x) => x.id === roomId);
                if (r) updateRoom(floor.id, roomId, removeVertexRemap(r, index, scale));
              }}
              onInsertPoint={(roomId, edge, pt) => {
                const r = floor.rooms.find((x) => x.id === roomId);
                if (r) updateRoom(floor.id, roomId, insertVertex(r, edge, pt, scale));
                window.setTimeout(settle, 80);
              }}
              onMoveStair={(id, dx, dy) => updateFloor(floor.id, (f) => ({ ...f, stairs: (f.stairs ?? []).map((st) => (st.id === id ? { ...st, x: st.x + dx, y: st.y + dy } : st)) }))}
              onMoveOpening={(roomId, openingId, edge, t) => {
                const r = floor.rooms.find((x) => x.id === roomId);
                if (!r) return;
                updateRoom(floor.id, roomId, { openings: r.openings.map((o) => (o.id === openingId ? { ...o, edge, t } : o)) });
              }}
              busy={busy}
              opacity={opacity}
              setOpacity={setOpacity}
              onImport={(src) => {
                const replace = floor.rooms.length ? confirm("Remplacer les pièces actuelles par celles lues sur le plan ?") : true;
                void runAnalyze(src, replace);
              }}
              onReanalyze={() => void runAnalyze(floor.planImage, true)}
              onCreate={(pts) => {
                const r = makeRoom(floor.id, `Pièce ${floor.rooms.length + 1}`, "autre", {
                  height: floor.height,
                  points: pts,
                });
                const synced = syncFromPoints(r, pts, scale);
                addRoom(floor.id, synced);
                setSel({ kind: "room", id: synced.id });
                setTool("select");
              }}
              onPatch={(id, pts) => {
                const r = floor.rooms.find((x) => x.id === id);
                if (!r) return;
                updateRoom(floor.id, id, syncFromPoints(r, pts, scale));
              }}
              onScale={applyScale}
            />
            <p className="mt-2 text-[11px] leading-relaxed text-stone-500">
              Importez le plan : les pièces sont lues et créées. Puis cliquez deux points d'une cote du dessin et saisissez la longueur réelle.
            </p>
          </div>

          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">Créer depuis un texte</h2>
              <Btn
                variant="forest"
                onClick={() => {
                  const rooms = parseRoomText(text, floor.id, floor.height);
                  rooms.forEach((r) => addRoom(floor.id, r));
                  setMsg(`${rooms.length} pièce(s) ajoutée(s)`);
                }}
              >
                <Wand2 size={14} /> Analyser le texte
              </Btn>
            </div>
            <Input value={text} onChange={(e) => setText(e.target.value)} />
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Pièces de {floor.name}</h2>
              <Btn
                onClick={() => {
                  const r = makeRoom(floor.id, `Pièce ${floor.rooms.length + 1}`, "autre", { height: floor.height });
                  addRoom(floor.id, r);
                  setSel({ kind: "room", id: r.id });
                }}
              >
                <Plus size={14} /> Pièce
              </Btn>
            </div>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Nom</Th>
                  <Th>Type</Th>
                  <Th>Emprise</Th>
                  <Th>Sol</Th>
                  <Th>Périmètre</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {floor.rooms.map((r) => {
                  const s = roomSurfaces(r);
                  return (
                    <tr
                      key={r.id}
                      className={`cursor-pointer hover:bg-paper-2 ${sel?.id === r.id ? "bg-paper-2" : ""}`}
                      onClick={() => setSel({ kind: "room", id: r.id })}
                    >
                      <Td>
                        <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
                        {r.name}
                      </Td>
                      <Td>{ROOM_TYPES.find((t) => t.id === r.type)?.label}</Td>
                      <Td className="font-mono text-xs">
                        {fmtD(r.length, 2)} × {fmtD(r.width, 2)} m
                      </Td>
                      <Td>{fmtD(s.floor, 1)} m²</Td>
                      <Td>{fmtD(s.perimeter, 1)} ml</Td>
                      <Td>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRoom(floor.id, r.id);
                            if (sel?.id === r.id) setSel(null);
                          }}
                        >
                          <Trash2 size={14} className="text-stone-400 hover:text-red-700" />
                        </button>
                      </Td>
                    </tr>
                  );
                })}
                {floor.rooms.length === 0 && (
                  <tr>
                    <Td colSpan={6} className="text-stone-400">
                      Importez un plan ou tracez une pièce.
                    </Td>
                  </tr>
                )}
              </tbody>
            </TableWrap>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Cloisons</h2>
              <Btn
                variant="forest"
                onClick={() => {
                  const p: Partition = {
                    id: uid(),
                    floorId: floor.id,
                    name: `Cloison ${floor.partitions.length + 1}`,
                    length: 3,
                    height: floor.height,
                    thickness: 70,
                    type: "phonique",
                    insulated: true,
                    roomAId: floor.rooms[0]?.id ?? "",
                    roomBId: floor.rooms[1]?.id ?? "",
                    doorCount: 1,
                    doorWidth: 0.83,
                  };
                  addPartition(floor.id, p);
                  setSel({ kind: "part", id: p.id });
                }}
              >
                <Plus size={14} /> Cloison
              </Btn>
            </div>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Nom</Th>
                  <Th>Longueur</Th>
                  <Th>Épaisseur</Th>
                  <Th>Type</Th>
                  <Th>Portes</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {floor.partitions.map((p) => (
                  <tr
                    key={p.id}
                    className={`cursor-pointer hover:bg-paper-2 ${sel?.id === p.id ? "bg-green-50" : ""}`}
                    onClick={() => setSel({ kind: "part", id: p.id })}
                  >
                    <Td>{p.name}</Td>
                    <Td>{fmtD(p.length, 2)} m</Td>
                    <Td>{p.thickness} mm</Td>
                    <Td>{p.type}</Td>
                    <Td>
                      {p.doorCount} × {fmtD(p.doorWidth, 2)} m
                    </Td>
                    <Td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removePartition(floor.id, p.id);
                        }}
                      >
                        <Trash2 size={14} className="text-stone-400 hover:text-red-700" />
                      </button>
                    </Td>
                  </tr>
                ))}
                {floor.partitions.length === 0 && (
                  <tr>
                    <Td colSpan={6} className="text-stone-400">
                      Ajoutez les cloisons (placo, isolant, portes).
                    </Td>
                  </tr>
                )}
              </tbody>
            </TableWrap>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
          <Card>
            <h2 className="font-display mb-3 text-lg font-bold">Étage</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nom">
                <Input value={floor.name} onChange={(e) => updateFloor(floor.id, { name: e.target.value })} />
              </Field>
              <Field label="Hauteur sous plafond">
                <Num value={floor.height} onChange={(n) => updateFloor(floor.id, { height: n })} suffix="m" />
              </Field>
            </div>
            {project.floors.length > 1 && (
              <Btn
                variant="ghost"
                className="mt-3 text-red-700"
                onClick={() => {
                  if (confirm("Supprimer cet étage ?")) removeFloor(floor.id);
                }}
              >
                <Trash2 size={14} /> Supprimer
              </Btn>
            )}
          </Card>

          {floor.rooms.length > 1 && (
            <Card>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold">Cloisons entre les pièces</h2>
                <button
                  className="rounded-lg border border-rule bg-white px-2.5 py-1 text-xs font-semibold hover:bg-paper-2"
                  title="Supprime les points posés au milieu d'un mur droit (angle plat), sans changer la forme des pièces."
                  onClick={() => updateFloor(floor.id, (cur) => { try { return { ...cur, rooms: removeFlatVertices(cur).rooms }; } catch { return cur; } })}
                >
                  Nettoyer les points inutiles
                </button>
              </div>
              <p className="mb-2 text-xs text-stone-500">
                Quand deux pièces se touchent, le site compte une cloison : ossature une seule fois, plaques sur chaque face et isolant de cloison (décoche « isolée » pour ne pas en mettre). Coche « passage » là où il n'y a pas de mur. Les couches de chaque mur sont dessinées sur le plan.
              </p>
              {sharedWalls(floor).length === 0 && <p className="text-xs text-stone-400">Aucune pièce ne se touche sur ce plan pour l'instant.</p>}
              {sharedWalls(floor).length > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <button
                    className="rounded-lg border border-rule bg-white px-2.5 py-1 text-xs font-semibold hover:bg-paper-2"
                    title="Ajoute un point sur le mur d'une pièce là où commence le mur d'une voisine. À utiliser seulement si tu veux des murs avec les mêmes extrémités."
                    onClick={() => updateFloor(floor.id, (cur) => { try { return { ...cur, rooms: withAdjacencyFloor(alignFloor(cur)).rooms }; } catch { return cur; } })}
                  >
                    Aligner les extrémités des murs (ajoute des points)
                  </button>
                  <span className="text-[11px] text-stone-400">Aucun point n'est ajouté tout seul.</span>
                </div>
              )}
              <div className="space-y-1">
                {sharedWalls(floor).map((w) => {
                  const A = floor.rooms.find((r) => r.id === w.roomAId);
                  const B = floor.rooms.find((r) => r.id === w.roomBId);
                  if (!A || !B) return null;
                  return (
                    <div key={`${w.roomAId}-${w.edgeA}-${w.roomBId}-${w.edgeB}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-white/70 px-2 py-1.5 text-xs">
                      <label className="flex items-center gap-1 font-semibold"><input
                        type="checkbox"
                        checked={w.passage}
                        onChange={(e) => {
                          const flip = (r: Room, edge: number): Room => {
                            const wt = { ...(r.wallTypes ?? {}) } as Record<string, string>;
                            if (e.target.checked) wt[String(edge)] = "none";
                            else delete wt[String(edge)];
                            return { ...r, wallTypes: wt as Room["wallTypes"] };
                          };
                          updateFloor(floor.id, { rooms: floor.rooms.map((r) => (r.id === A.id ? flip(r, w.edgeA) : r.id === B.id ? flip(r, w.edgeB) : r)) });
                        }}
                      />
                      passage</label>
                      <span className="font-semibold">{A.name} ⟷ {B.name}</span>
                      <span className="text-stone-500">{w.lengthM.toFixed(2).replace(".", ",")} m</span>
                      <span className={`ml-auto rounded px-1.5 py-0.5 font-semibold ${w.passage ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-600"}`}>{w.passage ? "passage" : "cloison"}</span>
                      {!w.passage && (
                        <label className="flex items-center gap-1 rounded border border-rule bg-white px-1.5 py-0.5">
                          <input
                            type="checkbox"
                            checked={wallInsulated(floor, w)}
                            onChange={(e) => {
                              const set = (r: Room, edge: number): Room => {
                                const wi = { ...(r.wallInsul ?? {}) };
                                if (e.target.checked) delete wi[String(edge)];
                                else wi[String(edge)] = false;
                                return { ...r, wallInsul: wi };
                              };
                              updateFloor(floor.id, { rooms: floor.rooms.map((r) => (r.id === A.id ? set(r, w.edgeA) : r.id === B.id ? set(r, w.edgeB) : r)) });
                            }}
                          />
                          isolée
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <PlacoAuditCard />

          <StairsPanel floor={floor} selStair={selStair} setSelStair={setSelStair} onChange={(stairs) => updateFloor(floor.id, { stairs })} />

          {room && (
            <RoomEditor
              room={room}
              scale={scale}
              selOpening={selOpening}
              setSelOpening={setSelOpening}
              onHoverEdge={setHoverEdge}
              onChange={(patch) => updateRoom(floor.id, room.id, patch)}
              onPoints={(pts) => updateRoom(floor.id, room.id, syncFromPoints(room, pts, scale))}
              onRemove={() => {
                removeRoom(floor.id, room.id);
                setSel(null);
              }}
            />
          )}
          {part && (
            <PartEditor
              part={part}
              rooms={floor.rooms}
              onChange={(patch) => updatePartition(floor.id, part.id, patch)}
              onRemove={() => {
                removePartition(floor.id, part.id);
                setSel(null);
              }}
            />
          )}
          {!room && !part && (
            <Card>
              <p className="text-sm text-stone-500">Sélectionnez une pièce colorée pour éditer ses cotes, sommets et finitions.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function RoomEditor({
  room,
  scale,
  selOpening,
  setSelOpening,
  onHoverEdge,
  onChange,
  onPoints,
  onRemove,
}: {
  room: Room;
  scale: number;
  selOpening: string | null;
  setSelOpening: (id: string | null) => void;
  onHoverEdge: (i: number | null) => void;
  onChange: (p: Partial<Room>) => void;
  onPoints: (pts: Pt[]) => void;
  onRemove: () => void;
}) {
  const { project } = useStore();
  const globalJoint = project.settings.carrelage.jointMm;
  const s = roomSurfaces(room);
  const pts = pointsForRoom(room, scale);
  const edges = roomEdges(room, scale);
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Pièce</h2>
        <input type="color" value={room.color} onChange={(e) => onChange({ color: e.target.value })} className="h-8 w-8 cursor-pointer rounded" />
      </div>
      <div className="space-y-3">
        <Field label="Nom">
          <Input value={room.name} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <Field label="Type">
          <Select
            value={room.type}
            onChange={(e) => {
              const type = e.target.value as RoomType;
              const meta = ROOM_TYPES.find((t) => t.id === type);
              onChange({
                type,
                placoType: meta?.hydro ? "hydro" : room.placoType,
                tileFloor: meta?.defaultTile ?? room.tileFloor,
                tileWalls: type === "sdb" || type === "sde",
                floorHeating: meta?.defaultHeating ?? room.floorHeating,
                solType: (meta?.defaultTile ? "carrelage" : room.solType) as SolType,
              });
            }}
          >
            {ROOM_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="rounded-xl bg-paper-2 p-3 font-mono text-xs text-stone-600">
          Sol {fmtD(s.floor, 2)} m² · Périmètre {fmtD(s.perimeter, 2)} m · Murs {fmtD(s.wallsNet, 2)} m² · {pts.length} sommets
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Emprise L">
            <Num value={room.length} onChange={(n) => onChange({ length: n })} suffix="m" />
          </Field>
          <Field label="Emprise l">
            <Num value={room.width} onChange={(n) => onChange({ width: n })} suffix="m" />
          </Field>
          <Field label="Hauteur">
            <Num value={room.height} onChange={(n) => onChange({ height: n })} suffix="m" />
          </Field>
          <Field label="Murs extérieurs">
            <Num value={room.exteriorWallLength} onChange={(n) => onChange({ exteriorWallLength: n })} suffix="ml" />
          </Field>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Parois : placo & isolation</span>
            <button
              type="button"
              className="ml-auto rounded-lg border border-rule bg-white px-2 py-1 text-[11px] font-semibold hover:bg-paper-2"
              title="Tous les murs extérieurs de cette pièce en brique brute : ni isolant, ni placo (garage, local brut). Le plafond se règle à part."
              onClick={() => {
                const ws: Record<string, "ossature" | "nu"> = { ...(room.wallStruct ?? {}) };
                roomEdges(room, scale).forEach((e) => { if (e.exterior) ws[String(e.index)] = "nu"; });
                onChange({ wallStruct: ws });
              }}
            >
              Garage : murs bruts
            </button>
          </div>
          <p className="mb-2 rounded-lg bg-paper-2 px-2 py-1.5 text-[11px] leading-relaxed text-stone-500">
            Les numéros <strong>P1, P2…</strong> sont affichés sur le plan quand la pièce est sélectionnée. Survolez une
            paroi ci-dessous : elle s'illumine en jaune sur le plan.
          </p>
          <div className="space-y-2">
            {edges.map((e) => {
              const setExterior = (ext: boolean) => {
                const next = new Set(room.exteriorEdges ?? []);
                // Si rien n'était coché, l'app devinait : on fige d'abord l'état deviné.
                if ((room.exteriorEdges ?? []).length === 0) {
                  edges.forEach((x) => {
                    if (x.exterior) next.add(x.index);
                  });
                }
                if (ext) next.add(e.index);
                else next.delete(e.index);
                const list = [...next];
                const total = edges.filter((x) => list.includes(x.index)).reduce((s, x) => s + x.lengthM, 0);
                onChange({ exteriorEdges: list, exteriorWallLength: Math.round(total * 10) / 10, extLocked: true, extAuto: false });
              };
              return (
                <div
                  key={e.index}
                  onMouseEnter={() => onHoverEdge(e.index)}
                  onMouseLeave={() => onHoverEdge(null)}
                  className="rounded-lg border border-rule bg-white/70 p-2 transition hover:border-gold hover:bg-amber-50/40"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-7 shrink-0 items-center justify-center rounded bg-ink font-mono text-[10px] font-bold text-white">
                      P{e.index + 1}
                    </span>
                    <Num
                      value={Math.round(e.lengthM * 100) / 100}
                      onChange={(n) => onPoints(setEdgeLength(pts, e.index, n * scale))}
                      suffix="m"
                      step={0.01}
                    />
                    <span className="text-[10px] text-stone-400">{fmtD(e.lengthM * room.height, 1)} m²</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <Select
                      value={room.wallTypes?.[String(e.index)] ?? ""}
                      onChange={(ev) => {
                        const v = ev.target.value;
                        const next = { ...room.wallTypes };
                        if (v === "") delete next[String(e.index)];
                        else next[String(e.index)] = v as PlaqueType | "none";
                        onChange({ wallTypes: next });
                      }}
                    >
                      <option value="">Plaque : {PLAQUE_INFO[room.placoType].label} (défaut)</option>
                      <option value="ba13">BA13 standard</option>
                      <option value="hydro">Hydro (pièce humide)</option>
                      <option value="phonique">Phonique</option>
                      <option value="feu">Feu</option>
                      <option value="ba15">BA15</option>
                      <option value="haute_durete">Haute dureté</option>
                      <option value="none">Aucun placo — passage</option>
                    </Select>
                    <div className="flex overflow-hidden rounded-lg border border-rule text-[11px] font-semibold">
                      <button
                        onClick={() => setExterior(false)}
                        title="Cloison intérieure : pas d'isolant ni de doublage sur cette paroi"
                        className={`flex-1 px-1 py-1 transition ${
                          !e.exterior ? "bg-ink text-white" : "bg-white text-stone-400 hover:bg-paper-2"
                        }`}
                      >
                        Intérieur
                      </button>
                      <button
                        onClick={() => setExterior(true)}
                        title="Mur extérieur : recevra l'isolant et le doublage placo"
                        className={`flex-1 px-1 py-1 transition ${
                          e.exterior ? "bg-forest text-white" : "bg-white text-stone-400 hover:bg-paper-2"
                        }`}
                      >
                        Extérieur
                      </button>
                    </div>
                  </div>
                  {e.exterior && (
                    <label className="mt-1.5 block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                      Structure du mur extérieur
                      <select
                        className="mt-0.5 w-full rounded-lg border border-rule bg-white px-2 py-1.5 text-xs normal-case"
                        value={room.wallStruct?.[String(e.index)] ?? "brique"}
                        onChange={(ev) => {
                          const ws = { ...(room.wallStruct ?? {}) };
                          if (ev.target.value === "brique") delete ws[String(e.index)];
                          else ws[String(e.index)] = ev.target.value as "ossature" | "nu";
                          onChange({ wallStruct: ws });
                        }}
                      >
                        <option value="brique">Brique + isolant + placo</option>
                        <option value="ossature">Isolant + placo, sans brique (ossature)</option>
                        <option value="nu">Brique brute : ni isolant ni placo (garage)</option>
                      </select>
                    </label>
                  )}
                  {e.passage && (
                    <p className="mt-1 text-[10px] font-semibold text-amber-700">
                      Passage ouvert : exclu des plaques, bandes, enduits et isolant.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-stone-500">
            <strong>Extérieur</strong> (vert) = mur donnant dehors : compté pour l'isolant + le doublage.{" "}
            <strong>Intérieur</strong> = cloison vers une autre pièce. <strong>Aucun placo — passage</strong> = ouverture
            (cuisine ouverte…) : exclue de tous les calculs de cette paroi.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Toggle value={room.placoWalls} onChange={(v) => onChange({ placoWalls: v })} label="Placo murs" />
          <Toggle value={room.placoCeiling} onChange={(v) => onChange({ placoCeiling: v })} label="Placo plafond" />
          <Toggle value={room.paintWalls} onChange={(v) => onChange({ paintWalls: v })} label="Peinture murs" />
          <Toggle value={room.paintCeiling} onChange={(v) => onChange({ paintCeiling: v })} label="Peinture plafond" />
          <Toggle value={room.paintFloor} onChange={(v) => onChange({ paintFloor: v })} label="Peinture sol" />
          <Toggle value={room.tileFloor} onChange={(v) => onChange({ tileFloor: v })} label="Carrelage sol" />
          <Toggle value={room.tileWalls} onChange={(v) => onChange({ tileWalls: v })} label="Faïence murs" />
          <Toggle value={room.floorHeating} onChange={(v) => onChange({ floorHeating: v })} label="Plancher chauffant" />
        </div>
        <div className="rounded-xl border border-rule bg-paper p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Appareillage connecté
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Prises connectées">
              <Num
                value={room.elec.prisesConnectees ?? 0}
                onChange={(n) =>
                  onChange({
                    elec: {
                      ...room.elec,
                      prisesConnectees: Math.max(0, Math.round(n)),
                      prisesConnected: (room.elec.prisesConnectees ?? 0) > 0 || n > 0,
                    },
                  })
                }
                step={1}
              />
            </Field>
            <Field label="Inter. connectés">
              <Num
                value={room.elec.intersConnectes ?? 0}
                onChange={(n) =>
                  onChange({
                    elec: {
                      ...room.elec,
                      intersConnectes: Math.max(0, Math.round(n)),
                      interConnected: (room.elec.intersConnectes ?? 0) > 0 || n > 0,
                    },
                  })
                }
                step={1}
              />
            </Field>
            <Field label="DCL connectées">
              <Num
                value={room.elec.dclConnectes ?? 0}
                onChange={(n) => onChange({ elec: { ...room.elec, dclConnectes: Math.max(0, Math.round(n)) } })}
                step={1}
              />
            </Field>
            <Field label="Spots connectés">
              <Num
                value={room.elec.spotsConnectes ?? 0}
                onChange={(n) => onChange({ elec: { ...room.elec, spotsConnectes: Math.max(0, Math.round(n)) } })}
                step={1}
              />
            </Field>
          </div>
          <p className="mt-2 text-[11px] text-stone-500">
            Saisissez 0 pour n'avoir que du classique. Ces quantités s'ajoutent aux prises et interrupteurs standards.
          </p>
        </div>
        <Field label="Type de plaque">
          <Select value={room.placoType} onChange={(e) => onChange({ placoType: e.target.value as PlaqueType })}>
            <option value="ba13">BA13 standard</option>
            <option value="hydro">Hydro</option>
            <option value="phonique">Phonique</option>
            <option value="feu">Feu</option>
            <option value="ba15">BA15</option>
            <option value="haute_durete">Haute dureté</option>
          </Select>
        </Field>
        <Field label="Sol">
          <Select value={room.solType} onChange={(e) => onChange({ solType: e.target.value as SolType })}>
            <option value="carrelage">Carrelage</option>
            <option value="parquet">Parquet</option>
            <option value="souple">Sol souple</option>
            <option value="resine">Résine</option>
            <option value="aucun">Aucun</option>
          </Select>
        </Field>
        {room.tileWalls && (
          <Field label="Hauteur faïence">
            <Num value={room.tileWallHeight} onChange={(n) => onChange({ tileWallHeight: n })} suffix="m" />
          </Field>
        )}
        {(room.tileFloor || room.tileWalls) && (
          <Field label="Joints de carrelage de cette pièce">
            <div className="flex items-center gap-2">
              <Num value={room.jointMm ?? 0} onChange={(n) => onChange({ jointMm: Math.max(0, n) })} step={0.5} suffix="mm" />
              <span className="text-[11px] text-stone-500">0 = joint global ({globalJoint} mm)</span>
            </div>
          </Field>
        )}
        {(room.fixtures?.length ?? 0) > 0 && (
          <div className="rounded-lg border border-rule bg-white/70 p-2 text-[11px] text-stone-600">
            <div className="mb-1 font-semibold uppercase tracking-[0.12em] text-stone-500">Éléments muraux placés en 3D ({room.fixtures!.length})</div>
            {room.fixtures!.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 py-0.5">
                <span>{f.label ?? f.kind} — paroi {f.edge + 1}, à {Math.round(f.u * 100)} cm, h {Math.round(f.z * 100)} cm</span>
                <button className="text-stone-400 hover:text-red-700" onClick={() => onChange({ fixtures: room.fixtures!.filter((x) => x.id !== f.id) })}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <p className="mt-1 text-stone-500">Modifiables dans la vue 3D de chaque poste : ce sont les mêmes données.</p>
          </div>
        )}
        <OpeningsPanel room={room} scale={scale} selOpening={selOpening} setSelOpening={setSelOpening} onChange={onChange} />
        <RoomMaterialsPanel roomId={room.id} />
        <Btn variant="ghost" className="text-red-700" onClick={onRemove}>
          <Trash2 size={14} /> Supprimer la pièce
        </Btn>
      </div>
    </Card>
  );
}

/** Récapitulatif des matériaux prévus pour la pièce, groupés par poste. */
function RoomMaterialsPanel({ roomId }: { roomId: string }) {
  const { project } = useStore();
  const lines = roomMaterials(project, roomId);
  if (!lines.length) return null;
  const groups = POSTS.map((p) => ({ post: p, rows: lines.filter((l) => l.post === p.id) })).filter(
    (g) => g.rows.length,
  );
  return (
    <details className="rounded-xl border border-rule bg-paper p-3" open>
      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
        Matériaux prévus pour cette pièce ({lines.length} lignes)
      </summary>
      <div className="mt-2 space-y-3">
        {groups.map((g) => (
          <div key={g.post.id}>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold" style={{ color: g.post.color }}>
              <span className="h-2 w-2 rounded-sm" style={{ background: g.post.color }} />
              {g.post.label}
            </div>
            <ul className="space-y-0.5">
              {g.rows.map((l, i) => (
                <li key={i} className="flex items-baseline gap-2 text-xs">
                  <span className="w-20 shrink-0 text-right font-mono font-semibold text-ink">
                    {l.qty.toLocaleString("fr-FR")} {l.unit}
                  </span>
                  <span className="min-w-0 text-stone-700">
                    {l.name}
                    {l.note && <span className="text-[10px] text-stone-400"> · {l.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-stone-400">
        Quantités arrondies à l'unité d'achat, pertes incluses. Les éléments communs du chantier (tableau électrique,
        PAC, caisson VMC, cloisons…) ne sont pas ventilés par pièce.
      </p>
    </details>
  );
}

/** Portes, fenêtres et ouvertures de la pièce : position précise (paroi + distance) et déplacement sur le plan. */
function OpeningsPanel({
  room,
  scale,
  selOpening,
  setSelOpening,
  onChange,
}: {
  room: Room;
  scale: number;
  selOpening: string | null;
  setSelOpening: (id: string | null) => void;
  onChange: (p: Partial<Room>) => void;
}) {
  const [newType, setNewType] = useState<Opening["type"]>("fenetre");
  const edges = planEdges(room, scale);
  const placed = new Map(placeOpenings(room, scale).map((p) => [p.o.id, p]));
  const patch = (id: string, p: Partial<Opening>) => onChange({ openings: room.openings.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const add = () => {
    const pre = OPENING_PRESET[newType];
    const o: Opening = { id: uid(), type: newType, width: pre.width, height: Math.min(pre.height, room.height || 2.5), wall: pre.wall };
    // posée directement au milieu de la plus longue paroi adaptée, prête à être glissée sur le plan
    const cand = edges.filter((e) => (pre.wall === "exterieur" ? e.exterior : !e.exterior) && e.lenM > 0.3);
    const pool = (cand.length ? cand : edges).slice().sort((x, y) => y.lenM - x.lenM);
    if (pre.wall !== "plafond" && pool[0]) {
      o.edge = pool[0].index;
      o.t = 0.5;
    }
    onChange({ openings: [...room.openings, o] });
    setSelOpening(o.id);
  };
  return (
    <div className="rounded-xl border border-rule bg-paper p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Portes, fenêtres et ouvertures</div>
      <p className="mb-2 text-[11px] leading-relaxed text-stone-500">
        Sur le plan, la pièce étant sélectionnée, les ouvertures apparaissent en pastilles colorées sur les parois : glisse-les pour les placer. Tu peux aussi régler ici la paroi et la distance exacte. Pour ouvrir seulement une partie de cloison, ajoute une <b>ouverture libre</b> et place-la à l'endroit voulu : le reste du mur reste plein, en 3D comme dans tous les postes.
      </p>
      <div className="mb-2 flex items-center gap-1.5">
        <Select value={newType} onChange={(e) => setNewType(e.target.value as Opening["type"])}>
          {OPENING_TYPES.map((t) => (
            <option key={t} value={t}>{OPENING_NAMES[t]}</option>
          ))}
          <option value="trappe">Trappe (plafond)</option>
        </Select>
        <button className="shrink-0 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white" onClick={add}>+ Ajouter</button>
      </div>
      {room.openings.length === 0 && <p className="text-[11px] text-stone-400">Aucune ouverture dans cette pièce.</p>}
      {room.openings.map((o) => (
        <OpeningRow
          key={o.id}
          o={o}
          selected={selOpening === o.id}
          onSelect={() => setSelOpening(o.id)}
          edges={edges}
          placed={placed.get(o.id)}
          roomHeight={room.height || 2.5}
          onChange={(p) => patch(o.id, p)}
          onRemove={() => onChange({ openings: room.openings.filter((x) => x.id !== o.id) })}
        />
      ))}
    </div>
  );
}

function OpeningRow({
  o,
  selected,
  onSelect,
  edges,
  placed,
  roomHeight,
  onChange,
  onRemove,
}: {
  o: Opening;
  selected: boolean;
  onSelect: () => void;
  edges: ReturnType<typeof planEdges>;
  placed?: { edge: number; t: number; auto: boolean };
  roomHeight: number;
  onChange: (p: Partial<Opening>) => void;
  onRemove: () => void;
}) {
  const onWall = isWallOpening(o);
  const edge = placed ? edges[placed.edge] : undefined;
  const lenM = edge?.lenM ?? 0;
  const centerCm = placed && edge ? Math.round(placed.t * lenM * 100) : 0;
  const setCenterCm = (cmv: number) => {
    if (!edge || !placed) return;
    const half = o.width / 2;
    const m = Math.min(lenM - Math.min(half, lenM / 2), Math.max(Math.min(half, lenM / 2), cmv / 100));
    onChange({ edge: placed.edge, t: Math.round((m / Math.max(0.1, lenM)) * 1000) / 1000 });
  };
  const defaultSill = o.type === "fenetre" ? (o.height >= 1 ? 0.9 : 1.3) : 0;
  return (
    <div
      className={`mb-2 rounded-lg border p-2 ${selected ? "border-orange-500 bg-orange-50" : "border-rule bg-white/70"}`}
      onClick={onSelect}
    >
      <div className="grid grid-cols-[1fr_70px_70px_28px] items-end gap-1">
        <Select
          value={o.type}
          onChange={(e) => {
            const type = e.target.value as Opening["type"];
            const pre = OPENING_PRESET[type];
            onChange({ type, width: pre.width, height: Math.min(pre.height, roomHeight), wall: pre.wall, sill: undefined });
          }}
        >
          {OPENING_TYPES.map((t) => (
            <option key={t} value={t}>{OPENING_NAMES[t]}</option>
          ))}
          <option value="trappe">Trappe (plafond)</option>
        </Select>
        <Num value={o.width} onChange={(n) => onChange({ width: n })} step={0.05} />
        <Num value={o.height} onChange={(n) => onChange({ height: n })} step={0.05} />
        <button onClick={onRemove} className="pb-2 text-stone-400 hover:text-red-700">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="mt-0.5 grid grid-cols-[1fr_70px_70px_28px] gap-1 text-[9px] uppercase tracking-wide text-stone-400">
        <span>Type</span><span>Larg. (m)</span><span>Haut. (m)</span><span />
      </div>
      <Select
        value={o.wall}
        onChange={(e) => onChange({ wall: e.target.value as Opening["wall"] })}
        className="mt-1"
      >
        <option value="exterieur">Dans un mur extérieur (1 face)</option>
        <option value="cloison">Dans une cloison — compte 2 faces, à déclarer 1 seule fois</option>
        <option value="plafond">Dans le plafond (trappe)</option>
      </Select>
      {onWall && edge && placed && (
        <div className="mt-2 space-y-1.5 rounded-lg bg-paper p-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
              Paroi
              <select
                className="mt-0.5 w-full rounded-lg border border-rule bg-white px-2 py-1.5 text-sm normal-case"
                value={placed.edge}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  onChange({ edge: i, t: 0.5 });
                }}
              >
                {edges.map((x) => (
                  <option key={x.index} value={x.index}>
                    P{x.index + 1} ({fmtD(x.lenM, 2)} m){x.exterior ? " · ext." : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
              Centre à (cm du début)
              <input
                type="number"
                className="mt-0.5 w-full rounded-lg border border-rule bg-white px-2 py-1.5 text-sm"
                value={centerCm}
                onChange={(e) => setCenterCm(Number(e.target.value))}
              />
            </label>
          </div>
          <input
            type="range"
            className="w-full accent-terra"
            min={0}
            max={Math.round(lenM * 100)}
            value={centerCm}
            onChange={(e) => setCenterCm(Number(e.target.value))}
          />
          <p className="text-[10px] text-stone-500">
            Bord gauche à {Math.round(centerCm - (o.width * 100) / 2)} cm · bord droit à {Math.round(lenM * 100 - centerCm - (o.width * 100) / 2)} cm de la fin de la paroi.
            {placed.auto && " Position automatique : déplace-la ou règle-la pour la fixer."}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <button className="rounded-lg border border-rule bg-white px-2 py-1 text-[11px] font-semibold" onClick={() => setCenterCm((lenM * 100) / 2)}>Centrer</button>
            {o.edge != null && (
              <button className="rounded-lg border border-rule bg-white px-2 py-1 text-[11px] font-semibold" onClick={() => onChange({ edge: undefined, t: undefined })}>
                Remettre en automatique
              </button>
            )}
            {o.type !== "passage" && o.type !== "arche" && (
              <label className="ml-auto flex items-center gap-1 text-[11px] font-semibold">
                Allège
                <input
                  type="number"
                  step={5}
                  min={0}
                  className="w-16 rounded-lg border border-rule bg-white px-1.5 py-1 text-sm"
                  value={Math.round((o.sill ?? defaultSill) * 100)}
                  onChange={(e) => onChange({ sill: Math.max(0, Number(e.target.value)) / 100 })}
                />
                cm
              </label>
            )}
          </div>
        </div>
      )}
      {o.wall === "cloison" && (
        <p className="mt-1 text-[10px] leading-relaxed text-stone-500">
          Ne redéclarez pas cette ouverture dans la pièce voisine : les deux faces de la cloison sont déjà déduites.
        </p>
      )}
    </div>
  );
}

function PartEditor({
  part,
  rooms,
  onChange,
  onRemove,
}: {
  part: Partition;
  rooms: Room[];
  onChange: (p: Partial<Partition>) => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      <h2 className="font-display mb-3 text-lg font-bold">Cloison</h2>
      <div className="space-y-3">
        <Field label="Nom">
          <Input value={part.name} onChange={(e) => onChange({ name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Longueur">
            <Num value={part.length} onChange={(n) => onChange({ length: n })} suffix="m" />
          </Field>
          <Field label="Hauteur">
            <Num value={part.height} onChange={(n) => onChange({ height: n })} suffix="m" />
          </Field>
          <Field label="Épaisseur">
            <Select value={String(part.thickness)} onChange={(e) => onChange({ thickness: Number(e.target.value) as Partition["thickness"] })}>
              <option value="48">48 mm</option>
              <option value="70">70 mm</option>
              <option value="90">90 mm</option>
              <option value="100">100 mm</option>
              <option value="120">120 mm</option>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={part.type} onChange={(e) => onChange({ type: e.target.value as Partition["type"] })}>
              <option value="simple">Simple</option>
              <option value="hydro">Hydro</option>
              <option value="phonique">Phonique</option>
              <option value="coupe_feu">Coupe-feu</option>
              <option value="hydro_phonique">Hydro + phonique</option>
            </Select>
          </Field>
          <Field label="Nb portes">
            <Num value={part.doorCount} onChange={(n) => onChange({ doorCount: Math.max(0, Math.round(n)) })} step={1} />
          </Field>
          <Field label="Largeur porte">
            <Num value={part.doorWidth} onChange={(n) => onChange({ doorWidth: n })} suffix="m" />
          </Field>
        </div>
        <Toggle value={part.insulated} onChange={(v) => onChange({ insulated: v })} label="Isolant dans la cloison" />
        <Field label="Pièce A">
          <Select value={part.roomAId} onChange={(e) => onChange({ roomAId: e.target.value })}>
            <option value="">—</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Pièce B">
          <Select value={part.roomBId} onChange={(e) => onChange({ roomBId: e.target.value })}>
            <option value="">—</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Btn variant="ghost" className="text-red-700" onClick={onRemove}>
          <Trash2 size={14} /> Supprimer
        </Btn>
      </div>
    </Card>
  );
}

/** Emprise (m) de toutes les pièces d'un étage, dans le repère de son plan. */
function floorBox(f: Floor) {
  const sc = f.planScale || 40;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const r of f.rooms)
    for (const p of pointsForRoom(r, sc)) {
      xs.push(p.x / sc);
      ys.push(p.y / sc);
    }
  if (!xs.length) return null;
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function FloorAlign({ floors, floorId, onPatch }: { floors: Floor[]; floorId: string; onPatch: (p: Partial<Floor>) => void }) {
  const f = floors.find((x) => x.id === floorId)!;
  const ref = [...floors].sort((a, b) => a.level - b.level)[0];
  const isRef = ref.id === f.id;
  const ox = f.offsetX ?? 0;
  const oy = f.offsetY ?? 0;
  const align = (mode: "corner" | "center") => {
    const a = floorBox(f);
    const b = floorBox(ref);
    if (!a || !b) return;
    const bx = b.x0 + (ref.offsetX ?? 0);
    const by = b.y0 + (ref.offsetY ?? 0);
    if (mode === "corner") onPatch({ offsetX: Math.round((bx - a.x0) * 100) / 100, offsetY: Math.round((by - a.y0) * 100) / 100 });
    else
      onPatch({
        offsetX: Math.round((bx + (b.x1 - b.x0) / 2 - (a.x0 + (a.x1 - a.x0) / 2)) * 100) / 100,
        offsetY: Math.round((by + (b.y1 - b.y0) / 2 - (a.y0 + (a.y1 - a.y0) / 2)) * 100) / 100,
      });
  };
  return (
    <div className="mb-4 rounded-xl border border-rule bg-white/70 p-3">
      <div className="mb-1 text-sm font-semibold">Superposition des étages (vue 3D)</div>
      {isRef ? (
        <p className="text-xs text-stone-500">
          « {f.name} » sert de référence : les autres étages se calent dessus. Choisis un autre étage pour régler sa position.
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-stone-500">
            Chaque plan a sa propre origine : si « {f.name} » n'est pas exactement au-dessus de « {ref.name} » dans la vue 3D, cale-le ici (cm). Les pièces, portes, appareillages et gaines de cet étage suivent.
          </p>
          <div className="flex flex-wrap items-end gap-2 text-xs">
            <label className="font-semibold">
              Décalage X (cm)
              <input className="ml-1 w-20 rounded-lg border border-black/15 bg-white px-2 py-1 text-sm" type="number" step={1} value={Math.round(ox * 100)} onChange={(e) => onPatch({ offsetX: Number(e.target.value) / 100 })} />
            </label>
            <label className="font-semibold">
              Décalage Y (cm)
              <input className="ml-1 w-20 rounded-lg border border-black/15 bg-white px-2 py-1 text-sm" type="number" step={1} value={Math.round(oy * 100)} onChange={(e) => onPatch({ offsetY: Number(e.target.value) / 100 })} />
            </label>
            <Btn variant="ghost" onClick={() => align("corner")}>Aligner le coin haut-gauche</Btn>
            <Btn variant="ghost" onClick={() => align("center")}>Aligner les centres</Btn>
            <Btn variant="ghost" onClick={() => onPatch({ offsetX: 0, offsetY: 0 })}>Remettre à 0</Btn>
          </div>
        </>
      )}
    </div>
  );
}
