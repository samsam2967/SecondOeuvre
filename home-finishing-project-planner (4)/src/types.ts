export type RoomType =
  | "salon"
  | "sejour"
  | "salle_manger"
  | "cuisine"
  | "chambre"
  | "bureau"
  | "sdb"
  | "sde"
  | "wc"
  | "buanderie"
  | "cellier"
  | "dressing"
  | "entree"
  | "couloir"
  | "degagement"
  | "palier"
  | "escalier"
  | "garage"
  | "combles"
  | "autre";

export type PostId =
  | "placo"
  | "isolation"
  | "electricite"
  | "sanitaire"
  | "vmc"
  | "chauffage"
  | "peinture"
  | "carrelage"
  | "quincaillerie";

export type TaskStatus = "todo" | "doing" | "done" | "blocked";
export type ExpenseStatus = "prevu" | "commande" | "paye";
export type IsolQuality = "tres_bien" | "bien" | "correct" | "minimal";
export type PoseIsolation =
  | "optima_appuis"
  | "rails_appuis_gtl"
  | "ossature_deportee"
  | "colle_contrecloison";
export type VmcType = "simple_hygro_b" | "simple_autoreg" | "double_flux";
export type PlaqueType = "ba13" | "hydro" | "phonique" | "feu" | "ba15" | "haute_durete";
export type SolType = "carrelage" | "parquet" | "souple" | "resine" | "aucun";

export interface Opening {
  id: string;
  type: "porte" | "fenetre" | "baie" | "porte_fenetre" | "trappe";
  width: number;
  height: number;
  wall: "exterieur" | "cloison" | "plafond";
}

export interface Pt {
  x: number;
  y: number;
}

export interface RoomElec {
  override: boolean;
  prises: number;
  interrupteurs: number;
  vaEtVient: number;
  poussoirs: number;
  dcl: number;
  spots: number;
  rj45: number;
  tv: number;
  specialised: string[];
  connected: boolean;
  prisesConnected: boolean;
  interConnected: boolean;
  prisesConnectees: number;
  intersConnectes: number;
  spotsConnectes: number;
  dclConnectes: number;
}

export interface Room {
  id: string;
  floorId: string;
  name: string;
  type: RoomType;
  length: number;
  width: number;
  height: number;
  exteriorWallLength: number;
  openings: Opening[];
  placoWalls: boolean;
  placoCeiling: boolean;
  placoType: PlaqueType;
  paintWalls: boolean;
  paintCeiling: boolean;
  paintFloor: boolean;
  tileFloor: boolean;
  tileWalls: boolean;
  tileWallHeight: number;
  floorHeating: boolean;
  solType: SolType;
  notes: string;
  x: number;
  y: number;
  color: string;
  elec: RoomElec;
  points: Pt[];
  areaM2: number;
  perimeterM: number;
  exteriorEdges: number[];
  wallTypes: Record<string, PlaqueType | "none">;
  /** Prix spécifiques à la pièce — 0 = tarif global de l'onglet Matériaux. */
  prixCarrelageM2: number;
  prixFaienceM2: number;
  /** Dimensions du carreau propre à la pièce (m) — 0 = format global. */
  carreauL: number;
  carreauW: number;
  faienceL: number;
  faienceW: number;
  prixPeintureMurPot: number;
  prixPeinturePlafondPot: number;
  /** Produits du catalogue Matériaux choisis pour cette pièce (vide = produit par défaut). */
  tileSolId?: string;
  tileMurId?: string;
  paintWallId?: string;
  paintCeilId?: string;
}

export interface Partition {
  id: string;
  floorId: string;
  name: string;
  length: number;
  height: number;
  thickness: 48 | 70 | 90 | 100 | 120;
  type: "simple" | "hydro" | "phonique" | "coupe_feu" | "hydro_phonique";
  insulated: boolean;
  roomAId: string;
  roomBId: string;
  doorCount: number;
  doorWidth: number;
}

