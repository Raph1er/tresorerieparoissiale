"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, fetchWithAuth } from "@/lib/api-client";
import { getAuthUser } from "@/lib/client-auth";
import type {
  CategorieResponseDTO,
  PaginatedCategorieResponse,
} from "@/types/categorie";
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Layers3,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash,
} from "lucide-react";

type TypeFilter = "ALL" | "ENTREE" | "SORTIE";
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type FormMode = "create" | "edit";

interface CategoryListItem {
  id: number;
  nom: string;
  type: "ENTREE" | "SORTIE";
  description: string;
  estSysteme: boolean;
  actif: boolean;
  parentNom: string;
  creeLe: string;
  sousCategorieCount: number;
  transactionCount: number;
}

interface CategoryFormState {
  nom: string;
  type: "ENTREE" | "SORTIE";
  description: string;
  parentId: string;
  actif: boolean;
  estSysteme: boolean;
}

interface CategoryMutationPayload {
  nom?: string;
  type?: "ENTREE" | "SORTIE";
  description?: string;
  parentId?: number | null;
  actif?: boolean;
  estSysteme?: boolean;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeCategorie(item: CategorieResponseDTO): CategoryListItem {
  return {
    id: item.id,
    nom: item.nom,
    type: item.type,
    description: item.description?.trim() || "Aucune description",
    estSysteme: item.estSysteme,
    actif: item.actif,
    parentNom: item.parent?.nom || "Catégorie racine",
    creeLe: String(item.creeLe),
    sousCategorieCount: item.sousCategorieCount,
    transactionCount: item.transactionCount,
  };
}

export default function DashboardCategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [items, setItems] = useState<CategoryListItem[]>([]);
  const [allCategories, setAllCategories] = useState<CategorieResponseDTO[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [mutationLoading, setMutationLoading] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [form, setForm] = useState<CategoryFormState>({
    nom: "",
    type: "ENTREE",
    description: "",
    parentId: "",
    actif: true,
    estSysteme: false,
  });

  const currentUser = getAuthUser();
  const isAdmin = currentUser?.role === "ADMIN";

  async function chargerCategories(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      // Les query params reflètent exactement les filtres validés par l'API.
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (typeFilter !== "ALL") {
        params.set("type", typeFilter);
      }

      if (statusFilter !== "ALL") {
        params.set("actif", String(statusFilter === "ACTIVE"));
      }

      if (searchTerm.trim().length > 0) {
        params.set("search", searchTerm.trim());
      }

      const response = await fetchWithAuth<PaginatedCategorieResponse>(
        `/api/categories?${params.toString()}`
      );

      setItems(response.data.map(normalizeCategorie));
      setTotal(response.total);
      setTotalPages(response.totalPages || 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    chargerCategories();
  }, [page, limit, typeFilter, statusFilter, searchTerm]);

  useEffect(() => {
    chargerParents();
  }, []);

  const resume = useMemo(() => {
    const categoriesActives = items.filter((item) => item.actif).length;
    const categoriesSysteme = items.filter((item) => item.estSysteme).length;
    const totalSousCategories = items.reduce(
      (acc, item) => acc + item.sousCategorieCount,
      0
    );

    return {
      categoriesActives,
      categoriesSysteme,
      totalSousCategories,
    };
  }, [items]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearchTerm(searchInput);
  }

  function handleTypeChange(nextType: TypeFilter) {
    setPage(1);
    setTypeFilter(nextType);
  }

  function handleStatusChange(nextStatus: StatusFilter) {
    setPage(1);
    setStatusFilter(nextStatus);
  }

  async function chargerParents(): Promise<void> {
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "100",
        orderBy: "nom",
        order: "asc",
      });

      const response = await fetchWithAuth<PaginatedCategorieResponse>(
        `/api/categories?${params.toString()}`
      );

