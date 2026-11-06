const FORMATTEUR_MOIS = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  timeZone: "UTC",
});

const FORMATTEUR_JOUR = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  timeZone: "UTC",
});

export interface DateReunionProgramme {
  date: string;
  libelle: string;
}

export interface DatesProgrammeSemaine {
  moisAnnee: string;
  mercredi: DateReunionProgramme;
  jeudi: DateReunionProgramme;
  vendredi: DateReunionProgramme;
  dimancheMatin: DateReunionProgramme;
  dimancheSoir: DateReunionProgramme;
}

export interface ProgrammeChamp {
  cle: string;
  valueKey: string;
  libelle: string;
  typeDonnee: string;
  ordre: number;
  obligatoire: boolean;
  calcule: boolean;
  calcul: string | null;
  modifiablePar: string;
}

export interface ProgrammeSection {
  cle: string;
  libelle: string;
  ordre: number;
  jourDecalage: number | null;
  heure: string | null;
  dateReunion?: string;
  champs: ProgrammeChamp[];
}

export interface ProgrammeStructure {
  cle: string;
  nom: string;
  version: number;
  sections: ProgrammeSection[];
}

export interface ProgrammeTemplateListe {
  id: number;
  cle: string;
  nom: string;
  description: string | null;
  version: number;
}

export interface ProgrammeSemaineListe {
  id: number;
  typeTemplateId: number;
  nomTemplate: string;
  cleTemplate: string;
  dateDebut: string;
  dateFin: string;
  statut: string;
  modifieLe: string;
}

export interface ProgrammeSemaineDetail extends ProgrammeSemaineListe {
  structure: ProgrammeStructure;
  valeurs: Record<string, string>;
}

function parserDateLocale(dateIso: string): Date {
  const correspondance = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  if (!correspondance) {
    throw new Error("La date de début doit être au format AAAA-MM-JJ.");
  }

  const annee = Number(correspondance[1]);
  const mois = Number(correspondance[2]);
  const jour = Number(correspondance[3]);
  const date = new Date(Date.UTC(annee, mois - 1, jour));

  if (
    date.getUTCFullYear() !== annee
    || date.getUTCMonth() !== mois - 1
    || date.getUTCDate() !== jour
  ) {
    throw new Error("La date de début n’est pas une date valide.");
  }

  if (date.getUTCDay() !== 1) {
    throw new Error("La date de début du programme doit être un lundi.");
  }

  return date;
}

function obtenirDateReunion(semaine: Date, decalageJours: number): DateReunionProgramme {
  const date = new Date(semaine);
  date.setUTCDate(date.getUTCDate() + decalageJours);

  const jour = FORMATTEUR_JOUR.format(date);
  const libelle = `${jour.charAt(0).toLocaleUpperCase("fr-FR")}${jour.slice(1)} ${date.getUTCDate()}`;

  return {
    date: date.toISOString().slice(0, 10),
    libelle,
  };
}

function obtenirMoisAnnee(semaine: Date): string {
  const moisDeLaSemaine: Date[] = [];

  for (let decalage = 0; decalage <= 6; decalage += 1) {
    const date = new Date(semaine);
    date.setUTCDate(date.getUTCDate() + decalage);
    const moisDejaAjoute = moisDeLaSemaine.some(
      (mois) => mois.getUTCMonth() === date.getUTCMonth()
        && mois.getUTCFullYear() === date.getUTCFullYear()
    );

    if (!moisDejaAjoute) {
      moisDeLaSemaine.push(date);
    }
  }

  const annees = new Set(moisDeLaSemaine.map((date) => date.getUTCFullYear()));
  const mois = moisDeLaSemaine.map((date) => FORMATTEUR_MOIS.format(date).toLocaleUpperCase("fr-FR"));

  if (annees.size === 1) {
    return `${mois.join("/")} ${moisDeLaSemaine[0].getUTCFullYear()}`;
  }

  return moisDeLaSemaine
    .map((date, index) => `${mois[index]} ${date.getUTCFullYear()}`)
    .join("/");
}

export function calculerDatesProgrammeSemaine(dateDebut: string): DatesProgrammeSemaine {
  const semaine = parserDateLocale(dateDebut);
  const dimanche = obtenirDateReunion(semaine, 6);

  return {
    moisAnnee: obtenirMoisAnnee(semaine),
    mercredi: obtenirDateReunion(semaine, 2),
    jeudi: obtenirDateReunion(semaine, 3),
    vendredi: obtenirDateReunion(semaine, 4),
    dimancheMatin: dimanche,
    dimancheSoir: dimanche,
  };
}

export function formaterLibelleSemaine(dateDebut: string, dateFin: string): string {
  const debut = parserDateISO(dateDebut);
  const fin = parserDateISO(dateFin);
  const memeMois = debut.getUTCMonth() === fin.getUTCMonth()
    && debut.getUTCFullYear() === fin.getUTCFullYear();
  const formatterMois = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    timeZone: "UTC",
  });
  const moisDebut = formatterMois.format(debut);
  const moisFin = formatterMois.format(fin);
  const jourDebut = `Lundi ${String(debut.getUTCDate()).padStart(2, "0")}`;
  const debutFormate = memeMois
    ? jourDebut
    : `${jourDebut} ${moisDebut.charAt(0).toLocaleUpperCase("fr-FR")}${moisDebut.slice(1)}`;
  const jourFin = `Dimanche ${String(fin.getUTCDate()).padStart(2, "0")}`;
  const moisFinFormate = `${moisFin.charAt(0).toLocaleUpperCase("fr-FR")}${moisFin.slice(1)}`;

  return `Semaine du ${debutFormate} au ${jourFin} ${moisFinFormate} ${fin.getUTCFullYear()}`;
}

function parserDateISO(dateIso: string): Date {
  const correspondance = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  if (!correspondance) {
    throw new Error("La date de début doit être au format AAAA-MM-JJ.");
  }
  const date = new Date(Date.UTC(
    Number(correspondance[1]),
    Number(correspondance[2]) - 1,
    Number(correspondance[3])
  ));
  if (
    date.getUTCFullYear() !== Number(correspondance[1])
    || date.getUTCMonth() !== Number(correspondance[2]) - 1
    || date.getUTCDate() !== Number(correspondance[3])
  ) {
    throw new Error("La date de début n’est pas une date valide.");
  }
  return date;
}
