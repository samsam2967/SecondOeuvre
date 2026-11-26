import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker&inline";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { HelpBox } from "./HelpBox";
import { deleteInvoiceFile, downloadInvoiceFile, getSession, getSupabaseConfig, uploadInvoiceFile } from "../utils/supabase";

// Worker intégré au fichier unique (vite-plugin-singlefile) : pas de fichier externe à héberger.
pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();

const btn = "rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-black/5 disabled:opacity-40";
const btnOn = "rounded-lg border border-black bg-black px-3 py-1.5 text-xs font-semibold text-white";
const card = "rounded-xl border border-black/10 bg-white p-4";
const inp = "w-full rounded-lg border border-black/15 bg-white px-2 py-1 text-sm";

const FONTS = {
  Helvetica: { css: "Helvetica, Arial, sans-serif", std: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique] },
  Times: { css: '"Times New Roman", Times, serif', std: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic] },
  Courier: { css: '"Courier New", monospace', std: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique] },
} as const;
type FontId = keyof typeof FONTS;

interface Sig { dataUrl: string; w: number; h: number }
interface Page { w: number; h: number; url: string }
interface Item {
  id: string;
  kind: "text" | "sig";
  page: number;
  /** Coin haut-gauche, en fraction de la page. */
  x: number;
  y: number;
  text: string;
  font: FontId;
  bold: boolean;
  italic: boolean;
  size: number;
  color: string;
  sig: 0 | 1;
  /** Largeur de la signature en fraction de la largeur de page. */
  wFrac: number;
}

const SIG_KEY = "cc-signatures-v1";
const loadSigs = (): (Sig | null)[] => {
  try {
    const r = JSON.parse(localStorage.getItem(SIG_KEY) || "null");
    if (Array.isArray(r) && r.length === 2) return r;
  } catch { /* ignore */ }
  return [null, null];
};
/** Les signatures vivent dans Supabase Storage (bucket privé « factures », dossier de l'utilisateur) ; le navigateur en garde une copie. */
const sigPath = (slot: 0 | 1) => {
  const s = getSession();
  return s ? `${s.userId}/signatures/signature-${slot + 1}.png` : null;
};
const blobToSig = (b: Blob) =>
  new Promise<Sig>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const url = String(fr.result);
      const im = new Image();
      im.onload = () => res({ dataUrl: url, w: im.naturalWidth, h: im.naturalHeight });
      im.onerror = () => rej(new Error("image illisible"));
      im.src = url;
    };
    fr.onerror = () => rej(new Error("lecture impossible"));
    fr.readAsDataURL(b);
  });
type SigState = "cloud" | "local" | "saving" | "none";
const cacheSigs = (a: (Sig | null)[]) => {
  try {
    localStorage.setItem(SIG_KEY, JSON.stringify(a));
  } catch {
    /* quota */
  }
};
const rid = () => Math.random().toString(36).slice(2, 10);
const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
/** Les polices PDF standard ne gèrent que le Latin-1 + quelques symboles. */
const safe = (t: string) => t.replace(/[^\u0020-\u00FF€’‘“”–—…]/g, "?");

async function imageToPdf(file: File): Promise<Uint8Array> {
  const bmp = await createImageBitmap(file);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  const png = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(await png.arrayBuffer());
  const w = 595;
  const h = (bmp.height / bmp.width) * w;
  doc.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
  return doc.save();
}

