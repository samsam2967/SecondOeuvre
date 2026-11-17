export function fmtN(n: number, d = 1) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

export function fmtD(n: number, d = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d });
}

export function fmtE(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function fmtU(n: number, unit: string, d = 1) {
  return `${fmtN(n, d)} ${unit}`;
}

export function ceilTo(n: number, step = 1) {
  return Math.ceil(n / step) * step;
}

export function packCount(qty: number, pack: number) {
  if (pack <= 0) return Math.ceil(qty);
  return Math.ceil(qty / pack);
}
