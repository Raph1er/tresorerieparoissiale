import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";
import { validerAuthentification, validerRole } from "@/middleware/auth.middleware";

export const runtime = "nodejs";

const ROLES_SECRETARIAT = ["ADMIN", "SECRETAIRE"];
const BUCKET_PROGRAMMES = "programmes-pdf-temporaires";
const TAILLE_MAX_PDF = 4 * 1024 * 1024;
const DUREE_LIEN_SECONDES = 14 * 24 * 60 * 60;
const SEUIL_NETTOYAGE = 20;
const NOMBRE_A_SUPPRIMER = 10;

function reponseErreur(message: string, status: number): NextResponse {
  return NextResponse.json(
    { erreur: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

async function nettoyerPdfSiNecessaire(fichierNouveau: string): Promise<void> {
  const stockage = supabaseServer.storage.from(BUCKET_PROGRAMMES);
  const fichiers: Array<{ name: string; created_at?: string | null }> = [];
  const taillePage = 1000;

  for (let offset = 0; ; offset += taillePage) {
    const { data: page, error: erreurListe } = await stockage.list("", {
      limit: taillePage,
      offset,
      sortBy: { column: "created_at", order: "asc" },
    });
    if (erreurListe) throw erreurListe;

    const pdfsPage = (page ?? []).filter((fichier) =>
      fichier.name.toLowerCase().endsWith(".pdf")
    );
    fichiers.push(...pdfsPage);

    if (!page || page.length < taillePage) break;
  }

  if (fichiers.length < SEUIL_NETTOYAGE) return;

  const plusAnciens = fichiers
    .filter((fichier) => fichier.name !== fichierNouveau)
    .sort((a, b) => {
      const dateA = Date.parse(a.created_at ?? "") || 0;
      const dateB = Date.parse(b.created_at ?? "") || 0;
      return dateA - dateB;
    })
    .slice(0, NOMBRE_A_SUPPRIMER);
  if (plusAnciens.length < NOMBRE_A_SUPPRIMER) {
    throw new Error("Impossible de déterminer les dix anciens PDF à supprimer.");
  }

  const { error: erreurSuppression } = await stockage.remove(
    plusAnciens.map((fichier) => fichier.name)
  );
  if (erreurSuppression) throw erreurSuppression;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contexte = await validerAuthentification(request);
  if (contexte instanceof NextResponse) return contexte;

  const erreurRole = validerRole(contexte, ROLES_SECRETARIAT);
  if (erreurRole) return erreurRole;

  let formulaire: FormData;
  try {
    formulaire = await request.formData();
  } catch {
    return reponseErreur("Le formulaire de partage est invalide.", 400);
  }

  const document = formulaire.get("document");
  if (
    typeof File === "undefined"
    || !(document instanceof File)
    || document.size === 0
    || document.size > TAILLE_MAX_PDF
    || document.type !== "application/pdf"
  ) {
    return reponseErreur("Le fichier fourni doit être un PDF valide de 4 Mo maximum.", 400);
  }

  const bytes = new Uint8Array(await document.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") {
    return reponseErreur("Le fichier fourni n’est pas un PDF valide.", 400);
  }

  const stockage = supabaseServer.storage.from(BUCKET_PROGRAMMES);
  const chemin = `${Date.now()}-${crypto.randomUUID()}.pdf`;
  const { error: erreurTeleversement } = await stockage.upload(chemin, bytes, {
    contentType: "application/pdf",
    cacheControl: String(DUREE_LIEN_SECONDES),
    upsert: false,
  });
  if (erreurTeleversement) {
    console.error("Erreur de téléversement du PDF temporaire:", erreurTeleversement);
    return reponseErreur(
      "Impossible de préparer le lien temporaire. Vérifiez le bucket de stockage Supabase.",
      503
    );
  }

  try {
    await nettoyerPdfSiNecessaire(chemin);
  } catch (error) {
    const { error: erreurSuppression } = await stockage.remove([chemin]);
    if (erreurSuppression) {
      console.error("Impossible de supprimer le nouveau PDF après échec du nettoyage:", erreurSuppression);
    }
    console.error("Erreur de nettoyage des anciens PDF temporaires:", error);
    return reponseErreur(
      "Impossible de vérifier ou nettoyer le stockage temporaire. Réessayez plus tard.",
      503
    );
  }

  const { data: lien, error: erreurLien } = await stockage.createSignedUrl(
    chemin,
    DUREE_LIEN_SECONDES,
    { download: document.name.replace(/[\r\n"]/g, "") || "programme.pdf" }
  );
  if (erreurLien || !lien?.signedUrl) {
    const { error: erreurNettoyage } = await stockage.remove([chemin]);
    if (erreurNettoyage) {
      console.error("Impossible de supprimer un PDF dont le lien n’a pas été créé:", erreurNettoyage);
    }
    console.error("Erreur de création du lien PDF temporaire:", erreurLien);
    return reponseErreur("Impossible de créer le lien de téléchargement temporaire.", 503);
  }

  return NextResponse.json(
    { lien: lien.signedUrl, expireDansSecondes: DUREE_LIEN_SECONDES },
    { headers: { "Cache-Control": "no-store" } }
  );
}
