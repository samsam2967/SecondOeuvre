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
  type: "porte" | "fenetre" | "baie" | "porte_fenetre" | "trappe" | "porte_garage" | "arche" | "passage";
  width: number;
  height: number;
  wall: "exterieur" | "cloison" | "plafond";
  /** Placement 3D : numéro de la paroi de la pièce (absent = réparti automatiquement). */
  edge?: number;
  /** Position du centre de l'ouverture le long de la paroi, de 0 (début) à 1 (fin). */
  t?: number;
  /** Hauteur d'allège en mètres (absent = valeur usuelle selon le type). */
  sill?: number;
}

/** Élément posé sur un mur d'une pièce (prise, interrupteur, sanitaire…), placé et dimensionné à la main dans la vue 3D. */
export type FixtureKind =
  | "prise"
  | "prise_double"
  | "prise_triple"
  | "inter"
  | "inter_double"
  | "poussoir"
  | "rj45"
  | "tv"
  | "hdmi"
  | "derivation"
  | "tableau"
  | "evier"
  | "receveur"
  | "paroi_douche"
  | "baignoire"
  | "meuble_vasque"
  | "vasque"
  | "wc"
  | "bati_wc"
  | "lave_mains"
  | "lave_linge"
  | "seche_serviettes"
  | "radiateur"
  | "miroir";

export interface Fixture {
  id: string;
  kind: FixtureKind;
  /** Numéro de la paroi de la pièce (comme pour les ouvertures). */
  edge: number;
  /** Position du centre le long de la paroi, en mètres depuis le début de la paroi. */
  u: number;
  /** Hauteur du bas de l'élément au-dessus du sol fini (m). */
  z: number;
  /** Largeur le long du mur, profondeur depuis le mur, hauteur (m). */
  w: number;
  d: number;
  h: number;
  label?: string;
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
  /** Prises murales HDMI de la pièce (en plus des prises réseau et TV). */
  hdmi: number;
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
  /** Isolant du sol de cette pièce (absent = isolant du sol des réglages Chauffage / Isolation). */
  floorInsulId?: string;
  /** Épaisseur d'isolant sous le sol de cette pièce, en mm (absent = épaisseur du catalogue). */
  floorInsulMm?: number;
  /** Zones que l'on ne souhaite pas chauffer dans la pièce (mètres, depuis le coin haut-gauche de la pièce). */
  heatExcl?: HeatExcl[];
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
  /** Parois extérieures réglées à la main : la détection automatique des murs mitoyens n'y touche pas. */
  extLocked?: boolean;
  /** Parois extérieures déduites automatiquement des pièces voisines. */
  extAuto?: boolean;
  /** Cloisons non isolées : numéros de parois mises à false (absent = isolée avec l'isolant de cloison). */
  wallInsul?: Record<string, boolean>;
  /** Murs extérieurs sans brique : isolant et plaques sur ossature (numéro de paroi → "ossature"). Absent = brique + isolant + placo. */
  wallStruct?: Record<string, "ossature" | "nu">;
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
  /** Largeur des joints de carrelage propre à cette pièce (mm) — absent / 0 = joint global. */
  jointMm?: number;
  /** Éléments muraux (prises, interrupteurs, sanitaire…) placés à la main dans la vue 3D — absent = répartition automatique. */
  fixtures?: Fixture[];
  /** Éléments retirés de la répartition automatique (clé « kind#n »). */
  hiddenAuto?: string[];
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
  /** Décalage de cet étage dans la vue 3D (m), pour superposer parfaitement les plans. */
  offsetX?: number;
  offsetY?: number;
  rooms: Room[];
  partitions: Partition[];
  /** Éléments électriques posés sur le plan de cet étage (outil « Plan électrique »). */
  elecDevices?: ElecDevice[];
  /** Éléments VMC posés sur le plan de cet étage (outil « Plan des gaines VMC »). */
  vmcDevices?: VmcDevice[];
  /** Escaliers qui partent de cet étage (outil « Plans & pièces »). */
  stairs?: Stair[];
  /** Collecteurs du plancher chauffant (absent = placement automatique). */
  collectors?: HeatCollector[];
}

export interface HeatExcl {
  id: string;
  u: number;
  v: number;
  w: number;
  h: number;
}

/** Collecteur du plancher chauffant, en pixels du plan. */
export interface HeatCollector {
  id: string;
  x: number;
  y: number;
}

export type StairKind = "droit" | "quart" | "demi";
export type StairMaterial = "bois" | "beton" | "metal" | "pierre";