export interface Floor {
  id: string;
  name: string;
  level: number;
  height: number;
  planImage: string;
  planScale: number;
  planWidth: number;
  planHeight: number;
  rooms: Room[];
  partitions: Partition[];
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  unitPrice: number;
  packQty: number;
  length?: number;
  width?: number;
  height?: number;
  thickness?: number;
  coverage?: number;
  notes?: string;
}

export interface IsolantProduct {
  id: string;
  name: string;
  family: string;
  lambda: number;
  thickness: number;
  panelL: number;
  panelW: number;
  priceM2: number;
  usages: ("mur" | "cloison" | "sol" | "plafond")[];
  bio: boolean;
  notes: string;
}

/** Un carrelage / faïence du catalogue : 1 produit = 1 format + 1 prix + 1 photo. */
export interface TileProduct {
  id: string;
  /** Référence visible, ex. « Grès cérame béton 60×60 » */
  name: string;
  /** Dimensions en mètres (0,6 × 0,6). */
  tileL: number;
  tileW: number;
  /** Prix au m². */
  priceM2: number;
  /** Photo du produit (data-URL compressée) — optionnel. */
  photo?: string;
  /** Lien d'achat — optionnel. */
  link?: string;
  notes?: string;
}

/** Une peinture du catalogue : 1 produit = 1 pot + 1 rendement + 1 prix + 1 photo. */
export interface PaintProduct {
  id: string;
  name: string;
  /** Contenance du pot en litres. */
  potL: number;
  /** Rendement en m² par litre. */
  yieldM2L: number;
  /** Prix du pot. */
  pricePot: number;
  /** Photo du produit / nuancier (data-URL compressée) — optionnel. */
  photo?: string;
  link?: string;
  /** Usage conseillé. */
  usage: "mur" | "plafond" | "sol" | "sous-couche" | "universel";
  notes?: string;
}

export interface PlacoSettings {
  plaqueTypeDefault: PlaqueType;
  plaqueL: number;
  plaqueW: number;
  wastePct: number;
  marginPct: number;
  montantSpacing: number;
  visPerM2: number;
  bandePerM2: number;
  enduitJointKgM2: number;
  enduitFinitionKgM2: number;
  railLength: number;
  montantLength: number;
  fourrureLength: number;
  visMm: number;
  bandeWidthMm: number;
  /** Dimensions par type de plaque (BA13, hydro…) — absent = plaqueL × plaqueW. */
  plaqueSizes: Record<string, { l: number; w: number }>;
  prices: Record<string, number>;
}

export interface IsolationSettings {
  quality: IsolQuality;
  pose: PoseIsolation;
  isolantMurId: string;
  isolantCloisonId: string;
  isolantSolId: string;
  isolantPlafondId: string;
  thicknessMur: number;
  thicknessCloison: number;
  thicknessSol: number;
  appuisHSpacing: number;
  appuisVSpacing: number;
  montantSpacing: number;
  gtlMm: number;
  wastePct: number;
  marginPct: number;
  railLength: number;
  prices: Record<string, number>;
}

export interface ElecSettings {
  connected: boolean;
  cablePriseM: number;
  cableEclairageM: number;
  gaineMarge: number;
  wastePct: number;
  marginPct: number;
  gainePriseMm: number;
  gaineEclairageMm: number;
  gaineSpeMm: number;
  boiteDiamMm: number;
  cable15: number;
  cable25: number;
  cable6: number;
  prices: Record<string, number>;
}

export interface SanitaireSettings {
  prices: Record<string, number>;
  perDiameter: number;
  wastePct: number;
  marginPct: number;
  tubePerPointM: number;
}

export interface VmcSettings {
  type: VmcType;
  prices: Record<string, number>;
  gaineMPerBouche: number;
  wastePct: number;
  marginPct: number;
}

