import type {
  IsolantProduct,
  IsolQuality,
  PlaqueType,
  PostId,
  RoomType,
} from "../types";

export const POSTS: {
  id: PostId;
  label: string;
  short: string;
  color: string;
  blurb: string;
}[] = [
  { id: "placo", label: "Placo & cloisons", short: "Placo", color: "#6e9c81", blurb: "Plaques, ossatures, bandes, enduits, vis" },
  { id: "isolation", label: "Isolation", short: "Isolant", color: "#4f7a63", blurb: "Murs, cloisons, appuis, GTL, étanchéité" },
  { id: "electricite", label: "Électricité", short: "Élec.", color: "#c2a756", blurb: "NFC 15-100, prises, tableau, câbles" },
  { id: "sanitaire", label: "Sanitaire", short: "Sanit.", color: "#8493b6", blurb: "Eau, évacuations, appareils" },
  { id: "vmc", label: "VMC", short: "VMC", color: "#659ca0", blurb: "Simple ou double flux, gaines, bouches" },
  { id: "chauffage", label: "Chauffage", short: "Chauff.", color: "#bf7e89", blurb: "Plancher chauffant, PAC, collecteurs" },
  { id: "peinture", label: "Peinture", short: "Peint.", color: "#9b85b8", blurb: "Sous-couche, murs, plafonds, sols" },
  { id: "carrelage", label: "Carrelage & sols", short: "Sols", color: "#858b72", blurb: "Carreaux, natte, colle, joints" },
  { id: "quincaillerie", label: "Quincaillerie", short: "Quinc.", color: "#8a8577", blurb: "Portes, poignées, plinthes, vis, EPI" },
];

export const ROOM_TYPES: {
  id: RoomType;
  label: string;
  wet: boolean;
  defaultTile: boolean;
  defaultHeating: boolean;
  hydro: boolean;
}[] = [
  { id: "salon", label: "Salon", wet: false, defaultTile: false, defaultHeating: true, hydro: false },
  { id: "sejour", label: "Séjour", wet: false, defaultTile: false, defaultHeating: true, hydro: false },
  { id: "salle_manger", label: "Salle à manger", wet: false, defaultTile: false, defaultHeating: true, hydro: false },
  { id: "cuisine", label: "Cuisine", wet: true, defaultTile: true, defaultHeating: true, hydro: true },
  { id: "chambre", label: "Chambre", wet: false, defaultTile: false, defaultHeating: true, hydro: false },
  { id: "bureau", label: "Bureau", wet: false, defaultTile: false, defaultHeating: true, hydro: false },
  { id: "sdb", label: "Salle de bain", wet: true, defaultTile: true, defaultHeating: true, hydro: true },
  { id: "sde", label: "Salle d'eau", wet: true, defaultTile: true, defaultHeating: true, hydro: true },
  { id: "wc", label: "WC", wet: true, defaultTile: true, defaultHeating: false, hydro: true },
  { id: "buanderie", label: "Buanderie", wet: true, defaultTile: true, defaultHeating: false, hydro: true },
  { id: "cellier", label: "Cellier", wet: false, defaultTile: true, defaultHeating: false, hydro: false },
  { id: "dressing", label: "Dressing", wet: false, defaultTile: false, defaultHeating: true, hydro: false },
  { id: "entree", label: "Entrée", wet: false, defaultTile: true, defaultHeating: true, hydro: false },
  { id: "couloir", label: "Couloir", wet: false, defaultTile: true, defaultHeating: true, hydro: false },
  { id: "degagement", label: "Dégagement", wet: false, defaultTile: true, defaultHeating: true, hydro: false },
  { id: "palier", label: "Palier", wet: false, defaultTile: true, defaultHeating: true, hydro: false },
  { id: "escalier", label: "Escalier", wet: false, defaultTile: false, defaultHeating: false, hydro: false },
  { id: "garage", label: "Garage", wet: false, defaultTile: false, defaultHeating: false, hydro: false },
  { id: "combles", label: "Combles", wet: false, defaultTile: false, defaultHeating: false, hydro: false },
  { id: "autre", label: "Autre", wet: false, defaultTile: false, defaultHeating: true, hydro: false },
];

