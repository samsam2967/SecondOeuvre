import type { Chapter } from "./elecGuide";

/**
 * Guide « Comprendre et réaliser sa VMC » — pour débutant complet.
 * Repères d'après l'arrêté du 24 mars 1982 (aération des logements), le DTU 68.3 (installations de ventilation mécanique)
 * et les notices des fabricants. Les valeurs chiffrées sont des ordres de grandeur : la notice du caisson choisi et
 * un installateur ou bureau d'études qui relit ton plan restent la référence.
 */
export const VMC_GUIDE: Chapter[] = [
  {
    id: "vmc-avant",
    title: "0. À quoi sert la VMC (et pourquoi elle est indispensable)",
    intro: "Une maison récente est très étanche à l'air : sans ventilation mécanique, l'humidité, les odeurs et le CO₂ s'accumulent.",
    blocks: [
      { t: "p", text: "**VMC** veut dire **ventilation mécanique contrôlée** : un ventilateur dans un caisson renouvelle l'air du logement en continu, nuit et jour, avec un débit maîtrisé. Elle **extrait l'air vicié** (cuisine, salle de bain, WC, buanderie) et fait **entrer de l'air neuf** dans les pièces de vie (séjour, chambres, bureau)." },
      { t: "list", items: ["**Évacue l'humidité** de la douche, de la cuisine et du séchage du linge : sans elle, moisissures sur les murs, condensation sur les fenêtres, dégradation de l'isolant.", "**Évite l'air confiné** : CO₂, composés organiques volatils (peintures, colles, meubles neufs), radon dans certaines régions.", "**Est exigée par la réglementation** : un logement neuf doit avoir une aération générale et permanente (arrêté du 24 mars 1982). Avec la RE2020, la maison est tellement étanche que la ventilation n'est plus un « plus » mais la condition de la santé du bâti."] },
      { t: "warn", text: "Ne bouche **jamais** les bouches ou les entrées d'air « parce que ça siffle ou qu'il fait froid ». Réduire la ventilation, c'est ramener l'humidité dans les murs. Si ça siffle, c'est un réglage ou un choix de grille à corriger, pas une raison de couper." },
    ],
  },
  {
    id: "vmc-flux",
    title: "1. Simple flux ou double flux : les différences",
    intro: "C'est le premier choix à faire. Il change le matériel, les gaines, le budget et la façon de poser.",
    blocks: [
      { t: "p", text: "**Simple flux :** le ventilateur **aspire seulement l'air vicié** dans les pièces humides. L'air neuf arrive tout seul par des **entrées d'air** dans les menuiseries des pièces de vie, poussé par la dépression créée. Un seul réseau de gaines (extraction)." },
      { t: "svg", id: "vmc-simple", caption: "Simple flux : entrées d'air dans les pièces de vie, bouches d'extraction dans les pièces humides, un seul réseau de gaines." },
      { t: "p", text: "**Double flux :** deux ventilateurs et un **échangeur de chaleur**. L'air extrait **réchauffe l'air neuf** (sans se mélanger) avant son entrée dans les pièces. Deux réseaux de gaines : **extraction** (pièces humides) et **insufflation** (pièces de vie). Il n'y a plus d'entrées d'air dans les fenêtres." },
      { t: "svg", id: "vmc-double", caption: "Double flux : l'air neuf passe dans l'échangeur et se réchauffe au contact de l'air extrait. Deux réseaux de gaines." },
      {
        t: "table",
        head: ["", "Simple flux (hygro B ou autoréglable)", "Double flux"],
        rows: [
          ["Principe", "Extrait l'air vicié, l'air neuf entre par des grilles dans les fenêtres", "Extrait et insuffle, avec récupération de la chaleur de l'air extrait"],
          ["Chaleur récupérée", "Aucune : l'air neuf entre à la température extérieure", "Environ 75 à 95 % de la chaleur selon l'échangeur (valeur donnée par le fabricant)"],
          ["Gaines", "Un réseau d'extraction, souvent court", "Deux réseaux (extraction + insufflation), plus de gaines, à isoler quand elles passent hors volume chauffé"],
          ["Entrées d'air", "Obligatoires dans les menuiseries des pièces de vie", "Aucune : fenêtres sans grilles, donc moins de bruit de la rue"],
          ["Étanchéité du bâtiment", "Fonctionne avec une maison moyennement étanche", "N'est efficace que dans une maison **très étanche** (sinon l'air entre par les fuites et l'échangeur est contourné)"],
          ["Confort et air", "Air froid qui entre l'hiver près des entrées d'air", "Air neuf tempéré et filtré (pollen, poussières)"],
          ["Prix du matériel (ordre de grandeur)", "Quelques centaines d'euros pour le caisson", "Souvent 1 500 à 4 000 € pour le caisson et ses accessoires"],
          ["Consommation électrique", "Faible (ordre de 10 à 30 W)", "Plus élevée (ordre de 30 à 80 W, deux ventilateurs)"],
          ["Entretien", "Nettoyer les bouches, vérifier le caisson", "Changer ou nettoyer les **filtres** (en général 2 à 4 fois par an), purger les condensats"],
          ["Place nécessaire", "Petit caisson, combles ou placard", "Caisson plus gros (volume d'environ 80 × 80 × 40 cm ou plus), local technique ou combles, avec évacuation des condensats"],
          ["Pose pour un débutant", "Assez simple", "Plus technique : deux réseaux, équilibrage des débits, condensats"],
        ],
        note: "Ordres de grandeur issus des notices et guides fabricants. Les prix, rendements et consommations varient beaucoup : prends toujours les valeurs de la fiche technique du modèle visé.",
      },
      { t: "info", text: "**Lequel choisir ?** Le double flux est pertinent pour une maison **très isolée et très étanche** (RE2020, basse consommation) : le chauffage est réduit, donc la chaleur récupérée compte. Le simple flux hygroréglable B reste un très bon choix quand le budget ou la place sont limités, ou quand la maison est moyennement étanche. Le réglage du site se fait dans **Matériaux → VMC**, le plan se dessine dans « Plan des gaines VMC »." },
    ],
  },
  {
    id: "vmc-types",
    title: "2. Les trois types de VMC proposés dans le site",
    blocks: [
      {
        t: "table",
        head: ["Type", "Comment ça marche", "Pour qui"],
        rows: [
          ["Simple flux autoréglable", "Débit **fixe** : les bouches laissent toujours passer la même quantité d'air, qu'il y ait de l'humidité ou non", "Budget serré. Moins économe en chauffage car elle ventile toujours autant"],
          ["Simple flux hygroréglable B", "Les **bouches et les entrées d'air** s'adaptent à l'humidité : elles s'ouvrent quand l'air est humide, se referment quand il est sec", "Le choix courant : bon compromis entre prix et économie de chauffage"],
          ["Double flux", "Récupère la chaleur de l'air extrait pour réchauffer l'air neuf", "Maison très étanche et très isolée, confort et économie de chauffage recherchés"],
        ],
        note: "Les hygroréglables de type A règlent seulement les entrées d'air, les types B règlent aussi les bouches d'extraction. Vérifie la compatibilité des bouches et des entrées d'air : on ne mélange pas les marques sans l'avis du fabricant.",
      },
    ],
  },
  {
    id: "vmc-debits",
    title: "3. Les débits : combien d'air, où",
    intro: "On ne choisit pas la puissance « au feeling » : on calcule des débits par pièce, puis on dimensionne le caisson et les gaines.",
    blocks: [
      { t: "p", text: "Le **débit** se mesure en **m³/h** (mètres cubes d'air par heure). La réglementation fixe des débits d'extraction minimaux selon la pièce et le nombre de pièces principales du logement (arrêté du 24 mars 1982). Le site utilise des valeurs de départ raisonnables que tu peux modifier pièce par pièce :" },
      {
        t: "table",
        head: ["Pièce", "Rôle", "Valeur de départ du site"],
        rows: [
          ["Cuisine", "Extraction (vapeur, odeurs de cuisson)", "90 m³/h (débit de pointe pendant la cuisson ; le débit de base est plus faible)"],
          ["Salle de bain / salle d'eau", "Extraction (humidité de la douche)", "45 m³/h"],
          ["WC", "Extraction (odeurs)", "30 m³/h"],
          ["Buanderie", "Extraction (séchage, humidité)", "30 m³/h"],
          ["Séjour, salon", "Insufflation (double flux seulement)", "45 m³/h"],
          ["Chambre, bureau", "Insufflation (double flux seulement)", "30 m³/h"],
        ],
        note: "Valeurs de départ pour le plan : le calcul réglementaire exact dépend du nombre de pièces principales et du modèle de caisson. Fais-le valider par l'installateur ou dans la notice du caisson.",
      },
      { t: "tip", text: "**Équilibre :** en double flux, le débit total insufflé doit être **à peu près égal** au débit total extrait, sinon la maison est en surpression ou en dépression et les réglages ne tiennent pas. Le plan VMC du site affiche les débits par bouche pour t'aider à les comparer." },
    ],
  },
  {
    id: "vmc-placement",
    title: "4. Où placer le caisson, les bouches et les entrées d'air",
    blocks: [
      { t: "svg", id: "vmc-reseau", caption: "Réseau type : caisson, gaine principale, té de distribution, puis une gaine par bouche. Le caisson est au centre de gravité des bouches pour raccourcir les gaines." },
      { t: "list", items: ["**Le caisson** : en volume chauffé ou en combles aménagés/isolés, dans un endroit facile d'accès (entretien), loin des chambres (bruit). Un cellier, une buanderie ou un garage chauffé conviennent bien. Il se fixe sur un support rigide avec des **suspentes ou plots anti-vibratiles**.", "**Les bouches d'extraction** : dans les pièces humides (cuisine, salle de bain, salle d'eau, WC, buanderie), **haut** dans la pièce, loin de la porte et de l'entrée d'air pour balayer toute la pièce.", "**Les entrées d'air (simple flux)** : dans les menuiseries des pièces de vie (séjour, chambres, bureau), en partie haute de la fenêtre pour éviter les courants d'air froid.", "**Les bouches d'insufflation (double flux)** : dans les pièces de vie, loin des bouches d'extraction pour que l'air traverse la maison.", "**Le passage de l'air entre les pièces** : l'air doit aller des pièces de vie vers les pièces humides. On **détalonne les portes** (jeu de 1,5 à 2 cm sous la porte) ou on met une grille de transfert.", "**La prise d'air neuf et le rejet (double flux)** : à l'extérieur, **espacés l'un de l'autre** (voir la notice, de l'ordre de 1 à 1,5 m) et loin de toute source de pollution (cheminée, sortie de hotte)."] },
      { t: "warn", text: "La **hotte de cuisine** ne se raccorde **jamais** sur la VMC : c'est un circuit séparé, avec sa propre évacuation (ou un recyclage au charbon actif). Le rejet de graisses boucherait les gaines et le caisson." },
      { t: "tip", text: "Dans le site, « Placer automatiquement (optimisé) » dans **Plan des gaines VMC** teste chaque pièce comme emplacement du caisson et garde la solution la plus courte qui respecte les limites. Tu peux ensuite tout déplacer à la main." },
    ],
  },
  {
    id: "vmc-gaines",
    title: "5. Les gaines : diamètres, longueurs, coudes, isolation",
    blocks: [
      {
        t: "table",
        head: ["Diamètre", "Usage typique", "Débit maximal à 5 m/s", "Longueur maxi retenue par le site"],
        rows: [
          ["Ø80", "Dernier tronçon vers une bouche", "≈ 90 m³/h", "10 m"],
          ["Ø125", "Branche ou départ de caisson", "≈ 220 m³/h", "15 m"],
          ["Ø160", "Gaine principale pour de gros débits", "≈ 360 m³/h", "20 m"],
        ],
        note: "Le débit maximal est un calcul (section × 5 m/s). Les longueurs maximales sont des réglages du plan VMC, modifiables dans la page « Plan des gaines VMC ».",
      },
      { t: "list", items: ["**Vitesse de l'air** : on vise **5 m/s au maximum** dans les gaines. Au-delà : sifflements, bruit, pertes de charge.", "**Gaine rigide** (galvanisée) : lisse, moins de pertes, plus facile à nettoyer, c'est le meilleur choix pour les longs tronçons. **Gaine souple** : pratique pour les derniers mètres, mais rugueuse : le site compte **1,3 × sa longueur** pour tenir compte des pertes.", "**Coudes** : chaque coude freine l'air. Le site compte l'équivalent de **20 diamètres de longueur droite par coude**. Fais le moins de coudes possible et des **rayons larges**.", "**Gaines hors volume chauffé (combles perdus)** : toujours **isolées** (manchon isolant d'au moins 25 mm, davantage en climat froid) pour éviter la condensation à l'intérieur de la gaine, surtout sur l'air extrait chaud et humide.", "**Pente et condensats** : en double flux, le caisson évacue les condensats par un tuyau avec **siphon** et une pente vers l'évacuation. En simple flux, une gaine d'extraction en combles se pose avec une légère pente vers le caisson ou une purge.", "**Pas d'écrasement, pas de plis** : une gaine souple pincée perd la moitié de son débit. Fixe-la avec des colliers tous les 1 à 1,5 m."] },
    ],
  },
  {
    id: "vmc-pose",
    title: "6. Poser sa VMC pas à pas",
    blocks: [
      { t: "ol", items: ["**Plan et débits** : valide ton plan (Plan des gaines VMC) : pas de dépassement de longueur, vitesse OK, débits cohérents.", "**Caisson** : fixe-le sur un support solide avec plots anti-vibratiles, de niveau, avec **accès libre** pour changer les filtres et ouvrir la trappe. Prévois l'évacuation des condensats (double flux).", "**Gaines** : tire les gaines **avant** de fermer les plafonds (placo). Fixe-les, évite les coudes serrés, isole celles qui passent hors volume chauffé. Raccorde avec **manchons et ruban adhésif** : les raccords doivent être **étanches à l'air** (un réseau qui fuit perd du débit et fait du bruit).", "**Bouches** : pose-les à la fin, après les peintures. Elles se vissent dans les manchons et se règlent (hygro : rien à régler ; autoréglable : bien choisir la référence selon le débit).", "**Sorties extérieures** : rejet et prise d'air neuf avec grilles anti-oiseaux, **étanchéité soignée** au passage de toiture (souche ou chapeau de ventilation). Respecte la distance entre prise et rejet.", "**Électricité** : alimente le caisson depuis un circuit prévu pour lui, avec un interrupteur d'arrêt accessible pour l'entretien (voir le guide électricité).", "**Mise en route et réglage** : lance en vitesse de base, mesure les débits aux bouches (anémomètre ou fournisseur), équilibre les bouches en double flux jusqu'à ce que insufflation ≈ extraction.", "**Dossier** : garde la notice, la fiche de réglage et les photos des gaines avant fermeture : elles servent à l'entretien et à la revente."] },
      { t: "warn", text: "Ne ferme jamais un faux plafond sur une gaine **non testée** : fuites, bruits et raccords mal serrés se détectent avant, pas après. Photographie le réseau avant de fermer." },
    ],
  },
  {
    id: "vmc-entretien",
    title: "7. Entretien : ce qu'il faut faire, et quand",
    blocks: [
      {
        t: "table",
        head: ["Quoi", "Simple flux", "Double flux"],
        rows: [
          ["Bouches d'extraction", "Dépoussiérer et laver à l'eau tiède 2 à 3 fois par an. Ne jamais intervertir les bouches", "Idem pour extraction et insufflation"],
          ["Filtres", "Souvent pas de filtre, ou un filtre simple à nettoyer", "Changer ou nettoyer en moyenne **tous les 3 à 6 mois** (selon la notice et la pollution)"],
          ["Entrées d'air", "Nettoyer 1 à 2 fois par an", "Sans objet"],
          ["Caisson", "Contrôle visuel tous les ans, dépoussiérage", "Nettoyage de l'échangeur et vérification du siphon de condensats, tous les ans ou tous les 2 ans"],
          ["Gaines", "Contrôle et nettoyage par un professionnel tous les 3 à 5 ans si besoin", "Idem, plus important car il y a deux réseaux"],
        ],
      },
      { t: "tip", text: "Mets une alerte dans ton agenda « filtres VMC » avant l'hiver et avant le printemps (pollens). Une VMC encrassée consomme plus et ventile mal." },
    ],
  },
  {
    id: "vmc-erreurs",
    title: "8. Les erreurs les plus fréquentes",
    blocks: [
      { t: "list", items: ["Choisir un double flux dans une maison peu étanche : l'investissement ne rapporte rien.", "Brancher la **hotte** sur la VMC.", "Oublier de **détalonner les portes** : l'air ne circule plus, la ventilation ne marche pas.", "Mettre un caisson dans un endroit inaccessible : les filtres ne sont jamais changés.", "Faire trop de coudes ou utiliser de la gaine souple pour toute la longueur : bruit, débit trop faible, bouches inefficaces.", "Oublier d'isoler les gaines en combles : de l'eau coule dans le placo.", "Placer les bouches d'extraction à côté des entrées d'air : l'air neuf est aspiré tout de suite, la pièce n'est pas balayée.", "Boucher les entrées d'air « parce qu'il fait froid »."] },
    ],
  },
  {
    id: "vmc-glossaire",
    title: "9. Mini-glossaire",
    blocks: [
      {
        t: "table",
        head: ["Mot", "Signification"],
        rows: [
          ["VMC", "Ventilation mécanique contrôlée : un ventilateur renouvelle l'air en continu"],
          ["Caisson", "L'appareil avec le ou les ventilateurs (et l'échangeur en double flux)"],
          ["Bouche", "Grille dans le plafond ou le mur qui aspire (extraction) ou souffle (insufflation) l'air"],
          ["Entrée d'air", "Grille posée dans la menuiserie qui laisse entrer l'air neuf (simple flux)"],
          ["Échangeur", "Pièce du double flux où l'air extrait chauffe l'air neuf sans se mélanger"],
          ["Débit", "Quantité d'air en m³/h"],
          ["Hygroréglable", "Qui adapte son débit à l'humidité de l'air"],
          ["Autoréglable", "Qui a un débit fixe"],
          ["Perte de charge", "Frein que subit l'air dans la gaine (coudes, longueur, rugosité)"],
          ["Té", "Raccord en T qui répartit l'air d'une gaine vers plusieurs bouches"],
          ["Condensats", "Eau qui se forme dans l'échangeur d'un double flux et doit être évacuée"],
          ["Détalonnage", "Jeu laissé sous les portes pour laisser passer l'air"],
        ],
      },
    ],
  },
];
