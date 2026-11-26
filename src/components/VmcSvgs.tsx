const NEUF = "#2563eb";
const VICIE = "#ea580c";
const TEMP = "#16a34a";
const INK = "#1f2937";

const Arrow = ({ id, color }: { id: string; color: string }) => (
  <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill={color} />
  </marker>
);

const T = ({ x, y, children, size = 11, anchor = "middle", bold = false, fill = INK }: { x: number | string; y: number | string; children: React.ReactNode; size?: number; anchor?: "start" | "middle" | "end"; bold?: boolean; fill?: string }) => (
  <text x={x} y={y} fontSize={size} textAnchor={anchor} fontWeight={bold ? 700 : 400} fill={fill} fontFamily="Helvetica, Arial, sans-serif">
    {children}
  </text>
);

/** Schéma : VMC simple flux. */
export function SvgVmcSimple() {
  return (
    <svg viewBox="0 0 560 260" className="w-full" role="img" aria-label="VMC simple flux">
      <defs>
        <Arrow id="s-n" color={NEUF} />
        <Arrow id="s-v" color={VICIE} />
      </defs>
      <rect x="40" y="70" width="480" height="150" fill="#fafaf9" stroke={INK} strokeWidth="2" />
      <line x1="280" y1="70" x2="280" y2="220" stroke={INK} strokeWidth="1.5" strokeDasharray="5 4" />
      <T x="160" y="205" bold>Pièces de vie</T>
      <T x="400" y="205" bold>Pièces humides</T>
      <T x="160" y="190" size={10}>séjour · chambres · bureau</T>
      <T x="400" y="190" size={10}>cuisine · salle de bain · WC</T>
      {/* entrées d'air */}
      {[110, 210].map((x) => (
        <g key={x}>
          <line x1={x} y1="20" x2={x} y2="68" stroke={NEUF} strokeWidth="3" markerEnd="url(#s-n)" />
          <rect x={x - 14} y="66" width="28" height="8" fill={NEUF} />
        </g>
      ))}
      <T x="160" y="14" size={11} fill={NEUF} bold>Entrées d'air (air neuf)</T>
      {/* circulation */}
      <line x1="150" y1="130" x2="340" y2="130" stroke={NEUF} strokeWidth="3" markerEnd="url(#s-n)" strokeDasharray="2 0" />
      <T x="250" y="122" size={10} fill={NEUF}>l'air traverse la maison</T>
      <T x="250" y="146" size={10} fill={NEUF}>(portes détalonnées)</T>
      {/* bouches + caisson */}
      {[360, 440].map((x) => (
        <g key={x}>
          <circle cx={x} cy="95" r="9" fill="#fff" stroke={VICIE} strokeWidth="3" />
          <path d={`M${x} 86 L${x} 50 L${x < 400 ? 395 : 430} 50`} fill="none" stroke={VICIE} strokeWidth="3" />
        </g>
      ))}
      <rect x="395" y="34" width="70" height="32" rx="4" fill="#fff" stroke={INK} strokeWidth="2" />
      <T x="430" y="54" size={11} bold>Caisson</T>
      <line x1="465" y1="50" x2="540" y2="50" stroke={VICIE} strokeWidth="3" markerEnd="url(#s-v)" />
      <T x="510" y="40" size={10} fill={VICIE} bold>Rejet</T>
      <T x="400" y="125" size={10} fill={VICIE}>bouches d'extraction</T>
    </svg>
  );
}

