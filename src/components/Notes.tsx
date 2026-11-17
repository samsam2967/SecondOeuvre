import { useState } from "react";
import { CheckCheck, ListTodo, Plus, StickyNote, Trash2 } from "lucide-react";
import { useStore } from "../store";
import { uid } from "../utils/id";
import { Btn, Card, H, Input, Textarea } from "./ui";

export function Notes() {
  const { project, setSettings } = useStore();
  const S = project.settings;
  const todos = S.todoList ?? [];
  const [draft, setDraft] = useState("");

  const setTodos = (list: typeof todos) => setSettings({ ...S, todoList: list });

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    setTodos([{ id: uid(), text, done: false }, ...todos]);
    setDraft("");
  };

  const remaining = todos.filter((t) => !t.done).length;

  return (
    <div>
      <H
        kicker="Pense-bête"
        title="Notes & liste"
        sub="Vos notes libres et votre liste de choses à faire ou à ne pas oublier. Tout est enregistré dans votre compte et synchronisé entre vos appareils."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <ListTodo size={18} className="text-forest" />
            <h2 className="font-display text-lg font-bold">Ma liste</h2>
            <span className="ml-auto text-xs text-stone-500">
              {remaining ? `${remaining} à faire` : todos.length ? "tout est fait ✔" : ""}
            </span>
          </div>

          <form
            className="mb-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ex. : racheter 2 sacs d'enduit, appeler le carreleur…"
            />
            <Btn type="submit" disabled={!draft.trim()}>
              <Plus size={15} /> Ajouter
            </Btn>
          </form>

          <ul className="space-y-1.5">
            {todos.map((t) => (
              <li
                key={t.id}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
                  t.done ? "border-rule bg-stone-50" : "border-rule bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={(e) => setTodos(todos.map((x) => (x.id === t.id ? { ...x, done: e.target.checked } : x)))}
                  className="h-4 w-4 shrink-0 accent-forest"
                />
                <input
                  value={t.text}
                  onChange={(e) => setTodos(todos.map((x) => (x.id === t.id ? { ...x, text: e.target.value } : x)))}
                  className={`min-w-0 flex-1 bg-transparent text-sm focus:outline-none ${
                    t.done ? "text-stone-400 line-through" : "text-ink"
                  }`}
                />
                <button
                  onClick={() => setTodos(todos.filter((x) => x.id !== t.id))}
                  className="shrink-0 text-stone-300 hover:text-red-700"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
            {todos.length === 0 && (
              <li className="rounded-lg border border-dashed border-rule px-3 py-6 text-center text-xs text-stone-400">
                Rien pour l'instant — ajoutez votre premier élément ci-dessus.
              </li>
            )}
          </ul>

          {todos.some((t) => t.done) && (
            <div className="mt-3">
              <Btn variant="ghost" onClick={() => setTodos(todos.filter((t) => !t.done))}>
                <CheckCheck size={14} /> Effacer les éléments faits
              </Btn>
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <StickyNote size={18} className="text-gold" />
            <h2 className="font-display text-lg font-bold">Notes libres</h2>
          </div>
          <Textarea
            value={S.notes}
            onChange={(e) => setSettings({ ...S, notes: e.target.value })}
            placeholder={
              "Écrivez ce que vous voulez : références de produits, mesures prises sur place, idées, numéros d'artisans…"
            }
            className="min-h-[320px] font-mono text-[13px] leading-relaxed"
          />
          <p className="mt-2 text-[11px] text-stone-400">Enregistrement automatique à chaque frappe.</p>
        </Card>
      </div>
    </div>
  );
}