      setAllCategories(response.data);
    } catch {
      // L'écran principal reste utilisable même si la liste de parents échoue.
    }
  }

  function openCreateModal() {
    setFormMode("create");
    setEditingCategoryId(null);
    setForm({
      nom: "",
      type: "ENTREE",
      description: "",
      parentId: "",
      actif: true,
      estSysteme: false,
    });
    setError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  }

  function openEditModal(category: CategoryListItem) {
    setFormMode("edit");
    setEditingCategoryId(category.id);

    const source = allCategories.find((item) => item.id === category.id);

    setForm({
      nom: category.nom,
      type: category.type,
      description: source?.description ?? category.description,
      parentId: source?.parentId ? String(source.parentId) : "",
      actif: category.actif,
      estSysteme: category.estSysteme,
    });

    setError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  }

  async function handleDelete(category: CategoryListItem): Promise<void> {
    if (!isAdmin) {
      setError("Seul un ADMIN peut supprimer une catégorie.");
      return;
    }

    const confirmed = window.confirm(
      `Confirmer la suppression de la catégorie \"${category.nom}\" ?`
    );
    if (!confirmed) {
      return;
    }

    setMutationLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await fetchWithAuth(`/api/categories/${category.id}`, {
        method: "DELETE",
      });

      setSuccessMessage(`Catégorie \"${category.nom}\" supprimée.`);
      await Promise.all([chargerCategories(), chargerParents()]);
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

    const basePayload: CategoryMutationPayload = {
      nom: form.nom.trim(),
      type: form.type,
      description: form.description.trim() || undefined,
    };

    if (!basePayload.nom) {
      setMutationLoading(false);
      setError("Le nom de la catégorie est requis.");
      return;
    }

    try {
      if (formMode === "create") {
        const payload: CategoryMutationPayload = {
          ...basePayload,
          estSysteme: form.estSysteme,
        };

        if (form.parentId.trim()) {
          payload.parentId = Number(form.parentId);
        }

        await fetchWithAuth("/api/categories", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setSuccessMessage("Catégorie créée avec succès.");
      } else {
        if (!editingCategoryId) {
          throw new Error("Identifiant de catégorie manquant");
        }

        const payload: CategoryMutationPayload = {
          ...basePayload,
          actif: form.actif,
          parentId: form.parentId.trim() ? Number(form.parentId) : null,
        };

        await fetchWithAuth(`/api/categories/${editingCategoryId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        setSuccessMessage("Catégorie mise à jour avec succès.");
      }

      setIsModalOpen(false);
      await Promise.all([chargerCategories(), chargerParents()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible");
    } finally {
      setMutationLoading(false);
    }
  }

  const parentOptions = useMemo(() => {
    return allCategories
      .filter((item) => item.type === form.type)
      .filter((item) => item.id !== editingCategoryId)
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [allCategories, form.type, editingCategoryId]);

  return (
    <section className="space-y-6">
      <header className="rounded-bb bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-bodytext font-semibold">
              Paramétrage financier
            </p>
            <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">
              Catégories
            </h1>
            <p className="mt-2 text-bodytext max-w-2xl">
              Structure des entrées et sorties, hiérarchie parent-enfant et suivi
              des catégories système.
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
           
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
          <p className="text-sm text-bodytext">Total catégories</p>
          <p className="mt-2 text-2xl font-bold text-dark dark:text-white">{loading ? "..." : total}</p>
        </article>
        <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
          <p className="text-sm text-bodytext">Actives sur cette page</p>
          <p className="mt-2 text-2xl font-bold text-success">{loading ? "..." : resume.categoriesActives}</p>
        </article>
        <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
          <p className="text-sm text-bodytext">Système sur cette page</p>
          <p className="mt-2 text-2xl font-bold text-primary">{loading ? "..." : resume.categoriesSysteme}</p>
        </article>
        <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
          <p className="text-sm text-bodytext">Sous-catégories visibles</p>
          <p className="mt-2 text-2xl font-bold text-warning">{loading ? "..." : resume.totalSousCategories}</p>
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
              { value: "ALL", label: "Toutes" },
              { value: "ENTREE", label: "Entrées" },
              { value: "SORTIE", label: "Sorties" },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleTypeChange(option.value)}
                className={`px-3 py-2 text-sm font-medium ${
                  typeFilter === option.value
                    ? "bg-primary text-white"
                    : "bg-transparent text-link dark:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-xl border border-border dark:border-darkborder overflow-hidden">
            {([
              { value: "ALL", label: "Tout statut" },
              { value: "ACTIVE", label: "Actives" },
              { value: "INACTIVE", label: "Inactives" },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleStatusChange(option.value)}
                className={`px-3 py-2 text-sm font-medium ${
                  statusFilter === option.value
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
            Nouvelle catégorie
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
                <th className="py-3 pr-3 font-semibold">Catégorie</th>
                <th className="py-3 px-3 font-semibold">Type</th>
                <th className="py-3 px-3 font-semibold">Parent</th>
                <th className="py-3 px-3 font-semibold">Structure</th>
                <th className="py-3 px-3 font-semibold">Création</th>
                <th className="py-3 px-3 text-right font-semibold">Statut</th>
                <th className="py-3 pl-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-bodytext">
                    Chargement des catégories...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-bodytext">
                    Aucune catégorie trouvée.
                  </td>
                </tr>
              ) : (
                items.map((categorie) => (
                  <tr
                    key={categorie.id}
                    className="border-b border-border/60 dark:border-darkborder/60 hover:bg-lightgray/50"
                  >
                    <td className="py-3 pr-3 align-top">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-lightprimary text-primary">
                          <FolderKanban size={16} />
                        </span>
                        <div>
                          <p className="font-semibold text-dark dark:text-white">
                            {categorie.nom}
                          </p>
                          <p className="mt-1 max-w-[280px] text-bodytext line-clamp-2">
                            {categorie.description}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <span
                        className={`inline-flex rounded-lg px-2 py-1 text-xs font-semibold ${
                          categorie.type === "ENTREE"
                            ? "bg-lightsuccess text-success"
                            : "bg-lighterror text-error"
                        }`}
                      >
                        {categorie.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 align-top text-bodytext">
                      {categorie.parentNom}
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="space-y-2">
                        <p className="inline-flex items-center gap-2 text-bodytext">
                          <Layers3 size={14} />
                          {categorie.sousCategorieCount} sous-catégorie(s)
                        </p>
                        <p className="inline-flex items-center gap-2 text-bodytext">
                          <ShieldCheck size={14} />
                          {categorie.transactionCount} transaction(s)
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top text-bodytext">
                      {formatDate(categorie.creeLe)}
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`inline-flex rounded-lg px-2 py-1 text-xs font-semibold ${
                            categorie.actif
                              ? "bg-lightsuccess text-success"
                              : "bg-lightwarning text-warning"
                          }`}
                        >
                          {categorie.actif ? "Active" : "Inactive"}
                        </span>
                        {categorie.estSysteme ? (
                          <span className="inline-flex rounded-lg bg-lightprimary px-2 py-1 text-xs font-semibold text-primary">
                            Système
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 pl-3 align-top">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(categorie)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border dark:border-darkborder px-2.5 py-1.5 text-xs font-medium text-link dark:text-white"
                        >
                          <Pencil size={13} />
                          Modifier
                        </button>
                        <button
                          type="button"
                          disabled={!isAdmin || mutationLoading}
                          onClick={() => handleDelete(categorie)}
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
          <p className="text-sm text-bodytext">{loading ? "Chargement..." : `Page ${page} sur ${Math.max(1, totalPages)}`}</p>
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
                {formMode === "create" ? "Créer une catégorie" : "Modifier la catégorie"}
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
                  <span>Nom</span>
                  <input
                    value={form.nom}
                    onChange={(event) => setForm((current) => ({ ...current, nom: event.target.value }))}
                    required
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  />
                </label>

                <label className="text-sm text-bodytext space-y-1">
                  <span>Type</span>
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        type: event.target.value as "ENTREE" | "SORTIE",
                        parentId: "",
                      }))
                    }
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  >
                    <option value="ENTREE">ENTREE</option>
                    <option value="SORTIE">SORTIE</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-bodytext space-y-1">
                  <span>Catégorie parent</span>
                  <select
                    value={form.parentId}
                    onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))}
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  >
                    <option value="">Aucune (racine)</option>
                    {parentOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.nom}
                      </option>
                    ))}
                  </select>
                </label>

                {formMode === "create" ? (
                  <label className="text-sm text-bodytext space-y-2">
                    {/* <span>Type de catégorie</span> */}
                    {/* <span className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        checked={form.estSysteme}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, estSysteme: event.target.checked }))
                        }
                      />
                      <span>Catégorie système</span>
                    </span> */}
                  </label>
                ) : (
                  <label className="text-sm text-bodytext space-y-2">
                    <span>Statut</span>
                    <span className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        checked={form.actif}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, actif: event.target.checked }))
                        }
                      />
                      <span>Catégorie active</span>
                    </span>
                  </label>
                )}
              </div>

              <label className="text-sm text-bodytext space-y-1 block">
                <span>Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                />
              </label>

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
                  {mutationLoading
                    ? "Enregistrement..."
                    : formMode === "create"
                      ? "Créer"
                      : "Mettre à jour"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
