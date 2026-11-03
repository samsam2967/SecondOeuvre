import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ELEC_GUIDE, type Block } from "../data/elecGuide";
import { POSTS } from "../data/catalogs";
import { NORMS } from "../data/norms";
import { TUTORIALS, type Tutorial } from "../data/tutorials";
import type { PostId, Project } from "../types";

/**
 * PDF imprimables : guide électricité, et normes + tutoriels de chaque poste.
 * Les polices standard d'un PDF ne contiennent pas tous les symboles du site : on les remplace (≈ → ~, → → ->, Ω → ohm…).
 */
export function pdfText(s: string): string {
  return s
    .replace(/[\u202f\u00a0\u2009]/g, " ")
    .replace(/≈/g, "~")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/Ω/g, "ohm")
    .replace(/MΩ/g, "Mohm")
    .replace(/★/g, "*")
    .replace(/[✓✔]/g, "ok")
    .replace(/[−]/g, "-")
    .replace(/[↕]/g, "")
    .replace(/λ/g, "lambda")
    .replace(/[’‘]/g, "'")
    .replace(/²/g, "²");
}

/** Rasterise un schéma du guide (identifié par son id) en image PNG ; renvoie null si impossible. */
export type Rasterizer = (id: string) => Promise<{ dataUrl: string; w: number; h: number } | null>;
/** Charge une image du site (schéma d'un tutoriel) en data URL ; renvoie null si impossible. */
export type ImageLoader = (url: string) => Promise<{ dataUrl: string; w: number; h: number } | null>;

const W = 210;
const H = 297;
const MX = 15;
const TOP = 24;
const BOTTOM = 18;
const INK: [number, number, number] = [29, 33, 28];
const MUTED: [number, number, number] = [110, 113, 108];
const FOREST: [number, number, number] = [63, 107, 82];

interface Seg {
  text: string;
  bold: boolean;
}

/** Découpe « texte **gras** texte » en segments. */
function segments(text: string): Seg[] {
  return pdfText(text)
    .split(/\*\*(.+?)\*\*/g)
    .map((t, i) => ({ text: t, bold: i % 2 === 1 }))
    .filter((s) => s.text !== "");
}

class Flow {
  doc = new jsPDF({ compress: true });
  y = TOP;
  constructor(
    private title: string,
    private project: Project,
  ) {}

  private ensure(h: number) {
    if (this.y + h > H - BOTTOM) {
      this.doc.addPage();
      this.y = TOP;
    }
  }

  space(h: number) {
    this.y += h;
  }

  /** Page de titre. */
  cover(subtitle: string, lines: string[]) {
    const d = this.doc;
    d.setFillColor(25, 29, 24);
    d.rect(0, 0, W, 62, "F");
    d.setFillColor(242, 194, 48);
    d.rect(0, 62, W, 2.5, "F");
    d.setTextColor(244, 245, 242);
    d.setFont("helvetica", "bold");
    d.setFontSize(22);
    const t = d.splitTextToSize(pdfText(this.title), W - 2 * MX);
    d.text(t, MX, 28);
    d.setFont("helvetica", "normal");
    d.setFontSize(11);
    d.text(pdfText(subtitle), MX, 28 + t.length * 9 + 4);
    d.setFontSize(9);
    d.text(pdfText(`${this.project.settings.projectName}${this.project.settings.address ? " — " + this.project.settings.address : ""}`), MX, 56);
    d.setTextColor(...INK);
    this.y = 76;
    for (const l of lines) this.p(l, { size: 10 });
    this.space(2);
  }

  h1(text: string) {
    this.ensure(48);
    const d = this.doc;
    this.space(5);
    d.setFillColor(...FOREST);
    d.rect(MX, this.y - 5.2, 2.2, 8, "F");
    d.setFont("helvetica", "bold");
    d.setFontSize(14);
    d.setTextColor(...INK);
    const lines = d.splitTextToSize(pdfText(text), W - 2 * MX - 6);
    d.text(lines, MX + 5, this.y);
    this.y += lines.length * 6 + 2;
  }

  h2(text: string) {
    this.ensure(16);
    const d = this.doc;
    d.setFont("helvetica", "bold");
    d.setFontSize(11);
    d.setTextColor(...FOREST);
    const lines = d.splitTextToSize(pdfText(text), W - 2 * MX);
    d.text(lines, MX, this.y);
    d.setTextColor(...INK);
    this.y += lines.length * 5 + 1.5;
  }