export const ROOM_COLORS = [
  "#6e9c81", "#d09762", "#8493b6", "#bf7e89", "#9b85b8",
  "#659ca0", "#c2a756", "#858b72", "#4f7a63", "#b08968",
  "#7d9bc0", "#a49a86", "#8a8577", "#6b7f99", "#98a67a",
];

export const ISOLANTS: IsolantProduct[] = [
  { id: "fb036-120", name: "Fibre de bois semi-rigide λ036", family: "fibre_bois", lambda: 0.036, thickness: 120, panelL: 1.35, panelW: 0.575, priceM2: 18.9, usages: ["mur", "cloison", "plafond"], bio: true, notes: "Steico Flex / Isonat — excellent hygrothermique, déphasage." },
  { id: "fb036-145", name: "Fibre de bois semi-rigide λ036", family: "fibre_bois", lambda: 0.036, thickness: 145, panelL: 1.35, panelW: 0.575, priceM2: 22.4, usages: ["mur", "plafond"], bio: true, notes: "Épaisseur RE2020 confort, R≈4,03." },
  { id: "fb036-160", name: "Fibre de bois semi-rigide λ036", family: "fibre_bois", lambda: 0.036, thickness: 160, panelL: 1.35, panelW: 0.575, priceM2: 24.8, usages: ["mur", "plafond"], bio: true, notes: "Très bien isolé, R≈4,44." },
  { id: "fb036-200", name: "Fibre de bois semi-rigide λ036", family: "fibre_bois", lambda: 0.036, thickness: 200, panelL: 1.22, panelW: 0.575, priceM2: 31.5, usages: ["mur", "plafond"], bio: true, notes: "Performance haute, R≈5,55." },
  { id: "fb038-80", name: "Fibre de bois semi-rigide λ038", family: "fibre_bois", lambda: 0.038, thickness: 80, panelL: 1.35, panelW: 0.575, priceM2: 12.4, usages: ["mur", "cloison"], bio: true, notes: "Cloisons / complément d'isolation." },
  { id: "fb038-100", name: "Fibre de bois semi-rigide λ038", family: "fibre_bois", lambda: 0.038, thickness: 100, panelL: 1.35, panelW: 0.575, priceM2: 15.2, usages: ["mur", "cloison", "plafond"], bio: true, notes: "Polyvalent, R≈2,63." },
  { id: "lv032-100", name: "Laine de verre GR32", family: "laine_verre", lambda: 0.032, thickness: 100, panelL: 1.35, panelW: 0.6, priceM2: 7.9, usages: ["mur", "cloison", "plafond"], bio: false, notes: "Bon rapport R/prix, irritant à la pose." },
  { id: "lv032-120", name: "Laine de verre GR32", family: "laine_verre", lambda: 0.032, thickness: 120, panelL: 1.35, panelW: 0.6, priceM2: 9.4, usages: ["mur", "plafond"], bio: false, notes: "R≈3,75 — seuil RE2020 murs bas." },
  { id: "lv032-160", name: "Laine de verre GR32", family: "laine_verre", lambda: 0.032, thickness: 160, panelL: 1.35, panelW: 0.6, priceM2: 12.1, usages: ["mur", "plafond"], bio: false, notes: "R≈5,00 — très bien isolé." },
  { id: "lv032-200", name: "Laine de verre GR32", family: "laine_verre", lambda: 0.032, thickness: 200, panelL: 1.35, panelW: 0.6, priceM2: 14.8, usages: ["mur", "plafond"], bio: false, notes: "R≈6,25 — excellent." },
  { id: "lr035-75", name: "Laine de roche acoustique", family: "laine_roche", lambda: 0.035, thickness: 75, panelL: 1.35, panelW: 0.6, priceM2: 8.6, usages: ["cloison"], bio: false, notes: "Idéale cloisons phoniques, incombustible." },
  { id: "lr035-100", name: "Laine de roche", family: "laine_roche", lambda: 0.035, thickness: 100, panelL: 1.35, panelW: 0.6, priceM2: 10.5, usages: ["mur", "cloison", "plafond"], bio: false, notes: "Feu + acoustique." },
  { id: "lr035-140", name: "Laine de roche", family: "laine_roche", lambda: 0.035, thickness: 140, panelL: 1.35, panelW: 0.6, priceM2: 13.9, usages: ["mur", "plafond"], bio: false, notes: "R≈4,00." },
  { id: "ouate-100", name: "Ouate de cellulose (panneau)", family: "ouate", lambda: 0.039, thickness: 100, panelL: 1.2, panelW: 0.6, priceM2: 14.2, usages: ["mur", "cloison", "plafond"], bio: true, notes: "Recyclée, bon déphasage." },
  { id: "ouate-145", name: "Ouate de cellulose (panneau)", family: "ouate", lambda: 0.039, thickness: 145, panelL: 1.2, panelW: 0.6, priceM2: 19.5, usages: ["mur", "plafond"], bio: true, notes: "R≈3,72." },
  { id: "chanvre-100", name: "Laine de chanvre", family: "chanvre", lambda: 0.04, thickness: 100, panelL: 1.2, panelW: 0.6, priceM2: 16.8, usages: ["mur", "cloison"], bio: true, notes: "Biosourcé, régulateur d'humidité." },
  { id: "chanvre-145", name: "Laine de chanvre", family: "chanvre", lambda: 0.04, thickness: 145, panelL: 1.2, panelW: 0.6, priceM2: 23.4, usages: ["mur", "plafond"], bio: true, notes: "R≈3,63." },
  { id: "metisse-100", name: "Métisse (textile recyclé)", family: "metisse", lambda: 0.039, thickness: 100, panelL: 1.2, panelW: 0.6, priceM2: 13.5, usages: ["mur", "cloison"], bio: true, notes: "Issu de vêtements recyclés." },
  { id: "liege-80", name: "Liège expansé", family: "liege", lambda: 0.04, thickness: 80, panelL: 1.0, panelW: 0.5, priceM2: 28.0, usages: ["mur", "sol"], bio: true, notes: " imputrescible, isolant phonique." },
  { id: "biofib-120", name: "Biofib Trio (chanvre/lin/coton)", family: "biofib", lambda: 0.038, thickness: 120, panelL: 1.25, panelW: 0.6, priceM2: 19.9, usages: ["mur", "cloison", "plafond"], bio: true, notes: "Très agréable à poser." },
  { id: "pu-80", name: "Polyuréthane PIR", family: "pu", lambda: 0.022, thickness: 80, panelL: 2.4, panelW: 1.2, priceM2: 22.0, usages: ["sol", "mur"], bio: false, notes: "R élevé à faible épaisseur, attention à la vapeur." },
  { id: "pu-100", name: "Polyuréthane PIR", family: "pu", lambda: 0.022, thickness: 100, panelL: 2.4, panelW: 1.2, priceM2: 26.5, usages: ["sol", "mur"], bio: false, notes: "R≈4,55 — plancher bas / sol chauffant." },
  { id: "xps-40", name: "XPS sol chauffant", family: "xps", lambda: 0.034, thickness: 40, panelL: 1.25, panelW: 0.6, priceM2: 9.8, usages: ["sol"], bio: false, notes: "Dalles à plots ou rainurées plancher chauffant." },
  { id: "xps-60", name: "XPS sol", family: "xps", lambda: 0.034, thickness: 60, panelL: 1.25, panelW: 0.6, priceM2: 13.2, usages: ["sol"], bio: false, notes: "Plancher intermédiaire." },
  { id: "xps-100", name: "XPS sol", family: "xps", lambda: 0.033, thickness: 100, panelL: 1.25, panelW: 0.6, priceM2: 19.4, usages: ["sol"], bio: false, notes: "Plancher bas sur local non chauffé / terre-plein." },
  { id: "lv-cloison-45", name: "Laine de verre cloison 45 mm", family: "laine_verre", lambda: 0.037, thickness: 45, panelL: 1.35, panelW: 0.6, priceM2: 3.9, usages: ["cloison"], bio: false, notes: "Remplissage ossature 48." },
  { id: "lv-cloison-70", name: "Laine de verre cloison 70 mm", family: "laine_verre", lambda: 0.037, thickness: 70, panelL: 1.35, panelW: 0.6, priceM2: 5.4, usages: ["cloison"], bio: false, notes: "Ossature 70, meilleur phonique." },
];

