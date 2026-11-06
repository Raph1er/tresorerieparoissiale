import type { jsPDF as JsPdfDocument } from "jspdf";
import type { ProgrammeSection, ProgrammeSemaineDetail } from "@/utils/programme-semaine";
import { getParoisseReportHeaderLines } from "@/lib/paroisse-config";

const COLONNES = [
  "Dates",
  "Conducteurs",
  "Prières de trois personnes",
  "Textes bibliques",
  "Lecteurs",
  "Prédicateur",
  "Quêteurs",
  "Prière de clôture",
];
const LARGEURS_COLONNES = [21, 30, 39, 36, 44, 32, 43, 34];
const LIGNE_POINTILLEE = "............................";
const TAILLE_POLICE_TABLEAU = 8.5;
const TAILLE_POLICE_MIN = 6; 
const FACTEUR_INTERLIGNE = 1.15;
const ESPACE_ENTRE_ELEMENTS = 1.2;
const COLONNE_TEXTES_BIBLIQUES = 3;
const TAILLE_ICONE_BIBLE = 3;
const ESPACE_ICONE_TEXTE = 0.5;

function getValeur(programme: ProgrammeSemaineDetail, section: ProgrammeSection, cle: string): string {
  const champ = section.champs.find((element) => element.cle === cle);
  if (!champ) return "";
  return (programme.valeurs[champ.valueKey] ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

interface ContenuCellule {
  texte: string;
  elementsMultiples: string[];
}

function construireContenuCellule(
  programme: ProgrammeSemaineDetail,
  section: ProgrammeSection,
  cles: string[],
  nombreLignesVides: number,
  prefixeParChamp?: string[]
): ContenuCellule {
  if (cles.length === 0) {
    const elements = Array(nombreLignesVides).fill("");
    return {
      texte: elements.join("\n"),
      elementsMultiples: elements.length > 1 ? elements : [],
    };
  }
  if (cles.length === 1 && nombreLignesVides > 1) {
    const valeur = getValeur(programme, section, cles[0]);
    if (!valeur) {
      const elements = Array(nombreLignesVides)
        .fill(`${prefixeParChamp?.[0] ?? ""}`.trim());
      return {
        texte: elements.join("\n"),
        elementsMultiples: elements.length > 1 ? elements : [],
      };
    }
  }
  const elements = cles.map((cle, index) =>
    `${prefixeParChamp?.[index] ?? ""}${getValeur(programme, section, cle) || ""}`.trim()
  );
  return {
    texte: elements.join("\n"),
    elementsMultiples: elements.length > 1 ? elements : [],
  };
}
function obtenirDateSection(programme: ProgrammeSemaineDetail, section: ProgrammeSection): string {
  const champDate = section.champs.find((champ) =>
    champ.calcul === "DATE_SECTION" || champ.calcul === "DATE_CALENDRIER"
  );
  const date = champDate ? getValeur(programme, section, champDate.cle) : "";
  if (date) return date;
  return `${section.libelle}${section.heure ? ` à ${section.heure.slice(0, 2)}h` : ""}`;
}

function obtenirMoisAnnee(programme: ProgrammeSemaineDetail): string {
  const sectionGenerale = programme.structure.sections.find(
    (section) => section.cle === "informations_generales"
  );
  const moisAnnee = sectionGenerale
    ? getValeur(programme, sectionGenerale, "Mois_Annee")
    : "";
  return moisAnnee || programme.dateDebut.slice(0, 7);
}

function dessinerIconeBible(doc: JsPdfDocument, x: number, y: number, taille: number): void {
  const milieuX = x + taille / 2;
  const hautY = y;
  const basY = y + taille;

  doc.setDrawColor(75, 93, 112);
  doc.setLineWidth(0.25);
  doc.line(x, hautY + taille * 0.12, milieuX, hautY + taille * 0.24);
  doc.line(milieuX, hautY + taille * 0.24, x + taille, hautY + taille * 0.12);
  doc.line(x, hautY + taille * 0.12, x, basY - taille * 0.12);
  doc.line(x, basY - taille * 0.12, milieuX, basY - taille * 0.24);
  doc.line(milieuX, basY - taille * 0.24, x + taille, basY - taille * 0.12);
  doc.line(x + taille, basY - taille * 0.12, x + taille, hautY + taille * 0.12);
  doc.line(milieuX, hautY + taille * 0.24, milieuX, basY - taille * 0.24);

  doc.setLineWidth(0.15);
  doc.line(x + taille * 0.12, hautY + taille * 0.38, x + taille * 0.38, hautY + taille * 0.44);
  doc.line(x + taille * 0.12, hautY + taille * 0.55, x + taille * 0.38, hautY + taille * 0.61);
  doc.line(x + taille * 0.62, hautY + taille * 0.44, x + taille * 0.88, hautY + taille * 0.38);
  doc.line(x + taille * 0.62, hautY + taille * 0.61, x + taille * 0.88, hautY + taille * 0.55);
}

function construireLignes(programme: ProgrammeSemaineDetail): {
  rows: string[][];
  hauteurs: number[];
  lignesPrioritaires: boolean[];
  theme: string;
  elementsMultiples: string[][][];
} {
  const sectionGenerale = programme.structure.sections.find(
    (section) => section.cle === "informations_generales"
  );
  const theme = sectionGenerale ? getValeur(programme, sectionGenerale, "Theme") : "";
  const reunions = programme.structure.sections.filter(
    (section) => section.cle !== "informations_generales"
  );

  const cellules = reunions.map((section) => {
    const clesLecteursDimanche = [
      "Lecteur_1_Langue_locale",
      "Lecteur_1_Langue_francaise",
      "Lecteur_2_Langue_locale",
      "Lecteur_2_Langue_francaise",
    ];
    const estDimancheMatin = section.champs.some((champ) => clesLecteursDimanche.includes(champ.cle));
    const clesPrières = ["Priere_1", "Priere_2", "Priere_3"]
      .filter((cle) => section.champs.some((champ) => champ.cle === cle));
    const clesQueteurs = ["Queteur_1", "Queteur_2", "Queteur_3", "Queteur_4"]
      .filter((cle) => section.champs.some((champ) => champ.cle === cle));
    const clesLecteurs = estDimancheMatin
      ? clesLecteursDimanche
      : section.champs.some((champ) => champ.cle === "Lecteur")
        ? ["Lecteur"]
        : [];
    const prefixeLecteurs = estDimancheMatin ? ["G : ", "F : ", "G : ", "F : "] : undefined;

    // On force le nombre de sous-cases à 3 SEULEMENT le dimanche matin (3 prières distinctes)
    // Pour les autres jours, on laisse 1 seule case (pas de séparation)
    const nombrePrieres = estDimancheMatin ? 3 : 1;

    const prières = clesPrières.length
      ? construireContenuCellule(
        programme,
        section,
        clesPrières,
        nombrePrieres,
        clesPrières.map((_, index) => `${index + 1}. `)
      )
      : construireContenuCellule(programme, section, ["Prieres_Trois_Personnes"], nombrePrieres);
    const textesBibliques = estDimancheMatin
      ? construireContenuCellule(
        programme,
        section,
        ["Texte_Biblique_1", "Texte_Biblique_2"],
        2,
        ["", ""]
      )
      : construireContenuCellule(programme, section, ["Texte_Biblique"], 1);
    textesBibliques.elementsMultiples = textesBibliques.texte.split("\n");
    const lecteurs = construireContenuCellule(
      programme,
      section,
      clesLecteurs,
      estDimancheMatin ? 4 : 1,
      prefixeLecteurs
    );
    const queteurs = construireContenuCellule(
      programme,
      section,
      clesQueteurs,
      2,
      clesQueteurs.map((_, index) => `${index + 1}. `)
    );

    return [
      { texte: obtenirDateSection(programme, section), elementsMultiples: [] },
      construireContenuCellule(programme, section, ["Conducteur"], 1),
      prières,
      textesBibliques,
      lecteurs,
      construireContenuCellule(programme, section, ["Predicateur"], 1),
      queteurs,
      construireContenuCellule(programme, section, ["Priere_Cloture"], 1),
    ];
  });

  const hauteurs = reunions.map((section) => (
    section.champs.some((champ) => champ.cle === "Lecteur_1_Langue_locale") ? 34 : 16
  ));
  return {
    rows: cellules.map((ligne) => ligne.map((cellule) => cellule.texte)),
    hauteurs,
    lignesPrioritaires: reunions.map((section) =>
      section.champs.some((champ) => champ.cle === "Lecteur_1_Langue_locale")
    ),
    theme,
    elementsMultiples: cellules.map((ligne) => ligne.map((cellule) => cellule.elementsMultiples)),
  };
}

function dessinerEntete(doc: JsPdfDocument, moisAnnee: string): void {
  const largeurPage = doc.internal.pageSize.getWidth();
  const entete = [
    "EGLISE DU CHRISTIANISME CELESTE",
    "SAINT SIEGE DE PORTO-NOVO",
    "DIOCESE DU BENIN",
    ...getParoisseReportHeaderLines(),
  ];

  doc.setTextColor(20, 20, 20);
  doc.setFont("times", "bolditalic");
  doc.setFontSize(8);
  entete.forEach((ligne, index) => {
    doc.text(ligne.toLocaleUpperCase("fr-FR"), largeurPage / 2, 7 + index * 3.7, { align: "center" });
  });

  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.text("Programme de la semaine", largeurPage / 2, 34, { align: "center" });

  doc.setLineWidth(0.6);
  doc.setDrawColor(35, 35, 35);
  doc.rect(12, 30, 75, 12);
  doc.setFont("times", "bolditalic");
  doc.setFontSize(12);
  doc.text(moisAnnee.toLocaleUpperCase("fr-FR"), 49.5, 37.5, {
    align: "center",
    maxWidth: 71,
  });
}

export async function telechargerProgrammePdf(
  programme: ProgrammeSemaineDetail
): Promise<{ blob: Blob; fileName: string }> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const creerDocument = () => new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  let doc = creerDocument();
  const largeurPage = doc.internal.pageSize.getWidth();
  const hauteurPage = doc.internal.pageSize.getHeight();
  const { rows, hauteurs, lignesPrioritaires, theme, elementsMultiples } = construireLignes(programme);
  const dessinerTableau = (
    document: JsPdfDocument,
    hauteursLignes?: number[]
  ): number[] => {
    const cellulesMultiples = new Map<string, { lignes: string[] }>();
    const hauteursRendues = Array(rows.length).fill(0) as number[];

    autoTable(document, {
    startY: 44,
    head: [
      [{
        content: `THÈME : ${theme || LIGNE_POINTILLEE}`,
        colSpan: COLONNES.length,
        styles: {
          fontStyle: "bolditalic",
          fontSize: 11,
          minCellHeight: 9,
        },
      }],
      COLONNES,
    ],
    body: rows,
    margin: { left: 9, right: 9, top: 44, bottom: 12 },
    rowPageBreak: "avoid",
    styles: {
      font: "times",
      fontStyle: "normal",
      fontSize: TAILLE_POLICE_TABLEAU,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      cellPadding: { top: 1.5, right: 1.2, bottom: 1.5, left: 1.2 },
      valign: "middle",
      halign: "center",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      font: "times",
      fontStyle: "bold",
      fontSize: 8,
      minCellHeight: 10,
    },
    columnStyles: Object.fromEntries(
      LARGEURS_COLONNES.map((cellWidth, index) => [index, { cellWidth }])
    ),
    didParseCell: (data) => {
      data.cell.styles.textColor = [0, 0, 0];
      data.cell.styles.lineColor = [0, 0, 0];
      if (data.section === "head" && data.row.index === 0) {
        data.cell.styles.fillColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bolditalic";
        data.cell.styles.fontSize = 11;
      }
      if (data.section === "body") {
        data.cell.styles.font = "times";
        data.cell.styles.fontStyle = "normal";
        data.cell.styles.fontSize = TAILLE_POLICE_TABLEAU;
        
        // On s'assure que la hauteur minimale de la cellule est respectée
        data.cell.styles.minCellHeight = hauteursLignes?.[data.row.index]
          ?? hauteurs[data.row.index]
          ?? 16;

        const elements = elementsMultiples[data.row.index]?.[data.column.index] ?? [];
        const estColonneTextesBibliques = data.column.index === COLONNE_TEXTES_BIBLIQUES;
        if (elements.length > 1 || estColonneTextesBibliques) {
          data.cell.text = [];
          cellulesMultiples.set(`${data.row.index}:${data.column.index}`, {
            lignes: elements.length > 0
              ? elements
              : [rows[data.row.index][data.column.index]],
          });
        }
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      hauteursRendues[data.row.index] = Math.max(
        hauteursRendues[data.row.index],
        data.cell.height
      );
      const cellule = cellulesMultiples.get(`${data.row.index}:${data.column.index}`);
      if (!cellule) return;

      const nombreElements = cellule.lignes.length;
      const hauteurParElement = data.cell.height / nombreElements;
      const estColonneTextesBibliques = data.column.index === COLONNE_TEXTES_BIBLIQUES;
      const largeurTexte = data.cell.width
        - data.cell.padding("horizontal")
        - (estColonneTextesBibliques ? TAILLE_ICONE_BIBLE + ESPACE_ICONE_TEXTE : 0);
      
      const centreX = data.cell.x + data.cell.width / 2;
      const gaucheX = data.cell.x + data.cell.padding("left"); 
      const centreTexteX = estColonneTextesBibliques
        ? gaucheX + TAILLE_ICONE_BIBLE + ESPACE_ICONE_TEXTE + largeurTexte / 2
        : centreX;

      document.setFont("times", "normal");
      document.setDrawColor(0, 0, 0);
      document.setLineWidth(0.2);

      cellule.lignes.forEach((texte, index) => {
        const debutY = data.cell.y + index * hauteurParElement;
        const finY = debutY + hauteurParElement;

        if (texte.trim()) {
          if (estColonneTextesBibliques) {
            dessinerIconeBible(
              document,
              gaucheX,
              debutY + (hauteurParElement - TAILLE_ICONE_BIBLE) / 2,
              TAILLE_ICONE_BIBLE
            );
            document.setDrawColor(0, 0, 0);
            document.setLineWidth(0.2);
          }

          let taille = TAILLE_POLICE_TABLEAU;
          let lignesTexte: string[];
          let hauteurLigne: number;
          let hauteurTotaleTexte: number;
          const hauteurTexteDisponible = hauteurParElement - data.cell.padding("vertical");

          do {
            document.setFontSize(taille);
            lignesTexte = document.splitTextToSize(texte, largeurTexte);
            hauteurLigne = taille * FACTEUR_INTERLIGNE / document.internal.scaleFactor;
            hauteurTotaleTexte = lignesTexte.length * hauteurLigne;
            if (hauteurTotaleTexte <= hauteurTexteDisponible || taille <= TAILLE_POLICE_MIN) {
              break;
            }
            taille = Math.max(TAILLE_POLICE_MIN, taille - 0.5);
          } while (true);

          let curseurY = debutY + (hauteurParElement - hauteurTotaleTexte) / 2 + hauteurLigne * 0.8;
          const estVideOuPrefixe = !/[a-zA-ZÀ-ÿ]{2,}/.test(texte);

          lignesTexte.forEach((ligne: string) => {
            if (estVideOuPrefixe) {
              document.text(ligne, gaucheX, curseurY, { align: "left" });
            } else {
              document.text(ligne, centreTexteX, curseurY, { align: "center" });
            }
            curseurY += hauteurLigne;
          });
        }

        if (index < nombreElements - 1) {
          document.line(data.cell.x, finY, data.cell.x + data.cell.width, finY);
        }
      });
    },
    didDrawPage: () => dessinerEntete(document, obtenirMoisAnnee(programme)),
    });

    return hauteursRendues;
  };

  const hauteursLignes = dessinerTableau(doc);
  const hauteurFinaleInitiale = (doc as JsPdfDocument & { lastAutoTable?: { finalY: number } })
    .lastAutoTable?.finalY ?? 170;
  const limiteTableau = hauteurPage - 28;
  const espaceDisponible = limiteTableau - hauteurFinaleInitiale;

  if (doc.getNumberOfPages() === 1 && rows.length > 0 && espaceDisponible > 1) {
    const poidsTotal = lignesPrioritaires.reduce(
      (total, prioritaire) => total + (prioritaire ? 4 : 1),
      0
    );
    const hauteursCibles = hauteursLignes.map((hauteur, index) => (
      hauteur + espaceDisponible * (lignesPrioritaires[index] ? 4 : 1) / poidsTotal
    ));

    doc = creerDocument();
    dessinerTableau(doc, hauteursCibles);
  }

   const tableFinalY = (doc as JsPdfDocument & { lastAutoTable?: { finalY: number } })
    .lastAutoTable?.finalY ?? 170;
  
  // On positionne la ligne de signature un peu plus bas pour laisser respirer
  // On colle la signature à 5mm du tableau, et on autorise à descendre jusqu'à 12mm du bord
  let basPiedDePage = Math.min(tableFinalY + 12, hauteurPage - 12);
  
  // Si l'espace restant est trop petit pour la signature (moins de 10mm), on passe à la page suivante
  if (hauteurPage - basPiedDePage < 10) {
    doc.addPage();
    dessinerEntete(doc, obtenirMoisAnnee(programme));
    basPiedDePage = 44; // On repositionne la signature en haut de la nouvelle page
  }

  doc.setPage(doc.getNumberOfPages());
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);
  
  const nomCharge = process.env.NEXT_PUBLIC_PAROISSE_CHARGE_PAROISSIAL?.trim()
    || LIGNE_POINTILLEE;

  // Les 3 parties du texte
  const texteGauche = "Le Chargé Paroissial : ";
  const texteMilieu = nomCharge;
  const texteDroite = "Signature :";

  // On laisse un grand espace pour signer (environ 40mm)
  const espaceSignature = 10;

  // --- Calcul des largeurs ---
  doc.setFont("times", "italic");
  const largeurGauche = doc.getTextWidth(texteGauche);
  
  doc.setFont("times", "bold");
  const largeurMilieu = doc.getTextWidth(texteMilieu);
  
  doc.setFont("times", "italic");
  const largeurDroite = doc.getTextWidth(texteDroite);
  
  // Largeur totale de la ligne (avec l'espace de signature)
  const largeurTotale = largeurGauche + largeurMilieu + espaceSignature + largeurDroite;
  
  // Position X de départ pour centrer le tout
  let curseurX = (largeurPage - largeurTotale) / 2;
  const y = basPiedDePage;

  // --- Dessin ---
  
  // 1. Le Chargé Paroissial : (Italique + Souligné)
  doc.setFont("times", "italic");
  doc.text(texteGauche, curseurX, y);
  doc.setLineWidth(0.2);
  // On recule légèrement le trait pour éviter le débordement visuel de l'italique
  doc.line(curseurX, y + 0.8, curseurX + largeurGauche - 0.5, y + 0.8);
  curseurX += largeurGauche;

  // 2. Le Nom (Normal)
  doc.setFont("times", "bold");
  doc.text(texteMilieu, curseurX, y);
  curseurX += largeurMilieu + espaceSignature; // On saute l'espace de signature

  // 3. Signature : (Italique + Souligné)
  doc.setFont("times", "italic");
  doc.text(texteDroite, curseurX, y);
  // On recule légèrement le trait pour éviter le débordement visuel
  doc.line(curseurX, y + 0.8, curseurX + largeurDroite - 0.5, y + 0.8);

  // Ajout des numéros de page
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("times", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 90, 90);
    doc.text(`Page ${page} / ${pages}`, largeurPage - 9, hauteurPage - 4, { align: "right" });
  }

  const fileName = `programme-semaine-${programme.dateDebut}-au-${programme.dateFin}.pdf`;
  const blob = doc.output("blob");
  doc.save(fileName);
  return { blob, fileName };
}
