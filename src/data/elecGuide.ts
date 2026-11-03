/**
 * Guide « Comprendre et réaliser ses circuits électriques » — pour débutant complet.
 * Règles vérifiées avec la NF C 15-100 amendement 5 (en vigueur depuis le 27/11/2015) et les guides Legrand,
 * Hager, Promotelec, Consuel (oct. 2026). À recouper avec la version en vigueur avant de finaliser.
 */
export type Block =
  | { t: "p"; text: string }
  | { t: "list"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "table"; head: string[]; rows: string[][]; note?: string }
  | { t: "tip" | "warn" | "info"; text: string }
  | { t: "svg"; id: "arrivee" | "guirlande" | "volumes" | "eclairage"; caption: string };

export interface Chapter {
  id: string;
  title: string;
  intro?: string;
  blocks: Block[];
}

export const ELEC_GUIDE: Chapter[] = [
  {
    id: "avant",
    title: "0. Avant de commencer : sécurité et cadre légal",
    intro: "Ce guide t'explique comment fonctionne une installation électrique de maison et comment la concevoir. Lis ce chapitre en premier.",
    blocks: [
      { t: "warn", text: "Le courant de la maison (230 V) peut tuer. Avant toute intervention sur un câble, une prise ou le tableau : **coupe le disjoncteur général, cadenasse-le ou mets un panneau « ne pas remettre », et vérifie l'absence de tension avec un testeur (VAT)**. Ne te fie jamais à « j'ai coupé, donc c'est mort »." },
      { t: "p", text: "**As-tu le droit de faire ton électricité toi-même ?** Oui, pour ta propre maison. Mais trois choses sont obligatoires ou fortement conseillées :" },
      {
        t: "list",
        items: [
          "**L'installation doit respecter la norme NF C 15-100** (la règle de base de toute installation électrique de logement en France). Ce guide en reprend les points essentiels.",
          "**L'attestation de conformité Consuel est obligatoire** pour une maison neuve : sans elle, Enedis ne met pas le compteur en service. Un particulier qui a fait lui-même son installation peut la demander en son nom. Un inspecteur peut venir vérifier, et il est souvent plus attentif quand c'est un particulier.",
          "**Tu n'as pas de garantie décennale** sur ce que tu fais toi-même, et ton assureur peut avoir des exigences. Beaucoup de personnes qui font leur électricité confient à un électricien **le tableau et la prise de terre**, qui sont les parties où une erreur est la plus dangereuse.",
        ],
      },
      { t: "info", text: "Ce guide est un support d'apprentissage, pas un texte officiel. La norme évolue : avant de commander et de câbler, vérifie la version en vigueur (site du Consuel, ou un électricien qui relit ton schéma). Un électricien peut aussi **relire et valider ton plan** pour quelques dizaines d'euros : c'est un bon investissement." },
    ],
  },
  {
    id: "bases",
    title: "1. L'électricité en 5 minutes",
    intro: "Quatre notions suffisent pour tout comprendre. On les compare à de l'eau dans un tuyau.",
    blocks: [
      {
        t: "table",
        head: ["Notion", "Unité", "Comparaison avec l'eau", "À retenir"],
        rows: [
          ["Tension", "volt (V)", "La pression de l'eau", "Dans la maison : 230 V (monophasé)."],
          ["Intensité (courant)", "ampère (A)", "Le débit d'eau dans le tuyau", "Plus l'appareil consomme, plus l'intensité est forte."],
          ["Puissance", "watt (W)", "L'énergie que fournit le débit", "Puissance = tension × intensité. Exemple : 230 V × 16 A = 3 680 W."],
          ["Section du fil", "mm²", "Le diamètre du tuyau", "Plus l'intensité est forte, plus il faut un fil gros, sinon il chauffe."],
        ],
      },
      { t: "p", text: "**Un fil trop fin pour le courant qui le traverse chauffe, fait fondre sa gaine et peut déclencher un incendie.** C'est pour cela que chaque circuit a une section de fil et un disjoncteur adaptés (chapitre 4)." },
      { t: "p", text: "Le courant fait un aller-retour : il arrive par la **phase**, traverse l'appareil, repart par le **neutre**. La **terre** ne sert normalement à rien : c'est un fil de sécurité qui évacue le courant si un appareil a un défaut (par exemple une carcasse métallique qui devient « sous tension »)." },
      {
        t: "table",
        head: ["Fil", "Couleur", "Rôle", "Règle"],
        rows: [
          ["Terre", "Vert et jaune", "Sécurité", "Obligatoire. Ne sert jamais de phase ni de neutre."],
          ["Neutre", "Bleu clair", "Retour du courant", "Obligatoire. Le bleu n'est jamais une phase."],
          ["Phase", "Marron, rouge, noir, orange…", "Aller du courant (230 V)", "Toute autre couleur que vert/jaune et bleu. Dangereuse même si l'appareil est éteint."],
          ["Retour (lumière)", "Souvent noir ou orange", "Phase qui va de l'interrupteur à la lampe", "C'est une phase « commutée » : elle n'est sous tension que quand la lampe est allumée."],
        ],
      },
      {
        t: "table",
        head: ["Disjoncteur", "Puissance maximale à 230 V", "Exemples"],
        rows: [
          ["2 A", "≈ 460 W", "VMC"],
          ["10 A", "≈ 2 300 W", "Éclairage (possible), petit chauffage"],
          ["16 A", "≈ 3 680 W", "Éclairage, prises en 1,5 mm², volets roulants"],
          ["20 A", "≈ 4 600 W", "Prises en 2,5 mm², lave-linge, four, chauffe-eau"],
          ["32 A", "≈ 7 360 W", "Plaque de cuisson (câble 6 mm²)"],
        ],
      },
    ],
  },
  {
    id: "trajet",
    title: "2. Le trajet de l'électricité dans la maison",
    blocks: [
      { t: "svg", id: "arrivee", caption: "De la rue à la prise : chaque circuit part du tableau avec son propre disjoncteur." },
      {
        t: "ol",
        items: [
          "Le **réseau** (Enedis) arrive à ta maison par le branchement, jusqu'au **compteur** (Linky).",
          "Juste après le compteur, le **disjoncteur de branchement** (ou d'abonné) : c'est le grand interrupteur général. Il sert aussi de coupure d'urgence.",
          "Le **tableau électrique** (dans la gaine technique du logement, la GTL) répartit le courant en plusieurs **circuits**.",
          "Chaque circuit est protégé par un **disjoncteur** (protège les fils), et plusieurs circuits sont regroupés derrière un **interrupteur différentiel 30 mA** (protège les personnes).",
          "Du tableau, des câbles sous gaine partent vers les **boîtes de dérivation**, les **prises**, les **interrupteurs** et les **points lumineux**.",
        ],
      },
      { t: "tip", text: "Règle d'or : **1 circuit = 1 disjoncteur**. Deux circuits ne partagent jamais un disjoncteur, et un disjoncteur ne protège jamais deux circuits." },
    ],
  },
  {
    id: "tableau",
    title: "3. Le tableau électrique",
    intro: "C'est le cœur de l'installation. Voici ce qu'il contient et les règles de la norme.",
    blocks: [
      {
        t: "table",
        head: ["Appareil", "Il protège…", "Contre…", "Remarques"],
        rows: [
          ["Disjoncteur divisionnaire", "Les fils d'un circuit", "Surcharge et court-circuit", "Un par circuit. Son calibre (16 A, 20 A…) dépend de la section du fil."],
          ["Interrupteur différentiel 30 mA (DDR)", "Les personnes", "Électrocution (fuite de courant vers la terre)", "Coupe en une fraction de seconde si le courant fuit à la terre."],
          ["Parafoudre", "Les appareils", "Surtensions de la foudre", "Obligatoire dans certaines zones orageuses (AQ2) ou si le bâtiment a un paratonnerre. À vérifier pour ta commune."],
        ],
      },
      { t: "p", text: "**Différentiel de type A ou AC ?** Le type AC convient à la plupart des circuits. Le **type A est obligatoire pour le lave-linge, la plaque de cuisson** (et la borne de recharge de voiture électrique). Au minimum, un tableau contient **2 différentiels 30 mA dont 1 de type A**." },
      {
        t: "table",
        head: ["Surface du logement", "Rangées de 13 modules (minimum)", "Différentiels en pratique"],
        rows: [
          ["Moins de 35 m²", "2", "2 (1 type A + 1 type AC)"],
          ["35 à 100 m²", "3", "3 (1 type A + 2 type AC)"],
          ["Plus de 100 m²", "4", "4 (1 type A + 3 type AC)"],
        ],
        note: "La norme fixe un minimum de 2 différentiels dont 1 de type A ; le nombre de rangées suit la surface. En pratique on met un différentiel par rangée.",
      },
      {
        t: "list",
        items: [
          "**8 circuits maximum derrière un même différentiel.**",
          "**20 % de modules libres** dans le tableau pour les extensions futures.",
          "Une **barrette de terre** (et un bornier de neutre) : tous les fils de terre y arrivent.",
          "Les manettes doivent être accessibles : **le disjoncteur de branchement entre 0,90 m et 1,80 m du sol**, les autres manettes **entre environ 0,75 m et 1,80 m**.",
          "Répartis les circuits entre les différentiels pour qu'**un défaut ne laisse pas toute la maison dans le noir** : les lumières et les prises ne vont pas sur le même différentiel ; le congélateur est mieux sur un différentiel à part.",
        ],
      },
      { t: "warn", text: "Le raccordement du tableau au disjoncteur de branchement, et la prise de terre, sont les endroits où une erreur est la plus grave. Fais-les faire ou valider par un électricien, même si tu câbles le reste toi-même." },
    ],
  },
  {
    id: "circuits",
    title: "4. Les circuits : quel fil, quel disjoncteur, combien de points",
    intro: "C'est le tableau le plus important du guide. Tu le retrouves aussi dans la page Électricité du site (câbles, gaines, disjoncteurs calculés selon ces règles).",
    blocks: [
      {
        t: "table",
        head: ["Circuit", "Section du fil", "Disjoncteur max.", "Limite par circuit", "Gaine ICTA"],
        rows: [
          ["Éclairage", "1,5 mm²", "16 A (10 A possible)", "8 points lumineux maximum", "Ø16"],
          ["Prises (cas courant)", "2,5 mm²", "20 A", "12 prises maximum", "Ø20"],
          ["Prises (petit circuit)", "1,5 mm²", "16 A", "8 prises maximum", "Ø16 ou Ø20"],
          ["Prises de cuisine (plan de travail)", "2,5 mm²", "20 A", "6 prises, circuit dédié", "Ø20"],
          ["Lave-linge, lave-vaisselle, sèche-linge, four, congélateur", "2,5 mm²", "20 A", "1 prise ou 1 sortie de câble par circuit", "Ø20"],
          ["Chauffe-eau électrique", "2,5 mm²", "20 A", "Circuit dédié", "Ø20"],
          ["Plaque de cuisson", "6 mm²", "32 A", "Circuit dédié, sortie de câble", "Ø25"],
          ["Volets roulants", "1,5 mm²", "16 A", "Circuit dédié (conseillé : répartis sur 2 circuits)", "Ø16"],
          ["VMC", "1,5 mm²", "2 A en général", "Circuit dédié", "Ø16"],
          ["Chauffage électrique (sèche-serviettes…)", "1,5 mm² jusqu'à 2 250 W, 2,5 mm² jusqu'à 4 500 W", "10 A ou 20 A", "1 circuit par tranche de 4 500 W maximum", "Ø16 ou Ø20"],
        ],
        note: "Plus de 35 m² : au moins 2 circuits d'éclairage. Prises : le décompte se fait en « socles » : une prise double compte 2, une triple 3.",
      },
      { t: "info", text: "Le site, par prudence, prévoit un circuit de prises pour 8 prises (la norme en autorise 12 en 2,5 mm²). Cela donne un peu plus de circuits et une installation plus facile à dépanner : tu peux regrouper à 12 si tu veux économiser des disjoncteurs." },
      {
        t: "p",
        text: "**Un circuit « spécialisé »** alimente un seul appareil gourmand (four, lave-linge…). Il a son disjoncteur, son fil, et il ne se partage jamais avec une prise normale. C'est ce qui évite qu'un four et un grille-pain fassent sauter la même protection.",
      },
    ],
  },
  {
    id: "pieces",
    title: "5. Combien de prises, de lumières et de prises réseau par pièce",
    blocks: [
      {
        t: "table",
        head: ["Pièce", "Prises 16 A (minimum)", "Éclairage", "Autres"],
        rows: [
          ["Séjour / salon", "1 par tranche de 4 m², minimum 5 (donc 7 au moins au-delà de 28 m²)", "1 point au minimum", "2 prises RJ45 ; prise TV ; une prise 16 A à côté de chaque prise de communication"],
          ["Chambre / bureau", "3", "1 point", "1 RJ45 conseillée par chambre"],
          ["Cuisine", "6 dont 4 au-dessus du plan de travail (3 prises au total si la cuisine fait 4 m² ou moins)", "1 point général (+ éclairage de plan de travail conseillé)", "Circuits spécialisés : four, lave-vaisselle, plaque, lave-linge…"],
          ["Salle de bain / salle d'eau", "1 prise, hors des zones d'eau (voir chapitre 8)", "1 point avec commande à l'entrée", "Liaison équipotentielle supplémentaire"],
          ["WC", "Pas obligatoire", "1 point avec commande à l'entrée", "—"],
          ["Entrée, couloir, autre pièce de plus de 4 m²", "1", "1 point au minimum, commande à chaque extrémité (va-et-vient ou poussoirs)", "—"],
          ["Gaine technique du logement (GTL)", "2 prises sur un circuit réservé", "—", "Coffret de communication (box, RJ45)"],
        ],
        note: "Ce sont des minimums imposés. Rien ne t'empêche de mettre plus de prises, et c'est souvent une très bonne idée.",
      },
      {
        t: "list",
        items: [
          "**Comment le décompte se fait** : une boîte avec 1 prise compte 1, avec 2 prises côte à côte (prise double) 2, avec 3 prises 3. Tu peux donc remplacer 2 prises séparées par 1 prise double.",
          "**Dans le site** : la page Électricité reprend ces minimums par pièce, et tu peux ajouter des prises doubles, triples, des interrupteurs doubles et des boîtes de dérivation. Le total n'augmente que si tu dépasses le minimum.",
          "**Chaque pièce doit avoir une commande d'éclairage à l'entrée**, et une prise de courant à proximité de cette commande dans les pièces de vie.",
          "**Une prise 16 A doit se trouver près de chaque prise de communication (RJ45, TV)**, pour brancher la box, le décodeur…",
        ],
      },
      { t: "info", text: "Pense aussi au détecteur de fumée (DAAF) : au moins un par logement, obligatoire en France, à placer de préférence dans le dégagement qui dessert les chambres." },
    ],
  },
  {
    id: "hauteurs",
    title: "6. Où et à quelle hauteur poser les appareils",
    blocks: [
      {
        t: "table",
        head: ["Appareil", "Règle", "Source"],
        rows: [
          ["Prise 16 A / 20 A", "Axe à au moins 5 cm du sol fini et à 1,30 m au maximum", "Norme"],
          ["Prise 32 A (ou plus de 20 A)", "Au moins 12 cm du sol fini", "Norme"],
          ["Prise de hotte", "En position haute, à 1,80 m minimum du sol", "Norme (prise dédiée à la hotte)"],
          ["Prises courantes", "Vers 30 cm du sol (confortable, pas besoin de se pencher)", "Usage"],
          ["Interrupteur / poussoir", "Vers 1,10 m du sol, côté poignée de la porte, à 10–15 cm du chambranle", "Usage"],
          ["Plan de travail de cuisine", "Prises à 10–25 cm au-dessus du plan de travail", "Usage"],
          ["Tableau électrique", "Manettes entre 0,75 m et 1,80 m (disjoncteur de branchement : 0,90 m à 1,80 m)", "Norme"],
        ],
      },
      { t: "tip", text: "La norme n'impose plus de hauteur « accessibilité » pour les interrupteurs en maison : 1,10 m est un usage de chantier très répandu. Si tu vises une maison évolutive (vieillir chez soi), place les interrupteurs entre 0,90 m et 1,30 m." },
      { t: "p", text: "**Dans une cloison ou un doublage en placo, les câbles passent dans le vide** : ils suivent des cheminements bien droits (verticaux depuis la boîte, horizontaux en zone haute ou basse), jamais en diagonale, pour que tu saches où tu peux percer plus tard. **Prends des photos de tous les réseaux avant de fermer les murs, avec un mètre dans l'image.**" },
    ],
  },
  {
    id: "cuisine",
    title: "7. La cuisine, pas à pas",
    blocks: [
      {
        t: "ol",
        items: [
          "**6 prises 16 A** (3 si la cuisine fait 4 m² ou moins), dont **4 au-dessus du plan de travail**, sur **un circuit dédié** en 2,5 mm² / 20 A. Pas d'autre pièce sur ce circuit.",
          "Un circuit **spécialisé 20 A / 2,5 mm²** par appareil : four, lave-vaisselle, lave-linge (si dans la cuisine), congélateur.",
          "Un circuit **32 A / 6 mm²** pour la plaque de cuisson, avec une **sortie de câble** (pas de prise), derrière un différentiel de **type A**.",
          "Une prise pour la **hotte**, placée haut.",
          "Un **éclairage général** + un éclairage du plan de travail, sur circuit(s) d'éclairage.",
          "Une prise RJ45 si la cuisine est ouverte sur le séjour (elle compte alors dans le séjour).",
        ],
      },
      { t: "warn", text: "Les prises de plan de travail se placent à distance de l'évier et des plaques de cuisson (jamais juste au-dessus des feux ni de l'évier), à une hauteur qui reste accessible sans écarter un appareil." },
    ],
  },
  {
    id: "sdb",
    title: "8. Salle de bain, salle d'eau et WC",
    intro: "L'eau et l'électricité ne font pas bon ménage : la norme découpe la salle de bain en zones (les « volumes ») qui limitent ce qu'on peut y mettre.",
    blocks: [
      { t: "svg", id: "volumes", caption: "Vue de dessus d'une douche : plus on est près de l'eau, plus c'est restrictif." },
      {
        t: "table",
        head: ["Zone", "Où ?", "Prises", "Interrupteurs / éclairage"],
        rows: [
          ["Volume 0", "À l'intérieur de la baignoire ou du receveur de douche", "Interdites", "Seuls des éclairages spéciaux en très basse tension (12 V), très étanches (IPX7)"],
          ["Volume 1", "Au-dessus du receveur ou de la baignoire, jusqu'à 2,25 m de haut", "Interdites", "Interrupteurs et éclairage en très basse tension (12 V) uniquement, protection IPX5 minimum"],
          ["Volume 2", "60 cm autour du volume 1", "Seule une prise rasoir spéciale (avec transformateur de séparation)", "Appareils et éclairage protégés (IPX4 minimum)"],
          ["Hors volume", "Au-delà", "Autorisées (au moins 1 prise obligatoire)", "Peu de restrictions"],
        ],
        note: "Le volume 3 a disparu depuis l'amendement 5. IPX4 = protégé contre les projections d'eau.",
      },
      {
        t: "list",
        items: [
          "**Liaison équipotentielle supplémentaire (LES)** : un fil de terre relie entre eux les éléments métalliques de la pièce (tuyaux, huisserie métallique, receveur métallique…) et à la terre, pour qu'ils soient tous au même potentiel. À raccorder dans une boîte de connexion hors volumes.",
          "**Sèche-serviettes électrique** : circuit de chauffage dédié, matériel adapté à la zone où il se trouve.",
          "**Lave-linge, sèche-linge** : uniquement hors volume, sur leur circuit spécialisé.",
          "**Le différentiel 30 mA protège obligatoirement ces circuits.**",
          "**WC** : un point lumineux avec commande à l'entrée suffit. Une prise n'est pas obligatoire.",
        ],
      },
    ],
  },
  {
    id: "eclairage",
    title: "9. L'éclairage : simple allumage, va-et-vient, poussoirs et modules connectés",
    blocks: [
      { t: "svg", id: "eclairage", caption: "Principe du simple allumage : la phase passe par l'interrupteur, le neutre va directement à la lampe." },
      {
        t: "table",
        head: ["Montage", "Quand l'utiliser", "Matériel"],
        rows: [
          ["Simple allumage", "1 lampe commandée depuis 1 endroit", "1 interrupteur"],
          ["Double allumage", "2 lampes (ou 2 circuits) depuis 1 boîtier", "1 interrupteur double (2 boutons)"],
          ["Va-et-vient", "1 lampe commandée depuis 2 endroits (couloir, escalier)", "2 interrupteurs va-et-vient reliés par 2 fils « navettes »"],
          ["Permutateur", "1 lampe commandée depuis 3 endroits ou plus avec des interrupteurs classiques", "2 va-et-vient + 1 permutateur par endroit en plus (câblage lourd)"],
          ["Télérupteur + poussoirs", "3 endroits ou plus : plus simple que les permutateurs", "1 télérupteur au tableau + autant de boutons poussoirs que tu veux"],
          ["Module connecté + poussoirs", "Idem, pilotable à distance, scénarios, variation", "Boutons poussoirs classiques + 1 micro-module derrière chaque bouton ou au point lumineux"],
        ],
      },
      { t: "p", text: "**Si tous tes interrupteurs sont des poussoirs avec un module connecté**, tu n'as plus besoin de va-et-vient ni de permutateurs : chaque endroit a un poussoir, tous commandent le même module. Dans le site, tes interrupteurs sont alors comptés comme des interrupteurs simples (et des doubles si tu as 2 commandes par boîtier), avec un module par interrupteur." },
      {
        t: "list",
        items: [
          "**Prévois toujours la phase ET le neutre dans chaque boîte d'interrupteur.** La plupart des micro-modules connectés ont besoin du neutre pour fonctionner. Sans neutre, tu seras très limité dans le choix des modules.",
          "**Boîte d'encastrement profonde (50 mm)** : elle doit loger l'interrupteur et le module derrière. Pour un interrupteur double connecté, il faut une boîte double profonde et un module à 2 canaux.",
          "**Lis la notice du module** (Shelly, Sonoff, etc.) : les schémas de raccordement varient. Ce que le site compte (câble 3G1,5 jusqu'au point de commande, module derrière l'interrupteur, boîte profonde) te permet de brancher la plupart des modèles.",
          "**Un point lumineux = un DCL** (dispositif de connexion pour luminaire) fixé dans une boîte au plafond, qui supporte le poids du luminaire.",
          "**Boîte de dérivation** : quand un câble doit se séparer en plusieurs (par exemple pour alimenter 3 pièces), les fils se raccordent dans une boîte de dérivation avec bornes automatiques (type Wago). Elle doit rester **accessible** (couvercle visible, jamais noyée dans le plâtre).",
        ],
      },
    ],
  },
  {
    id: "guirlande",
    title: "10. Câbler des prises en guirlande",
    blocks: [
      { t: "svg", id: "guirlande", caption: "Les prises d'un circuit sont reliées l'une à l'autre : le câble arrive à la première, repart vers la deuxième…" },
      {
        t: "ol",
        items: [
          "Le câble **3G2,5** part du disjoncteur 20 A du circuit et arrive à la **première prise**.",
          "À chaque prise, **la phase, le neutre et la terre sont raccordés à la prise**, et un autre câble repart vers la prise suivante en reprenant les trois mêmes fils sur les **mêmes bornes** (borniers automatiques de la prise ou bornes Wago).",
          "La **terre** (vert/jaune) se raccorde à la borne de terre de **chaque** prise. Une prise sans terre, c'est une prise dangereuse.",
          "**Dénude juste ce qu'il faut** (environ 10 à 12 mm), enfonce à fond, tire doucement sur chaque fil pour vérifier qu'il tient.",
          "**Maximum 12 prises** sur un circuit 2,5 mm² / 20 A (8 sur un circuit 1,5 mm² / 16 A). Une prise double compte pour 2.",
          "Les prises d'un même circuit ne sont pas forcément dans la même pièce, mais regrouper par zone (salon + entrée, chambres de l'étage) rend le dépannage plus simple.",
        ],
      },
      { t: "tip", text: "Garde 15 à 20 cm de fil en réserve dans chaque boîte pour pouvoir câbler sans forcer, et fais une petite étiquette sur chaque câble au tableau (« prises salon », « four »…)." },
    ],
  },
  {
    id: "cheminer",
    title: "11. Gaines, câbles, boîtes : comment cheminer",
    blocks: [
      {
        t: "table",
        head: ["Élément", "Choix courant", "À savoir"],
        rows: [
          ["Câble", "Fils rigides H07V-U / H07V-R sous gaine, ou câble multiconducteur U1000 R2V (3G1,5, 3G2,5, 3G6)", "En encastré (dans un mur ou une cloison), le câble passe sous gaine."],
          ["Gaine", "ICTA (annelée, souple) Ø16, Ø20 ou Ø25", "Éclairage Ø16, prises Ø20, spécialisés et 6 mm² Ø25. Garde la place : les câbles ne doivent pas remplir la gaine à plus d'un tiers environ."],
          ["Boîte d'encastrement", "Ø67 mm, profondeur 40 mm (50 mm pour un interrupteur à module)", "Pour cloison sèche (placo) : boîtes à griffes ; en maçonnerie : boîtes à sceller."],
          ["Boîte DCL", "Boîte plafond avec crochet", "Reçoit le DCL et le luminaire."],
          ["Boîte de dérivation", "80 × 80 mm avec couvercle", "Reste accessible : jamais enfouie."],
        ],
      },
      {
        t: "list",
        items: [
          "**Les câbles du courant fort (230 V) et ceux du réseau ou de la TV (RJ45, coaxial) passent dans des gaines séparées**, pour éviter les parasites et les erreurs.",
          "**Ne fais jamais passer un câble en diagonale** dans un mur. Horizontal depuis la boîte vers le haut ou le bas, puis vertical.",
          "**Rayon de courbure** : une gaine ICTA se plie à la main sans plier net. Évite les coudes serrés qui bloquent ensuite le câble.",
          "**Dans un mur isolé RE2020** : utilise des boîtes d'encastrement **étanches à l'air** et des manchons sur les passages de gaines, pour ne pas ruiner l'étanchéité à l'air de la maison.",
          "**Tire les câbles avant de poser les plaques de placo**, et garde un fil de tirage (« aiguille ») dans les gaines vides que tu prévois pour plus tard.",
        ],
      },
    ],
  },
  {
    id: "terre",
    title: "12. La terre et les liaisons équipotentielles",
    blocks: [
      { t: "p", text: "La **prise de terre** est un conducteur en cuivre enterré qui évacue le courant de défaut dans le sol. Dans une maison neuve, c'est le maçon qui la pose à la fondation (boucle en fond de fouille : un câble de cuivre nu posé dans la tranchée de fondation, avant de couler le béton)." },
      {
        t: "list",
        items: [
          "**Vérifie qu'elle a été posée et photographie-la avant de couler**. Une prise de terre oubliée coûte très cher à refaire.",
          "Elle arrive au tableau sur la **barrette de terre**, par le **conducteur de terre**.",
          "**La valeur de la résistance de terre est mesurée** (par ton électricien ou avec un appareil dédié) et **indiquée sur la demande Consuel**. Plus elle est basse, mieux c'est (on vise nettement moins de 100 Ω).",
          "**Liaison équipotentielle principale** : au tableau, un fil vert/jaune relie la barrette de terre aux éléments métalliques qui entrent dans la maison (canalisations d'eau métalliques, gaz…).",
          "**Liaison équipotentielle supplémentaire** dans la salle de bain (chapitre 8).",
        ],
      },
    ],
  },
  {
    id: "methode",
    title: "13. Découper sa maison en circuits : méthode pas à pas",
    intro: "C'est l'étape que les débutants trouvent difficile. Voici une méthode simple.",
    blocks: [
      {
        t: "ol",
        items: [
          "**Liste les pièces et les besoins** dans la page Électricité du site (prises, lumières, RJ45 par pièce).",
          "**Commence par les circuits spécialisés** : un par gros appareil (four, lave-vaisselle, lave-linge, plaque, chauffe-eau, congélateur…).",
          "**Cuisine** : un circuit de 6 prises dédié.",
          "**Éclairage** : regroupe par zone ou par étage, 8 points maximum par circuit, au moins 2 circuits si la maison dépasse 35 m². Sépare le rez-de-chaussée de l'étage.",
          "**Prises** : regroupe par zone (séjour + entrée, chambres de l'étage…), 8 à 12 prises par circuit. Garde un peu de marge.",
          "**Volets roulants** : un circuit dédié, mieux sur 2 circuits (si l'un s'arrête, l'autre continue).",
          "**VMC, sèche-serviettes, GTL (2 prises), prises extérieures** : un circuit chacun ou une logique par usage.",
          "**Répartis les circuits entre les différentiels** : 8 circuits au maximum par différentiel, lave-linge et plaque sur le type A, lumières et prises sur des différentiels différents.",
          "**Compte les modules** et prends un tableau avec 20 % de modules libres.",
        ],
      },
      {
        t: "table",
        head: ["Exemple : maison de 110 m² sur 2 niveaux", "Fil", "Disjoncteur", "Différentiel"],
        rows: [
          ["Éclairage rez-de-chaussée", "1,5 mm²", "16 A", "1 (type AC)"],
          ["Éclairage étage", "1,5 mm²", "16 A", "1 (type AC)"],
          ["Volets roulants (2 circuits)", "1,5 mm²", "16 A chacun", "1 (type AC)"],
          ["VMC", "1,5 mm²", "2 A", "1 (type AC)"],
          ["Sèche-serviettes", "1,5 mm²", "10 A", "1 (type AC)"],
          ["Prises séjour et entrée", "2,5 mm²", "20 A", "2 (type AC)"],
          ["Prises chambres de l'étage", "2,5 mm²", "20 A", "2 (type AC)"],
          ["GTL (2 prises) + box", "2,5 mm²", "20 A", "2 (type AC)"],
          ["Prises de cuisine (6)", "2,5 mm²", "20 A", "3 (type AC)"],
          ["Four", "2,5 mm²", "20 A", "3 (type AC)"],
          ["Lave-vaisselle", "2,5 mm²", "20 A", "3 (type AC)"],
          ["Chauffe-eau", "2,5 mm²", "20 A", "3 (type AC)"],
          ["Congélateur", "2,5 mm²", "20 A", "3 (type AC)"],
          ["Lave-linge", "2,5 mm²", "20 A", "4 (type A)"],
          ["Plaque de cuisson", "6 mm²", "32 A", "4 (type A)"],
        ],
        note: "Exemple : 16 circuits sur 4 différentiels (jamais plus de 8 circuits par différentiel) : lumières et divers sur le 1, prises sur le 2, cuisine et appareils sur le 3, lave-linge et plaque sur le 4 (type A). À adapter à ta maison.",
      },
    ],
  },
  {
    id: "site",
    title: "14. Utiliser le Plan électrique du site",
    intro: "Le site peut mesurer la longueur de câble et de gaine à partir de ton plan, au lieu d'utiliser un forfait par point.",
    blocks: [
      {
        t: "ol",
        items: [
          "**Plans & pièces** : dessine ou importe le plan de chaque étage, **règle l'échelle** (px par mètre) en mesurant une distance connue.",
          "**Électricité** : vérifie les quantités par pièce (prises, lumières, RJ45…), ajoute prises doubles et triples, interrupteurs doubles, modules connectés.",
          "**Plan électrique** : choisis l'étage, pose le **tableau électrique** puis les éléments (prises, interrupteurs, points lumineux, boîtes de dérivation). Règle la hauteur de chaque élément.",
          "**Trace tes circuits** : « Tracer un câble » → clique sur le tableau, puis sur les points de passage (angles, plafond, trémie), puis sur chaque élément du circuit. Règle la section, la gaine et la hauteur de passage.",
          "**Plusieurs étages** : pour monter d'un étage, pose un point de passage à l'endroit de la trémie sur chaque étage. Le site ajoute la hauteur entre les deux sols.",
          "**Contrôle** avec « Pose vs prévu » : le tableau compare ce que tu as posé et les quantités de la page Électricité.",
          "**Active le mode « Mesuré sur le plan »** : les longueurs de câble et de gaine du chiffrage viennent de ton plan. Tu peux revenir au forfait à tout moment.",
          "**Récapitulatif par pièce** : tu vois pièce par pièce les matériaux, les quantités et les prix, et tu peux cliquer un matériau pour le retrouver dans la page Matériaux.",
        ],
      },
      { t: "tip", text: "Trace en guirlande, comme en vrai : tableau → prise 1 → prise 2 → prise 3. Le site ajoute 30 cm de réserve à chaque boîtier pour le câblage (réglable)." },
      { t: "warn", text: "En mode « plan », seuls les circuits tracés comptent : un point non relié à un circuit n'a pas de câble dans le chiffrage." },
    ],
  },
  {
    id: "phases",
    title: "15. L'ordre des travaux et les contrôles avant de fermer les murs",
    blocks: [
      {
        t: "ol",
        items: [
          "**Plan et schéma** : plan des points, liste des circuits, schéma du tableau. C'est aussi ce que demande le Consuel.",
          "**Prise de terre** (fondations) et **GTL / tableau** : repères et trémies.",
          "**Boîtes d'encastrement et boîtes DCL** : positionnées et fixées à la bonne hauteur.",
          "**Gaines** posées d'une boîte à l'autre, en suivant les cheminements prévus.",
          "**Câbles tirés dans les gaines**, étiquetés au tableau et dans les boîtes.",
          "**Contrôles avant fermeture** (voir ci-dessous).",
          "**Photos** de tous les réseaux, avec un mètre dans l'image.",
          "**Fermeture des murs**, enduits, peintures.",
          "**Appareillage** (prises, interrupteurs, plaques) et luminaires.",
          "**Tableau** câblé, étiqueté, puis **essais** et **Consuel**.",
        ],
      },
      {
        t: "table",
        head: ["Contrôle avant de fermer", "Comment"],
        rows: [
          ["Chaque point est repéré et son câble étiqueté", "Étiquettes sur le câble aux deux bouts"],
          ["Les boîtes sont à la bonne hauteur et d'aplomb", "Niveau + mètre"],
          ["La terre est présente partout", "Fil vert/jaune dans chaque boîte, à chaque prise et luminaire en classe I"],
          ["Pas de câble pincé, brûlé, entaillé", "Contrôle visuel du câble sur tout le trajet"],
          ["Les gaines ne sont pas écrasées", "Tirer le câble à vide pour tester"],
          ["Étanchéité à l'air des boîtes", "Boîtes étanches, manchons, scotch"],
          ["Photographies des réseaux", "Un cliché par mur"],
        ],
      },
    ],
  },
  {
    id: "service",
    title: "16. Essais, Consuel et mise en service",
    blocks: [
      {
        t: "list",
        items: [
          "**Continuité de la terre** : un testeur vérifie que chaque borne de terre est bien reliée au tableau.",
          "**Isolement** : un mégohmmètre (appareil de mesure) mesure l'isolation des câbles. La valeur minimale à respecter est de l'ordre de 0,5 MΩ. À faire hors tension et appareils débranchés.",
          "**Polarité** : la phase et le neutre ne sont pas inversés à une prise.",
          "**Différentiels** : bouton « test » du différentiel, et test avec un testeur adapté.",
          "**Mesure de la prise de terre** : à inscrire sur la demande Consuel.",
        ],
      },
      {
        t: "ol",
        items: [
          "**Demande d'attestation Consuel** sur consuel.com (formulaire « jaune » pour un logement neuf), avec ton schéma. Délai de l'ordre de quinze jours avant l'éventuelle visite d'un inspecteur.",
          "**Visa Consuel** obtenu : tu le transmets à ton fournisseur d'électricité.",
          "**Enedis met le compteur en service.** Sans visa Consuel, il refuse.",
        ],
      },
    ],
  },
  {
    id: "erreurs",
    title: "17. Les erreurs fréquentes",
    blocks: [
      {
        t: "list",
        items: [
          "**Fil trop fin pour le disjoncteur** : un disjoncteur 20 A sur du 1,5 mm² laisse le fil chauffer. 1,5 mm² = 16 A au maximum.",
          "**Oublier la terre** sur une prise ou un luminaire métallique.",
          "**Boîte de dérivation noyée dans le plâtre** : introuvable et inaccessible en cas de panne.",
          "**Trop de prises sur un circuit** : plus de 12 en 2,5 mm² ou 8 en 1,5 mm².",
          "**Partager un circuit spécialisé** entre plusieurs appareils.",
          "**Câbles en diagonale** dans les murs, ou sans gaine.",
          "**Neutre oublié à l'interrupteur**, puis impossibilité de poser un module connecté.",
          "**Prise dans le volume 1 ou 2** de la salle de bain.",
          "**Oublier de photographier** avant de fermer les murs.",
          "**Tableau trop petit** : sans 20 % de place libre, impossible d'ajouter un circuit plus tard.",
        ],
      },
    ],
  },
  {
    id: "glossaire",
    title: "18. Glossaire",
    blocks: [
      {
        t: "table",
        head: ["Mot", "Définition"],
        rows: [
          ["Circuit", "Un ensemble de points alimentés par un même disjoncteur."],
          ["Disjoncteur", "Coupe le courant en cas de surcharge ou de court-circuit. Protège les fils."],
          ["Différentiel (DDR)", "Coupe en cas de fuite de courant vers la terre. Protège les personnes."],
          ["GTL", "Gaine technique du logement : la zone où se trouvent le tableau, le coffret de communication et les arrivées."],
          ["Socle de prise", "Une prise individuelle. Une prise double compte pour 2 socles."],
          ["DCL", "Dispositif de connexion pour luminaire : la boîte plafond qui porte le luminaire."],
          ["ICTA", "Gaine annelée souple en plastique qui protège les câbles encastrés."],
          ["Va-et-vient", "Montage qui commande une lampe depuis deux endroits."],
          ["Télérupteur", "Relais au tableau qui commande une lampe depuis plusieurs boutons poussoirs."],
          ["Consuel", "Organisme qui délivre l'attestation de conformité de l'installation."],
          ["IPX4", "Protection contre les projections d'eau (exigée en zone humide)."],
          ["Classe II", "Appareil à double isolation, sans fil de terre."],
          ["TBTS", "Très basse tension de sécurité (12 V ou 24 V)."],
          ["VAT", "Vérificateur d'absence de tension : appareil qui confirme que le circuit est hors tension."],
        ],
      },
    ],
  },
  {
    id: "sources",
    title: "19. Sources et limites",
    blocks: [
      {
        t: "list",
        items: [
          "Norme **NF C 15-100**, amendement 5 (applicable depuis le 27 novembre 2015) : nombres de prises, circuits, tableau, salle de bain.",
          "Guides techniques **Legrand**, **Hager**, **Promotelec** et **Consuel** (consultés en octobre 2026).",
          "Les valeurs « usage » (hauteur d'un interrupteur, hauteur de prise de plan de travail, réserve de fil…) ne sont pas des obligations : ce sont des pratiques courantes.",
          "Les règles de la norme évoluent. Vérifie la version en vigueur auprès du Consuel ou d'un électricien avant de commander et de câbler.",
        ],
      },
    ],
  },
];
