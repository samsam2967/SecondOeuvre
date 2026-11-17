import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { POSTS } from "../data/catalogs";
import type { BankStatus, Expense, LineItem, PostId, Project } from "../types";
import type { CalcResult } from "./calc";
import { lineKey, lineTotal } from "./calc";
import { fmtD as fmtDRaw, fmtE as fmtERaw } from "./format";

// La police du PDF n'a pas l'espace fine insécable que les nombres français utilisent pour les milliers
// (elle s'affichait « / ») : on la remplace par une espace normale.
const pdfSpaces = (t: string) => t.replace(/[\u202f\u00a0]/g, " ");
const fmtE = (n: number) => pdfSpaces(fmtERaw(n));
const fmtD = (n: number, d?: number) => pdfSpaces(fmtDRaw(n, d));

function header(doc: jsPDF, title: string, project: Project) {
  doc.setFillColor(28, 25, 23);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(247, 243, 238);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ATELIER SECOND ŒUVRE", 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(title, 14, 20);
  doc.setFontSize(8);
  doc.text(project.settings.projectName, 196, 12, { align: "right" });
  doc.text(project.settings.address || "", 196, 18, { align: "right" });
  doc.setTextColor(28, 25, 23);
}

function footer(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 113, 108);
    doc.text(`Page ${i} / ${pageCount}  —  Document de chantier, quantités à valider sur place.`, 14, 290);
  }
}

export function exportShoppingPdf(project: Project, calc: CalcResult, post?: PostId, onlyKeys?: string[]) {
  const doc = new jsPDF();
  const source = post ? calc.byPost[post] : calc.items;
  const items = onlyKeys ? source.filter((i) => onlyKeys.includes(lineKey(i))) : source;
  const title = post ? `Liste de courses — ${POSTS.find((p) => p.id === post)?.label}` : "Liste de courses — chantier";
  header(doc, title, project);

  doc.setFontSize(9);
  doc.setTextColor(80, 70, 60);
  doc.text(
    `Surfaces : ${fmtD(calc.surfaces.floor, 1)} m² de plancher  ·  ${fmtD(calc.surfaces.exterior, 1)} m² murs ext.  ·  ${calc.surfaces.rooms} pièces`,
    14,
    36,
  );
  doc.text(
    `${items.length} ligne(s) retenue(s) · Total : ${fmtE(items.reduce((s, i) => s + lineTotal(i), 0))} TTC indicatif (TVA ${project.settings.tva} %).`,
    14,
    42,
  );

  const links = project.settings.productLinks ?? {};
  const body = items.map((i) => {
    const url = (i.linkKey ? links[`mat:${i.post}:${i.linkKey}`] : undefined) ?? links[lineKey(i)];
    const shortUrl = url && url.length > 70 ? `${url.slice(0, 67)}…` : url;
    return [
      POSTS.find((p) => p.id === i.post)?.short ?? i.post,
      i.category,
      `${i.name}${i.spec ? ` (${i.spec})` : ""}${shortUrl ? `\n→ ${shortUrl}` : ""}`,
      `${fmtD(i.quantity, 2)} ${i.unit}`,
      fmtE(i.unitPrice),
      fmtE(lineTotal(i)),
      "☐",
    ];
  });

  autoTable(doc, {
    startY: 48,
    head: [["Poste", "Famille", "Désignation", "Qté", "PU", "Total", "OK"]],
    body,
    styles: { fontSize: 7.5, cellPadding: 1.6, textColor: [40, 36, 32] },
    headStyles: { fillColor: [196, 92, 38], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 246, 240] },
    columnStyles: {
      0: { cellWidth: 18 },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { cellWidth: 10, halign: "center" },
    },
  });

  footer(doc);
  doc.save(slug(title) + ".pdf");
}

const frDate = (d?: string) => {
  if (!d) return "";
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString("fr-FR");
};

const BANK_LABEL: Record<BankStatus, string> = {
  non_demande: "Déblocage non demandé",
  demande: "Déblocage demandé",
  refuse: "Déblocage refusé",
  accepte: "Déblocage accepté",
};
const BANK_DATE_WORD: Record<Exclude<BankStatus, "non_demande">, string> = {
  demande: "demandé",
  refuse: "refusé",
  accepte: "accepté",
};
const EXPENSE_LABEL: Record<Expense["status"], string> = { paye: "Payé", commande: "Commandé", prevu: "Prévu" };

