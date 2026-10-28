import type { PostId } from "../types";

export interface TutoStep {
  title: string;
  body: string;
  tip?: string;
  warn?: string;
}

export interface Tutorial {
  id: string;
  post: PostId | "general";
  title: string;
  duration: string;
  level: "base" | "intermédiaire" | "avancé";
  image: string;
  videos: { title: string; url: string }[];
  tools: string[];
  norms: string[];
  steps: TutoStep[];
}

export const TUTORIALS: Tutorial[] = [
  {
    id: "placo-cloison",
    post: "placo",
    title: "Monter une cloison alvéolaire métallique",
    duration: "1 journée / 8 ml",
    level: "intermédiaire",
    image: "/images/cloison-coupe.png",
    videos: [
      { title: "Pose d'une cloison placo (Placo®)", url: "https://www.youtube.com/results?search_query=poser+cloison+placo+montant+rail" },
      { title: "Bandes et enduits — finition Q4", url: "https://www.youtube.com/results?search_query=bande+a+joint+placo+Q4" },
    ],
    tools: ["Laser / cordeau", "Cisaille à rail", "Visseuse à butée", "Cutter + scie égoïne placo", "Niveau 2 m", "Rabot à placo"],
    norms: ["DTU 25.41", "Entraxe montants 60 cm (40 cm si carrelage mural)", "Bande résiliente obligatoire au sol"],
    steps: [
      { title: "Implanter", body: "Tracez l'axe au sol et au plafond au laser. Repérez les portes (largeur fini + 2 × 20 mm + huisserie). Vérifiez l'équerrage 3-4-5.", tip: "Un trait de crayon net vaut mieux qu'un appui douteux plus tard." },
      { title: "Bande résiliente", body: "Collez la bande sous le rail bas (et au plafond si dalle brute). Elle coupe le pont phonique et limite les fissures.", warn: "Sans bande, la cloison transmet tous les bruits de pas." },
      { title: "Rails", body: "Coupez les rails à la cisaille, vissez tous les 60 cm. Aux portes, le rail bas est interrompu, le haut est continu. Éclisses aux jonctions." },
      { title: "Montants", body: "Enclenchez les montants, entraxe 60 cm. Doublez de chaque côté des huisseries et glissez un renfort bois 36×36 si vous posez une porte lourde ou un meuble vasque." },
      { title: "Réseaux", body: "Passez gaines et PER dans les lumières des montants, avec manchons et jamais deux réseaux qui se touchent (élec / eau). Boîtes d'encastrement serties." },
      { title: "Isolant", body: "Glissez la laine sans la comprimer. Comblez au-dessus des linteaux. Laine de roche 75 mm si vous visez l'acoustique chambres." },
      { title: "Plaques", body: "Départ d'un angle, joints verticaux décalés d'une face à l'autre. Vis tous les 30 cm, à 1 cm du bord. Hydro (verte) en pièces humides. Laissez 1 cm en pied, calé, à jointoyer ensuite.", tip: "La vis doit affleurer sans déchirer le carton." },
      { title: "Bandes & enduits", body: "Primaire si besoin, bande papier marouflée, 2 à 3 passes d'enduit, cornières sur angles sortants, ponçage lumière rasante. Q3 pour peinture, Q4 pour laques." },
    ],
  },
  {
    id: "placo-doublage",
    post: "placo",
    title: "Doublage des murs + GTL",
    duration: "variable",
    level: "intermédiaire",
    image: "/images/isolation-coupe.png",
    videos: [
      { title: "Système Optima2 Isover", url: "https://www.youtube.com/results?search_query=optima+2+isover+appuis+placo" },
    ],
    tools: ["Perceuse à percussion", "Cordeau", "Cutter isolant", "Visseuse", "Agrafeuse membrane"],
    norms: ["DTU 25.42", "RE2020 étanchéité à l'air", "GTL pour passer les réseaux après isolant"],
    steps: [
      { title: "Calepinage", body: "Décidez l'épaisseur finale : isolant + GTL (35–45 mm) + BA13. Cela mange la pièce : vérifiez les largeurs de portes et les meubles." },
      { title: "Appuis", body: "Fixez les appuis au mur, entraxe 60 cm en horizontal, 2 à 3 niveaux selon la hauteur. Cheville adaptée au support (brique, parpaing, béton cellulaire)." },
      { title: "Isolant", body: "Embrochez les panneaux semi-rigides (fibre de bois, laine). Joints serrés, pas de jour. Découpez proprement autour des menuiseries, isolez les tableaux." },
      { title: "Membrane", body: "Frein-vapeur côté chaud, scotch dédié, mastic en périphérie menuiseries, rosaces étanches aux passages.", warn: "Un pare-vapeur percé et non repris ruine le Q4Pa et peut condenser dans l'isolant." },
      { title: "Montants / fourrures", body: "Clipsez les montants sur les appuis : c'est votre GTL. Passez toutes les gaines ici, jamais à travers l'isolant au hasard." },
      { title: "Placo", body: "Même pose que cloisons. Prévoir trappes techniques aux collecteurs, VMC, vannes." },
    ],
  },
  {
    id: "isol-appuis",
    post: "isolation",
    title: "Isolation par appuis + fibre de bois",
    duration: "2–4 jours",
    level: "intermédiaire",
    image: "/images/isolation-coupe.png",
    videos: [
      { title: "Fibre de bois semi-rigide murs", url: "https://www.youtube.com/results?search_query=isolation+fibre+de+bois+murs+interieur" },
      { title: "Étanchéité à l'air maison", url: "https://www.youtube.com/results?search_query=etancheite+a+l+air+frein+vapeur+tuto" },
    ],
    tools: ["Scie isolant / crocodile", "Masque FFP2", "Gants", "Agrafeuse", "Rouleau marouflage"],
    norms: ["RE2020 R murs ≥ 4", "DTU 45.10", "Avis technique du panneau"],
    steps: [
      { title: "Choisir le R", body: "R = e / λ. Fibre de bois λ036 en 145 mm → R≈4,0 (bien). 200 mm → R≈5,5 (très bien). La fibre de bois offre un déphasage utile l'été, contrairement aux laines minces." },
      { title: "Support sec", body: "Mur sain, hors d'eau. Traitez les remontées, jamais d'isolant biosourcé sur mur humide sans diagnostic." },
      { title: "Pose des appuis", body: "Rails ou appuis ponctuels. Respectez l'entraxe du fabricant pour ne pas affaisser les plaques." },
      { title: "Panneaux", body: "Serrés, joints décalés, compression légère (1 cm) pour l'étanchéité, jamais écrasés de 20 % (perte de R)." },
      { title: "Ponts thermiques", body: "Tableaux, linteaux, appuis de fenêtre : mêmes performances. Rehausses de seuil, retour d'isolant." },
      { title: "Test", body: "Idéalement infiltrométrie intermédiaire avant placo pour corriger les fuites (prises, trappes, gaines)." },
    ],
  },
  {
    id: "elec-nfc",
    post: "electricite",
    title: "Électricité NFC 15-100 — de la GTL au Consuel",
    duration: "plusieurs semaines",
    level: "avancé",
    image: "/images/elec-schema.png",
    videos: [
      { title: "NFC 15-100 expliquée", url: "https://www.youtube.com/results?search_query=NFC+15-100+nombre+de+prises+par+piece" },
      { title: "Remplir un tableau électrique", url: "https://www.youtube.com/results?search_query=peigner+tableau+electrique+differentiel" },
    ],
    tools: ["Pince à dénuder", "Tire-fil", "Multimètre", "Niveau de bulle", "Scie cloche 67 mm"],
    norms: ["NF C 15-100", "Volumes SDB 0/1/2", "DDR 30 mA", "Consuel"],
    steps: [
      { title: "Schéma", body: "Listez pièces, points lumineux, prises, spécialisés. Calculez les circuits : 8 points max en éclairage 1,5 mm² / 10 A ; 8 prises max en 2,5 mm² / 16 ou 20 A." },
      { title: "GTL et tableau", body: "GTL près de l'entrée du réseau. Tableau 4 rangées mini en maison. DDR type A (lave-linge, plaques) + type AC. Parafoudre en zone d'orage." },
      { title: "Gaines", body: "ICTA 16 éclairage, 20 prises, 25 spécialisés / 6 mm². Évitez plus de 360° de coudes. Tirez un fil d'aiguille." },
      { title: "Hauteurs", body: "Interrupteurs 1,10 m, prises 0,30 m (0,08–0,25 m au-dessus du plan de travail cuisine). SDB : hors volumes 0 et 1." },
      { title: "Boîtes étanches", body: "En doublage isolé, boîtiers d'étanchéité à l'air + membrane. Sinon fuites massives au test Q4." },
      { title: "Terre et LES", body: "Liaison équipotentielle supplémentaire en SDB (canalisations, receveur, huisseries métal). Conducteur de terre vert-jaune partout." },
      { title: "Mise en service", body: "Appareillage en fin de chantier. Contrôles de continuité, isolement, bascule des DDR. Dossier Consuel + schéma unifilaire.", warn: "L'électricité n'est pas un poste 'on verra'. En cas de doute, faites contrôler par un électricien avant le Consuel." },
    ],
  },
  {
    id: "sanitaire-per",
    post: "sanitaire",
    title: "Réseaux PER, évacuations et appareils",
    duration: "1–2 semaines",
    level: "intermédiaire",
    image: "/images/plancher-chauffant.png",
    videos: [
      { title: "Nourrices et PER", url: "https://www.youtube.com/results?search_query=poser+nourrice+PER+plomberie" },
      { title: "WC suspendu bâti-support", url: "https://www.youtube.com/results?search_query=poser+bati+support+wc+suspendu" },
    ],
    tools: ["Pince à sertir ou glissement", "Coupe-tube", "Niveau", "Scie PVC", "Pompe à épreuve"],
    norms: ["DTU 60.1 / 60.11", "Calorifuge ECS", "Pente évacuation ≥ 1 cm/m"],
    steps: [
      { title: "Nourrices", body: "Placez les collecteurs EF/ECS dans un espace accessible (cellier, GTL). Une vanne par départ. Marquez les circuits." },
      { title: "PER", body: "Courbes larges, fourreau dans les dalles, jamais de raccord noyé. Isolant sur ECS (et EF en local non chauffé)." },
      { title: "Épreuve", body: "Mise en pression 2× la pression de service pendant 24 h avant de fermer les cloisons.", warn: "Un raccord qui fuit derrière le placo coûte une semaine." },
      { title: "PVC", body: "Collage propre, chanfrein, pente continue, Y plutôt que T, ventilation primaire en toiture. Ø100 pour WC." },
      { title: "Appareils", body: "Après carrelage et peinture. Silicone sanitaire en joint perdu. Essais d'écoulement et chasse." },
    ],
  },
  {
    id: "vmc",
    post: "vmc",
    title: "VMC simple flux hygro B ou double flux",
    duration: "2–5 jours",
    level: "intermédiaire",
    image: "/images/vmc-schema.png",
    videos: [
      { title: "Installer une VMC hygro B", url: "https://www.youtube.com/results?search_query=installer+VMC+simple+flux+hygro+B" },
      { title: "VMC double flux réseau", url: "https://www.youtube.com/results?search_query=installer+VMC+double+flux+gaines+isolees" },
    ],
    tools: ["Scie cloche", "Visseuse", "Niveau", "Mètre"],
    norms: ["DTU 68.3", "Débits réglementaires", "Entretien filtres DF"],
    steps: [
      { title: "Choisir", body: "Hygro B : économique, entrées d'air sur menuiseries, extraction pièces humides. Double flux : récupération de chaleur, indispensable si vous visez le confort RE2020 et l'étanchéité poussée (sinon la maison étanche n'a plus d'air neuf contrôlé)." },
      { title: "Caisson", body: "Local technique ou combles, accessible, sur plots anti-vibratiles, raccord électrique dédié." },
      { title: "Gaines", body: "Tendues, sans écrasement, pente vers l'extraction, isolées en combles (condensation). DF : réseau insufflation + extraction, jamais mélangés." },
      { title: "Bouches", body: "Cuisine Ø125, SDB/WC Ø80. Ne jamais les obturer. DF : insufflation chambres/séjour, extraction humides." },
      { title: "Réglages", body: "Débits selon nombre de pièces. DF : équilibrage + filtres 2 à 4 fois / an." },
    ],
  },
  {
    id: "pc-sol",
    post: "chauffage",
    title: "Plancher chauffant basse température + PAC",
    duration: "1–2 semaines + séchage chape",
    level: "avancé",
    image: "/images/plancher-chauffant.png",
    videos: [
      { title: "DTU 65.14 plancher chauffant", url: "https://www.youtube.com/results?search_query=plancher+chauffant+PER+pas+collecteur" },
      { title: "PAC air/eau principe", url: "https://www.youtube.com/results?search_query=PAC+air+eau+plancher+chauffant+tuto" },
    ],
    tools: ["Dérouleur", "Agrafeuse", "Collecteurs", "Pompe d'épreuve 6 bar"],
    norms: ["DTU 65.14", "Température de surface ≤ 28 °C", "R isolant sous chape"],
    steps: [
      { title: "Isolant", body: "Sur terre-plein visez R ≥ 3,2 à 4,5 (PIR 80–100 mm ou XPS). Sur étage chauffé, 20–40 mm + acoustique. Joints décalés, bande périphérique 5 mm tout autour." },
      { title: "Polyane", body: "Film continu, remonté sur la bande, pour la chape fluide." },
      { title: "Calepinage", body: "Pas 10 cm près des baies, 15 cm courant, 20 cm peu déperditif. Boucle ≤ 80–100 m en Ø16. Aller-retour du collecteur, jamais de pincement." },
      { title: "Fixation", body: "Agrafes ~8 / m² ou dalles à plots. Rayons de courbure mini du fabricant." },
      { title: "Épreuve", body: "6 bar, 24 h, rester en pression pendant la chape.", warn: "Chape sans épreuve = roulette russe." },
      { title: "Chape", body: "Fluide anhydrite ou ciment selon isolant/revêtement. Séchage : ne pas chauffer trop tôt. Protocole de mise en température avant carrelage." },
      { title: "PAC", body: "Dimensionnée sur déperditions réelles (pas un forfait). Courbe d'eau 30–35 °C si maison bien isolée. Ballon ECS 180–250 L couple." },
    ],
  },
  {
    id: "peinture",
    post: "peinture",
    title: "Peindre placo : impression et finition",
    duration: "3–6 jours séchage inclus",
    level: "base",
    image: "https://images.pexels.com/photos/1669754/pexels-photo-1669754.jpeg?auto=compress&cs=tinysrgb&w=1200",
    videos: [
      { title: "Peindre un plafond puis les murs", url: "https://www.youtube.com/results?search_query=peindre+placo+sous+couche+tuto" },
    ],
    tools: ["Rouleau microfibre 10–12 mm", "Téléscopique", "Bac", "Ruban 50 mm", "Lumière rasante"],
    norms: ["DTU 59.1", "Q3 minimum avant peinture"],
    steps: [
      { title: "Préparer", body: "Dépoussiérer, reboucher, poncer, masquer plinthes et huisseries. Lumière rasante pour voir les défauts d'enduit." },
      { title: "Sous-couche", body: "Impression placo obligatoire : elle régule l'absorption et évite le nuageage. 1 couche, 12 m²/L environ." },
      { title: "Plafonds", body: "Toujours avant les murs. 2 couches, croisées, sans surcharge en rives." },
      { title: "Murs", body: "2 couches. Pièces humides : peinture lessivable / spéciale SDB. Sols : peinture sol dédiée, dégraissée." },
      { title: "Rendement", body: "Quantité = surface × couches / rendement × 1,10 de perte. Un pot de 10 L à 11 m²/L en 2 couches couvre ≈ 55 m²." },
    ],
  },
  {
    id: "carrelage",
    post: "carrelage",
    title: "Natte, colle, joints — sols et faïence",
    duration: "1 semaine / 40 m²",
    level: "intermédiaire",
    image: "/images/carrelage-coupe.png",
    videos: [
      { title: "Natte de désolidarisation", url: "https://www.youtube.com/results?search_query=natte+desolidarisation+carrelage+plancher+chauffant" },
      { title: "SPEC douche à l'italienne", url: "https://www.youtube.com/results?search_query=SPEC+douche+italienne+tuto" },
    ],
    tools: ["Peigne 8 ou 10 mm", "Malaxeur", "Croisillons autonivelants", "Ventouses", "Coupe-carreaux"],
    norms: ["DTU 52.2", "CPT SPEC", "Joints 2–3 mm grès cérame"],
    steps: [
      { title: "Support", body: "Chape sèche, plane (± 5 mm sous 2 m). Primaire d'accrochage. Plancher chauffant : mise en température faite puis arrêt 48 h." },
      { title: "Natte", body: "Natte de désolidarisation (Schlüter-Ditra ou équivalent) collée : elle reprend les mouvements de chape et limite les cassures, surtout sur PC et grands formats." },
      { title: "SPEC", body: "Sous douche et receveur à carreler : primaire + deux couches de SPEC, bandes en angles, manchons d'évacuation." },
      { title: "Calepinage", body: "Centrez les coupes, évitez les listels < 5 cm. Joints réguliers. Profilés aux arrêts et nez de marche." },
      { title: "Double encollage", body: "Obligatoire au-delà de 30×30 ou 3600 cm², et toujours au sol. Peigne adapté." },
      { title: "Joints", body: "24–48 h après. Joint hydro en SDB. Silicone en rive et angles (joint perdu), jamais de joint ciment coincé sol/mur rigide." },
    ],
  },
  {
    id: "portes",
    post: "quincaillerie",
    title: "Portes, huisseries, plinthes",
    duration: "45–90 min / porte",
    level: "base",
    image: "https://images.pexels.com/photos/3958953/pexels-photo-3958953.jpeg?auto=compress&cs=tinysrgb&w=1200",
    videos: [
      { title: "Poser une porte alvéolaire", url: "https://www.youtube.com/results?search_query=poser+porte+interieure+huisserie+placo" },
    ],
    tools: ["Niveau", "Cales", "Scie à onglet", "Pistolet PU", "Visseuse"],
    norms: ["Jeu 5–8 mm en pied", "Plomb et niveau d'huisserie"],
    steps: [
      { title: "Huisserie", body: "Présentez, calez, plomb côté paumelles d'abord. Vérifiez le parallélisme. Fixez dans les renforts, pas seulement dans le BA13." },
      { title: "Mousse", body: "PU expansive à faible expansion, par points. Trop de mousse vrille l'huisserie." },
      { title: "Porte", body: "Paumelles, détalonnage si sol fini plus haut, serrure, béquilles. Le battant ne doit pas frotter." },
      { title: "Plinthes", body: "Après sols. Onglets à 45°, acrylique en tête, vis ou colle selon support. Arrêt aux chambranles." },
    ],
  },
  {
    id: "ordre",
    post: "general",
    title: "Ordre d'un second œuvre — ne pas se tromper",
    duration: "vue d'ensemble",
    level: "base",
    image: "/images/dashboard-house.png",
    videos: [
      { title: "Phasage second œuvre", url: "https://www.youtube.com/results?search_query=ordre+des+travaux+second+oeuvre+maison" },
    ],
    tools: ["Conducteur de travaux de l'app", "Photos des réseaux avant fermeture"],
    norms: ["Hors d'eau hors d'air avant isolants", "Épreuves plomberie/PC avant placo/chape"],
    steps: [
      { title: "1. Hors d'eau / d'air", body: "Toiture, menuiseries. Sinon, isolant et placo prennent l'humidité." },
      { title: "2. Cloisons ossature", body: "Rails, montants, renforts. Rien n'est fermé." },
      { title: "3. Isolation périphérique + étanchéité", body: "Puis test d'air si possible." },
      { title: "4. Tous les réseaux", body: "Élec, PER, PVC, VMC, tubes de PC. Photos + épreuves." },
      { title: "5. Isolant cloisons + placo + bandes", body: "On ferme. Plus d'accès aux réseaux." },
      { title: "6. Chape puis sols", body: "SPEC, natte, carrelage / parquet." },
      { title: "7. Peinture", body: "Sous-couche + 2 couches." },
      { title: "8. Appareils et finitions", body: "Sanitaires, prises, portes, plinthes, PAC, bouches VMC." },
    ],
  },
];
