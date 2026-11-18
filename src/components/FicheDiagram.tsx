import type { PostId, Project } from "../types";

/** Schéma technique en rapport avec le poste de la fiche, adapté aux réglages du projet. */
export function FicheDiagram({ post, title, project }: { post: PostId | "general"; title: string; project: Project }) {
  const S = project.settings;
  const t = title.toLowerCase();
  const ink = "#2a2823";
  const mut = "#8a867b";
  const Label = ({ x, y, children, anchor = "start" }: { x: number; y: number; children: React.ReactNode; anchor?: "start" | "middle" | "end" }) => (
    <text x={x} y={y} fontSize="11" fill={ink} textAnchor={anchor} fontFamily="system-ui, sans-serif">
      {children}
    </text>
  );
  const Dim = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => (
    <g stroke={mut} strokeWidth="1">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <line x1={x1} y1={y1 - 4} x2={x1} y2={y1 + 4} />
      <line x1={x2} y1={y2 - 4} x2={x2} y2={y2 + 4} />
    </g>
  );

  let body: React.ReactNode;
  let caption = "";

  if (post === "placo" || /cloison|placo|plaque|bande|enduit/.test(t) && post === "general") {
    const sp = Math.round((S.placo.montantSpacing || 0.6) * 100);
    caption = `Cloison en coupe horizontale : rails, montants tous les ${sp} cm, plaque sur chaque face.`;
    body = (
      <g>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={90 + i * 110} y={92} width={10} height={36} fill="#9aa3ad" />
            <rect x={90 + i * 110} y={92} width={26} height={5} fill="#9aa3ad" />
            <rect x={90 + i * 110} y={123} width={26} height={5} fill="#9aa3ad" />
          </g>
        ))}
        <rect x={80} y={80} width={380} height={12} fill="#e6e1d3" stroke={ink} />
        <rect x={80} y={128} width={380} height={12} fill="#e6e1d3" stroke={ink} />
        <Label x={470} y={90}>Plaque BA13 12,5 mm</Label>
        <Label x={470} y={138}>Plaque BA13 12,5 mm</Label>
        <Label x={470} y={113}>Montant M48</Label>
        <rect x={100} y={96} width={110} height={28} fill="#f5d98a" opacity="0.55" />
        <Label x={155} y={114} anchor="middle">isolant</Label>
        <Dim x1={95} y1={165} x2={205} y2={165} />
        <Label x={150} y={182} anchor="middle">entraxe {sp} cm</Label>
        <Label x={80} y={60}>Vis TTPC 25 mm tous les 25 cm · joints décalés de 40 cm</Label>
      </g>
    );
  } else if (post === "isolation") {
    const iso = (S.isolants?.length ? S.isolants : []).find((i) => i.id === S.isolation.isolantMurId);
    const th = iso?.thickness ?? 180;
    caption = `Doublage d'un mur extérieur : ${iso?.name ?? "isolant"} ${th} mm, pare-vapeur côté chaud.`;
    body = (
      <g>
        <rect x={80} y={50} width={90} height={140} fill="#b7b1a2" stroke={ink} />
        <Label x={125} y={125} anchor="middle">Mur porteur</Label>
        <rect x={170} y={50} width={Math.min(150, th * 0.7)} height={140} fill="#d9b982" stroke={ink} />
        <Label x={170 + Math.min(150, th * 0.7) / 2} y={125} anchor="middle">{th} mm</Label>
        <rect x={170 + Math.min(150, th * 0.7)} y={50} width={3} height={140} fill="#3b82f6" />
        <rect x={173 + Math.min(150, th * 0.7)} y={50} width={14} height={140} fill="#e6e1d3" stroke={ink} />
        <Label x={90} y={40}>Extérieur (froid)</Label>
        <Label x={300} y={40}>Intérieur (chaud)</Label>
        <Label x={380} y={90}>Plaque de plâtre</Label>
        <Label x={380} y={110}>Pare-vapeur (ruban aux jonctions)</Label>
        <Label x={380} y={130}>Isolant entre rails/montants</Label>
        <Label x={380} y={150}>Mur existant</Label>
      </g>
    );
  } else if (post === "electricite") {
    caption = "Principe d'un circuit : tableau → disjoncteur et différentiel 30 mA → boîte de dérivation → points.";
    body = (
      <g>
        <rect x={40} y={70} width={90} height={90} rx={6} fill="#fff" stroke={ink} />
        <Label x={85} y={90} anchor="middle">Tableau</Label>
        <rect x={52} y={100} width={22} height={40} fill="#f87171" />
        <rect x={80} y={100} width={22} height={40} fill="#60a5fa" />
        <Label x={63} y={152} anchor="middle">20 A</Label>
        <Label x={91} y={152} anchor="middle">16 A</Label>
        <path d="M130 120 H220" stroke="#1d4ed8" strokeWidth="3" fill="none" />
        <rect x={220} y={105} width={30} height={30} fill="#f5d98a" stroke={ink} />
        <Label x={235} y={152} anchor="middle">dérivation</Label>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <path d={`M250 120 H300 V${60 + i * 60} H350`} stroke="#1d4ed8" strokeWidth="2" fill="none" />
            <rect x={350} y={50 + i * 60} width={26} height={22} fill="#fff" stroke={ink} />
          </g>
        ))}
        <Label x={390} y={65}>Prise 16 A — 2,5 mm² — axe à 30 cm</Label>
        <Label x={390} y={125}>Interrupteur — 1,5 mm² — axe à 110 cm</Label>
        <Label x={390} y={185}>Point lumineux — 1,5 mm²</Label>
        <Label x={40} y={40}>Max. 8 prises (12 possibles) par circuit 16 A / 2,5 mm²</Label>
      </g>
    );
  } else if (post === "sanitaire") {
    caption = "Alimentation et évacuation : eau froide / chaude en haut, évacuation PVC avec pente 1 à 3 cm par mètre.";
    body = (
      <g>
        <path d="M60 60 H420" stroke="#2563eb" strokeWidth="4" />
        <path d="M60 80 H420" stroke="#dc2626" strokeWidth="4" />
        <Label x={430} y={64}>Eau froide (PER bleu)</Label>
        <Label x={430} y={84}>Eau chaude (PER rouge)</Label>
        <rect x={120} y={110} width={90} height={40} rx={8} fill="#fafafa" stroke={ink} />
        <Label x={165} y={134} anchor="middle">Vasque</Label>
        <rect x={300} y={100} width={60} height={50} rx={6} fill="#fafafa" stroke={ink} />
        <Label x={330} y={130} anchor="middle">WC</Label>
        <path d="M165 150 V170 L440 185" stroke="#6b7280" strokeWidth="6" fill="none" />
        <path d="M330 150 V172" stroke="#6b7280" strokeWidth="9" fill="none" />
        <Label x={40} y={200}>Évacuation PVC Ø40 lavabo · Ø100 WC · pente 1 à 3 cm/m · vanne d'arrêt sur chaque appareil</Label>
      </g>
    );
  } else if (post === "vmc") {
    caption = "VMC simple flux : entrées d'air dans les pièces de vie, extraction dans les pièces humides, caisson dans les combles.";
    body = (
      <g>
        <rect x={40} y={30} width={140} height={40} rx={6} fill="#cfe3ee" stroke={ink} />
        <Label x={110} y={55} anchor="middle">Caisson VMC</Label>
        <path d="M110 70 V110 H340 M110 110 V160 M220 110 V160" stroke="#6b7280" strokeWidth="8" fill="none" />
        {[110, 220, 340].map((x, i) => (
          <circle key={x} cx={x} cy={i === 2 ? 110 : 165} r={9} fill="#fff" stroke={ink} strokeWidth="2" />
        ))}
        <Label x={110} y={195} anchor="middle">Bouche SDB</Label>
        <Label x={220} y={195} anchor="middle">Bouche WC</Label>
        <Label x={340} y={138} anchor="middle">Cuisine</Label>
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M${400 + i * 40} 40 l-15 12 h8 v18 h14 v-18 h8 z`} fill="#a7d3a0" stroke={ink} />
        ))}
        <Label x={400} y={95}>Entrées d'air (menuiseries)</Label>
        <Label x={400} y={150}>Gaines isolées, courtes, peu de coudes</Label>
      </g>
    );
  } else if (post === "chauffage") {
    caption = "Plancher chauffant en coupe : dalle, isolant, tubes, chape, revêtement.";
    body = (
      <g>
        <rect x={60} y={150} width={380} height={30} fill="#b7b1a2" stroke={ink} />
        <rect x={60} y={120} width={380} height={30} fill="#d9b982" stroke={ink} />
        <rect x={60} y={70} width={380} height={50} fill="#e8e4da" stroke={ink} />
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx={85 + i * 42} cy={105} r={6} fill="#dc2626" />
        ))}
        <rect x={60} y={58} width={380} height={12} fill="#9ca3af" stroke={ink} />
        <Label x={450} y={166}>Dalle porteuse</Label>
        <Label x={450} y={138}>Isolant sous chape</Label>
        <Label x={450} y={100}>Chape ≥ 5 cm</Label>
        <Label x={450} y={66}>Carrelage + colle</Label>
        <Label x={60} y={40}>Tubes PER Ø16 · pas 15 cm · 100 m max par boucle · désolidariser en pourtour</Label>
      </g>
    );
  } else if (post === "carrelage") {
    const j = S.carrelage.jointMm;
    caption = `Carrelage en coupe (joint ${j} mm) et pose en quinconce comparée à la pose droite.`;
    body = (
      <g>
        <rect x={40} y={150} width={220} height={22} fill="#b7b1a2" stroke={ink} />
        <rect x={40} y={134} width={220} height={16} fill="#60a5fa" opacity="0.6" />
        <rect x={40} y={118} width={220} height={16} fill="#d9b982" />
        <rect x={40} y={98} width={104} height={20} fill="#d6cfc0" stroke={ink} />
        <rect x={146} y={98} width={104} height={20} fill="#d6cfc0" stroke={ink} />
        <Label x={40} y={90}>Carreau</Label>
        <Label x={270} y={112}>Colle (double encollage si &gt; 30×30)</Label>
        <Label x={270} y={146}>SPEC / natte (pièces humides)</Label>
        <Label x={270} y={166}>Chape ou dalle</Label>
        {[0, 1, 2].map((r) => (
          <g key={r}>
            {[0, 1, 2].map((c) => (
              <rect key={c} x={330 + c * 50 + (r % 2) * 25} y={40 + r * 24} width={46} height={20} fill="#d6cfc0" stroke={ink} />
            ))}
          </g>
        ))}
        <Label x={400} y={125} anchor="middle">Quinconce (1/2)</Label>
        {[0, 1].map((r) => (
          <g key={r}>
            {[0, 1, 2].map((c) => (
              <rect key={c} x={330 + c * 50} y={140 + r * 24} width={46} height={20} fill="#d6cfc0" stroke={ink} />
            ))}
          </g>
        ))}
        <Label x={400} y={200} anchor="middle">Pose droite</Label>
      </g>
    );
  } else if (post === "peinture") {
    caption = "Système de peinture : chaque couche a son rôle, le séchage entre les couches est impératif.";
    const layers = [["Support lissé et dépoussiéré", "#e6e1d3"], ["Impression / sous-couche", "#f7f3e8"], ["Finition — 1re couche", "#cdd9e8"], ["Finition — 2e couche", "#a9bcd6"]];
    body = (
      <g>
        {layers.map(([l, c], i) => (
          <g key={l}>
            <rect x={60} y={40 + i * 36} width={200 + i * 30} height={30} fill={c} stroke={ink} />
            <Label x={330 + i * 30} y={60 + i * 36}>{l}</Label>
          </g>
        ))}
        <Label x={60} y={200}>Rouleau 12 mm pour lisse · croisé puis tiré · humidité support &lt; 5 %</Label>
      </g>
    );
  } else if (post === "quincaillerie" || /porte|fenetre|fenêtre|huisserie|arche|passage/.test(t)) {
    caption = "Porte intérieure en élévation : cotes usuelles de la baie, jeu de l'huisserie et du dormant.";
    body = (
      <g>
        <rect x={150} y={30} width={180} height={170} fill="#fff" stroke={ink} strokeWidth="3" />
        <rect x={166} y={46} width={148} height={154} fill="#efe9d8" stroke={ink} />
        <circle cx={296} cy={125} r={4} fill={ink} />
        <Dim x1={150} y1={215} x2={330} y2={215} />
        <Label x={240} y={230} anchor="middle">baie = largeur de porte + 10 cm</Label>
        <Label x={345} y={120}>Hauteur de passage 204 cm</Label>
        <Label x={345} y={140}>Poignée à 105 cm</Label>
        <Label x={345} y={160}>Jeu bas 1 cm</Label>
        <Label x={20} y={70}>Huisserie</Label>
      </g>
    );
  } else {
    caption = "Ordre des travaux : on ferme les murs seulement une fois les réseaux contrôlés.";
    const steps = ["Ossatures", "Isolation", "Réseaux", "Plaques", "Sols", "Peinture", "Finitions"];
    body = (
      <g>
        {steps.map((s, i) => (
          <g key={s}>
            <circle cx={60 + i * 70} cy={110} r={16} fill="#c8512f" />
            <text x={60 + i * 70} y={114} fontSize="12" fill="#fff" textAnchor="middle" fontWeight="700">
              {i + 1}
            </text>
            <Label x={60 + i * 70} y={145} anchor="middle">{s}</Label>
            {i < steps.length - 1 && <line x1={78 + i * 70} y1={110} x2={112 + i * 70} y2={110} stroke={mut} strokeWidth="2" />}
          </g>
        ))}
      </g>
    );
  }

  return (
    <figure className="rounded-xl border border-rule bg-white p-3">
      <svg viewBox="0 0 560 240" className="w-full" role="img" aria-label={caption}>
        {body}
      </svg>
      <figcaption className="mt-1 text-center text-[11px] text-stone-500">Schéma — {caption}</figcaption>
    </figure>
  );
}