/** Texte de la cellule « Statut banque » : statut + date, puis les dates des étapes précédentes. */
function bankCell(e: Expense): string {
  const st = e.bankStatus ?? "non_demande";
  if (st === "non_demande") return BANK_LABEL[st];
  const d = e.bankDates?.[st];
  let txt = `${BANK_LABEL[st]}${d ? `\nle ${frDate(d)}` : ""}`;
  const past = (["demande", "refuse", "accepte"] as const).filter((k) => k !== st && e.bankDates?.[k]);
  if (past.length) txt += `\n(${past.map((k) => `${BANK_DATE_WORD[k]} le ${frDate(e.bankDates?.[k])}`).join(" · ")})`;
  return txt;
}

type RGB = [number, number, number];
const GREEN: RGB = [34, 120, 74];
const AMBER: RGB = [180, 110, 10];
const RED: RGB = [185, 40, 40];
const GREY: RGB = [110, 110, 110];

export function buildBudgetPdf(project: Project, calc: CalcResult, expenses: Expense[]) {
  const doc = new jsPDF();
  header(doc, "Suivi financier du chantier", project);

  const sum = (f: (e: Expense) => boolean) => expenses.filter(f).reduce((s, e) => s + e.amount, 0);
  const paid = sum((e) => e.status === "paye");
  const ordered = sum((e) => e.status === "commande");
  const planned = sum((e) => e.status === "prevu");
  const bank = (st: BankStatus) => sum((e) => (e.bankStatus ?? "non_demande") === st);

  doc.setFontSize(10);
  doc.text(`Estimé matériaux : ${fmtE(calc.costTotal)}`, 14, 38);
  doc.text(`Payé : ${fmtE(paid)}   ·   Commandé : ${fmtE(ordered)}   ·   Prévu : ${fmtE(planned)}`, 14, 45);
  doc.text(`Banque : débloqué ${fmtE(bank("accepte"))}   ·   demandé ${fmtE(bank("demande"))}   ·   refusé ${fmtE(bank("refuse"))}   ·   non demandé ${fmtE(bank("non_demande"))}`, 14, 52);
  doc.text(`Reste vs estimé (payé) : ${fmtE(calc.costTotal - paid)}`, 14, 59);

  autoTable(doc, {
    startY: 65,
    head: [["Poste", "Estimé matériaux"]],
    body: (Object.keys(calc.costByPost) as PostId[]).map((k) => [
      POSTS.find((p) => p.id === k)?.label ?? k,
      fmtE(calc.costByPost[k]),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [61, 90, 69], textColor: 255 },
  });

  const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  autoTable(doc, {
    startY: lastY + 10,
    head: [["Date", "Poste", "Libellé", "Fournisseur", "Statut", "Statut banque", "Fact.", "Montant"]],
    body: [
      ...expenses.map((e) => [
        frDate(e.date),
        e.post === "divers" ? "Divers" : (POSTS.find((p) => p.id === e.post)?.label ?? e.post),
        e.label,
        e.vendor,
        EXPENSE_LABEL[e.status],
        bankCell(e),
        e.invoices?.length ? String(e.invoices.length) : "—",
        fmtE(e.amount),
      ]),
      ["", "", "", "", "", "", "Total", fmtE(expenses.reduce((s, e) => s + e.amount, 0))],
    ],
    styles: { fontSize: 7.5, cellPadding: 1.6, valign: "middle" },
    headStyles: { fillColor: [196, 92, 38], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 24 },
      4: { cellWidth: 18 },
      5: { cellWidth: 38 },
      6: { cellWidth: 10, halign: "center" },
      7: { cellWidth: 20, halign: "right" },
    },
    didParseCell: (d) => {
      if (d.section !== "body") return;
      const e = expenses[d.row.index];
      if (!e) {
        d.cell.styles.fontStyle = "bold";
        return;
      }
      let color: RGB | null = null;
      if (d.column.index === 4) color = e.status === "paye" ? GREEN : e.status === "commande" ? AMBER : GREY;
      if (d.column.index === 5) {
        const st = e.bankStatus ?? "non_demande";
        color = st === "accepte" ? GREEN : st === "refuse" ? RED : st === "demande" ? AMBER : GREY;
      }
      if (color) {
        d.cell.styles.textColor = color;
        d.cell.styles.fontStyle = "bold";
      }
    },
  });

  footer(doc);
  return doc;
}

export function exportBudgetPdf(project: Project, calc: CalcResult, expenses: Expense[]) {
  buildBudgetPdf(project, calc, expenses).save("suivi-financier-chantier.pdf");
}

export function exportProjectJson(project: Project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = slug(project.settings.projectName || "projet") + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type { LineItem };
