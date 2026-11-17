import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../utils/cn";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("paper-card rounded-xl p-5", className)}>{children}</div>;
}

export function H({ kicker, title, sub }: { kicker?: string; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      {kicker && <div className="stamp text-terra mb-2 inline-block">{kicker}</div>}
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl">{title}</h1>
      {sub && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">{sub}</p>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "terra" | "forest" | "navy" | "gold";
}) {
  const ring =
    accent === "forest"
      ? "border-l-forest"
      : accent === "navy"
        ? "border-l-navy"
        : accent === "gold"
          ? "border-l-gold"
          : "border-l-terra";
  return (
    <div className={cn("paper-card rounded-xl border-l-4 p-4", ring)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">{label}</div>
      <div className="font-display mt-1 text-2xl font-bold text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  variant = "terra",
  type = "button",
  className,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "terra" | "forest" | "ghost" | "ink";
  type?: "button" | "submit";
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const v = {
    terra: "bg-terra text-white hover:bg-terra-2",
    forest: "bg-forest text-white hover:bg-forest-2",
    ink: "bg-ink text-paper hover:bg-stone-800",
    ghost: "bg-transparent text-ink border border-rule hover:bg-paper-2",
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition hover:-translate-y-px active:translate-y-0 disabled:opacity-40",
        v,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-stone-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-rule bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, "min-h-[80px]", props.className)} />;
}

export function Num({
  value,
  onChange,
  step = 0.1,
  min,
  max,
  suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={cn(inputCls, suffix && "pr-10")}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">{suffix}</span>}
    </div>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center gap-2 text-sm"
    >
      <span className={cn("h-5 w-9 rounded-full p-0.5 transition", value ? "bg-forest" : "bg-stone-300")}>
        <span className={cn("block h-4 w-4 rounded-full bg-white transition", value && "translate-x-4")} />
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-rule">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn("bg-ink px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-paper", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn("border-t border-rule px-3 py-2 align-middle", className)}>
      {children}
    </td>
  );
}

export function Badge({ children, color = "terra" }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: `${color}22`, color }}
    >
      {children}
    </span>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display mb-3 text-lg font-bold text-ink">{children}</h2>;
}

export function PriceInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return <Num value={value} onChange={onChange} step={0.1} suffix="€" />;
}
