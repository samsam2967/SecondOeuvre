import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { POSTS } from "../data/catalogs";
import type { Expense, LineItem, PostId, Project } from "../types";
import type { CalcResult } from "./calc";
import { lineKey, lineTotal } from "./calc";
import { fmtD, fmtE } from "./format";

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

export function exportBudgetPdf(project: Project, calc: CalcResult, expenses: Expense[]) {
  const doc = new jsPDF();
  header(doc, "Suivi financier du chantier", project);

  const paid = expenses.filter((e) => e.status === "paye").reduce((s, e) => s + e.amount, 0);
  const ordered = expenses.filter((e) => e.status === "commande").reduce((s, e) => s + e.amount, 0);
  const planned = expenses.filter((e) => e.status === "prevu").reduce((s, e) => s + e.amount, 0);

  doc.setFontSize(10);
  doc.text(`Estimé matériaux : ${fmtE(calc.costTotal)}`, 14, 38);
  doc.text(`Payé : ${fmtE(paid)}   ·   Commandé : ${fmtE(ordered)}   ·   Prévu : ${fmtE(planned)}`, 14, 45);
  doc.text(`Reste vs estimé (payé) : ${fmtE(calc.costTotal - paid)}`, 14, 52);

  autoTable(doc, {
    startY: 58,
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
    head: [["Date", "Poste", "Libellé", "Fournisseur", "Statut", "Montant"]],
    body: expenses.map((e) => [
      e.date,
      e.post,
      e.label,
      e.vendor,
      e.status === "paye" ? "Payé" : e.status === "commande" ? "Commandé" : "Prévu",
      fmtE(e.amount),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [196, 92, 38], textColor: 255 },
  });

  footer(doc);
  doc.save("suivi-financier-chantier.pdf");
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