  /** Paragraphe avec passages **en gras**. */
  p(text: string, opts: { size?: number; indent?: number; italic?: boolean; color?: [number, number, number]; width?: number } = {}) {
    const lines = this.wrap(text, opts);
    this.drawLines(lines, opts);
    this.y += 1.6;
  }

  private wrap(text: string, opts: { size?: number; indent?: number; italic?: boolean; width?: number }): Seg[][] {
    const d = this.doc;
    const size = opts.size ?? 9.5;
    const maxW = (opts.width ?? W - 2 * MX) - (opts.indent ?? 0);
    d.setFontSize(size);
    const words: Seg[] = [];
    for (const s of segments(text)) {
      for (const w of s.text.split(/(\s+)/)) if (w !== "") words.push({ text: w, bold: s.bold });
    }
    const lines: Seg[][] = [[]];
    let width = 0;
    for (const w of words) {
      d.setFont("helvetica", w.bold ? "bold" : opts.italic ? "italic" : "normal");
      const ww = d.getTextWidth(w.text);
      const isSpace = /^\s+$/.test(w.text);
      if (!isSpace && width + ww > maxW && width > 0) {
        lines.push([]);
        width = 0;
      }
      if (isSpace && width === 0) continue;
      lines[lines.length - 1].push(w);
      width += ww;
    }
    return lines;
  }

  private drawLines(lines: Seg[][], opts: { size?: number; indent?: number; italic?: boolean; color?: [number, number, number] }, x0 = MX) {
    const d = this.doc;
    const size = opts.size ?? 9.5;
    const lh = size * 0.46 + 1.4;
    d.setFontSize(size);
    d.setTextColor(...(opts.color ?? INK));
    for (const line of lines) {
      this.ensure(lh);
      let x = x0 + (opts.indent ?? 0);
      for (const s of line) {
        d.setFont("helvetica", s.bold ? "bold" : opts.italic ? "italic" : "normal");
        d.text(s.text, x, this.y);
        x += d.getTextWidth(s.text);
      }
      this.y += lh;
    }
    d.setTextColor(...INK);
  }

  list(items: string[], numbered = false) {
    const d = this.doc;
    items.forEach((it, i) => {
      const lines = this.wrap(it, { indent: 6 });
      const lh = 9.5 * 0.46 + 1.4;
      this.ensure(lh * Math.min(lines.length, 2));
      const marker = numbered ? `${i + 1}.` : "•";
      d.setFont("helvetica", "bold");
      d.setFontSize(9.5);
      const mc: [number, number, number] = numbered ? [196, 92, 38] : INK;
      d.setTextColor(...mc);
      d.text(marker, MX + (numbered ? 0 : 1.5), this.y);
      this.drawLines(lines, { indent: 6 });
      this.y += 0.6;
    });
    this.y += 1;
  }

  /** Encadré coloré (astuce, attention, info). */
  callout(kind: "tip" | "warn" | "info", text: string) {
    const d = this.doc;
    const cfg = {
      tip: { bg: [236, 247, 239], bar: [63, 107, 82], label: "ASTUCE" },
      warn: { bg: [254, 243, 199], bar: [180, 110, 10], label: "ATTENTION" },
      info: { bg: [232, 240, 250], bar: [58, 90, 116], label: "À SAVOIR" },
    }[kind] as { bg: [number, number, number]; bar: [number, number, number]; label: string };
    const lines = this.wrap(text, { indent: 0, width: W - 2 * MX - 8 });
    const lh = 9.5 * 0.46 + 1.4;
    const h = lines.length * lh + 9;
    this.ensure(h);
    d.setFillColor(...cfg.bg);
    d.rect(MX, this.y - 3.5, W - 2 * MX, h, "F");
    d.setFillColor(...cfg.bar);
    d.rect(MX, this.y - 3.5, 1.6, h, "F");
    d.setFont("helvetica", "bold");
    d.setFontSize(7.5);
    d.setTextColor(...cfg.bar);
    d.text(pdfText(cfg.label), MX + 5, this.y + 0.5);
    this.y += 4.2;
    this.drawLines(lines, {}, MX + 5);
    this.y += 6;
  }