export function rValue(lambda: number, thicknessMm: number) {
  return thicknessMm / 1000 / lambda;
}

export const QUALITY_TARGETS: Record<IsolQuality, { label: string; rMur: number; rSol: number; rPlafond: number; desc: string }> = {
  tres_bien: {
    label: "Très bien isolé",
    rMur: 5.0,
    rSol: 4.5,
    rPlafond: 7.0,
    desc: "Confort RE2020 haut de gamme, factures minimales, déphasage été.",
  },
  bien: {
    label: "Bien isolé",
    rMur: 4.0,
    rSol: 3.2,
    rPlafond: 6.0,
    desc: "Cible RE2020 / rénovation performante. Recommandé.",
  },
  correct: {
    label: "Correct",
    rMur: 3.2,
    rSol: 2.2,
    rPlafond: 4.5,
    desc: "Minimum acceptable, un peu juste vis-à-vis RE2020 murs.",
  },
  minimal: {
    label: "Peu isolé",
    rMur: 2.2,
    rSol: 1.0,
    rPlafond: 3.0,
    desc: "Non conforme RE2020. À éviter sauf contrainte d'épaisseur.",
  },
};

export const PLAQUE_INFO: Record<PlaqueType, { label: string; thickness: number; weight: number; usage: string }> = {
  ba13: { label: "BA13 standard", thickness: 12.5, weight: 9, usage: "Pièces sèches, doublage, cloisons courantes" },
  hydro: { label: "BA13 hydrofugé (verte)", thickness: 12.5, weight: 9.5, usage: "SDB, SDE, WC, cuisine, buanderie — DTU 25.41" },
  phonique: { label: "BA13 phonique (bleue)", thickness: 12.5, weight: 12, usage: "Chambres, séjour mitoyen, cloisons acoustiques" },
  feu: { label: "BA13 / BA15 feu (rose)", thickness: 12.5, weight: 10, usage: "Dégagements, garage, local technique" },
  ba15: { label: "BA15", thickness: 15, weight: 12.5, usage: "Plafonds, grandes portées, rigidité" },
  haute_durete: { label: "Haute dureté / impact", thickness: 12.5, weight: 13, usage: "Couloirs, pièces exposées aux chocs" },
};

