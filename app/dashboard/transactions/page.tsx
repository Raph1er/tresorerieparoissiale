"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, fetchWithAuth } from "@/lib/api-client";
import { getAuthUser } from "@/lib/client-auth";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Filter,
  Pencil,
  Plus,
  Search,
  Trash,
} from "lucide-react";

type TxType = "ENTREE" | "SORTIE";
type TxTypeFilter = "ALL" | TxType;

interface TransactionApiItem {
  id: number;
  type: TxType;
  montant: number;
  description: string | null;
  dateOperation: string;
  modePaiement: string | null;
  categorie: {
    id: number;
    nom: string;
    type: TxType;
  };
  utilisateur: {
    id: number;
    nom: string;
    email: string;
  };
  evenement: {
    id: number;
    nom: string;
  } | null;
}

interface TransactionsResponse {
  data: TransactionApiItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface TransactionListItem {
  id: number;
  type: TxType;
  montant: number;
  description: string;
  dateOperation: string;
  modePaiement: string;
  categorieId: number;
  categorieNom: string;
  utilisateurNom: string;
  evenementId: number | null;
  evenementNom: string;
}

interface CategoryOption {
  id: number;
  nom: string;
  type: TxType;
}

interface EventOption {
  id: number;
  nom: string;
}

interface TransactionFormState {
  type: TxType;
  montant: string;
  description: string;
  dateOperation: string;
  modePaiement: string;
  categorieId: string;
  evenementId: string;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toDateTimeLocalInputValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}:${s}`;
}

function getNowDateTimeInputValue(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}:${s}`;
}

