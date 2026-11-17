import { useState, type ReactNode } from "react";

/** Encadré « Mode d'emploi » repliable. Ouvert la première fois, puis il garde l'état choisi. */
export function HelpBox({ id, title = "Mode d'emploi", children }: { id: string; title?: string; children: ReactNode }) {
  const key = `cc-help-${id}`;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== "closed";
    } catch {
      return true;
    }
  });
  return (
    <details
      open={open}
      onToggle={(e) => {
        const o = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(o);
        try {
          localStorage.setItem(key, o ? "open" : "closed");
        } catch {
          /* stockage indisponible */
        }
      }}
      className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
    >
      <summary className="cursor-pointer select-none font-semibold">{title}</summary>
      <div className="mt-2 space-y-2 text-[13px] leading-relaxed [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc">{children}</div>
    </details>
  );
}