export interface ElecNorm {
  prisesMin: number;
  prisesPerM2?: number;
  interrupteurs: number;
  dcl: number;
  rj45: number;
  tv: number;
  specialised: string[];
  placement: string[];
  notes: string[];
}

export const ELEC_NORMS: Record<RoomType, ElecNorm> = {
  salon: {
    prisesMin: 5,
    prisesPerM2: 0.25,
    interrupteurs: 1,
    dcl: 1,
    rj45: 2,
    tv: 1,
    specialised: ["Commande volet", "Prise box / brassage"],
    placement: [
      "1 prise tous les 4 m² (NFC 15-100)",
      "Répartir sur tous les murs, jamais un seul pan",
      "Espace TV : 2 prises + RJ45 + coaxial à 30 cm du sol, derrière le meuble",
      "Interrupteur à 1,10 m du sol, côté poignée, 10 cm du chambranle",
      "Prévoir va-et-vient si 2 accès",
    ],
    notes: ["Minimum 5 prises 16A", "Au moins 1 circuit dédié si séjour > 28 m²"],
  },
  sejour: {
    prisesMin: 5,
    prisesPerM2: 0.25,
    interrupteurs: 1,
    dcl: 1,
    rj45: 2,
    tv: 1,
    specialised: ["Commande volet"],
    placement: ["1 prise / 4 m²", "TV + RJ45", "Inter près de la porte"],
    notes: ["Idem salon"],
  },
  salle_manger: {
    prisesMin: 4,
    prisesPerM2: 0.25,
    interrupteurs: 1,
    dcl: 1,
    rj45: 1,
    tv: 0,
    specialised: [],
    placement: ["Prises réparties", "Point lumineux centré table"],
    notes: [],
  },
  cuisine: {
    prisesMin: 6,
    interrupteurs: 1,
    dcl: 2,
    rj45: 1,
    tv: 0,
    specialised: [
      "Circuit plaque 32A (6 mm²)",
      "Four 20A",
      "Lave-vaisselle 20A",
      "Lave-linge 20A (si cuisine)",
      "Hotte 16A",
      "Frigo 16A dédié recommandé",
      "Congélateur 16A",
    ],
    placement: [
      "6 prises au-dessus du plan de travail (hors évier et plaques, 8 cm mini des bords)",
      "Hauteur prises plan de travail : 8 à 25 cm au-dessus du plan",
      "Éclairage général + éclairage plan de travail",
      "Inter visibilité dès l'entrée",
    ],
    notes: ["NFC 15-100 : 6 prises plan de travail minimum si linéaire > 3 m, sinon 3", "Aucun appareil dans volume 0/1 évier"],
  },
  chambre: {
    prisesMin: 3,
    interrupteurs: 1,
    dcl: 1,
    rj45: 1,
    tv: 1,
    specialised: ["Commande volet"],
    placement: [
      "1 prise de chaque côté du lit (tête de lit)",
      "1 prise sur un autre mur (bureau / TV)",
      "Inter côté ouverture de porte, 1,10 m",
      "RJ45 proche de la prise TV ou bureau",
    ],
    notes: ["Minimum 3 prises", "Va-et-vient si dressing / 2 portes"],
  },
  bureau: {
    prisesMin: 4,
    interrupteurs: 1,
    dcl: 1,
    rj45: 2,
    tv: 0,
    specialised: ["Prise onduleur"],
    placement: ["2+ prises au poste de travail", "2 RJ45 (box / PC)", "Éclairage direct + indirect"],
    notes: ["Prévoir un circuit prises dédié si télétravail intensif"],
  },
  sdb: {
    prisesMin: 1,
    interrupteurs: 1,
    dcl: 1,
    rj45: 0,
    tv: 0,
    specialised: ["Sèche-serviettes 16A", "VMC (si non centralisée)", "Éclairage miroir"],
    placement: [
      "Respecter les volumes 0, 1, 2 (NF C 15-100 / NF C 15-100 amendement)",
      "Prise hors volume 0 et 1, IP adapté, à 20-30 cm du plan vasque",
      "Éclairage IP44 mini en volume 2",
      "Sèche-serviettes en volume 2 ou hors volume, classe II",
      "Interrupteur hors volume, à l'entrée",
    ],
    notes: ["Liaison équipotentielle supplémentaire obligatoire", "Pas de 230V en volume 0"],
  },
  sde: {
    prisesMin: 1,
    interrupteurs: 1,
    dcl: 1,
    rj45: 0,
    tv: 0,
    specialised: ["Sèche-serviettes 16A"],
    placement: ["Mêmes règles de volumes que SDB"],
    notes: ["LES + IP44"],
  },
  wc: {
    prisesMin: 1,
    interrupteurs: 1,
    dcl: 1,
    rj45: 0,
    tv: 0,
    specialised: [],
    placement: ["Inter à l'entrée", "Petit éclairage + option prise lave-mains"],
    notes: [],
  },
  buanderie: {
    prisesMin: 3,
    interrupteurs: 1,
    dcl: 1,
    rj45: 0,
    tv: 0,
    specialised: ["Lave-linge 20A", "Sèche-linge 20A", "Chauffe-eau si présent"],
    placement: ["Prises dédiées en 1,20 m pour machines", "Évacuation + arrivée d'eau à proximité"],
    notes: ["Circuits spécialisés non partageables"],
  },
  cellier: {
    prisesMin: 2,
    interrupteurs: 1,
    dcl: 1,
    rj45: 1,
    tv: 0,
    specialised: ["Congélateur 16A"],
    placement: ["Prise congélateur accessible", "Éclairage plafond"],
    notes: [],
  },
  dressing: {
    prisesMin: 1,
    interrupteurs: 1,
    dcl: 1,
    rj45: 0,
    tv: 0,
    specialised: [],
    placement: ["Éclairage linéaire penderie", "Inter à l'entrée"],
    notes: [],
  },
  entree: {
    prisesMin: 1,
    interrupteurs: 1,
    dcl: 1,
    rj45: 0,
    tv: 0,
    specialised: ["Vidéophone / interphone", "Commande éclairage extérieur"],
    placement: ["Va-et-vient vers dégagement", "Prise pour robot / aspirateur"],
    notes: [],
  },
  couloir: {
    prisesMin: 1,
    interrupteurs: 2,
    dcl: 1,
    rj45: 0,
    tv: 0,
    specialised: [],
    placement: ["Va-et-vient aux deux extrémités", "1 prise / 4 m de circulation (min 1)"],
    notes: ["Éclairage sur détecteur possible en complément"],
  },
  degagement: {
    prisesMin: 1,
    interrupteurs: 2,
    dcl: 1,
    rj45: 0,
    tv: 0,
    specialised: [],
    placement: ["Va-et-vient", "1 prise"],
    notes: [],
  },
  palier: {
    prisesMin: 1,
    interrupteurs: 2,
    dcl: 1,
    rj45: 0,
    tv: 0,
    specialised: [],
    placement: ["Va-et-vient étages"],
    notes: [],
  },
  escalier: {
    prisesMin: 0,
    interrupteurs: 2,
    dcl: 1,
    rj45: 0,
    tv: 0,
    specialised: [],
    placement: ["Va-et-vient haut/bas", "Éclairage marches (LED) en option"],
    notes: ["Éclairement mini 150 lux recommandé"],
  },
  garage: {
    prisesMin: 2,
    interrupteurs: 1,
    dcl: 1,
    rj45: 0,
    tv: 0,
    specialised: ["Porte de garage", "Borne VE (prévoir 6 mm² / 16 mm²)", "Congélateur"],
    placement: ["Prises 16A murales 1,20 m", "Éclairage étanche IP"],
    notes: ["Tableau divisionnaire possible"],
  },
  combles: {
    prisesMin: 2,
    interrupteurs: 1,
    dcl: 1,
    rj45: 0,
    tv: 0,
    specialised: [],
    placement: ["Éclairage circulation", "Prise pour entretien"],
    notes: [],
  },
  autre: {
    prisesMin: 2,
    interrupteurs: 1,
    dcl: 1,
    rj45: 0,
    tv: 0,
    specialised: [],
    placement: ["Inter à l'entrée", "Prises réparties"],
    notes: [],
  },
};

