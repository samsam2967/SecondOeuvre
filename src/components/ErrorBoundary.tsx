import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Change quand on change de page : l'erreur est alors oubliée. */
  resetKey: string;
  onUndo: () => void;
  onHome: () => void;
}

/** Évite la page blanche : une erreur sur une page affiche un message avec de quoi repartir, sans perdre le reste du site. */
export class ErrorBoundary extends Component<Props, { error: Error | null; key: string }> {
  state = { error: null as Error | null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: { error: Error | null; key: string }) {
    if (props.resetKey !== state.key) return { error: null, key: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error) {
    console.error("Erreur d'affichage :", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-950">
        <h2 className="font-display mb-2 text-lg font-bold">Cette page n'a pas pu s'afficher</h2>
        <p className="mb-3">
          Tes données ne sont pas perdues. Le plus souvent, la dernière modification a rendu un plan incohérent : essaie d'abord d'annuler cette modification.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-full bg-amber-700 px-4 py-2 font-semibold text-white" onClick={() => { this.props.onUndo(); this.setState({ error: null }); }}>
            ↶ Annuler la dernière modification
          </button>
          <button className="rounded-full border border-amber-700 px-4 py-2 font-semibold" onClick={() => this.setState({ error: null })}>
            Réessayer
          </button>
          <button className="rounded-full border border-amber-700 px-4 py-2 font-semibold" onClick={this.props.onHome}>
            Retour au tableau de bord
          </button>
        </div>
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer">Détail technique</summary>
          <pre className="mt-2 whitespace-pre-wrap">{String(this.state.error?.message ?? this.state.error)}</pre>
        </details>
      </div>
    );
  }
}