export interface ChauffageSettings {
  pasMm: number;
  tubeDiameter: number;
  maxLoopM: number;
  isolantSolId: string;
  thicknessIsolant: number;
  pacPuissanceKw: number;
  pacPrix: number;
  ballonL: number;
  wastePct: number;
  marginPct: number;
  prices: Record<string, number>;
}

export interface PeintureSettings {
  coatsWall: number;
  coatsCeiling: number;
  coatsFloor: number;
  yieldWall: number;
  yieldCeiling: number;
  yieldFloor: number;
  yieldPrimer: number;
  potL: number;
  primerPotL: number;
  wastePct: number;
  marginPct: number;
  prices: Record<string, number>;
  sousCouche: boolean;
  /** Catalogue des peintures (1 produit = 1 pot + 1 rendement + 1 prix + 1 photo). */
  paints: PaintProduct[];
}

export interface CarrelageSettings {
  tileL: number;
  tileW: number;
  jointMm: number;
  wastePct: number;
  marginPct: number;
  natteL: number;
  natteW: number;
  colleKgM2: number;
  jointKgM2: number;
  primaireLperM2: number;
  prices: Record<string, number>;
  natte: boolean;
  spec: boolean;
  tiles: TileProduct[];
}

export interface QuincaillerieSettings {
  plintheH: number;
  plintheL: number;
  porteWidth: number;
  prices: Record<string, number>;
  wastePct: number;
  marginPct: number;
}

export interface Settings {
  projectName: string;
  address: string;
  tva: number;
  notes: string;
  placo: PlacoSettings;
  isolation: IsolationSettings;
  elec: ElecSettings;
  sanitaire: SanitaireSettings;
  vmc: VmcSettings;
  chauffage: ChauffageSettings;
  peinture: PeintureSettings;
  carrelage: CarrelageSettings;
  quincaillerie: QuincaillerieSettings;
  isolants: IsolantProduct[];
  shoppingSelection: Record<string, boolean>;
  /** Liens d'achat : clé `mat:post:priceKey` (Matériaux) ou lineKey (ligne précise). */
  productLinks: Record<string, string>;
  /** Liste de choses à faire / acheter de la page Notes. */
  todoList: { id: string; text: string; done: boolean }[];
}

export interface Expense {
  id: string;
  date: string;
  post: PostId | "divers";
  label: string;
  amount: number;
  status: ExpenseStatus;
  vendor: string;
  notes: string;
}

export interface Task {
  id: string;
  phase: number;
  title: string;
  detail: string;
  post: PostId | "general";
  status: TaskStatus;
  durationH: number;
  order: number;
}

export interface Project {
  version: number;
  settings: Settings;
  floors: Floor[];
  expenses: Expense[];
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
}

export interface LineItem {
  id: string;
  post: PostId;
  category: string;
  name: string;
  spec: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  roomId?: string;
  floorId?: string;
  notes: string;
  /** Clé du matériau dans les prix du poste — relie la ligne au lien d'achat saisi dans Matériaux. */
  linkKey?: string;
  /** Photo du produit (data-URL) — carrelage et peinture. */
  photo?: string;
  /** Identifiant du produit du catalogue (carrelage / peinture). */
  productId?: string;
}

export interface RoomSurfaces {
  floor: number;
  ceiling: number;
  wallsGross: number;
  /** Déduction totale des ouvertures : une ouverture en cloison compte double (2 faces percées). */
  openings: number;
  /** Surface des ouvertures côté pièce uniquement (1 face) — pour la faïence. */
  openingsSingle: number;
  wallsNet: number;
  exteriorWalls: number;
  perimeter: number;
  volume: number;
}

export type PageId =
  | "dashboard"
  | "plans"
  | "placo"
  | "isolation"
  | "electricite"
  | "sanitaire"
  | "vmc"
  | "chauffage"
  | "peinture"
  | "carrelage"
  | "quincaillerie"
  | "courses"
  | "budget"
  | "conducteur"
  | "tutoriels"
  | "normes"
  | "materiaux"
  | "notes"
  | "sync";