export function advisedPrises(type: RoomType, area: number) {
  const n = ELEC_NORMS[type];
  const byArea = n.prisesPerM2 ? Math.ceil(area * n.prisesPerM2) : 0;
  return Math.max(n.prisesMin, byArea);
}

export const POSE_LABELS: Record<string, { label: string; steps: string[] }> = {
  optima_appuis: {
    label: "Système appuis + montants (type Optima)",
    steps: [
      "Tracer l'aplomb et l'épaisseur finale (isolant + GTL + placo)",
      "Fixer les appuis au mur selon calepinage (entraxe 60 cm)",
      "Embrocher les panneaux d'isolant sur les appuis",
      "Clipser les montants / fourrures sur les appuis",
      "Passer les réseaux dans la GTL (entre isolant et placo)",
      "Visser les plaques sur les montants",
    ],
  },
  rails_appuis_gtl: {
    label: "Rails muraux + appuis + GTL + placo",
    steps: [
      "Fixer des rails horizontaux au mur porteur (haut, mi-hauteur, bas)",
      "Monter les appuis sur les rails",
      "Poser les panneaux d'isolant entre / sur appuis",
      "Créer la GTL avec fourrures désolidarisées",
      "Chemins de câbles / gaines dans la GTL",
      "Plaques de plâtre sur fourrures",
    ],
  },
  ossature_deportee: {
    label: "Ossature métallique déportée",
    steps: [
      "Bande résiliente au sol et plafond",
      "Rails haut et bas déportés de l'épaisseur d'isolant",
      "Montants à 60 cm, calés",
      "Isolant entre mur et ossature / entre montants",
      "Réseaux puis placo",
    ],
  },
  colle_contrecloison: {
    label: "Isolant collé + contre-cloison",
    steps: [
      "Coller les panneaux (PU / laine revêtue) au mur",
      "Ossature légère ou fourrures",
      "Placo",
    ],
  },
};

