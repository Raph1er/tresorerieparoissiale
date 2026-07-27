"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, fetchWithAuth } from "@/lib/api-client";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Hash,
  Pencil,
  Plus,
  Search,
  Trash,
} from "lucide-react";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type FormMode = "create" | "edit";

interface CahierListItem {
  id: number;
  nom: string;
  prefixeCode: string;
  description: string;
  actif: boolean;
  evenementNom: string | null;
  nombreEnregistrements: number;
  totalMontant: number;
}

interface CahierFormState {
  nom: string;
  prefixeCode: string;
  description: string;
  actif: boolean;
}

interface CahierMutationPayload {
  nom?: string;
  prefixeCode?: string;
  description?: string;
  actif?: boolean;
}

interface EnregistrementListItem {
  id: number;
  code: string;
  nomPersonne: string;
  note: string | null;
  montant: number;
  dateHeure: string;
}

interface EnregistrementDeletePreview {
  cahier: CahierListItem;
  enregistrements: EnregistrementListItem[];
}

function formatMontant(montant: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
  }).format(montant);
}

async function fetchAllEnregistrementsCahier(cahierId: number) {
  const allItems: EnregistrementListItem[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const params = new URLSearchParams({
      page: String(page),
      limit: "100",
      orderBy: "dateHeure",
      order: "desc",
    });

    const response = await fetchWithAuth<{
      data: EnregistrementListItem[];
      page: number;
      totalPages: number;
    }>(`/api/paudium/${cahierId}/enregistrements?${params.toString()}`);

    allItems.push(...response.data);
    totalPages = response.totalPages;
    page += 1;
  } while (page <= totalPages);

  return allItems;
}

