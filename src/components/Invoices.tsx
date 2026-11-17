import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, FileText, Paperclip, Trash2, Upload, X } from "lucide-react";
import { useStore } from "../store";
import type { Expense, Invoice } from "../types";
import { fmtD } from "../utils/format";
import { uid } from "../utils/id";
import {
  deleteInvoiceFile,
  downloadInvoiceFile,
  getSession,
  getSupabaseConfig,
  INVOICES_SQL,
  InvoiceStorageError,
  uploadInvoiceFile,
} from "../utils/supabase";
import { Btn } from "./ui";

const MAX_BYTES = 15 * 1024 * 1024;

/** Réduit une photo de facture (max 2000 px, JPEG) pour garder des fichiers légers et lisibles. */
async function shrinkImage(file: File): Promise<{ blob: Blob; mime: string; ext: string }> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return { blob: file, mime: file.type, ext: file.name.split(".").pop()?.toLowerCase() || "bin" };
  }
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k);
    const h = Math.round(bmp.height * k);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) throw new Error("blob");
    return blob.size < file.size || k < 1 ? { blob, mime: "image/jpeg", ext: "jpg" } : { blob: file, mime: file.type, ext: file.name.split(".").pop()?.toLowerCase() || "jpg" };
  } catch {
    return { blob: file, mime: file.type, ext: file.name.split(".").pop()?.toLowerCase() || "jpg" };
  }
}

const fmtSize = (b: number) => (b > 1024 * 1024 ? `${fmtD(b / 1024 / 1024, 1)} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`);