/** Schéma : VMC double flux. */
export function SvgVmcDouble() {
  return (
    <svg viewBox="0 0 560 280" className="w-full" role="img" aria-label="VMC double flux">
      <defs>
        <Arrow id="d-n" color={NEUF} />
        <Arrow id="d-v" color={VICIE} />
        <Arrow id="d-t" color={TEMP} />
      </defs>
      <rect x="40" y="110" width="330" height="140" fill="#fafaf9" stroke={INK} strokeWidth="2" />
      <line x1="210" y1="110" x2="210" y2="250" stroke={INK} strokeWidth="1.5" strokeDasharray="5 4" />
      <T x="125" y="238" bold>Pièces de vie</T>
      <T x="290" y="238" bold>Pièces humides</T>
      {/* échangeur */}
      <rect x="400" y="30" width="150" height="150" rx="6" fill="#fff" stroke={INK} strokeWidth="2" />
      <T x="475" y="50" bold>Caisson double flux</T>
      <rect x="440" y="70" width="70" height="70" fill="#fef3c7" stroke={INK} strokeWidth="1.5" transform="rotate(45 475 105)" />
      <T x="475" y="108" size={10} bold>Échangeur</T>
      <T x="475" y="121" size={9}>de chaleur</T>
      {/* air neuf */}
      <line x1="560" y1="170" x2="520" y2="170" stroke={NEUF} strokeWidth="3" />
      <T x="520" y="196" size={10} fill={NEUF} bold anchor="middle">Air neuf (froid)</T>
      <line x1="403" y1="150" x2="403" y2="150" stroke={NEUF} />
      <path d="M545 170 L545 150" stroke="none" />
      {/* insufflation */}
      <path d="M400 150 L125 150 L125 125" fill="none" stroke={TEMP} strokeWidth="3" markerEnd="url(#d-t)" />
      <T x="250" y="144" size={10} fill={TEMP} bold>Air neuf réchauffé → pièces de vie</T>
      {/* extraction */}
      <path d="M290 125 L290 70 L400 70" fill="none" stroke={VICIE} strokeWidth="3" markerEnd="url(#d-v)" />
      <T x="330" y="64" size={10} fill={VICIE} bold>Air vicié ← pièces humides</T>
      {/* rejet */}
      <line x1="475" y1="30" x2="475" y2="6" stroke={VICIE} strokeWidth="3" markerEnd="url(#d-v)" />
      <T x="510" y="14" size={10} fill={VICIE} bold anchor="start">Rejet</T>
      <T x="290" y="270" size={10}>Pas d'entrées d'air dans les fenêtres</T>
    </svg>
  );
}

/** Schéma : réseau de gaines (vue de dessus). */
export function SvgVmcReseau() {
  const bouche = (x: number, y: number, l: string) => (
    <g key={l}>
      <circle cx={x} cy={y} r="9" fill="#fff" stroke={VICIE} strokeWidth="3" />
      <T x={x} y={y + 24} size={10}>{l}</T>
    </g>
  );
  return (
    <svg viewBox="0 0 560 250" className="w-full" role="img" aria-label="Réseau de gaines VMC">
      <rect x="20" y="20" width="520" height="210" fill="#fafaf9" stroke={INK} strokeWidth="2" />
      <rect x="60" y="100" width="56" height="40" rx="4" fill="#fff" stroke={INK} strokeWidth="2" />
      <T x="88" y="124" size={11} bold>Caisson</T>
      {/* gaine principale Ø125 */}
      <line x1="116" y1="120" x2="300" y2="120" stroke="#0f172a" strokeWidth="6" />
      <T x="208" y="110" size={10} bold>Gaine Ø125</T>
      {/* té */}
      <circle cx="300" cy="120" r="7" fill="#0f172a" />
      <T x="300" y="146" size={10} bold>Té</T>
      {/* branches Ø80 */}
      <path d="M300 120 L300 60 L420 60" fill="none" stroke="#334155" strokeWidth="3" />
      <path d="M300 120 L420 120" fill="none" stroke="#334155" strokeWidth="3" />
      <path d="M300 120 L300 190 L420 190" fill="none" stroke="#334155" strokeWidth="3" />
      {bouche(430, 60, "Cuisine")}
      {bouche(430, 120, "Salle de bain")}
      {bouche(430, 190, "WC")}
      <T x="360" y="52" size={10}>Ø80</T>
      <T x="360" y="112" size={10}>Ø80</T>
      <T x="360" y="182" size={10}>Ø80</T>
      <line x1="88" y1="100" x2="88" y2="40" stroke={VICIE} strokeWidth="3" markerEnd="url(#r-v)" />
      <defs>
        <Arrow id="r-v" color={VICIE} />
      </defs>
      <T x="88" y="34" size={10} fill={VICIE} bold>Rejet dehors</T>
    </svg>
  );
}