/** Un escalier posé sur le plan d'un étage, rendu en 3D à l'échelle réelle. */
export interface Stair {
  id: string;
  name: string;
  /** Droit, quart tournant (palier d'angle) ou demi-tour (deux volées parallèles). */
  kind: StairKind;
  /** Pied de l'escalier (côté droit de la première marche), en pixels du plan. */
  x: number;
  y: number;
  /** Sens de la montée de la première volée, en degrés (0 = vers la droite du plan, 90 = vers le bas). */
  angle: number;
  /** Nombre de marches (contremarches) pour monter la hauteur totale. */
  steps: number;
  /** Hauteur à monter, en mètres. */
  rise: number;
  /** Largeur des marches, en mètres. */
  width: number;
  /** Giron (profondeur d'une marche), en mètres. */
  tread: number;
  /** Côté du tournant (quart et demi-tour). */
  turn: "gauche" | "droite";
  /** Escalier droit : montée en continu ou avec un palier intermédiaire. */
  landing: "continu" | "palier";
  /** Nombre de marches avant le palier. */
  landingAfter: number;
  /** Profondeur du palier (m). */
  landingDepth: number;
  /** Jour entre les deux volées d'un demi-tour (m). */
  gap: number;
  material: StairMaterial;
  color: string;
  /** Carrelage posé sur les marches. */
  tiled: boolean;
  tileColor: string;
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
  | "hdmi"
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
  type: "prises" | "eclairage" | "specialise" | "cuisson" | "reseau" | "tv" | "hdmi";
  /** Section du câble (mm²) pour le courant fort ; « rj45 », « coax » ou « hdmi » pour les courants faibles. */
  section: "1.5" | "2.5" | "6" | "rj45" | "coax" | "hdmi";
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
  /** Couleur d'aperçu pour la vue 3D (sans photo). */
  color?: string;
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
  /** Couleur de la peinture, pour la vue 3D. */
  color?: string;
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
  /** Où se placent les modules connectés : « interrupteur » = un module derrière chaque interrupteur ; « tableau » = un module (télérupteur connecté) par groupe de lumières, au tableau. */
  connectMode: "interrupteur" | "tableau";
  /** Câble réseau RJ45 par prise réseau (m) : de la prise au coffret de communication. */
  cableRj45M: number;
  /** Câble HDMI par prise HDMI (m). */
  cableHdmiM: number;
  /** Câble coaxial par prise TV (m). */
  cableCoaxM: number;
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
  /** Chiffrer les gaines avec les longueurs mesurées sur le plan VMC. */
  useMeasured?: boolean;
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
  /** Couleur des joints dans la vue 3D (gris par défaut). */
  jointColor?: string;
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
  /** Épaisseur du mur porteur (brique ou parpaing) dessiné sur le plan, en mm. */
  briqueMm?: number;
  /** Quantité que l'on compte acheter maintenant, par ligne (absent = tout ce qui reste). */
  shoppingNow?: Record<string, number>;
  /** Quantité déjà achetée, par ligne. */
  shoppingBought?: Record<string, number>;
  /** Historique des achats validés (pour les annuler et suivre le budget). */
  shoppingBatches?: { id: string; date: string; lines: { key: string; qty: number }[]; amount: number; expenseIds: string[] }[];
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
  /** Calepinages de sol, par identifiant de pièce. */
  tileLayouts?: Record<string, TileLayoutData>;
  /** Gaines VMC tracées sur le plan. */
  vmcPlan?: VmcPlan;
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
  | "guidevmc"
  | "planelec"
  | "budget"
  | "conducteur"
  | "tutoriels"
  | "normes"
  | "materiaux"
  | "notes"
  | "calepinage"
  | "vmcplan"
  | "signature"
  | "sync";

export interface TileLayoutData {
  /** Contour de la pièce redessiné, en mètres (même repère que le plan : px ÷ échelle). */
  points: Pt[];
  tileId: string;
  pattern: "droit" | "demi" | "tiers" | "diag" | "quinconce" | "chevron" | "batons";
  /** Quinconce : décalage d'une rangée sur la précédente, en % de la longueur du carreau. */
  shiftPct?: number;
  /** « alterne » : une rangée sur deux décalée (vrai quinconce) ; « progressif » : chaque rangée décalée de plus. */
  shiftMode?: "alterne" | "progressif";
  /** Rangées parallèles à la longueur du carreau (défaut) ou décalage des colonnes. */
  shiftAxis?: "rangees" | "colonnes";
  /** Angle de pose libre (degrés) ajouté au motif. */
  angleDeg?: number;
  /** Centrer la pose sur la pièce (coupes égales de chaque côté). */
  centered?: boolean;
  /** Pose partie du coin choisi : haut-gauche (défaut), haut-droit, bas-gauche, bas-droit. */
  origin?: "hg" | "hd" | "bg" | "bd";
  /** Carreau tourné de 90°. */
  swap: boolean;
  /** Décalage de la grille de calepinage (m), dans le repère du carreau. */
  offX: number;
  offY: number;
  jointMm: number;
  /** En dessous de cette largeur, une coupe est signalée comme chute inutilisable. */
  minCutCm: number;
}

export interface VmcDevice {
  id: string;
  kind: "caisson" | "extraction" | "insufflation" | "te";
  x: number;
  y: number;
  label?: string;
  /** Débit (m³/h). Absent = automatique selon le type de pièce. */
  flow?: number;
}

export interface VmcRun {
  id: string;
  fromId: string;
  toId: string;
  points: { floorId: string; x: number; y: number }[];
  diameter: 80 | 125 | 160;
  flexible: boolean;
  ortho: boolean;
}

export interface VmcLimits {
  maxLen: Record<80 | 125 | 160, number>;
  maxTotal: number;
  vMax: number;
  bendK: number;
  flexFactor: number;
}

export interface VmcPlan {
  runs: VmcRun[];
  limits: VmcLimits;
}
