/** Glossaire du second œuvre : chaque fiche affiche automatiquement les termes qu'elle emploie. */
export interface GlossaryEntry {
  term: string;
  /** Variantes à repérer dans le texte (sans accents, minuscules). */
  alias?: string[];
  def: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: "Ossature", alias: ["ossature", "montant", "rail"], def: "Squelette métallique (rails au sol et au plafond + montants verticaux) sur lequel on visse les plaques de plâtre." },
  { term: "Rail", def: "Profilé en U fixé au sol et au plafond : il reçoit les montants." },
  { term: "Montant", def: "Profilé vertical placé entre les rails, généralement tous les 60 cm (entraxe), qui porte les plaques." },
  { term: "Entraxe", def: "Distance mesurée d'axe en axe entre deux montants, solives ou fixations (60 cm en placo, 40 cm pour du lourd)." },
  { term: "BA13", alias: ["ba13", "ba 13"], def: "Plaque de plâtre standard de 12,5 mm d'épaisseur (« Placoplatre » 13)." },
  { term: "Plaque hydro", alias: ["hydro"], def: "Plaque de plâtre verte traitée contre l'humidité, pour salle de bains, WC et cuisine." },
  { term: "Doublage", alias: ["doublage"], def: "Complexe isolant + plaque de plâtre collé ou fixé contre le mur extérieur." },
  { term: "GTL", def: "Gaine Technique de Logement : goulotte verticale qui regroupe tableau, communications et arrivées techniques." },
  { term: "Bande à joint", alias: ["bande a joint", "bande"], def: "Bande papier ou fibre noyée dans l'enduit pour que les joints entre plaques ne fissurent pas." },
  { term: "Enduit de lissage", alias: ["enduit"], def: "Pâte appliquée en fines couches pour rendre la surface parfaitement plane avant peinture." },
  { term: "Q2 / Q3 / Q4", alias: ["q2", "q3", "q4"], def: "Niveaux de finition des plaques (DTU 25.41) : Q2 standard, Q3 pour finition soignée, Q4 pour lumière rasante ou grandes surfaces." },
  { term: "Cornière", def: "Profilé d'angle (métal ou papier-métal) qui protège et dessine un angle sortant." },
  { term: "Bande résiliente", alias: ["resiliente"], def: "Bande souple sous les rails : elle coupe la transmission des bruits et des vibrations." },
  { term: "Pare-vapeur", alias: ["pare-vapeur", "frein-vapeur", "frein vapeur"], def: "Membrane côté chaud de l'isolant qui empêche la vapeur d'eau de s'infiltrer dans le mur et d'y condenser." },
  { term: "Étanchéité à l'air", def: "Absence de fuites d'air parasites dans l'enveloppe : elle conditionne la performance RE2020." },
  { term: "RE2020", def: "Réglementation environnementale qui impose performance énergétique, confort d'été et bilan carbone aux logements neufs." },
  { term: "Résistance thermique (R)", alias: ["resistance thermique", " r = ", "r="], def: "Capacité d'un isolant à freiner la chaleur, en m².K/W. Plus R est grand, meilleur est l'isolant." },
  { term: "Lambda (λ)", alias: ["lambda"], def: "Conductivité thermique d'un matériau en W/m.K : plus elle est faible, plus il isole." },
  { term: "Déphasage", def: "Temps que met la chaleur de l'été pour traverser une paroi : les fibres de bois en offrent beaucoup (confort d'été)." },
  { term: "Pont thermique", alias: ["pont thermique"], def: "Zone où l'isolation est interrompue (angle, plancher, menuiserie) et où la chaleur s'échappe." },
  { term: "Hygroscopique", def: "Matériau qui absorbe puis rend l'humidité de l'air, ce qui régule l'ambiance de la pièce." },
  { term: "NF C 15-100", alias: ["nf c 15-100", "nfc 15-100", "c 15-100"], def: "Norme française de l'installation électrique basse tension dans les logements." },
  { term: "Consuel", def: "Attestation de conformité de l'installation électrique, nécessaire avant le raccordement au réseau." },
  { term: "Circuit", alias: ["circuit"], def: "Ligne électrique protégée par un disjoncteur au tableau (ex. prises 16 A, éclairage, plaque de cuisson)." },
  { term: "Disjoncteur", def: "Protection qui coupe le courant en cas de surcharge ou de court-circuit." },
  { term: "Différentiel 30 mA", alias: ["differentiel", "30 ma"], def: "Dispositif qui coupe en cas de fuite de courant (protège les personnes). Obligatoire sur tous les circuits." },
  { term: "Gaine ICTA", alias: ["icta", "gaine"], def: "Conduit annelé orange dans lequel on tire les fils électriques." },
  { term: "Boîte d'encastrement", alias: ["boite d'encastrement", "boite", "boîte"], def: "Boîtier plastique scellé dans le mur qui reçoit une prise ou un interrupteur." },
  { term: "Boîte de dérivation", alias: ["derivation"], def: "Boîte où l'on raccorde plusieurs fils ; elle doit toujours rester accessible." },
  { term: "Télérupteur", def: "Relais qui permet de commander une lumière depuis plusieurs boutons poussoirs." },
  { term: "Poussoir", def: "Interrupteur à impulsion (sans position fixe), utilisé avec un télérupteur ou un module connecté." },
  { term: "Section", def: "Diamètre utile d'un fil, en mm² : 1,5 mm² pour l'éclairage, 2,5 mm² pour les prises." },
  { term: "PER", def: "Tube plastique souple (polyéthylène réticulé) pour l'eau chaude et froide." },
  { term: "Multicouche", def: "Tube mi-plastique mi-aluminium, rigide, qui garde sa forme : il sert pour l'eau et le chauffage." },
  { term: "Nourrice / collecteur", alias: ["nourrice", "collecteur"], def: "Pièce qui distribue l'eau vers plusieurs départs, chacun avec sa vanne." },
  { term: "Siphon", def: "Coude d'eau qui bloque les mauvaises odeurs de l'évacuation." },
  { term: "Évacuation", alias: ["evacuation"], def: "Tuyau PVC qui emmène les eaux usées vers l'égout, avec une pente de 1 à 3 cm par mètre." },
  { term: "Bâti-support", alias: ["bati-support", "bati support"], def: "Armature métallique qui porte un WC suspendu avant d'être cachée dans la cloison." },
  { term: "Receveur", def: "Bac de douche posé au sol ou encastré." },
  { term: "Vanne d'arrêt", alias: ["vanne"], def: "Robinet qui isole un appareil sans couper toute la maison." },
  { term: "VMC", def: "Ventilation Mécanique Contrôlée : renouvelle l'air en continu." },
  { term: "Simple flux", alias: ["simple flux"], def: "VMC qui extrait l'air vicié des pièces humides ; l'air neuf entre par les entrées d'air des fenêtres." },
  { term: "Double flux", alias: ["double flux"], def: "VMC qui extrait ET insuffle l'air, avec un échangeur qui récupère la chaleur de l'air sorti." },
  { term: "Bouche", alias: ["bouche"], def: "Grille d'extraction ou de soufflage au bout d'une gaine VMC." },
  { term: "Caisson", alias: ["caisson"], def: "Moteur de la VMC qui aspire l'air du réseau de gaines." },
  { term: "Débit", def: "Volume d'air ou d'eau qui passe par heure ou par seconde (m³/h pour la VMC)." },
  { term: "Perte de charge", def: "Résistance au passage de l'air dans les gaines : plus le trajet est long et coudé, plus elle augmente." },
  { term: "Plancher chauffant", alias: ["plancher chauffant"], def: "Tubes d'eau chaude noyés dans la chape, qui chauffent le sol à basse température." },
  { term: "Chape", def: "Couche de mortier ou de liquide qui enrobe les tubes du plancher chauffant et reçoit le carrelage." },
  { term: "Joint de fractionnement", alias: ["fractionnement", "dilatation"], def: "Coupure de la chape ou du carrelage qui laisse la matière se dilater sans fissurer." },
  { term: "Collecteur chauffage", def: "Distribution des boucles du plancher chauffant, avec débitmètres et vannes." },
  { term: "PAC", def: "Pompe À Chaleur : produit le chauffage en puisant la chaleur dehors." },
  { term: "Calepinage", alias: ["calepinage"], def: "Plan de pose qui décide où tombe chaque carreau, pour limiter les chutes et éviter les coupes minuscules." },
  { term: "Quinconce", alias: ["quinconce", "decale", "décalé"], def: "Pose où chaque rangée est décalée de la précédente (1/2, 1/3…) : les joints ne s'alignent pas." },
  { term: "Pose droite", alias: ["pose droite", "joints alignes"], def: "Carreaux alignés en lignes et en colonnes, joints en croix." },
  { term: "Pose en diagonale", alias: ["diagonale", "diag"], def: "Carreaux posés à 45° : plus de coupes et de chutes (+10 à 15 %), effet visuel agrandissant." },
  { term: "Joint de carrelage", alias: ["joint"], def: "Espace rempli de mortier entre deux carreaux (2 à 5 mm selon le carreau)." },
  { term: "Croisillon", def: "Petite croix plastique qui garantit un joint régulier entre carreaux." },
  { term: "Colle double encollage", alias: ["double encollage"], def: "Colle appliquée sur le sol ET au dos du carreau, indispensable pour les grands formats (> 30×30)." },
  { term: "SPEC", alias: ["spec"], def: "Système de Protection à l'Eau sous Carrelage : résine étanche appliquée avant le carrelage des pièces humides." },
  { term: "Natte", alias: ["natte"], def: "Membrane d'étanchéité ou de désolidarisation posée sous le carrelage." },
  { term: "Primaire d'accrochage", alias: ["primaire", "impression"], def: "Produit qui prépare un support (poreux, lisse) pour que la colle ou la peinture adhère." },
  { term: "Sous-couche", alias: ["sous-couche"], def: "Première couche de peinture qui bouche les pores et uniformise le fond." },
  { term: "Satiné / mat", alias: ["satin", "mat"], def: "Aspect de la peinture : mat cache les défauts, satiné se lave mieux (cuisine, salle de bains)." },
  { term: "Lumière rasante", def: "Lumière qui frôle le mur et révèle chaque défaut de surface ; elle justifie la finition Q4." },
  { term: "Huisserie", alias: ["huisserie", "bloc-porte", "bloc porte"], def: "Cadre fixe dans lequel s'articule la porte." },
  { term: "Linteau", def: "Poutre horizontale au-dessus d'une ouverture : elle reprend le poids du mur." },
  { term: "Tableau (de baie)", alias: ["tableau"], def: "Côtés verticaux de l'ouverture d'une porte ou d'une fenêtre, dans l'épaisseur du mur." },
  { term: "Allège", alias: ["allege"], def: "Partie de mur sous une fenêtre, entre le sol et l'appui." },
  { term: "Seuil", def: "Pièce au sol à la limite de deux pièces ou sous une porte." },
  { term: "Arche", def: "Passage ouvert dans un mur, parfois cintré, sans porte." },
  { term: "Plinthe", alias: ["plinthe"], def: "Bandeau qui masque la jonction entre le sol et le mur." },
  { term: "DTU", def: "Document Technique Unifié : règles de l'art d'un type de travaux, référence en cas de litige." },
  { term: "Hors d'eau, hors d'air", alias: ["hors d'eau"], def: "Stade où toiture et menuiseries sont posées : le chantier est protégé de la pluie et du vent." },
  { term: "Niveau laser", alias: ["niveau laser", "laser"], def: "Outil qui projette une ligne horizontale ou verticale pour tracer et contrôler les cotes." },
  { term: "Règle de maçon / règle h", alias: ["regle"], def: "Règle de 2 m pour contrôler la planéité d'un mur ou d'un sol (tolérance 5 mm sous la règle de 2 m)." },
  { term: "Hygrométrie", def: "Taux d'humidité de l'air ou d'un support, à contrôler avant de peindre ou carreler." },
  { term: "Temps de séchage", alias: ["sechage"], def: "Délai à respecter avant l'étape suivante (chape, enduit, colle…) ; l'ignorer provoque fissures et décollements." },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Termes du glossaire réellement présents dans un texte. */
