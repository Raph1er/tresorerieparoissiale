"use client";

import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  Clock3,
  Download,
  FileText,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  Save,
  Send,
  X,
} from "lucide-react";
import { usePermissionContext } from "@/components/dashboard/PermissionContext";
import { ApiError, fetchWithAuth } from "@/lib/api-client";
import {
  calculerDatesProgrammeSemaine,
  formaterLibelleSemaine,
  type ProgrammeSemaineDetail,
  type ProgrammeTemplateListe,
} from "@/utils/programme-semaine";

interface TemplatesResponse {
  templates: ProgrammeTemplateListe[];
}

interface ProgrammeSelectionResponse {
  id: number;
  reaffectee?: boolean;
  modeleParDefaut?: boolean;
}

interface AssociationSemaineResponse {
  association: {
    programmeId: number;
    typeTemplateId: number;
  } | null;
}

interface DocumentPdf {
  blob: Blob;
  fileName: string;
}

interface LienPdfResponse {
  lien: string;
  expireDansSecondes: number;
}

function messageErreur(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export default function ProgrammeSemainePage() {
  const role = usePermissionContext()?.role;
  const estAdministrateur = role === "ADMIN";
  const [templates, setTemplates] = useState<ProgrammeTemplateListe[]>([]);
  const [modeleId, setModeleId] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [association, setAssociation] = useState<AssociationSemaineResponse["association"]>(null);
  const [programme, setProgramme] = useState<ProgrammeSemaineDetail | null>(null);
  const [valeursInitiales, setValeursInitiales] = useState<Record<string, string>>({});
  const [chargementTemplates, setChargementTemplates] = useState(true);
  const [ouvertureEnCours, setOuvertureEnCours] = useState(false);
  const [associationEnCours, setAssociationEnCours] = useState(false);
  const [modeleParDefaut, setModeleParDefaut] = useState(false);
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState(false);
  const [telechargementEnCours, setTelechargementEnCours] = useState(false);
  const [documentPdf, setDocumentPdf] = useState<DocumentPdf | null>(null);
  const [numeroWhatsApp, setNumeroWhatsApp] = useState("");
  const [partageEnCours, setPartageEnCours] = useState(false);
  const [erreurPartage, setErreurPartage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const requeteCourante = useRef(0);
  const modeleChoisiManuellement = useRef(false);
  const formulaireRef = useRef<HTMLElement | null>(null);

  const chargerTemplates = useCallback(async (): Promise<void> => {
    setChargementTemplates(true);
    setErreur(null);
    try {
      const resultat = await fetchWithAuth<TemplatesResponse>("/api/secretariat/programmes");
      setTemplates(resultat.templates);
    } catch (error) {
      setErreur(messageErreur(error, "Impossible de charger les modèles de programme."));
    } finally {
      setChargementTemplates(false);
    }
  }, []);

  const chargerProgramme = useCallback(async (id: number): Promise<ProgrammeSemaineDetail> => {
    return fetchWithAuth<ProgrammeSemaineDetail>(`/api/secretariat/programmes/${id}`);
  }, []);

  useEffect(() => {
    void chargerTemplates();
  }, [chargerTemplates]);

  const apercuSemaine = useMemo(() => {
    if (!dateDebut) return null;
    try {
      const dates = calculerDatesProgrammeSemaine(dateDebut);
      return {
        libelle: formaterLibelleSemaine(dateDebut, dates.dimancheMatin.date),
        moisAnnee: dates.moisAnnee,
      };
    } catch (error) {
      return { erreur: error instanceof Error ? error.message : "Date invalide." };
    }
  }, [dateDebut]);

  useEffect(() => {
    const requestId = requeteCourante.current + 1;
    requeteCourante.current = requestId;

    if (!dateDebut || !role || !apercuSemaine || "erreur" in apercuSemaine) {
      setProgramme(null);
      setAssociation(null);
      setModeleParDefaut(false);
      setOuvertureEnCours(false);
      setSucces(null);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setProgramme(null);
      setValeursInitiales({});
      setModeleParDefaut(false);
      setOuvertureEnCours(true);
      setErreur(null);
      setSucces(null);

      try {
        let programmeId: number;
        if (estAdministrateur) {
          const resultatAssociation = await fetchWithAuth<AssociationSemaineResponse>(
            `/api/secretariat/programmes?dateDebut=${encodeURIComponent(dateDebut)}`
          );
          if (requeteCourante.current !== requestId) return;
          setAssociation(resultatAssociation.association);
          if (resultatAssociation.association && !modeleChoisiManuellement.current) {
            setModeleId(String(resultatAssociation.association.typeTemplateId));
          }
          if (
            !resultatAssociation.association
            || String(resultatAssociation.association.typeTemplateId) !== modeleId
          ) {
            return;
          }
          programmeId = resultatAssociation.association.programmeId;
        } else {
          const selection = await fetchWithAuth<ProgrammeSelectionResponse>("/api/secretariat/programmes", {
            method: "POST",
            body: JSON.stringify({ dateDebut }),
          });
          programmeId = selection.id;
          setModeleParDefaut(selection.modeleParDefaut === true);
        }

        const resultat = await chargerProgramme(programmeId);

        if (requeteCourante.current !== requestId) return;
        setProgramme(resultat);
        setValeursInitiales(resultat.valeurs);
      } catch (error) {
        if (requeteCourante.current === requestId) {
          setErreur(messageErreur(error, "Impossible d’ouvrir le programme de cette semaine."));
        }
      } finally {
        if (requeteCourante.current === requestId) {
          setOuvertureEnCours(false);
        }
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [apercuSemaine, chargerProgramme, dateDebut, estAdministrateur, modeleId, role]);

  async function associerModeleASemaine(): Promise<void> {
    if (!estAdministrateur || !modeleId || !dateDebut || !apercuSemaine || "erreur" in apercuSemaine) return;

    const requestId = requeteCourante.current + 1;
    requeteCourante.current = requestId;
    setAssociationEnCours(true);
    setOuvertureEnCours(true);
    setProgramme(null);
    setValeursInitiales({});
    setErreur(null);
    setSucces(null);

    try {
      const selection = await fetchWithAuth<ProgrammeSelectionResponse>("/api/secretariat/programmes", {
        method: "POST",
        body: JSON.stringify({ typeTemplateId: Number(modeleId), dateDebut }),
      });
      const resultat = await chargerProgramme(selection.id);
      if (requeteCourante.current !== requestId) return;

      setAssociation({ programmeId: selection.id, typeTemplateId: Number(modeleId) });
      setModeleParDefaut(false);
      setProgramme(resultat);
      setValeursInitiales(resultat.valeurs);
      setSucces(selection.reaffectee
        ? "Le modèle a été réassocié à cette semaine. Les anciennes fiches et leurs données sont conservées."
        : "Le modèle a été associé à cette semaine.");
    } catch (error) {
      if (requeteCourante.current === requestId) {
        setErreur(messageErreur(error, "Impossible d’associer le modèle à cette semaine."));
      }
    } finally {
      if (requeteCourante.current === requestId) {
        setAssociationEnCours(false);
        setOuvertureEnCours(false);
      }
    }
  }

  const champsModifies = programme
    ? programme.structure.sections.flatMap((section) => section.champs)
      .filter((champ) => champ.modifiablePar === role && !champ.calcule)
      .some((champ) => (programme.valeurs[champ.valueKey] ?? "") !== (valeursInitiales[champ.valueKey] ?? ""))
    : false;

  function modifierValeur(cle: string, valeur: string): void {
    setProgramme((actuel) => actuel
      ? { ...actuel, valeurs: { ...actuel.valeurs, [cle]: valeur } }
      : actuel);
    setSucces(null);
  }

  async function enregistrerProgramme(): Promise<void> {
    if (!programme || !champsModifies) return;

    const valeurs = Object.fromEntries(
      programme.structure.sections.flatMap((section) => section.champs)
        .filter((champ) => champ.modifiablePar === role && !champ.calcule)
        .filter((champ) => (programme.valeurs[champ.valueKey] ?? "") !== (valeursInitiales[champ.valueKey] ?? ""))
        .map((champ) => [champ.valueKey, programme.valeurs[champ.valueKey] ?? ""])
    );

    setSauvegardeEnCours(true);
    setErreur(null);
    setSucces(null);
    try {
      await fetchWithAuth(`/api/secretariat/programmes/${programme.id}`, {
        method: "PATCH",
        body: JSON.stringify(valeurs),
      });
      const actualise = await chargerProgramme(programme.id);
      setProgramme(actualise);
      setValeursInitiales(actualise.valeurs);
      setSucces("Le programme a été enregistré.");
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    } catch (error) {
      setErreur(messageErreur(error, "La sauvegarde du programme a échoué."));
    } finally {
      setSauvegardeEnCours(false);
    }
  }

  async function telechargerPdf(): Promise<void> {
    if (!programme) return;

    setTelechargementEnCours(true);
    setErreur(null);
    try {
      const { telechargerProgrammePdf } = await import("@/utils/programme-pdf");
      const pdf = await telechargerProgrammePdf(programme);
      setDocumentPdf(pdf);
      setNumeroWhatsApp("");
      setErreurPartage(null);
    } catch (error) {
      setErreur(messageErreur(error, "Impossible de générer le PDF du programme."));
    } finally {
      setTelechargementEnCours(false);
    }
  }

  async function ouvrirWhatsAppAvecLien(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!documentPdf) return;

    const numeroNormalise = numeroWhatsApp.replace(/[\s()-]/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(numeroNormalise)) {
      setErreurPartage("Saisissez un numéro au format international, par exemple +2290123456789.");
      return;
    }

    const fenetreWhatsApp = window.open("about:blank", "_blank");
    if (!fenetreWhatsApp) {
      setErreurPartage("Autorisez les fenêtres contextuelles pour ouvrir WhatsApp.");
      return;
    }
    fenetreWhatsApp.opener = null;
    setPartageEnCours(true);
    setErreurPartage(null);

    try {
      const formulaire = new FormData();
      formulaire.set("document", documentPdf.blob, documentPdf.fileName);
      const resultat = await fetchWithAuth<LienPdfResponse>(
        "/api/secretariat/programmes/partage-lien",
        { method: "POST", body: formulaire }
      );
      const message = `Bonjour, voici le programme de la semaine à télécharger : ${resultat.lien}`;
      fenetreWhatsApp.location.href = `https://wa.me/${numeroNormalise.slice(1)}?text=${encodeURIComponent(message)}`;
      setDocumentPdf(null);
      setSucces("WhatsApp s’est ouvert avec le lien du programme. Vérifiez le destinataire puis appuyez sur Envoyer.");
    } catch (error) {
      fenetreWhatsApp.close();
      setErreurPartage(messageErreur(error, "Impossible de préparer le lien de partage."));
    } finally {
      setPartageEnCours(false);
    }
  }

  function fermerPropositionWhatsApp(): void {
    if (partageEnCours) return;
    setDocumentPdf(null);
    setErreurPartage(null);
  }

  function changerDate(event: ChangeEvent<HTMLInputElement>): void {
    modeleChoisiManuellement.current = false;
    setModeleId("");
    setProgramme(null);
    setAssociation(null);
    setModeleParDefaut(false);
    setValeursInitiales({});
    setDateDebut(event.target.value);
    setErreur(null);
    setSucces(null);
  }

  function obtenirValeurAffichee(cle: string): string {
    if (!programme) return "";
    return programme.valeurs[cle] ?? "";
  }

  return (
    <>
    <section className="mx-auto w-full max-w-[1600px] space-y-5">
      <header className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-5 shadow-sm dark:border-darkborder dark:bg-darkgray sm:flex-row sm:items-center sm:p-6">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-lightprimary text-primary">
          <CalendarDays size={24} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bodytext">Secrétariat</p>
          <h1 className="mt-1 text-2xl font-bold text-dark dark:text-white sm:text-3xl">Programme de la semaine</h1>
          <p className="mt-1 text-sm text-bodytext">
            {estAdministrateur
              ? "Associez d’abord un modèle à la semaine, puis renseignez le thème et les lectures."
              : "Choisissez une semaine associée par l’administrateur, puis renseignez vos officiants."}
          </p>
        </div>
      </header>

      {erreur ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-lighterror bg-lighterror p-4 text-sm text-error">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>{erreur}</span>
        </div>
      ) : null}
      {succes ? (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-lightsuccess bg-lightsuccess/60 p-4 text-sm text-success">
          <Check size={17} />
          <span>{succes}</span>
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm dark:border-darkborder dark:bg-darkgray sm:p-5 lg:p-6">
        <div className={`grid gap-4 ${
          estAdministrateur ? "md:grid-cols-2" : "md:grid-cols-[minmax(220px,320px)_minmax(0,1fr)]"
        }`}>
          {estAdministrateur ? (
            <label className="block min-w-0 space-y-1.5 text-sm font-semibold text-dark dark:text-white">
              Modèle à associer
              <select
                value={modeleId}
                onChange={(event) => {
                  modeleChoisiManuellement.current = true;
                  setProgramme(null);
                  setValeursInitiales({});
                  setModeleId(event.target.value);
                }}
                disabled={chargementTemplates || templates.length === 0 || ouvertureEnCours || sauvegardeEnCours}
                className="w-full rounded-xl border border-border bg-white px-3 py-3 text-sm font-normal text-dark outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 dark:border-darkborder dark:bg-darkgray dark:text-white"
              >
                <option value="">Choisir un modèle</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.nom}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block min-w-0 space-y-1.5 text-sm font-semibold text-dark dark:text-white">
            Semaine (choisissez le lundi)
            <span className="relative block">
              <input
                type="date"
                value={dateDebut}
                onChange={changerDate}
                disabled={chargementTemplates || templates.length === 0 || ouvertureEnCours || associationEnCours || sauvegardeEnCours}
                className="w-full rounded-xl border border-border bg-white px-3 py-3 pr-11 text-sm font-normal text-dark outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 dark:border-darkborder dark:bg-darkgray dark:text-white"
              />
              <CalendarDays
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary"
              />
            </span>
          </label>
          {!estAdministrateur && apercuSemaine && !("erreur" in apercuSemaine) ? (
            <div className="flex min-w-0 flex-col justify-center rounded-xl border border-border bg-lightgray/30 px-4 py-3 dark:border-darkborder dark:bg-dark">
              <p className="text-sm font-semibold leading-6 text-dark dark:text-white">{apercuSemaine.libelle}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-bodytext">{apercuSemaine.moisAnnee}</p>
            </div>
          ) : null}
        </div>
        {estAdministrateur && apercuSemaine ? (
          "erreur" in apercuSemaine ? (
            <p role="alert" className="mt-3 text-sm text-error">{apercuSemaine.erreur}</p>
          ) : (
            <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3 dark:border-darkborder sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold text-dark dark:text-white">{apercuSemaine.libelle}</p>
              <p className="text-sm font-medium text-bodytext">{apercuSemaine.moisAnnee}</p>
            </div>
          )
        ) : (
          !dateDebut ? (
            <p className="mt-3 text-sm text-bodytext">
              {estAdministrateur
                ? "Choisissez un modèle et un lundi, puis associez explicitement le modèle à la semaine."
                : "Choisissez un lundi pour ouvrir le programme de la semaine."}
            </p>
          ) : null
        )}
        {!estAdministrateur && modeleParDefaut ? (
          <div role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-lightwarning bg-lightwarning/50 p-3 text-sm text-warning">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <p>
              Aucun modèle n’est associé à cette semaine. Le modèle standard a été chargé par défaut;
              veuillez vérifier qu’il correspond bien au programme prévu.
            </p>
          </div>
        ) : null}
        {estAdministrateur && dateDebut && apercuSemaine && !("erreur" in apercuSemaine) ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 dark:border-darkborder sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-bodytext">
              {association
                ? `Modèle actuellement associé : ${templates.find((template) => template.id === association.typeTemplateId)?.nom ?? "Modèle indisponible"}`
                : "Aucun modèle n’est encore associé à cette semaine."}
            </p>
            {String(association?.typeTemplateId ?? "") !== modeleId ? (
              <button
                type="button"
                onClick={() => void associerModeleASemaine()}
                disabled={!modeleId || associationEnCours || ouvertureEnCours || sauvegardeEnCours}
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {associationEnCours ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}
                {associationEnCours
                  ? "Association…"
                  : association
                    ? "Associer ce modèle à la semaine"
                    : "Associer ce modèle à la semaine"}
              </button>
            ) : null}
          </div>
        ) : null}
        {estAdministrateur && association && String(association.typeTemplateId) !== modeleId ? (
          <p className="mt-2 text-sm text-bodytext">
            Le changement conservera l’ancienne fiche et ses données; le nouveau modèle deviendra celui ouvert par les secrétaires.
          </p>
        ) : null}
      </section>

      {chargementTemplates ? (
        <div className="flex min-h-48 items-center justify-center gap-3 rounded-2xl border border-border bg-white text-sm text-bodytext dark:border-darkborder dark:bg-darkgray">
          <LoaderCircle size={20} className="animate-spin text-primary" />
          Chargement des modèles…
        </div>
      ) : templates.length === 0 ? (
        <div role="alert" className="rounded-2xl border border-lightwarning bg-lightwarning/40 p-5 text-sm text-warning">
          Aucun modèle actif n’a été trouvé. Vérifiez que le seed Supabase des programmes a été exécuté.
        </div>
      ) : ouvertureEnCours ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-white text-sm text-bodytext shadow-sm dark:border-darkborder dark:bg-darkgray">
          <LoaderCircle size={26} className="animate-spin text-primary" />
          Ouverture du programme…
        </div>
      ) : programme ? (
        <article
          ref={formulaireRef}
          className="scroll-mt-24 w-full overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:border-darkborder dark:bg-darkgray"
        >
          <div className="flex flex-col gap-4 border-b border-border p-4 dark:border-darkborder sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-bodytext">
                <FileText size={16} className="shrink-0 text-primary" />
                <span className="truncate">{programme.nomTemplate}</span>
              </div>
              <h2 className="mt-1 text-xl font-bold text-dark dark:text-white sm:text-2xl">
                {formaterLibelleSemaine(programme.dateDebut, programme.dateFin)}
              </h2>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={() => void telechargerPdf()}
                disabled={telechargementEnCours}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-lightprimary disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {telechargementEnCours ? <LoaderCircle size={17} className="animate-spin" /> : <Download size={17} />}
                {telechargementEnCours ? "Préparation du PDF…" : "Télécharger le PDF"}
              </button>
              <button
                type="button"
                onClick={() => void enregistrerProgramme()}
                disabled={!champsModifies || sauvegardeEnCours}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {sauvegardeEnCours ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
                {sauvegardeEnCours ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>

          <div className="space-y-4 p-3 sm:space-y-5 sm:p-5 lg:p-6">
            {programme.structure.sections.map((section) => (
              <section key={section.cle} className="rounded-xl border border-border p-4 sm:p-5 dark:border-darkborder">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 dark:border-darkborder">
                  <h3 className="text-base font-bold text-dark dark:text-white sm:text-lg">{section.libelle}</h3>
                  {section.heure ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-lightprimary px-2.5 py-1 text-xs font-semibold text-primary">
                      <Clock3 size={14} />
                      {section.heure}
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {section.champs.map((champ) => {
                    const editable = champ.modifiablePar === role && !champ.calcule;
                    const valeur = obtenirValeurAffichee(champ.valueKey);
                    const estDejaEnregistre = Boolean(valeursInitiales[champ.valueKey]?.trim())
                      && valeur === valeursInitiales[champ.valueKey];
                    const estTheme = champ.cle === "Theme";
                    const estTexteLong = estTheme
                      || ["Texte_Biblique", "Texte_Biblique_1", "Texte_Biblique_2"].includes(champ.cle);

                    return (
                      <label
                        key={champ.valueKey}
                        className={`block min-w-0 space-y-1.5 text-sm font-medium text-dark dark:text-white ${
                          estTheme ? "sm:col-span-2 xl:col-span-2 2xl:col-span-3" : ""
                        }`}
                      >
                        <span className="flex min-h-5 items-center gap-1.5">
                          <span>{champ.libelle}</span>
                          {!editable ? (
                            <LockKeyhole
                              size={13}
                              className={`shrink-0 ${champ.calcule ? "text-primary" : "text-bodytext"}`}
                              aria-label={champ.calcule ? "Calculé automatiquement" : "Lecture seule"}
                            />
                          ) : null}
                        </span>
                        {editable ? (
                          estTexteLong ? (
                            <textarea
                              rows={2}
                              maxLength={500}
                              value={valeur}
                              onChange={(event) => modifierValeur(champ.valueKey, event.target.value)}
                              placeholder="À renseigner"
                              className={`min-h-20 w-full resize-y rounded-xl border px-3 py-2.5 text-sm font-normal outline-none transition placeholder:italic ${
                                estDejaEnregistre
                                  ? "border-emerald-200 bg-emerald-50/70 text-emerald-950 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50"
                                  : "border-border bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-darkborder dark:bg-darkgray dark:text-white"
                              } ${estTheme ? "text-center" : ""}`}
                            />
                          ) : (
                            <input
                              type="text"
                              maxLength={500}
                              value={valeur}
                              onChange={(event) => modifierValeur(champ.valueKey, event.target.value)}
                              placeholder="Nom de l’officiant"
                              className={`min-h-11 w-full rounded-xl border px-3 py-2.5 text-sm font-normal outline-none transition placeholder:italic ${
                                estDejaEnregistre
                                  ? "border-emerald-200 bg-emerald-50/70 text-emerald-950 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50"
                                  : "border-border bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-darkborder dark:bg-darkgray dark:text-white"
                              }`}
                            />
                          )
                        ) : (
                          <div
                            aria-readonly="true"
                            className={`flex min-h-11 w-full items-center rounded-xl border px-3 py-2.5 text-sm font-medium ${
                              estTheme ? "justify-center text-center" : ""
                            } ${
                              champ.calcule
                                ? "border-primary bg-primary text-white shadow-sm shadow-primary/20"
                                : champ.modifiablePar === "ADMIN" && !estAdministrateur && valeur
                                  ? "border-primary/20 bg-lightprimary text-dark shadow-sm shadow-primary/5 dark:border-primary/30 dark:text-white"
                                  : `border-border dark:border-darkborder ${
                                    valeur
                                      ? "bg-lightgray/50 text-dark dark:bg-dark dark:text-white"
                                      : "bg-lightgray/30 text-bodytext dark:bg-dark"
                                  }`
                            }`}
                          >
                            {valeur || (champ.modifiablePar === "ADMIN" && !estAdministrateur
                              ? "Non renseigné"
                              : "—")}
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
            <p className="flex items-start gap-2 px-1 text-xs text-bodytext">
              <LockKeyhole size={14} className="mt-0.5 shrink-0" />
              Les dates sont calculées automatiquement. Chaque rôle ne peut modifier que ses propres champs.
            </p>
            <div className="flex justify-end border-t border-border pt-4 dark:border-darkborder">
              <button
                type="button"
                onClick={() => void enregistrerProgramme()}
                disabled={!champsModifies || sauvegardeEnCours}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {sauvegardeEnCours ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
                {sauvegardeEnCours ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </article>
      ) : dateDebut && apercuSemaine && "erreur" in apercuSemaine ? null : (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white px-5 text-center dark:border-darkborder dark:bg-darkgray">
          <CalendarDays size={30} className="text-primary" />
          <h2 className="mt-3 font-semibold text-dark dark:text-white">Votre programme s’affichera ici</h2>
          <p className="mt-1 max-w-md text-sm text-bodytext">
            Choisissez une semaine. La fiche correspondante sera chargée automatiquement ou créée si elle n’existe pas encore.
          </p>
        </div>
      )}
    </section>
    {documentPdf ? (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) fermerPropositionWhatsApp();
        }}
      >
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="whatsapp-dialog-title"
          onSubmit={(event) => void ouvrirWhatsAppAvecLien(event)}
          className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-darkgray sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-950/40">
                <MessageCircle size={23} />
              </span>
              <div>
                <h2 id="whatsapp-dialog-title" className="text-lg font-bold text-dark dark:text-white">
                  Partager le programme sur WhatsApp ?
                </h2>
                <p className="mt-1 text-sm text-bodytext">
                  WhatsApp s’ouvrira avec un lien de téléchargement temporaire prérempli.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={fermerPropositionWhatsApp}
              disabled={partageEnCours}
              aria-label="Fermer"
              className="rounded-lg p-2 text-bodytext transition hover:bg-lightgray disabled:opacity-50"
            >
              <X size={19} />
            </button>
          </div>

          <label className="mt-5 block space-y-1.5 text-sm font-semibold text-dark dark:text-white">
            Numéro WhatsApp du destinataire
            <input
              type="tel"
              autoComplete="tel"
              required
              value={numeroWhatsApp}
              onChange={(event) => setNumeroWhatsApp(event.target.value)}
              placeholder="+229 01 23 45 67 89"
              disabled={partageEnCours}
              className="w-full rounded-xl border border-border bg-white px-3 py-3 text-sm font-normal text-dark outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 dark:border-darkborder dark:bg-dark dark:text-white"
            />
            <span className="block text-xs font-normal text-bodytext">
              Le lien de téléchargement reste valable pendant 14 jours.
            </span>
          </label>

          <p className="mt-4 rounded-xl bg-lightgray/50 p-3 text-xs leading-5 text-bodytext dark:bg-dark">
            Cette action ouvre une discussion WhatsApp; elle n’envoie pas le message automatiquement.
            Vérifiez le numéro et appuyez sur Envoyer dans WhatsApp.
          </p>

          {erreurPartage ? (
            <p role="alert" className="mt-4 rounded-xl border border-lighterror bg-lighterror/40 p-3 text-sm text-error">
              {erreurPartage}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={fermerPropositionWhatsApp}
              disabled={partageEnCours}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-dark transition hover:bg-lightgray disabled:cursor-not-allowed disabled:opacity-50 dark:border-darkborder dark:text-white"
            >
              Plus tard
            </button>
            <button
              type="submit"
              disabled={partageEnCours || !numeroWhatsApp.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {partageEnCours ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}
              {partageEnCours ? "Préparation du lien…" : "Ouvrir WhatsApp"}
            </button>
          </div>
        </form>
      </div>
    ) : null}
    </>
  );
}