export default function DashboardTransactionsPage() {
  const now = getNowDateTimeInputValue();
  const currentUser = getAuthUser();
  const canMutate =
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "RESPONSABLE" ||
    currentUser?.role === "TRESORIER";
  const canDelete = currentUser?.role === "ADMIN" || currentUser?.role === "TRESORIER";

  const [loading, setLoading] = useState(true);
  const [mutationLoading, setMutationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [items, setItems] = useState<TransactionListItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState<TxTypeFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [form, setForm] = useState<TransactionFormState>({
    type: "ENTREE",
    montant: "",
    description: "",
    dateOperation: now,
    modePaiement: "",
    categorieId: "",
    evenementId: "",
  });

  async function chargerTransactions(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (typeFilter !== "ALL") {
        params.set("type", typeFilter);
      }

      if (searchTerm.trim().length > 0) {
        params.set("search", searchTerm.trim());
      }

      const response = await fetchWithAuth<TransactionsResponse>(`/api/transactions?${params.toString()}`);

      const normalisees: TransactionListItem[] = response.data.map((tx) => ({
        id: tx.id,
        type: tx.type,
        montant: tx.montant,
        description: tx.description || "Sans description",
        dateOperation: tx.dateOperation,
        modePaiement: tx.modePaiement || "Non précisé",
        categorieId: tx.categorie?.id,
        categorieNom: tx.categorie?.nom || "Sans catégorie",
        utilisateurNom: tx.utilisateur?.nom || "Inconnu",
        evenementId: tx.evenement?.id || null,
        evenementNom: tx.evenement?.nom || "-",
      }));

      setItems(normalisees);
      setTotal(response.pagination.total);
      setTotalPages(response.pagination.totalPages || 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    chargerTransactions();
  }, [page, limit, typeFilter, searchTerm]);

  useEffect(() => {
    fetchWithAuth<{ data: Array<{ id: number; nom: string; type: TxType; actif: boolean }> }>(
      "/api/categories?page=1&limit=100&actif=true&orderBy=nom&order=asc"
    )
      .then((response) => {
        setCategories(
          response.data
            .filter((item) => item.actif)
            .map((item) => ({ id: item.id, nom: item.nom, type: item.type }))
        );
      })
      .catch(() => setCategories([]));

    fetchWithAuth<{ data: Array<{ id: number; nom: string; actif: boolean }> }>(
      "/api/evenements?page=1&limit=100&actif=true&orderBy=nom&order=asc"
    )
      .then((response) => {
        setEvents(response.data.filter((item) => item.actif).map((item) => ({ id: item.id, nom: item.nom })));
      })
      .catch(() => setEvents([]));
  }, []);

  const resume = useMemo(() => {
    const totalEntrees = items
      .filter((tx) => tx.type === "ENTREE")
      .reduce((acc, tx) => acc + tx.montant, 0);

    const totalSorties = items
      .filter((tx) => tx.type === "SORTIE")
      .reduce((acc, tx) => acc + tx.montant, 0);

    return {
      totalEntrees,
      totalSorties,
    };
  }, [items]);

  const categoriesByType = useMemo(
    () => categories.filter((category) => category.type === form.type),
    [categories, form.type]
  );

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearchTerm(searchInput);
  }

  function handleTypeChange(nextType: TxTypeFilter) {
    setPage(1);
    setTypeFilter(nextType);
  }

  function openCreateModal() {
    setEditingTransactionId(null);
    setForm({
      type: "ENTREE",
      montant: "",
      description: "",
      dateOperation: now,
      modePaiement: "",
      categorieId: "",
      evenementId: "",
    });
    setError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  }

  function openEditModal(item: TransactionListItem) {
    setEditingTransactionId(item.id);
    setForm({
      type: item.type,
      montant: String(item.montant),
      description: item.description === "Sans description" ? "" : item.description,
      dateOperation: toDateTimeLocalInputValue(item.dateOperation),
      modePaiement: item.modePaiement === "Non précisé" ? "" : item.modePaiement,
      categorieId: String(item.categorieId),
      evenementId: item.evenementId ? String(item.evenementId) : "",
    });
    setError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  }

  async function handleSubmitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMutationLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload: {
        type: TxType;
        montant: number;
        description?: string;
        dateOperation: string;
        modePaiement?: string;
        categorieId: number;
        evenementId?: number | null;
      } = {
        type: form.type,
        montant: Number(form.montant),
        dateOperation: form.dateOperation,
        categorieId: Number(form.categorieId),
      };

      if (form.description.trim()) {
        payload.description = form.description.trim();
      }

      if (form.modePaiement.trim()) {
        payload.modePaiement = form.modePaiement.trim();
      }

      if (form.evenementId.trim()) {
        payload.evenementId = Number(form.evenementId);
      } else if (editingTransactionId) {
        payload.evenementId = null;
      }

      if (editingTransactionId) {
        await fetchWithAuth(`/api/transactions/${editingTransactionId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Transaction mise à jour avec succès.");
      } else {
        await fetchWithAuth("/api/transactions", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Transaction créée avec succès.");
      }

      setIsModalOpen(false);
      await chargerTransactions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible");
    } finally {
      setMutationLoading(false);
    }
  }

  async function handleDelete(item: TransactionListItem): Promise<void> {
    if (!canDelete) {
      setError("Suppression autorisée seulement pour ADMIN et TRESORIER.");
      return;
    }

    if (!window.confirm(`Supprimer la transaction #${item.id} ?`)) {
      return;
    }

    setMutationLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await fetchWithAuth(`/api/transactions/${item.id}`, { method: "DELETE" });
      setSuccessMessage(`Transaction #${item.id} supprimée.`);
      await chargerTransactions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Suppression impossible");
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
              Module financier
            </p>
            <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">
              Transactions
            </h1>
            <p className="mt-2 text-bodytext">
              Contrôle des entrées, sorties et justificatifs avec pagination.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-border dark:border-darkborder px-4 py-2 text-sm font-medium text-link dark:text-white"
          >
            <CreditCard size={16} />
            Retour au dashboard
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
          <p className="text-sm text-bodytext">Total éléments</p>
          <p className="mt-2 text-2xl font-bold text-dark dark:text-white">{loading ? "..." : total}</p>
        </article>
        <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
          <p className="text-sm text-bodytext">Entrées (page courante)</p>
          <p className="mt-2 text-2xl font-bold text-success">{loading ? "..." : formatMoney(resume.totalEntrees)}</p>
        </article>
        <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
          <p className="text-sm text-bodytext">Sorties (page courante)</p>
          <p className="mt-2 text-2xl font-bold text-error">{loading ? "..." : formatMoney(resume.totalSorties)}</p>
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
                placeholder="Rechercher dans la description"
                className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent py-2.5 pl-9 pr-3 text-sm text-dark dark:text-white"
              />
            </div>
          </form>

          <div className="inline-flex rounded-xl border border-border dark:border-darkborder overflow-hidden">
            {([
              { value: "ALL", label: "Tous" },
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
                <span className="inline-flex items-center gap-1">
                  <Filter size={14} />
                  {option.label}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            disabled={!canMutate}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Plus size={15} />
            Nouvelle transaction
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
                <th className="py-3 pr-3 font-semibold">Type</th>
                <th className="py-3 px-3 font-semibold">Description</th>
                <th className="py-3 px-3 font-semibold">Catégorie</th>
                <th className="py-3 px-3 font-semibold">Utilisateur</th>
                <th className="py-3 px-3 font-semibold">Date</th>
                <th className="py-3 px-3 font-semibold">Évènement</th>
                <th className="py-3 px-3 text-right font-semibold">Montant</th>
                <th className="py-3 pl-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-bodytext">
                    Chargement des transactions...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-bodytext">
                    Aucune transaction trouvée.
                  </td>
                </tr>
              ) : (
                items.map((tx) => (
                  <tr key={tx.id} className="border-b border-border/60 dark:border-darkborder/60 hover:bg-lightgray/50">
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${
                          tx.type === "ENTREE"
                            ? "bg-lightsuccess text-success"
                            : "bg-lighterror text-error"
                        }`}
                      >
                        {tx.type === "ENTREE" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-dark dark:text-white max-w-[240px] truncate" title={tx.description}>
                      {tx.description}
                    </td>
                    <td className="py-3 px-3 text-dark dark:text-white">{tx.categorieNom}</td>
                    <td className="py-3 px-3 text-bodytext">{tx.utilisateurNom}</td>
                    <td className="py-3 px-3 text-bodytext">{formatDate(tx.dateOperation)}</td>
                    <td className="py-3 px-3 text-bodytext">{tx.evenementNom}</td>
                    <td className={`py-3 px-3 text-right font-semibold ${tx.type === "ENTREE" ? "text-success" : "text-error"}`}>
                      {tx.type === "ENTREE" ? "+" : "-"} {formatMoney(tx.montant)}
                    </td>
                    <td className="py-3 pl-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={!canMutate}
                          onClick={() => openEditModal(tx)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border dark:border-darkborder px-2.5 py-1.5 text-xs font-medium text-link dark:text-white disabled:opacity-50"
                        >
                          <Pencil size={13} />
                          Modifier
                        </button>
                        {/* <button
                          type="button"
                          disabled={!canDelete || mutationLoading}
                          onClick={() => handleDelete(tx)}
                          className="inline-flex items-center gap-1 rounded-lg border border-lighterror px-2.5 py-1.5 text-xs font-medium text-error disabled:opacity-50"
                        >
                          <Trash size={13} />
                          Supprimer
                        </button> */}
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
                {editingTransactionId ? "Modifier la transaction" : "Créer une transaction"}
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-sm text-bodytext">Fermer</button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-bodytext space-y-1 block">
                  <span>Type</span>
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, type: event.target.value as TxType, categorieId: "" }))
                    }
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  >
                    <option value="ENTREE">ENTREE</option>
                    <option value="SORTIE">SORTIE</option>
                  </select>
                </label>

                <label className="text-sm text-bodytext space-y-1 block">
                  <span>Montant</span>
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    required
                    value={form.montant}
                    onChange={(event) => setForm((current) => ({ ...current, montant: event.target.value }))}
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-bodytext space-y-1 block">
                  <span>Date opération</span>
                  <input
                    type="datetime-local"
                    step={1}
                    required
                    value={form.dateOperation}
                    onChange={(event) => setForm((current) => ({ ...current, dateOperation: event.target.value }))}
                    max={now}
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  />
                </label>

                <label className="text-sm text-bodytext space-y-1 block">
                  <span>Catégorie</span>
                  <select
                    required
                    value={form.categorieId}
                    onChange={(event) => setForm((current) => ({ ...current, categorieId: event.target.value }))}
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  >
                    <option value="">Sélectionner</option>
                    {categoriesByType.map((item) => (
                      <option key={item.id} value={item.id}>{item.nom}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-bodytext space-y-1 block">
                  <span>Mode de paiement (optionnel)</span>
                  <input
                    value={form.modePaiement}
                    onChange={(event) => setForm((current) => ({ ...current, modePaiement: event.target.value }))}
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  />
                </label>

                <label className="text-sm text-bodytext space-y-1 block">
                  <span>Évènement (optionnel)</span>
                  <select
                    value={form.evenementId}
                    onChange={(event) => setForm((current) => ({ ...current, evenementId: event.target.value }))}
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  >
                    <option value="">Aucun</option>
                    {events.map((item) => (
                      <option key={item.id} value={item.id}>{item.nom}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="text-sm text-bodytext space-y-1 block">
                <span>Description (optionnel)</span>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl border border-border px-4 py-2 text-sm text-link dark:text-white">Annuler</button>
                <button type="submit" disabled={mutationLoading} className="rounded-xl bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">
                  {mutationLoading ? "Enregistrement..." : editingTransactionId ? "Mettre à jour" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