export function glossaryFor(text: string): GlossaryEntry[] {
  const hay = ` ${norm(text)} `;
  return GLOSSARY.filter((g) => {
    const keys = [g.term, ...(g.alias ?? [])].map(norm).filter((k) => k.length >= 3);
    return keys.some((k) => {
      const i = hay.indexOf(k);
      if (i < 0) return false;
      // mots courts : on exige une frontière de mot pour éviter les faux positifs (« mat », « bande »…)
      if (k.length <= 5) return /[^a-z0-9]/.test(hay[i - 1] ?? " ") && /[^a-z0-9]/.test(hay[i + k.length] ?? " ");
      return true;
    });
  });
}

/** Palette : chaque terme du glossaire garde la même couleur dans le texte, le glossaire et le PDF. */
export const GLOSS_COLORS = ["#c2410c", "#2563eb", "#16a34a", "#9333ea", "#db2777", "#0d9488", "#a16207", "#4f46e5"];
export const GLOSS_RGB: [number, number, number][] = GLOSS_COLORS.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
export const glossIndex = (g: GlossaryEntry) => Math.max(0, GLOSSARY.indexOf(g)) % GLOSS_COLORS.length;

export interface TextPart {
  text: string;
  entry?: GlossaryEntry;
}

/** Découpe un texte en morceaux, les mots du glossaire étant repérés (pour les colorer). */
export function splitGlossary(text: string): TextPart[] {
  const nt = norm(text);
  if (nt.length !== text.length) return [{ text }];
  const keys = glossaryFor(text)
    .flatMap((e) => [e.term, ...(e.alias ?? [])].map((k) => ({ k: norm(k).trim(), e })))
    .filter((x) => x.k.length >= 3 && !x.k.includes("="))
    .sort((a, b) => b.k.length - a.k.length);
  const taken: { a: number; b: number; e: GlossaryEntry }[] = [];
  for (const { k, e } of keys) {
    let i = nt.indexOf(k);
    while (i >= 0) {
      const j = i + k.length;
      const okL = !/[a-z0-9]/.test(nt[i - 1] ?? " ");
      const okR = !/[a-z0-9]/.test(nt[j] ?? " ") || k.length > 5;
      if (okL && okR && !taken.some((t) => i < t.b && j > t.a)) taken.push({ a: i, b: j, e });
      i = nt.indexOf(k, i + 1);
    }
  }
  taken.sort((x, y) => x.a - y.a);
  const parts: TextPart[] = [];
  let pos = 0;
  for (const t of taken) {
    if (t.a > pos) parts.push({ text: text.slice(pos, t.a) });
    parts.push({ text: text.slice(t.a, t.b), entry: t.e });
    pos = t.b;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos) });
  return parts.length ? parts : [{ text }];
}

/** Même découpage, sous forme de balisage lisible par le générateur de PDF. */
export const markGlossary = (text: string) => splitGlossary(text).map((p) => (p.entry ? `⟦${glossIndex(p.entry)}|${p.text}⟧` : p.text)).join("");