export const RE2020_NOTES = [
  "RE2020 (bâtiment neuf) : isolation, étanchéité à l'air, confort d'été, carbone.",
  "Murs : viser R ≥ 4,0 à 5,0 m².K/W selon zone climatique.",
  "Plancher bas : R ≥ 3,2 à 4,5 (terre-plein / vide sanitaire / local non chauffé).",
  "Plafond / toiture : R ≥ 6,0 à 8,0.",
  "Étanchéité à l'air : Q4Pa-surf ≤ 0,6 m³/(h.m²) en maison individuelle — scotch, membranes, joints, boîtiers étanches.",
  "Ponts thermiques : bande résiliente, rupteurs, traitement des seuils et menuiseries.",
  "Ventilation obligatoire et dimensionnée (avis technique CSTB).",
  "En rénovation, ces cibles restent la référence d'une isolation performante (BBC rénovation / DPE A-B).",
];

export const DTU_REFS: Record<PostId, string[]> = {
  placo: ["DTU 25.41 (ouvrages en plaques de plâtre)", "DTU 25.42 (doublage)", "NF EN 520"],
  isolation: ["DTU 45.10 / 20.1", "Avis techniques isolants", "RE2020 / RT existant"],
  electricite: ["NF C 15-100", "Consuel", "Promotelec"],
  sanitaire: ["DTU 60.1, 60.11, 65.10", "DTU 26.2 (chapes)", "Atrègles plomberie"],
  vmc: ["DTU 68.3", "Avis techniques VMC hygro / DF"],
  chauffage: ["DTU 65.14 (planchers chauffants)", "DTU 65.7", "DESP / PAC"],
  peinture: ["DTU 59.1"],
  carrelage: ["DTU 52.2 (revêtements collés)", "DTU 13.3 / 26.2", "CPT SPEC / SEL"],
  quincaillerie: ["DTU 36.1 (menuiseries bois)", "NF EN 14351"],
};

export const QUALITY_LABEL: Record<IsolQuality, string> = {
  tres_bien: "Très bien isolé",
  bien: "Bien isolé",
  correct: "Correct",
  minimal: "Peu isolé",
};
