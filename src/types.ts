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

/** Suivi du déblocage de fonds auprès de la banque, pour une dépense. */
export type BankStatus = "non_demande" | "demande" | "refuse" | "accepte";

/** Facture jointe à une dépense. Le fichier est dans Supabase Storage ; seules ces infos sont dans le projet. */
export interface Invoice {
  id: string;
  name: string;
  mime: string;
  size: number;
  /** Chemin dans le bucket « factures ». */
  path: string;
  addedAt: string;
}
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
  /** Prises doubles (1 boîtier 2 postes = 2 prises de la norme). */
  prisesDoubles: number;
  /** Prises triples (1 boîtier 3 postes = 3 prises de la norme). */
  prisesTriples: number;
  /** Interrupteurs doubles (1 boîtier 2 postes = 2 points de commande). */
  intersDoubles: number;
  /** Parmi les interrupteurs doubles : combien sont connectés (module connecté double). */
  intersDoublesConnectes: number;
  /** Boîtes de dérivation de la pièce — null / absent = estimation automatique. */
  boitesDerivation?: number | null;
}

/** Matériau ajouté par l'utilisateur dans la page Matériaux, avec l'unité de son choix. */
export interface CustomMaterial {
  id: string;
  post: PostId;
  name: string;
  /** Unité d'achat affichée : u, m, m², m³, kg, L, sac, boîte, rouleau, forfait… ou un texte libre. */
  unit: string;
  /** Prix d'UNE unité (€). */
  price: number;
  link?: string;
  notes?: string;
}

/** Cible d'un lien vers la page Matériaux : une ligne de la grille des prix ou un produit d'un catalogue. */
export interface MatTarget {
  /** Onglet : un poste, ou « isolants » pour le catalogue des isolants. */
  post: PostId | "isolants";
  /** Clé de la ligne de prix (grille des prix du poste). */
  key?: string;
  /** Id d'un produit des catalogues (carrelage, peinture, isolant). */
  productId?: string;
}

/** Matériau ajouté à la main dans une pièce (depuis le catalogue de la page Matériaux). */
export interface RoomExtra {
  id: string;
  /** « price » = ligne de la grille de prix d'un poste ; sinon un produit des catalogues. */
  kind: "price" | "tile" | "paint" | "isolant" | "custom";
  post: PostId;
  /** Clé de prix (kind « price ») ou id du produit du catalogue. */
  ref: string;
  /** Quantité dans l'unité du matériau, telle que saisie (aucune perte ajoutée). */
  qty: number;
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
  /** Matériaux ajoutés à la main pour cette pièce — absent = aucun. */
  extras?: RoomExtra[];
  /** Quantités corrigées à la main, par clé de ligne du récapitulatif (absent = calcul automatique). */
  qtyOverrides?: Record<string, number>;
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
  /** Éléments électriques posés sur le plan de cet étage (outil « Plan électrique »). */
  elecDevices?: ElecDevice[];
}

export type ElecDeviceKind =
  | "tableau"
  | "prise"
  | "prise_double"
  | "prise_triple"
  | "inter"
  | "inter_double"
  | "va_et_vient"
  | "poussoir"
  | "dcl"
  | "spot"
  | "rj45"
  | "tv"
  | "derivation"
  | "specialise";

/** Un élément électrique posé sur le plan. x / y en pixels du plan (comme les pièces). */
export interface ElecDevice {
  id: string;
  kind: ElecDeviceKind;
  x: number;
  y: number;
  /** Hauteur du centre du boîtier au-dessus du sol fini de l'étage (m). */
  z: number;
  label?: string;
}

/** Un point du trajet d'un câble : soit un élément (deviceId), soit un point de passage libre. */
export interface ElecRunPoint {
  floorId: string;
  x: number;
  y: number;
  deviceId?: string;
}

/** Un circuit / un trajet de câble tracé sur le plan. */
export interface ElecRun {
  id: string;
  name: string;
  type: "prises" | "eclairage" | "specialise" | "cuisson";
  /** Section du câble (mm²). */
  section: "1.5" | "2.5" | "6";
  /** Le câble passe-t-il sous gaine ICTA ? */
  gaine: boolean;
  gaineMm: 16 | 20 | 25;
  /** Hauteur de cheminement horizontal : sous plafond, dans la chape / plinthe, ou valeur libre. */
  routeMode: "plafond" | "sol" | "custom";
  routeZ: number;
  /** Trajet à angles droits entre deux points (suit les murs) au lieu de la ligne droite. */
  ortho: boolean;
  points: ElecRunPoint[];
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
  /** Nombre de prises par circuit pris en compte pour les disjoncteurs (8 = prudent ; la norme autorise jusqu'à 12 en 2,5 mm² / 20 A). */
  prisesParCircuit: number;
  /** « forfait » = mètres par point (ancien calcul) ; « plan » = longueurs mesurées sur le plan électrique. */
  cableMode: "forfait" | "plan";
  /** Réserve de câble à chaque boîtier (m) : dénudage, raccordement. */
  slackPerEndM: number;
  /** Épaisseur de plancher entre deux étages (m), pour les montées de câble. */
  slabM: number;
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
  /** Matériaux personnalisés (page Matériaux), par poste. */
  customMaterials: CustomMaterial[];
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
  /** Statut du déblocage bancaire (absent = non demandé). */
  bankStatus?: BankStatus;
  /** Date de chaque étape du déblocage (demandé, refusé, accepté). */
  bankDates?: Partial<Record<Exclude<BankStatus, "non_demande">, string>>;
  invoices?: Invoice[];
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
  /** Circuits / trajets de câbles tracés sur le plan électrique. */
  elecRuns?: ElecRun[];
  /** Matériaux ajoutés à la main pour le chantier, hors de toute pièce (quantités saisies telles quelles). */
  commonExtras?: RoomExtra[];
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
  | "recap"
  | "guideelec"
  | "planelec"
  | "budget"
  | "conducteur"
  | "tutoriels"
  | "normes"
  | "materiaux"
  | "notes"
  | "sync";
