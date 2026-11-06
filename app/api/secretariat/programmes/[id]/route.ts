import { NextRequest, NextResponse } from "next/server";
import { validerAuthentification, validerRole } from "@/middleware/auth.middleware";
import { supabaseServer } from "@/lib/supabase";
import type { ProgrammeSemaineDetail, ProgrammeStructure } from "@/utils/programme-semaine";

const ROLES_SECRETARIAT = ["ADMIN", "SECRETAIRE"];

interface RouteContext {
  params: Promise<{ id: string }>;
}

function analyserId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const contexte = await validerAuthentification(request);
  if (contexte instanceof NextResponse) return contexte;

  const erreurRole = validerRole(contexte, ROLES_SECRETARIAT);
  if (erreurRole) return erreurRole;

  const id = analyserId((await context.params).id);
  if (!id) return NextResponse.json({ erreur: "Identifiant de programme invalide." }, { status: 400 });

  const { data: programme, error } = await supabaseServer
    .from("programmes_semaine")
    .select("id, type_template_id, date_debut, date_fin, statut, modifie_le, structure, valeurs")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Erreur GET /api/secretariat/programmes/[id]:", error);
    return NextResponse.json({ erreur: "Impossible de charger le programme." }, { status: 500 });
  }
  if (!programme) return NextResponse.json({ erreur: "Programme introuvable." }, { status: 404 });
  const { data: template, error: erreurTemplate } = await supabaseServer
    .from("types_templates")
    .select("nom, cle")
    .eq("id", programme.type_template_id)
    .maybeSingle();
  if (erreurTemplate) {
    console.error("Erreur GET modèle /api/secretariat/programmes/[id]:", erreurTemplate);
    return NextResponse.json({ erreur: "Impossible de charger le modèle du programme." }, { status: 500 });
  }
  if (!template) {
    return NextResponse.json({ erreur: "Le modèle de ce programme est introuvable." }, { status: 409 });
  }

  const structureComplete = programme.structure as ProgrammeStructure;
  const valeursPartagees = programme.valeurs as Record<string, string>;
  let valeursSecretaire: Record<string, string> = {};
  if (contexte.role === "SECRETAIRE") {
    const { data: saisieSecretaire, error: erreurSaisieSecretaire } = await supabaseServer
      .from("programmes_semaine_secretaires")
      .select("valeurs")
      .eq("programme_id", id)
      .eq("utilisateur_id", contexte.userId)
      .maybeSingle();

    if (erreurSaisieSecretaire) {
      console.error("Erreur GET saisie secrétaire /api/secretariat/programmes/[id]:", erreurSaisieSecretaire);
      return NextResponse.json(
        { erreur: "Impossible de charger vos officiants. Vérifiez que la mise à jour Supabase du secrétariat a été exécutée." },
        { status: 500 }
      );
    }

    valeursSecretaire = (saisieSecretaire?.valeurs ?? {}) as Record<string, string>;
  }

  const sectionsVisibles = structureComplete.sections
    .map((section) => ({
      ...section,
      champs: section.champs.filter(
        (champ) => champ.calcule
          || champ.modifiablePar === contexte.role
          || (contexte.role === "SECRETAIRE" && champ.modifiablePar === "ADMIN")
      ),
    }))
    .filter((section) => section.champs.length > 0);
  const clesVisibles = new Set(
    sectionsVisibles.flatMap((section) => section.champs.map((champ) => champ.valueKey))
  );
  const clesSecretaire = new Set(
    sectionsVisibles.flatMap((section) => section.champs
      .filter((champ) => champ.modifiablePar === "SECRETAIRE" && !champ.calcule)
      .map((champ) => champ.valueKey))
  );
  const valeursVisibles = Object.fromEntries(
    Object.entries(valeursPartagees)
      .filter(([cle]) => clesVisibles.has(cle) && !clesSecretaire.has(cle))
  );
  for (const [cle, valeur] of Object.entries(valeursSecretaire)) {
    if (clesSecretaire.has(cle)) valeursVisibles[cle] = valeur;
  }

  const detail: ProgrammeSemaineDetail = {
    id: programme.id,
    typeTemplateId: programme.type_template_id,
    nomTemplate: template.nom,
    cleTemplate: template.cle,
    dateDebut: programme.date_debut,
    dateFin: programme.date_fin,
    statut: programme.statut,
    modifieLe: programme.modifie_le,
    structure: { ...structureComplete, sections: sectionsVisibles },
    valeurs: valeursVisibles,
  };

  return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const contexte = await validerAuthentification(request);
  if (contexte instanceof NextResponse) return contexte;

  const erreurRole = validerRole(contexte, ROLES_SECRETARIAT);
  if (erreurRole) return erreurRole;

  const id = analyserId((await context.params).id);
  if (!id) return NextResponse.json({ erreur: "Identifiant de programme invalide." }, { status: 400 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Corps JSON invalide." }, { status: 400 });
  }

  if (
    typeof payload !== "object"
    || payload === null
    || Array.isArray(payload)
    || Object.keys(payload).length === 0
    || Object.values(payload).some((value) => typeof value !== "string" || value.length > 500)
  ) {
    return NextResponse.json({ erreur: "Valeurs de champs invalides." }, { status: 400 });
  }

  const { error } = await supabaseServer.rpc("rpc_update_programme_semaine_values", {
    p_programme_id: id,
    p_role: contexte.role,
    p_user_id: contexte.userId,
    p_fields: payload,
  });

  if (error?.message.includes("PROGRAM_NOT_FOUND")) {
    return NextResponse.json({ erreur: "Programme introuvable." }, { status: 404 });
  }
  if (error?.message.includes("INVALID_PROGRAM_FIELD") || error?.message.includes("INVALID_PROGRAM_FIELDS")) {
    return NextResponse.json(
      { erreur: "Un ou plusieurs champs ne peuvent pas être modifiés avec votre rôle." },
      { status: 403 }
    );
  }
  if (error) {
    console.error("Erreur PATCH /api/secretariat/programmes/[id]:", error);
    return NextResponse.json(
      { erreur: "La sauvegarde du programme a échoué. Vérifiez que le script Supabase de secrétariat a été exécuté." },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Programme enregistré." });
}