  table(head: string[], rows: string[][], note?: string) {
    this.ensure(20);
    autoTable(this.doc, {
      startY: this.y,
      head: [head.map(pdfText)],
      body: rows.map((r) => r.map((c) => pdfText(c))),
      margin: { left: MX, right: MX, top: TOP, bottom: BOTTOM },
      styles: { fontSize: 8.2, cellPadding: 1.8, overflow: "linebreak", textColor: INK, lineColor: [226, 229, 223], lineWidth: 0.2 },
      headStyles: { fillColor: FOREST, textColor: 255, fontSize: 8 },
      alternateRowStyles: { fillColor: [247, 248, 245] },
      columnStyles: { 0: { fontStyle: "bold" } },
    });
    this.y = (this.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    if (note) this.p(note, { size: 8, italic: true, color: MUTED });
  }

  image(img: { dataUrl: string; w: number; h: number }, caption?: string, maxW = 150) {
    const w = Math.min(maxW, W - 2 * MX);
    const h = (img.h / img.w) * w;
    this.ensure(h + 10);
    this.doc.addImage(img.dataUrl, "PNG", MX + (W - 2 * MX - w) / 2, this.y, w, h, undefined, "FAST");
    this.y += h + 2;
    if (caption) {
      this.doc.setFont("helvetica", "italic");
      this.doc.setFontSize(8);
      this.doc.setTextColor(...MUTED);
      this.doc.text(pdfText(caption), W / 2, this.y + 2, { align: "center", maxWidth: W - 2 * MX });
      this.doc.setTextColor(...INK);
      this.y += 6;
    }
  }

  /** En-tête courant et pied de page sur toutes les pages sauf la couverture. */
  finish(): jsPDF {
    const d = this.doc;
    const n = d.getNumberOfPages();
    const date = new Date().toLocaleDateString("fr-FR");
    for (let i = 1; i <= n; i++) {
      d.setPage(i);
      d.setFontSize(8);
      d.setFont("helvetica", "normal");
      d.setTextColor(...MUTED);
      if (i > 1) {
        d.text(pdfText(this.title), MX, 12);
        d.text(pdfText(this.project.settings.projectName), W - MX, 12, { align: "right" });
        d.setDrawColor(226, 229, 223);
        d.line(MX, 14.5, W - MX, 14.5);
      }
      d.text(`Page ${i} / ${n}  —  Imprimé le ${date}. Document d'aide : vérifier la version en vigueur de la norme.`, MX, H - 9);
    }
    return d;
  }
}

function renderBlock(f: Flow, b: Block, imgs: Map<string, { dataUrl: string; w: number; h: number }>) {
  switch (b.t) {
    case "p":
      return f.p(b.text);
    case "list":
      return f.list(b.items, false);
    case "ol":
      return f.list(b.items, true);
    case "table":
      return f.table(b.head, b.rows, b.note);
    case "tip":
    case "warn":
    case "info":
      return f.callout(b.t, b.text);
    case "svg": {
      const im = imgs.get(b.id);
      if (im) f.image(im, b.caption, 140);
      else f.p(`[Schéma : ${b.caption}]`, { italic: true, color: MUTED });
    }
  }
}

/** PDF du guide électricité (tous les chapitres). */
export async function buildElecGuidePdf(project: Project, rasterize?: Rasterizer): Promise<jsPDF> {
  const f = new Flow("Guide électricité — comprendre et faire ses circuits", project);
  const imgs = new Map<string, { dataUrl: string; w: number; h: number }>();
  if (rasterize) {
    for (const id of ["arrivee", "guirlande", "volumes", "eclairage"]) {
      const r = await rasterize(id);
      if (r) imgs.set(id, r);
    }
  }
  f.cover("Pour débutant : les bases, la norme NF C 15-100, les circuits, le Consuel", [
    "Ce guide explique comment fonctionne une installation électrique de maison, comment la découper en circuits et comment câbler chacun d'eux. Il reprend les règles de la norme NF C 15-100 (amendement 5, en vigueur depuis le 27 novembre 2015), vérifiées dans les guides Legrand, Hager, Promotelec et Consuel en octobre 2026.",
    "**Sécurité :** coupe toujours le courant au disjoncteur général, cadenasse-le et vérifie l'absence de tension avec un testeur avant toute intervention.",
    "**Avant de commander et de câbler**, vérifie la version de la norme en vigueur et fais relire ton schéma par un électricien. Le tableau et la prise de terre sont les parties les plus critiques.",
  ]);
  f.h2("Sommaire");
  f.list(ELEC_GUIDE.map((c) => c.title));
  for (const ch of ELEC_GUIDE) {
    f.h1(ch.title);
    if (ch.intro) f.p(ch.intro, { italic: true, color: MUTED });
    for (const b of ch.blocks) renderBlock(f, b, imgs);
  }
  return f.finish();
}

const POST_NORM_KEY: Record<PostId | "general", string> = {
  general: "général",
  placo: "placo",
  isolation: "isolation",
  electricite: "électricité",
  sanitaire: "sanitaire",
  vmc: "vmc",
  chauffage: "chauffage",
  peinture: "peinture",
  carrelage: "carrelage",
  quincaillerie: "quincaillerie",
};

/** Libellé de poste utilisé dans la page Normes → identifiant de poste. */
export const NORM_LABEL_TO_POST: Record<string, PostId | "general"> = Object.fromEntries(
  Object.entries(POST_NORM_KEY).map(([k, v]) => [v, k as PostId | "general"]),
);

const postLabel = (k: PostId | "general") => (k === "general" ? "Général" : (POSTS.find((p) => p.id === k)?.label ?? k));

function renderTutorial(f: Flow, t: Tutorial, img: { dataUrl: string; w: number; h: number } | null) {
  f.h2(`${t.title}`);
  f.p(`**Durée :** ${t.duration}    **Niveau :** ${t.level}`, { size: 9 });
  if (img) f.image(img, undefined, 120);
  if (t.tools.length) {
    f.p("**Outils :** " + t.tools.join(" · "), { size: 9 });
  }
  if (t.norms.length) {
    f.callout("info", "**Normes et règles à respecter :** " + t.norms.join(" · "));
  }
  t.steps.forEach((s, i) => {
    f.p(`**${i + 1}. ${s.title}** — ${s.body}`);
    if (s.tip) f.callout("tip", s.tip);
    if (s.warn) f.callout("warn", s.warn);
  });
  if (t.videos.length) f.p("**Vidéos :** " + t.videos.map((v) => `${v.title} (${v.url})`).join(" ; "), { size: 8, color: MUTED });
  f.space(3);
}

/** PDF d'un poste (ou de tous) : normes à respecter puis tutoriels de pose. */
export async function buildPostPdf(project: Project, post: PostId | "general" | "all", loadImage?: ImageLoader): Promise<jsPDF> {
  const keys: (PostId | "general")[] = post === "all" ? ["general", ...POSTS.map((p) => p.id)] : [post];
  const title = post === "all" ? "Normes et tutoriels — tous les postes" : `Normes et tutoriels — ${postLabel(post)}`;
  const f = new Flow(title, project);
  f.cover("Normes à respecter et pas-à-pas de pose", [
    post === "all"
      ? "Pour chaque poste du second œuvre : les normes et règles à respecter (DTU, NF C 15-100, RE2020…), puis les tutoriels de pose avec outils, étapes, astuces et points d'attention."
      : `Les normes et règles à respecter pour le poste « ${postLabel(post)} », puis les tutoriels de pose avec outils, étapes, astuces et points d'attention.`,
    "Les textes sont un aide-mémoire : en cas de doute, la référence reste le DTU, la norme ou la notice du fabricant en vigueur. Fais relire les points critiques (électricité, étanchéité, gaz) par un professionnel.",
  ]);
  for (const k of keys) {
    const norms = NORMS.filter((n) => n.post === POST_NORM_KEY[k]);
    const tutos = TUTORIALS.filter((t) => t.post === k);
    if (!norms.length && !tutos.length) continue;
    f.h1(postLabel(k));
    if (norms.length) {
      f.h2("Normes et règles à respecter");
      f.table(
        ["Règle", "Référence", "Ce qu'il faut respecter", "Statut"],
        norms.map((n) => [n.title, n.code, n.body, n.severity]),
      );
    }
    if (k === "electricite") {
      f.callout("info", "Pour comprendre et réaliser chaque circuit en partant de zéro, voir le « Guide électricité » (PDF séparé, ou page Guide électricité du site).");
    }
    if (tutos.length) {
      f.h2(tutos.length > 1 ? "Tutoriels de pose" : "Tutoriel de pose");
      for (const t of tutos) {
        const img = loadImage ? await loadImage(t.image) : null;
        renderTutorial(f, t, img);
      }
    }
  }
  return f.finish();
}

/* ------------------------------------------------------------------ navigateur : rasterisation et téléchargement ------------------------------------------------------------------ */

/** Convertit une image du site (PNG, JPG, SVG) en PNG via un canvas. */
export const browserImageLoader: ImageLoader = async (url) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0);
    return { dataUrl: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height };
  } catch {
    return null;
  }
};

/** Rasterise un SVG (texte) en PNG dans le navigateur. */
export async function svgToPng(svg: string, widthPx = 1400): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const vb = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
    if (!vb) return null;
    const ratio = Number(vb[2]) / Number(vb[1]);
    const withNs = svg.includes("xmlns=") ? svg : svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(withNs);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("svg"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = Math.round(widthPx * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height };
  } catch {
    return null;
  }
}
