import { NextRequest, NextResponse } from "next/server";
import { validerAuthentification, validerRole } from "@/middleware/auth.middleware";
import { supabaseServer } from "@/lib/supabase";
import {
  calculerDatesProgrammeSemaine,
  type ProgrammeChamp,
  type ProgrammeSection,
  type ProgrammeStructure,
} from "@/utils/programme-semaine";

const ROLES_SECRETARIAT = ["ADMIN", "SECRETAIRE"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formaterDateCalculee(
  section: ProgrammeSection,
  champ: ProgrammeChamp,
  dateDebut: string
): string {
  if (champ.calcul === "MOIS_ANNEE_SEMAINE") {
    return calculerDatesProgrammeSemaine(dateDebut).moisAnnee;
  }

  if (champ.calcul === "DATE_CALENDRIER" && section.dateReunion) {
    const date = new Date(`${section.dateReunion}T00:00:00.000Z`);
    const jour = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      timeZone: "UTC",
    }).format(date);
    const mois = new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      timeZone: "UTC",
    }).format(date);
    const dateFormatee = `${jour.charAt(0).toLocaleUpperCase("fr-FR")}${jour.slice(1)} ${date.getUTCDate()} ${mois}`;
    return `${dateFormatee}${section.heure ? ` à ${section.heure.slice(0, 2)}h` : ""}`;
  }

  if (champ.calcul !== "DATE_SECTION") {
    throw new Error(`Calcul de champ inconnu : ${champ.calcul}`);
  }

  const decalages = calculerDatesProgrammeSemaine(dateDebut);
  const reunion = {
    mercredi: decalages.mercredi,
    jeudi_00h: decalages.jeudi,
    vendredi: decalages.vendredi,
    dimanche_matin: decalages.dimancheMatin,
    dimanche_soir: decalages.dimancheSoir,
  }[section.cle];
  if (!reunion) {
    throw new Error(`Aucune date calculée pour la section ${section.cle}.`);
  }

  return `${reunion.libelle}${section.heure ? ` à ${section.heure.slice(0, 2)}h` : ""}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const contexte = await validerAuthentification(request);
  if (contexte instanceof NextResponse) return contexte;

  const erreurRole = validerRole(contexte, ROLES_SECRETARIAT);
  if (erreurRole) return erreurRole;

  const dateDebut = request.nextUrl.searchParams.get("dateDebut");
  if (dateDebut) {
    try {
      calculerDatesProgrammeSemaine(dateDebut);
    } catch (error) {
      return NextResponse.json(
        { erreur: error instanceof Error ? error.message : "Date de début invalide." },
        { status: 400 }
      );
    }

    const { data: association, error: erreurAssociation } = await supabaseServer
      .from("programmes_semaine_assignations")
      .select("programme_id")
      .eq("date_debut", dateDebut)
      .maybeSingle();

    if (erreurAssociation) {
      console.error("Erreur GET association programme:", erreurAssociation);
      return NextResponse.json(
        { erreur: "Impossible de vérifier le modèle associé à cette semaine. Vérifiez la mise à jour Supabase." },
        { status: 500 }
      );
    }

    if (!association) {
      return NextResponse.json({ association: null }, { headers: { "Cache-Control": "no-store" } });
    }

    const { data: programmeAssocie, error: erreurProgrammeAssocie } = await supabaseServer
      .from("programmes_semaine")
      .select("id, type_template_id")
      .eq("id", association.programme_id)
      .maybeSingle();

    if (erreurProgrammeAssocie) {
      console.error("Erreur GET programme associé:", erreurProgrammeAssocie);
      return NextResponse.json({ erreur: "Impossible de charger le programme associé." }, { status: 500 });
    }
    if (!programmeAssocie) {
      return NextResponse.json({ erreur: "L’association de cette semaine référence un programme introuvable." }, { status: 409 });
    }

    return NextResponse.json({
      association: {
        programmeId: programmeAssocie.id,
        typeTemplateId: programmeAssocie.type_template_id,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const { data: templates, error: erreurTemplates } = await supabaseServer
      .from("types_templates")
      .select("id, cle, nom, description, version, actif")
      .eq("actif", true)
      .order("nom");

    if (erreurTemplates) throw erreurTemplates;

    return NextResponse.json({
      templates: (templates ?? []).map((template) => ({
        id: template.id,
        cle: template.cle,
        nom: template.nom,
        description: template.description,
        version: template.version,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erreur GET /api/secretariat/programmes:", error);
    return NextResponse.json(
      { erreur: "Impossible de charger les modèles de programme." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contexte = await validerAuthentification(request);
  if (contexte instanceof NextResponse) return contexte;

  const erreurRole = validerRole(contexte, ROLES_SECRETARIAT);
  if (erreurRole) return erreurRole;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Corps JSON invalide." }, { status: 400 });
  }

  const estAdministrateur = contexte.role === "ADMIN";
  if (!isRecord(payload)
    || Object.keys(payload).some((key) => !["typeTemplateId", "dateDebut"].includes(key))
    || (estAdministrateur && !("typeTemplateId" in payload))
    || (!estAdministrateur && "typeTemplateId" in payload)) {
    return NextResponse.json({ erreur: "Données de création invalides." }, { status: 400 });
  }

  const typeTemplateId = payload.typeTemplateId;
  const dateDebut = payload.dateDebut;
  if (typeof dateDebut !== "string"
    || (estAdministrateur && (typeof typeTemplateId !== "number" || !Number.isSafeInteger(typeTemplateId)))) {
    return NextResponse.json({ erreur: "Choisissez une date de début valide et un modèle si vous êtes administrateur." }, { status: 400 });
  }
  let templateId = 0;
  if (estAdministrateur) {
    if (typeof typeTemplateId !== "number") {
      return NextResponse.json({ erreur: "Choisissez un modèle valide." }, { status: 400 });
    }
    templateId = typeTemplateId;
  }
  let modeleParDefaut = false;

  let dates;
  try {
    dates = calculerDatesProgrammeSemaine(dateDebut);
  } catch (error) {
    return NextResponse.json(
      { erreur: error instanceof Error ? error.message : "Date de début invalide." },
      { status: 400 }
    );
  }

  try {
    if (!estAdministrateur) {
      const { data: association, error: erreurAssociation } = await supabaseServer
        .from("programmes_semaine_assignations")
        .select("programme_id")
        .eq("date_debut", dateDebut)
        .maybeSingle();

      if (erreurAssociation) throw erreurAssociation;
      if (association) {
        return NextResponse.json({ id: association.programme_id, modeleParDefaut: false });
      }

      const { data: modeleStandard, error: erreurModeleStandard } = await supabaseServer
        .from("types_templates")
        .select("id")
        .eq("cle", "PROGRAMME_SEMAINE_STANDARD")
        .eq("actif", true)
        .maybeSingle();

      if (erreurModeleStandard) throw erreurModeleStandard;
      if (!modeleStandard) {
        return NextResponse.json(
          { erreur: "Le modèle standard par défaut est introuvable ou désactivé." },
          { status: 409 }
        );
      }

      templateId = modeleStandard.id;
      modeleParDefaut = true;
    }

    const { data: template, error: erreurTemplate } = await supabaseServer
      .from("types_templates")
      .select("id, cle, nom, version")
      .eq("id", templateId)
      .eq("actif", true)
      .maybeSingle();

    if (erreurTemplate) throw erreurTemplate;
    if (!template) {
      return NextResponse.json({ erreur: "Le modèle choisi est introuvable ou désactivé." }, { status: 404 });
    }

    const { data: programmeExistant, error: erreurProgrammeExistant } = await supabaseServer
      .from("programmes_semaine")
      .select("id")
      .eq("type_template_id", template.id)
      .eq("date_debut", dateDebut)
      .maybeSingle();

    if (erreurProgrammeExistant) throw erreurProgrammeExistant;
    if (programmeExistant) {
      const { reaffectee } = await enregistrerAssociation(
        dateDebut,
        programmeExistant.id,
        contexte.userId
      );
      return NextResponse.json(
        { id: programmeExistant.id, dejaExistant: true, reaffectee, modeleParDefaut },
        { status: 200 }
      );
    }

    const { data: sections, error: erreurSections } = await supabaseServer
      .from("sections_templates")
      .select("id, cle, libelle, ordre, jour_decalage, heure")
      .eq("type_template_id", template.id)
      .order("ordre");

    if (erreurSections) throw erreurSections;
    if (!sections?.length) {
      return NextResponse.json({ erreur: "Ce modèle ne contient aucune section." }, { status: 409 });
    }

    const { data: champs, error: erreurChamps } = await supabaseServer
      .from("champs_templates")
      .select("section_id, cle, libelle, type_donnee, ordre, obligatoire, calcule, calcul, modifiable_par")
      .in("section_id", sections.map((section) => section.id))
      .order("ordre");

    if (erreurChamps) throw erreurChamps;

    const { data: reglesCalendrier, error: erreurReglesCalendrier } = await supabaseServer
      .from("regles_calendrier_templates")
      .select("id, cle, type_regle, mois_debut, jour_debut, mois_fin, jour_fin, recurrence, section_id")
      .eq("type_template_id", template.id)
      .order("id");

    if (erreurReglesCalendrier) throw erreurReglesCalendrier;
    const regles = reglesCalendrier ?? [];
    const sectionsRegies = new Set(regles.map((regle) => regle.section_id));
    const regleInvalide = regles.find((regle) => !(
        (regle.type_regle === "PLAGE_ANNUELLE_QUOTIDIENNE" && regle.recurrence === "QUOTIDIENNE")
        || (regle.type_regle === "DATE_ANNUELLE" && regle.recurrence === "ANNUELLE")
      ));
    if (regleInvalide) {
      throw new Error(`Règle de calendrier non prise en charge : ${regleInvalide.cle}`);
    }

    const structure: ProgrammeStructure = {
      cle: template.cle,
      nom: template.nom,
      version: template.version,
      sections: sections
        .filter((section) => !sectionsRegies.has(section.id))
        .map((section) => ({
          cle: section.cle,
          libelle: section.libelle,
          ordre: section.ordre,
          jourDecalage: section.jour_decalage,
          heure: section.heure,
          champs: (champs ?? [])
            .filter((champ) => champ.section_id === section.id)
            .map((champ) => ({
              cle: champ.cle,
              valueKey: `${section.cle}.${champ.cle}`,
              libelle: champ.libelle,
              typeDonnee: champ.type_donnee,
              ordre: champ.ordre,
              obligatoire: champ.obligatoire,
              calcule: champ.calcule,
              calcul: champ.calcul,
              modifiablePar: champ.modifiable_par,
            })),
        })),
    };

    let totalJoursGeneres = 0;
    for (const regle of regles) {
      const sectionModele = sections.find((section) => section.id === regle.section_id);
      if (!sectionModele) {
        throw new Error(`Section de calendrier introuvable pour la règle ${regle.cle}.`);
      }

      const dateCourante = new Date(`${dateDebut}T00:00:00.000Z`);
      for (let decalage = 0; decalage <= 6; decalage += 1) {
        const date = new Date(dateCourante);
        date.setUTCDate(date.getUTCDate() + decalage);
        const cleDate = date.getUTCMonth() * 100 + date.getUTCDate();
        const cleDebut = (regle.mois_debut - 1) * 100 + regle.jour_debut;
        const cleFin = (regle.mois_fin - 1) * 100 + regle.jour_fin;
        const estDateAnnuelle = regle.type_regle === "DATE_ANNUELLE";
        const correspondRegle = estDateAnnuelle
          ? cleDate === cleDebut
          : cleDebut <= cleFin
            ? cleDate >= cleDebut && cleDate <= cleFin
            : cleDate >= cleDebut || cleDate <= cleFin;
        if (!correspondRegle) continue;

        totalJoursGeneres += 1;
        const dateISO = date.toISOString().slice(0, 10);
        const libelleJour = new Intl.DateTimeFormat("fr-FR", {
          weekday: "long",
          timeZone: "UTC",
        }).format(date);
        const libelleMois = new Intl.DateTimeFormat("fr-FR", {
          month: "long",
          timeZone: "UTC",
        }).format(date);
        const cleJour = `${libelleJour.charAt(0).toLocaleUpperCase("fr-FR")}${libelleJour.slice(1)}`;

        structure.sections.push({
          cle: `${sectionModele.cle}_${dateISO.replaceAll("-", "")}`,
          libelle: `${cleJour} ${date.getUTCDate()} ${libelleMois}`,
          ordre: decalage,
          jourDecalage: decalage,
          heure: sectionModele.heure,
          dateReunion: dateISO,
          champs: (champs ?? [])
            .filter((champ) => champ.section_id === sectionModele.id)
            .map((champ) => ({
              cle: champ.cle,
              valueKey: `${sectionModele.cle}_${dateISO.replaceAll("-", "")}.${champ.cle}`,
              libelle: champ.libelle,
              typeDonnee: champ.type_donnee,
              ordre: champ.ordre,
              obligatoire: champ.obligatoire,
              calcule: champ.calcule,
              calcul: champ.calcul,
              modifiablePar: champ.modifiable_par,
            })),
        });
      }
    }

    if (regles.length > 0 && totalJoursGeneres === 0) {
      return NextResponse.json(
        { erreur: "Ce modèle s’applique aux semaines contenant au moins une date du 18 au 24 décembre ou le 31 décembre." },
        { status: 400 }
      );
    }

    structure.sections.sort((sectionA, sectionB) => {
      const decalageA = sectionA.jourDecalage ?? -1;
      const decalageB = sectionB.jourDecalage ?? -1;
      if (decalageA !== decalageB) return decalageA - decalageB;
      return (sectionA.heure ?? "").localeCompare(sectionB.heure ?? "");
    });
    structure.sections.forEach((section, index) => {
      section.ordre = index + 1;
    });

    const valeurs: Record<string, string> = {};
    for (const section of structure.sections) {
      for (const champ of section.champs) {
        valeurs[champ.valueKey] = champ.calcule
          ? formaterDateCalculee(section, champ, dateDebut)
          : "";
      }
    }

    const { data: programme, error: erreurCreation } = await supabaseServer
      .from("programmes_semaine")
      .insert({
        type_template_id: template.id,
        date_debut: dateDebut,
        date_fin: dates.dimancheMatin.date,
        version_template: template.version,
        structure,
        valeurs,
        statut: "EN_PREPARATION",
        cree_par_id: contexte.userId,
      })
      .select("id")
      .single();

    if (erreurCreation?.code === "23505") {
      const { data: programmeConcurrent, error: erreurRechercheConcurrente } = await supabaseServer
        .from("programmes_semaine")
        .select("id")
        .eq("type_template_id", template.id)
        .eq("date_debut", dateDebut)
        .maybeSingle();

      if (erreurRechercheConcurrente) throw erreurRechercheConcurrente;
      if (programmeConcurrent) {
        const { reaffectee } = await enregistrerAssociation(
          dateDebut,
          programmeConcurrent.id,
          contexte.userId
        );
        return NextResponse.json(
          { id: programmeConcurrent.id, dejaExistant: true, reaffectee, modeleParDefaut },
          { status: 200 }
        );
      }

      throw erreurCreation;
    }
    if (erreurCreation) throw erreurCreation;

    const { reaffectee } = await enregistrerAssociation(dateDebut, programme.id, contexte.userId);
    return NextResponse.json({ id: programme.id, reaffectee, modeleParDefaut }, { status: 201 });
  } catch (error) {
    console.error("Erreur POST /api/secretariat/programmes:", error);
    return NextResponse.json(
      { erreur: "L’association du modèle à cette semaine a échoué. Vérifiez que le script Supabase du secrétariat a été exécuté." },
      { status: 500 }
    );
  }
}

async function enregistrerAssociation(
  dateDebut: string,
  programmeId: number,
  utilisateurId: number
): Promise<{ reaffectee: boolean }> {
  const { data: associationExistante, error: erreurLecture } = await supabaseServer
    .from("programmes_semaine_assignations")
    .select("programme_id")
    .eq("date_debut", dateDebut)
    .maybeSingle();

  if (erreurLecture) throw erreurLecture;

  const { error: erreurEnregistrement } = await supabaseServer
    .from("programmes_semaine_assignations")
    .upsert({
      date_debut: dateDebut,
      programme_id: programmeId,
      associe_par_id: utilisateurId,
      associe_le: new Date().toISOString(),
    }, { onConflict: "date_debut" });

  if (erreurEnregistrement) throw erreurEnregistrement;

  return {
    reaffectee: Boolean(
      associationExistante && associationExistante.programme_id !== programmeId
    ),
  };
}