function SignaturePad({ onSave }: { onSave: (slot: 0 | 1, s: Sig) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const down = useRef(false);
  const [color, setColor] = useState("#0b1f6b");
  const [width, setWidth] = useState(3);
  const [empty, setEmpty] = useState(true);

  const pt = (e: React.PointerEvent) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const start = (e: React.PointerEvent) => {
    const ctx = ref.current!.getContext("2d")!;
    ref.current!.setPointerCapture(e.pointerId);
    down.current = true;
    const p = pt(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y);
    ctx.stroke();
    setEmpty(false);
  };
  const move = (e: React.PointerEvent) => {
    if (!down.current) return;
    const ctx = ref.current!.getContext("2d")!;
    const p = pt(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const clear = () => {
    const c = ref.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };
  const save = (slot: 0 | 1) => {
    const c = ref.current!;
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (d[(y * c.width + x) * 4 + 3] > 10) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 < x0) return;
    const pad = 6;
    const out = document.createElement("canvas");
    out.width = x1 - x0 + 1 + pad * 2;
    out.height = y1 - y0 + 1 + pad * 2;
    out.getContext("2d")!.drawImage(c, x0 - pad, y0 - pad, out.width, out.height, 0, 0, out.width, out.height);
    onSave(slot, { dataUrl: out.toDataURL("image/png"), w: out.width, h: out.height });
    clear();
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        width={700}
        height={240}
        className="w-full touch-none rounded-lg border border-dashed border-black/30 bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => (down.current = false)}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1">Couleur
          <select className="rounded border border-black/15 px-1 py-0.5" value={color} onChange={(e) => setColor(e.target.value)}>
            <option value="#0b1f6b">Bleu stylo</option>
            <option value="#111111">Noir</option>
          </select>
        </label>
        <label className="flex items-center gap-1">Épaisseur
          <input type="range" min={1} max={8} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
        </label>
        <button className={btn} onClick={clear}>Effacer</button>
        <button className={btnOn} disabled={empty} onClick={() => save(0)}>Enregistrer comme signature 1</button>
        <button className={btnOn} disabled={empty} onClick={() => save(1)}>Enregistrer comme signature 2</button>
      </div>
    </div>
  );
}

export function InvoiceStamp() {
  const [sigs, setSigs] = useState<(Sig | null)[]>(loadSigs);
  const [pages, setPages] = useState<Page[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [tool, setTool] = useState<"text" | 0 | 1 | null>(null);
  const [zoomW, setZoomW] = useState(760);
  const [name, setName] = useState("facture");
  const [busy, setBusy] = useState("");
  const [showPad, setShowPad] = useState(false);
  const bytes = useRef<Uint8Array | null>(null);
  const grab = useRef({ dx: 0, dy: 0 });
  const [dragId, setDragId] = useState<string | null>(null);

  const sel = items.find((i) => i.id === selId);
  const patch = (id: string, p: Partial<Item>) => setItems((a) => a.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const [sigState, setSigState] = useState<SigState[]>(() => loadSigs().map((x) => (x ? "local" : "none")) as SigState[]);
  const [sigMsg, setSigMsg] = useState("");
  const sigsRef = useRef(sigs);
  sigsRef.current = sigs;
  const setSlot = (slot: 0 | 1, v: Sig | null, st: SigState) => {
    const next = [...sigsRef.current];
    next[slot] = v;
    sigsRef.current = next;
    setSigs(next);
    cacheSigs(next);
    setSigState((a) => a.map((x, i) => (i === slot ? st : x)) as SigState[]);
  };
  const pushCloud = async (slot: 0 | 1, s: Sig) => {
    const cfg = getSupabaseConfig();
    const path = sigPath(slot);
    if (!cfg || !path) return setSigState((a) => a.map((x, i) => (i === slot ? "local" : x)) as SigState[]);
    setSigState((a) => a.map((x, i) => (i === slot ? "saving" : x)) as SigState[]);
    try {
      const blob = await (await fetch(s.dataUrl)).blob();
      await uploadInvoiceFile(cfg, path, blob, "image/png");
      setSigState((a) => a.map((x, i) => (i === slot ? "cloud" : x)) as SigState[]);
      setSigMsg("");
    } catch (e) {
      setSigState((a) => a.map((x, i) => (i === slot ? "local" : x)) as SigState[]);
      setSigMsg(e instanceof Error ? e.message : "Enregistrement dans le cloud impossible.");
    }
  };
  const saveSig = (slot: 0 | 1, s: Sig) => {
    setSlot(slot, s, "saving");
    void pushCloud(slot, s);
  };
  const removeSig = async (slot: 0 | 1) => {
    setSlot(slot, null, "none");
    const cfg = getSupabaseConfig();
    const path = sigPath(slot);
    if (cfg && path) await deleteInvoiceFile(cfg, path).catch(() => undefined);
  };

  // Au chargement : on récupère les signatures du compte (le cloud fait foi) ; une copie locale non encore envoyée est envoyée.
  useEffect(() => {
    const cfg = getSupabaseConfig();
    if (!cfg || !getSession()) return;
    (async () => {
      for (const slot of [0, 1] as const) {
        const path = sigPath(slot);
        if (!path) continue;
        try {
          const s = await blobToSig(await downloadInvoiceFile(cfg, path));
          setSlot(slot, s, "cloud");
        } catch {
          const local = sigsRef.current[slot];
          if (local) void pushCloud(slot, local);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openFile = async (file: File) => {
    setBusy("Lecture du document…");
    try {
      bytes.current = file.type.startsWith("image/") ? await imageToPdf(file) : new Uint8Array(await file.arrayBuffer());
      const doc = await pdfjs.getDocument({ data: bytes.current.slice() }).promise;
      const out: Page[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const pg = await doc.getPage(n);
        const base = pg.getViewport({ scale: 1 });
        const vp = pg.getViewport({ scale: 1.6 });
        const c = document.createElement("canvas");
        c.width = vp.width;
        c.height = vp.height;
        await pg.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
        out.push({ w: base.width, h: base.height, url: c.toDataURL("image/jpeg", 0.88) });
      }
      setPages(out);
      setItems([]);
      setSelId(null);
      setName(file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      alert("Impossible de lire ce fichier : " + (e instanceof Error ? e.message : e));
    }
    setBusy("");
  };

  const place = (e: React.PointerEvent<HTMLDivElement>, pageIdx: number) => {
    if (tool === null) return setSelId(null);
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const it: Item = {
      id: rid(), kind: tool === "text" ? "text" : "sig", page: pageIdx,
      x: Math.min(0.9, fx), y: Math.min(0.95, fy),
      text: "Bon pour accord", font: "Helvetica", bold: false, italic: false, size: 12, color: "#111111",
      sig: tool === 1 ? 1 : 0, wFrac: 0.2,
    };
    setItems((a) => [...a, it]);
    setSelId(it.id);
    setTool(null);
  };

  // Déplacement : possible d'une page à l'autre (documents de plusieurs factures)
  useEffect(() => {
    if (!dragId) return;
    const move = (e: PointerEvent) => {
      const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest("[data-page]") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(0.97, (e.clientX - grab.current.dx - r.left) / r.width));
      const y = Math.max(0, Math.min(0.99, (e.clientY - grab.current.dy - r.top) / r.height));
      patch(dragId, { page: Number(el.dataset.page), x, y });
    };
    const up = () => setDragId(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragId]);

  const exportPdf = async () => {
    if (!bytes.current) return;
    setBusy("Création du PDF…");
    try {
      const pdf = await PDFDocument.load(bytes.current);
      const cache = new Map<string, Awaited<ReturnType<typeof pdf.embedFont>>>();
      const getFont = async (f: FontId, b: boolean, i: boolean) => {
        const std = FONTS[f].std[(b ? 1 : 0) + (i ? 2 : 0)];
        if (!cache.has(std)) cache.set(std, await pdf.embedFont(std));
        return cache.get(std)!;
      };
      for (const it of items) {
        const page = pdf.getPage(it.page);
        const { width, height } = page.getSize();
        if (it.kind === "text") {
          const font = await getFont(it.font, it.bold, it.italic);
          it.text.split("\n").forEach((line, k) => {
            page.drawText(safe(line), { x: it.x * width, y: height - it.y * height - it.size * (1 + k * 1.2), size: it.size, font, color: hex(it.color) });
          });
        } else {
          const s = sigs[it.sig];
          if (!s) continue;
          const img = await pdf.embedPng(s.dataUrl);
          const w = it.wFrac * width;
          const h = (w * s.h) / s.w;
          page.drawImage(img, { x: it.x * width, y: height - it.y * height - h, width: w, height: h });
        }
      }
      const out = await pdf.save();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([out as unknown as BlobPart], { type: "application/pdf" }));
      a.download = `${name}-annotee.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert("Export impossible : " + (e instanceof Error ? e.message : e));
    }
    setBusy("");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl uppercase">Annoter & signer une facture</h1>
        <p className="text-sm text-black/60">
          Ouvre un PDF ou une photo, ajoute un message et tes signatures, place-les où tu veux (sur n'importe quelle page), puis exporte un PDF.
        </p>
      </div>

      <HelpBox id="signature">
        <ol>
          <li><b>Crée tes signatures une fois pour toutes</b> : « Créer / modifier mes signatures », dessine avec la souris, le doigt ou un stylet, puis « Enregistrer comme signature 1 » (ou 2). Elles sont enregistrées sur ton compte (Supabase) et retrouvées sur tous tes appareils.</li>
          <li><b>Ouvre le document</b> : « Ouvrir un PDF / une image » (facture en PDF, photo ou scan). Toutes les pages s'affichent l'une sous l'autre ; une photo devient un PDF d'une page.</li>
          <li><b>Ajoute un message</b> : « + Message », puis clique sur la page à l'endroit voulu. Modifie le texte dans l'éditeur fixe à droite (plusieurs lignes possibles), la police, la taille, le gras, l'italique et la couleur.</li>
          <li><b>Ajoute une signature</b> : « + Signature 1 » ou « + Signature 2 », puis clique sur la page. Règle sa largeur à droite. Les deux signatures se placent indépendamment.</li>
          <li><b>Déplace</b> : glisse un élément n'importe où, même sur une autre page. Utile pour un document qui contient plusieurs factures : place un message et une signature sur chacune. « Copier sur toutes les pages » duplique l'élément à la même position.</li>
          <li><b>Exporte</b> : « Exporter le PDF » télécharge un nouveau fichier « …-annotee.pdf ». Le document d'origine n'est pas modifié.</li>
        </ol>
        <p>Dans le PDF exporté, seuls les caractères latins (accents, €, guillemets) sont gérés ; les autres symboles sont remplacés par « ? ».</p>
      </HelpBox>

      <div className="sticky top-[64px] z-30 lg:top-2">
      <div className={`${card} flex flex-wrap items-center gap-2 shadow-md`}>
        <label className={`${btnOn} cursor-pointer`}>
          Ouvrir un PDF / une image
          <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])} />
        </label>
        <button className={tool === "text" ? btnOn : btn} disabled={!pages.length} onClick={() => setTool(tool === "text" ? null : "text")}>+ Message</button>
        {[0, 1].map((n) => (
          <button key={n} className={tool === n ? btnOn : btn} disabled={!pages.length || !sigs[n]} onClick={() => setTool(tool === n ? null : (n as 0 | 1))}>
            + Signature {n + 1}
          </button>
        ))}
        <button className={btn} onClick={() => setShowPad((v) => !v)}>{showPad ? "Fermer" : "Créer / modifier mes signatures"}</button>
        <label className="ml-auto flex items-center gap-2 text-xs">Zoom
          <input type="range" min={400} max={1100} value={zoomW} onChange={(e) => setZoomW(Number(e.target.value))} />
        </label>
        <button className={btnOn} disabled={!pages.length || !!busy} onClick={exportPdf}>Exporter le PDF</button>
      </div>
      </div>
      {busy && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{busy}</div>}
      {tool !== null && <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">Clique sur la page à l'endroit voulu pour poser l'élément.</div>}

      {showPad && (
        <div className={card}>
          <div className="mb-2 text-sm font-semibold">Dessine ta signature (souris, doigt ou stylet)</div>
          <SignaturePad onSave={saveSig} />
          {sigMsg && <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Signature gardée sur cet appareil seulement : {sigMsg}</div>}
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[0, 1].map((n) => (
              <div key={n} className="rounded-lg border border-black/10 p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>Signature {n + 1}</span>
                  <span className={sigState[n] === "cloud" ? "text-emerald-700" : sigState[n] === "local" ? "text-amber-700" : "text-black/40"}>
                    {{ cloud: "✓ enregistrée dans ton compte", local: "sur cet appareil seulement", saving: "envoi…", none: "" }[sigState[n]]}
                  </span>
                </div>
                <div className="mt-1 flex h-16 items-center justify-center bg-[#fafafa]">
                  {sigs[n] ? <img src={sigs[n]!.dataUrl} alt="" className="max-h-14" /> : <span className="text-black/40">vide</span>}
                </div>
                {sigs[n] && <button className={`${btn} mt-1`} onClick={() => removeSig(n as 0 | 1)}>Supprimer</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="space-y-3 overflow-x-auto rounded-xl bg-black/5 p-3">
          {pages.length === 0 && <div className="p-8 text-center text-sm text-black/50">Aucun document ouvert.</div>}
          {pages.map((pg, idx) => {
            const sc = zoomW / pg.w;
            return (
              <div key={idx} className="mx-auto">
                <div className="mb-1 text-center text-[11px] text-black/50">Page {idx + 1} / {pages.length}</div>
                <div
                  data-page={idx}
                  className="relative mx-auto bg-white shadow"
                  style={{ width: zoomW, height: zoomW * (pg.h / pg.w), cursor: tool !== null ? "crosshair" : "default" }}
                  onPointerDown={(e) => e.target === e.currentTarget || (e.target as HTMLElement).tagName === "IMG" ? place(e, idx) : undefined}
                >
                  <img src={pg.url} alt="" className="pointer-events-auto absolute inset-0 h-full w-full select-none" draggable={false} />
                  {items.filter((i) => i.page === idx).map((i) => {
                    const sg = i.kind === "sig" ? sigs[i.sig] : null;
                    return (
                      <div
                        key={i.id}
                        className="absolute select-none"
                        style={{
                          left: `${i.x * 100}%`, top: `${i.y * 100}%`, cursor: "move", touchAction: "none",
                          outline: selId === i.id ? "1.5px dashed #2563eb" : "none", outlineOffset: 2,
                          ...(i.kind === "text"
                            ? { fontSize: i.size * sc, lineHeight: 1.2, whiteSpace: "pre", color: i.color, fontFamily: FONTS[i.font].css, fontWeight: i.bold ? 700 : 400, fontStyle: i.italic ? "italic" : "normal" }
                            : { width: `${i.wFrac * 100}%` }),
                        }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const r = e.currentTarget.getBoundingClientRect();
                          grab.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
                          setSelId(i.id);
                          setDragId(i.id);
                        }}
                      >
                        {i.kind === "text" ? i.text : sg ? <img src={sg.dataUrl} alt="" draggable={false} className="w-full" /> : "(signature supprimée)"}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className={`${card} h-fit space-y-3 text-xs xl:sticky xl:top-[78px] xl:max-h-[calc(100vh-96px)] xl:overflow-y-auto`}>
          {!sel ? (
            <p className="text-black/50">Sélectionne un élément posé sur la page pour modifier son texte, sa police, sa taille ou sa taille de signature. Tu peux le glisser n'importe où, même sur une autre page.</p>
          ) : (
            <>
              <div className="text-sm font-semibold">{sel.kind === "text" ? "Message" : `Signature ${sel.sig + 1}`}</div>
              {sel.kind === "text" ? (
                <>
                  <textarea className={`${inp} h-24`} value={sel.text} onChange={(e) => patch(sel.id, { text: e.target.value })} />
                  <label className="block font-semibold">Police
                    <select className={inp} value={sel.font} onChange={(e) => patch(sel.id, { font: e.target.value as FontId })}>
                      <option value="Helvetica">Helvetica (sans empattement)</option>
                      <option value="Times">Times (avec empattement)</option>
                      <option value="Courier">Courier (machine à écrire)</option>
                    </select>
                  </label>
                  <label className="block font-semibold">Taille : {sel.size} pt
                    <input type="range" min={6} max={60} value={sel.size} onChange={(e) => patch(sel.id, { size: Number(e.target.value) })} className="w-full" />
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={sel.bold} onChange={(e) => patch(sel.id, { bold: e.target.checked })} /> Gras</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={sel.italic} onChange={(e) => patch(sel.id, { italic: e.target.checked })} /> Italique</label>
                    <input type="color" value={sel.color} onChange={(e) => patch(sel.id, { color: e.target.value })} />
                  </div>
                </>
              ) : (
                <label className="block font-semibold">Largeur : {Math.round(sel.wFrac * 100)} % de la page
                  <input type="range" min={5} max={60} value={Math.round(sel.wFrac * 100)} onChange={(e) => patch(sel.id, { wFrac: Number(e.target.value) / 100 })} className="w-full" />
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                <button className={btn} onClick={() => setItems((a) => [...a, ...pages.map((_, p) => p).filter((p) => p !== sel.page).map((p) => ({ ...sel, id: rid(), page: p }))])}>
                  Copier sur toutes les pages
                </button>
                <button className={btn} onClick={() => { setItems((a) => a.filter((i) => i.id !== sel.id)); setSelId(null); }}>Supprimer</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