export default function DashboardPaudiumPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [items, setItems] = useState<CahierListItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [mutationLoading, setMutationLoading] = useState(false);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCahierId, setEditingCahierId] = useState<number | null>(null);
  const [deletePreview, setDeletePreview] = useState<EnregistrementDeletePreview | null>(null);
  const [form, setForm] = useState<CahierFormState>({
    nom: "",
    prefixeCode: "",
    description: "",
    actif: true,
  });

  async function chargerCahiers(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (statusFilter !== "ALL") {
        params.set("actif", String(statusFilter === "ACTIVE"));
      }

      if (searchTerm.trim().length > 0) {
        params.set("search", searchTerm.trim());
      }

      const response = await fetchWithAuth<any>(`/api/paudium?${params.toString()}`);

      setItems(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages || 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    chargerCahiers();
  }, [page, limit, statusFilter, searchTerm]);

  const resume = useMemo(() => {
    const cahiersActifs = items.filter((item) => item.actif).length;
    const totalEnregistrements = items.reduce(
      (acc, item) => acc + item.nombreEnregistrements,
      0
    );
    const totalMontants = items.reduce((acc, item) => acc + item.totalMontant, 0);

    return {
      cahiersActifs,
      totalEnregistrements,
      totalMontants,
    };
  }, [items]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearchTerm(searchInput);
  }

  function handleStatusChange(nextStatus: StatusFilter) {
    setPage(1);
    setStatusFilter(nextStatus);
  }

  function openCreateModal() {
    setFormMode("create");
    setEditingCahierId(null);
    setForm({
      nom: "",
      prefixeCode: "",
      description: "",
      actif: true,
    });
    setError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  }

  function openEditModal(cahier: CahierListItem) {
    setFormMode("edit");
    setEditingCahierId(cahier.id);
    setForm({
      nom: cahier.nom,
      prefixeCode: cahier.prefixeCode,
      description: cahier.description || "",
      actif: cahier.actif,
    });
    setError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  }

  async function handleDelete(cahier: CahierListItem): Promise<void> {
    setError(null);
    setSuccessMessage(null);

    setDeletePreviewLoading(true);

    try {
      const enregistrements = await fetchAllEnregistrementsCahier(cahier.id);
      setDeletePreview({ cahier, enregistrements });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement du contenu du cahier impossible");
    } finally {
      setDeletePreviewLoading(false);
    }
  }

  async function confirmDeleteCahier(): Promise<void> {
    if (!deletePreview) return;

    setMutationLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await fetchWithAuth(`/api/paudium/${deletePreview.cahier.id}`, {
        method: "DELETE",
      });

      const suffix = deletePreview.enregistrements.length > 0
        ? ` et ${deletePreview.enregistrements.length} enregistrement(s)`
        : "";
      setSuccessMessage(`Cahier "${deletePreview.cahier.nom}"${suffix} supprimé(s).`);
      setDeletePreview(null);
      await chargerCahiers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Suppression impossible");
    } finally {
      setMutationLoading(false);
    }
  }

  async function handleSubmitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMutationLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (!form.nom.trim()) {
      setMutationLoading(false);
      setError("Le nom du cahier est requis.");
      return;
    }

    if (!form.prefixeCode.trim()) {
      setMutationLoading(false);
      setError("Le préfixe du code est requis.");
      return;
    }

    try {
      const payload: CahierMutationPayload = {
        nom: form.nom.trim(),
        prefixeCode: form.prefixeCode.trim().toUpperCase(),
        description: form.description.trim() || undefined,
      };

      if (formMode === "create") {
        await fetchWithAuth("/api/paudium", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Cahier créé avec succès.");
      } else {
        if (!editingCahierId) throw new Error("Identifiant manquant");

        payload.actif = form.actif;
        await fetchWithAuth(`/api/paudium/${editingCahierId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Cahier mis à jour avec succès.");
      }

      setIsModalOpen(false);
      await chargerCahiers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible");
    } finally {
      setMutationLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="rounded-bb bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-bodytext font-semibold">
              Gestion des fêtes
            </p>
            <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">
              Paudium
            </h1>
            <p className="mt-2 text-bodytext max-w-2xl">
              Cahiers numériques pour les fêtes de moisson, bazaars et ventes.
              Génération automatique des codes uniques.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-border dark:border-darkborder px-4 py-2 text-sm font-medium text-link dark:text-white"
          >
            <ArrowRight size={16} />
            Retour au dashboard
          </Link>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus size={15} />
            Nouveau cahier
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
          <p className="text-sm text-bodytext">Total cahiers</p>
          <p className="mt-2 text-2xl font-bold text-dark dark:text-white">
            {loading ? "..." : total}
          </p>
        </article>
        <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
          <p className="text-sm text-bodytext">Cahiers actifs</p>
          <p className="mt-2 text-2xl font-bold text-success">
            {loading ? "..." : resume.cahiersActifs}
          </p>
        </article>
        <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
          <p className="text-sm text-bodytext">Total enregistrements</p>
          <p className="mt-2 text-2xl font-bold text-primary">
            {loading ? "..." : resume.totalEnregistrements}
          </p>
        </article>
        <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
          <p className="text-sm text-bodytext">Total collecté</p>
          <p className="mt-2 text-2xl font-bold text-warning">
            {loading ? "..." : formatMontant(resume.totalMontants)}
          </p>
        </article>
      </div>

      <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[260px]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-bodytext" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Rechercher par nom ou description"
                className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent py-2.5 pl-9 pr-3 text-sm text-dark dark:text-white"
              />
            </div>
          </form>

          <div className="inline-flex rounded-xl border border-border dark:border-darkborder overflow-hidden">
            {([
              { value: "ALL", label: "Tout statut" },
              { value: "ACTIVE", label: "Actifs" },
              { value: "INACTIVE", label: "Inactifs" },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleStatusChange(option.value)}
                className={`px-3 py-2 text-sm font-medium ${statusFilter === option.value
                    ? "bg-dark text-white dark:bg-primary"
                    : "bg-transparent text-link dark:text-white"
                  }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus size={15} />
            Nouveau cahier
          </button>
        </div>

        {error ? (
          <div className="rounded-xl bg-lighterror border border-lighterror p-4 text-error text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-xl border border-lightsuccess bg-lightsuccess/60 p-4 text-success text-sm">
            {successMessage}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-bodytext border-b border-border dark:border-darkborder">
                <th className="py-3 pr-3 font-semibold">Cahier</th>
                <th className="py-3 px-3 font-semibold">Préfixe</th>
                <th className="py-3 px-3 font-semibold">Événement</th>
                <th className="py-3 px-3 font-semibold">Enregistrements</th>
                <th className="py-3 px-3 font-semibold">Total</th>
                <th className="py-3 px-3 text-right font-semibold">Statut</th>
                <th className="py-3 pl-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-bodytext">
                    Chargement des cahiers...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-bodytext">
                    Aucun cahier trouvé.
                  </td>
                </tr>
              ) : (
                items.map((cahier) => (
                  <tr
                    key={cahier.id}
                    className="border-b border-border/60 dark:border-darkborder/60 hover:bg-lightgray/50"
                  >
                    <td className="py-3 pr-3 align-top">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-lightprimary text-primary">
                          <BookOpen size={16} />
                        </span>
                        <div>
                          <Link
                            href={`/dashboard/paudium/${cahier.id}`}
                            className="font-semibold text-dark dark:text-white hover:text-primary"
                          >
                            {cahier.nom}
                          </Link>
                          <p className="mt-1 max-w-[280px] text-bodytext line-clamp-2">
                            {cahier.description || "Aucune description"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-lightprimary px-2 py-1 text-xs font-semibold text-primary">
                        <Hash size={12} />
                        {cahier.prefixeCode}
                      </span>
                    </td>
                    <td className="py-3 px-3 align-top text-bodytext">
                      {cahier.evenementNom || "—"}
                    </td>
                    <td className="py-3 px-3 align-top">
                      <p className="font-semibold text-dark dark:text-white">
                        {cahier.nombreEnregistrements}
                      </p>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <p className="font-semibold text-success">
                        {formatMontant(cahier.totalMontant)}
                      </p>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="flex justify-end">
                        <span
                          className={`inline-flex rounded-lg px-2 py-1 text-xs font-semibold ${cahier.actif
                              ? "bg-lightsuccess text-success"
                              : "bg-lightwarning text-warning"
                            }`}
                        >
                          {cahier.actif ? "Actif" : "Inactif"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pl-3 align-top">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/dashboard/paudium/${cahier.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-border dark:border-darkborder px-2.5 py-1.5 text-xs font-medium text-link dark:text-white"
                        >
                          Ouvrir
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEditModal(cahier)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border dark:border-darkborder px-2.5 py-1.5 text-xs font-medium text-link dark:text-white"
                        >
                          <Pencil size={13} />
                          Modifier
                        </button>
                        <button
                          type="button"
                          disabled={mutationLoading || deletePreviewLoading}
                          onClick={() => handleDelete(cahier)}
                          className="inline-flex items-center gap-1 rounded-lg border border-lighterror px-2.5 py-1.5 text-xs font-medium text-error disabled:opacity-50"
                        >
                          <Trash size={13} />
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="flex items-center justify-between gap-3 pt-2">
          <p className="text-sm text-bodytext">
            {loading ? "Chargement..." : `Page ${page} sur ${Math.max(1, totalPages)}`}
          </p>
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-border dark:border-darkborder px-3 py-2 text-sm text-link dark:text-white disabled:opacity-50"
            >
              <ChevronLeft size={15} />
              Précédent
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-border dark:border-darkborder px-3 py-2 text-sm text-link dark:text-white disabled:opacity-50"
            >
              Suivant
              <ChevronRight size={15} />
            </button>
          </div>
        </footer>
      </article>

      {isModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-darkgray border border-border dark:border-darkborder shadow-xl">
            <div className="border-b border-border dark:border-darkborder px-5 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark dark:text-white">
                {formMode === "create" ? "Créer un cahier" : "Modifier le cahier"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-sm text-bodytext hover:text-dark dark:hover:text-white"
              >
                Fermer
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-bodytext space-y-1">
                  <span>Nom du cahier</span>
                  <input
                    value={form.nom}
                    onChange={(event) => setForm((current) => ({ ...current, nom: event.target.value }))}
                    required
                    placeholder="Ex: Cahier des Ventes"
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  />
                </label>

                <label className="text-sm text-bodytext space-y-1">
                  <span>Préfixe du code</span>
                  <input
                    value={form.prefixeCode}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, prefixeCode: event.target.value.toUpperCase() }))
                    }
                    required
                    placeholder="Ex: VNT"
                    maxLength={10}
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  />
                  <p className="text-xs text-bodytext mt-1">
                    Générera des codes comme {form.prefixeCode || "VNT"}-0001
                  </p>
                </label>
              </div>

              <label className="text-sm text-bodytext space-y-1 block">
                <span>Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  placeholder="Description optionnelle du cahier"
                  className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                />
              </label>

              {formMode === "edit" && (
                <label className="text-sm text-bodytext space-y-2">
                  <span>Statut</span>
                  <span className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      checked={form.actif}
                      onChange={(event) => setForm((current) => ({ ...current, actif: event.target.checked }))}
                    />
                    <span>Cahier actif</span>
                  </span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-border dark:border-darkborder px-4 py-2 text-sm text-link dark:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={mutationLoading}
                  className="rounded-xl bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {mutationLoading ? "Enregistrement..." : formMode === "create" ? "Créer" : "Mettre à jour"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deletePreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-darkgray border border-lighterror shadow-xl">
            <div className="border-b border-border dark:border-darkborder px-5 py-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-error font-semibold">
                  Suppression définitive
                </p>
                <h2 className="mt-1 text-lg font-semibold text-dark dark:text-white">
                  {deletePreview.cahier.nom}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDeletePreview(null)}
                className="text-sm text-bodytext hover:text-dark dark:hover:text-white"
              >
                Annuler
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-lighterror bg-lighterror/40 p-4 text-sm text-error space-y-2">
                <p className="font-semibold">
                  Cette action supprimera le cahier et tous ses enregistrements de la base de données.
                </p>
                <p>
                  Enregistrements trouvés : <strong>{deletePreview.enregistrements.length}</strong>
                </p>
              </div>

              {deletePreview.enregistrements.length > 0 ? (
                <div className="rounded-xl border border-border dark:border-darkborder">
                  <div className="max-h-80 overflow-y-auto divide-y divide-border dark:divide-darkborder">
                    {deletePreview.enregistrements.map((enreg) => (
                      <div key={enreg.id} className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-dark dark:text-white">{enreg.code}</p>
                            <p className="text-bodytext">
                              {enreg.nomPersonne}{enreg.note ? ` - ${enreg.note}` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-success">{formatMontant(enreg.montant)}</p>
                            <p className="text-xs text-bodytext">
                              {new Date(enreg.dateHeure).toLocaleString("fr-FR")}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border dark:border-darkborder bg-lightgray/40 p-4 text-sm text-bodytext">
                  Aucun enregistrement n’est rattaché à ce cahier.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletePreview(null)}
                  className="rounded-xl border border-border dark:border-darkborder px-4 py-2 text-sm text-link dark:text-white"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={mutationLoading}
                  onClick={confirmDeleteCahier}
                  className="rounded-xl bg-error px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {mutationLoading ? "Suppression..." : "Oui, supprimer définitivement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}