export function Invoices({ expense }: { expense: Expense }) {
  const { cloud, updateExpense } = useStore();
  const [open, setOpen] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState(false);
  const cache = useRef(new Map<string, string>());
  const fileRef = useRef<HTMLInputElement>(null);
  const list = expense.invoices ?? [];
  const sel = list.find((i) => i.id === selId) ?? null;

  useEffect(
    () => () => {
      for (const u of cache.current.values()) URL.revokeObjectURL(u);
    },
    [],
  );

  // Charge la facture sélectionnée.
  useEffect(() => {
    if (!open || !sel) {
      setUrl(null);
      return;
    }
    const cached = cache.current.get(sel.path);
    if (cached) {
      setUrl(cached);
      return;
    }
    const cfg = getSupabaseConfig();
    if (!cfg) return;
    let alive = true;
    setLoading(true);
    setError("");
    downloadInvoiceFile(cfg, sel.path)
      .then((b) => {
        const u = URL.createObjectURL(new Blob([b], { type: sel.mime || b.type }));
        cache.current.set(sel.path, u);
        if (alive) setUrl(u);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Lecture impossible.");
        setSetup(e instanceof InvoiceStorageError && e.setupNeeded);
        setUrl(null);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const cfg = getSupabaseConfig();
    const session = getSession();
    if (!cfg || !session) {
      setError("Connexion au cloud indisponible : reconnectez-vous.");
      return;
    }
    setBusy(true);
    setError("");
    setSetup(false);
    let lastId: string | null = null;
    try {
      for (const file of Array.from(files)) {
        if (!(file.type.startsWith("image/") || file.type === "application/pdf")) {
          throw new Error(`« ${file.name} » : seuls les photos (JPG, PNG…) et les PDF sont acceptés.`);
        }
        const { blob, mime, ext } = await shrinkImage(file);
        if (blob.size > MAX_BYTES) throw new Error(`« ${file.name} » dépasse ${MAX_BYTES / 1024 / 1024} Mo.`);
        const id = uid();
        const path = `${session.userId}/${cloud.projectId}/${expense.id}/${id}.${ext}`;
        await uploadInvoiceFile(cfg, path, blob, mime);
        const inv: Invoice = { id, name: file.name, mime, size: blob.size, path, addedAt: new Date().toISOString() };
        updateExpense(expense.id, (e) => ({ ...e, invoices: [...(e.invoices ?? []), inv] }));
        lastId = id;
      }
      if (lastId) setSelId(lastId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
      setSetup(e instanceof InvoiceStorageError && e.setupNeeded);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (inv: Invoice) => {
    if (!window.confirm(`Supprimer la facture « ${inv.name} » ?`)) return;
    const cfg = getSupabaseConfig();
    try {
      if (cfg) await deleteInvoiceFile(cfg, inv.path);
    } catch {
      /* le fichier est peut-être déjà absent : on retire quand même la référence */
    }
    const u = cache.current.get(inv.path);
    if (u) {
      URL.revokeObjectURL(u);
      cache.current.delete(inv.path);
    }
    updateExpense(expense.id, (e) => ({ ...e, invoices: (e.invoices ?? []).filter((i) => i.id !== inv.id) }));
    if (selId === inv.id) setSelId(null);
  };

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(INVOICES_SQL);
    } catch {
      window.prompt("Copiez ce script SQL :", INVOICES_SQL);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (!selId && list[0]) setSelId(list[0].id);
        }}
        title="Factures de cette dépense"
        className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold ${list.length ? "border-forest text-forest" : "border-rule text-stone-500"}`}
      >
        <Paperclip size={13} /> {list.length || "Ajouter"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3" onClick={() => setOpen(false)}>
          <div
            className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-paper shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-rule bg-white px-4 py-3">
              <div>
                <div className="font-display text-lg font-bold">Factures</div>
                <div className="text-xs text-stone-500">
                  {expense.label || "Dépense sans libellé"}
                  {expense.vendor ? ` · ${expense.vendor}` : ""}
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-paper-2" title="Fermer">
                <X size={18} />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 md:grid-cols-[280px_1fr]">
              <div className="flex min-h-0 flex-col border-b border-rule bg-white md:border-b-0 md:border-r">
                <div className="p-3">
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
                  <Btn onClick={() => fileRef.current?.click()} disabled={busy}>
                    <Upload size={14} /> {busy ? "Envoi…" : "Ajouter des factures"}
                  </Btn>
                  <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
                    Photos (JPG, PNG…) ou PDF, 15 Mo maximum. Les photos sont allégées automatiquement.
                  </p>
                </div>
                <ul className="min-h-0 flex-1 space-y-1 overflow-auto px-3 pb-3">
                  {list.map((inv) => (
                    <li key={inv.id}>
                      <div className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${inv.id === selId ? "border-terra bg-orange-50" : "border-rule"}`}>
                        <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setSelId(inv.id)}>
                          <FileText size={16} className="shrink-0 text-stone-500" />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold">{inv.name}</span>
                            <span className="block text-[10px] text-stone-400">
                              {fmtSize(inv.size)} · {new Date(inv.addedAt).toLocaleDateString("fr-FR")}
                            </span>
                          </span>
                        </button>
                        <button title="Supprimer" className="rounded p-1 text-red-700 hover:bg-red-50" onClick={() => remove(inv)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  ))}
                  {!list.length && <li className="text-xs text-stone-400">Aucune facture pour cette dépense.</li>}
                </ul>
              </div>

              <div className="relative flex min-h-0 flex-col bg-stone-100">
                {error && (
                  <div className="m-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                    {error}
                    {setup && (
                      <div className="mt-2">
                        <pre className="max-h-40 overflow-auto rounded-lg bg-white p-2 font-mono text-[10px] text-stone-700">{INVOICES_SQL}</pre>
                        <Btn className="mt-2" onClick={copySql}>
                          Copier le script SQL
                        </Btn>
                        <p className="mt-1 text-[11px]">
                          Collez-le dans Supabase → SQL Editor → Run, puis réessayez.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {loading && <div className="m-auto text-sm text-stone-500">Chargement de la facture…</div>}
                {!loading && !sel && !error && <div className="m-auto text-sm text-stone-400">Sélectionnez une facture pour la lire.</div>}
                {!loading && sel && url && (
                  <>
                    <div className="flex items-center justify-between gap-2 border-b border-rule bg-white px-3 py-2 text-xs">
                      <span className="truncate font-semibold">{sel.name}</span>
                      <span className="flex shrink-0 gap-3">
                        <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-terra">
                          <ExternalLink size={13} /> Ouvrir
                        </a>
                        <a href={url} download={sel.name} className="flex items-center gap-1 text-terra">
                          <Download size={13} /> Télécharger
                        </a>
                      </span>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto">
                      {sel.mime === "application/pdf" ? (
                        <iframe title={sel.name} src={url} className="h-full min-h-[60vh] w-full bg-white" />
                      ) : (
                        <img src={url} alt={sel.name} className="mx-auto max-w-full" />
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
