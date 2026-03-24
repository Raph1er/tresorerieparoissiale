"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Coins,
  Eye,
  Landmark,
  Pencil,
  Plus,
  Scale,
  Trash,
  Wallet,
  X,
} from "lucide-react";

interface AuthUser {
  id: number;
  nom: string;
  email: string;
  role: string;
}

interface RepartitionDimeResponseDTO {
  id: number;
  transactionId: number;
  totalDime: number;
  partParoisseMere: number;
  partCaisseLocale: number;
  partResponsable: number;
  partLevites: number;
  creeLe: Date | string;
  transactionEntree: {
    id: number;
    montant: number;
    description: string | null;
    dateOperation: Date | string;
  };
  transactionsGeneres: {
    paroisseMere: { id: number; montant: number };
    responsable: { id: number; montant: number };
    levites: { id: number; montant: number };
  };
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) {
      return null;
    }

    const decoded = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getAuthTokenLocal(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("auth_token");
}

function getAuthUserLocal(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem("auth_user");
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function isTokenExpiredLocal(token: string): boolean {
  const payload = decodePayload(token);
  const exp = payload?.exp;

  if (typeof exp !== "number") {
    return true;
  }

  return Date.now() >= exp * 1000;
}

function clearSessionLocal(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
}

async function fetchWithAuth<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthTokenLocal();

  if (!token || isTokenExpiredLocal(token)) {
    clearSessionLocal();
    throw new ApiError("Session expiree. Merci de vous reconnecter.", 401);
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => ({} as { erreur?: string }));

  if (!response.ok) {
    if (response.status === 401) {
      clearSessionLocal();
    }

    const errorMessage =
      typeof data === "object" && data !== null && "erreur" in data && typeof data.erreur === "string"
        ? data.erreur
        : "Erreur serveur";

    throw new ApiError(errorMessage, response.status);
  }

  return data as T;
}

type SortFilter = "RECENT" | "MONTANT";

interface DimeListItem {
  id: number;
  totalDime: number;
  creeLe: string;
  transactionId: number;
  transactionDescription: string;
  transactionDate: string;
  partParoisseMere: number;
  partCaisseLocale: number;
  partResponsable: number;
  partLevites: number;
}

interface DimeCreateFormState {
  montant: string;
  description: string;
  dateOperation: string;
  modePaiement: string;
  evenementId: string;
}

interface EvenementOption {
  id: number;
  nom: string;
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

function normalizeDime(item: RepartitionDimeResponseDTO): DimeListItem {
  return {
    id: item.id,
    totalDime: item.totalDime,
    creeLe: String(item.creeLe),
    transactionId: item.transactionId,
    transactionDescription: item.transactionEntree.description?.trim() || "Sans description",
    transactionDate: String(item.transactionEntree.dateOperation),
    partParoisseMere: item.partParoisseMere,
    partCaisseLocale: item.partCaisseLocale,
    partResponsable: item.partResponsable,
    partLevites: item.partLevites,
  };
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

export default function DashboardDimesPage() {
  const now = getNowDateTimeInputValue();
  const currentUser = getAuthUserLocal();
  const canCreate =
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "RESPONSABLE" ||
    currentUser?.role === "TRESORIER";
  const canUpdate = canCreate;
  const canDelete = currentUser?.role === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [mutationLoading, setMutationLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [items, setItems] = useState<DimeListItem[]>([]);
  const [selectedDime, setSelectedDime] = useState<RepartitionDimeResponseDTO | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortFilter, setSortFilter] = useState<SortFilter>("RECENT");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingDimeId, setEditingDimeId] = useState<number | null>(null);
  const [form, setForm] = useState<DimeCreateFormState>({
    montant: "",
    description: "",
    dateOperation: now,
    modePaiement: "",
    evenementId: "",
  });
  const [evenementOptions, setEvenementOptions] = useState<EvenementOption[]>([]);

  async function chargerDimes(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("orderBy", sortFilter === "MONTANT" ? "totalDime" : "creeLe");
      params.set("order", "desc");

      const response = await fetchWithAuth<PaginatedResponse<RepartitionDimeResponseDTO>>(
        `/api/dimes?${params.toString()}`
      );

      setItems(response.data.map(normalizeDime));
      setTotal(response.pagination.total);
      setTotalPages(Math.max(1, response.pagination.totalPages));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    chargerDimes();
  }, [page, limit, sortFilter]);

  useEffect(() => {
    fetchWithAuth<{
      data: Array<{ id: number; nom: string; actif: boolean }>;
    }>("/api/evenements?page=1&limit=100&actif=true&orderBy=nom&order=asc")
      .then((response) => {
        setEvenementOptions(response.data.map((item) => ({ id: item.id, nom: item.nom })));
      })
      .catch(() => {
        setEvenementOptions([]);
      });
  }, []);

  function openCreateModal() {
    setEditingDimeId(null);
    setForm({
      montant: "",
      description: "",
      dateOperation: now,
      modePaiement: "",
      evenementId: "",
    });
    setError(null);
    setSuccessMessage(null);
    setIsCreateModalOpen(true);
  }

  function openEditModal(item: DimeListItem): void {
    setEditingDimeId(item.id);
    setForm({
      montant: String(item.totalDime),
      description: item.transactionDescription === "Sans description" ? "" : item.transactionDescription,
      dateOperation: toDateTimeLocalInputValue(item.transactionDate),
      modePaiement: "",
      evenementId: "",
    });
    setError(null);
    setSuccessMessage(null);
    setIsCreateModalOpen(true);
  }

  async function handleCreateOrUpdate(): Promise<void> {
    setMutationLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload: {
        montant: number;
        description?: string;
        dateOperation: string;
        modePaiement?: string;
        evenementId?: number;
      } = {
        montant: Number(form.montant),
        dateOperation: form.dateOperation,
      };

      if (form.description.trim()) {
        payload.description = form.description.trim();
      }

      if (form.modePaiement.trim()) {
        payload.modePaiement = form.modePaiement.trim();
      }

      if (form.evenementId.trim()) {
        payload.evenementId = Number(form.evenementId);
      }

      await fetchWithAuth(editingDimeId ? `/api/dimes/${editingDimeId}` : "/api/dimes", {
        method: editingDimeId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      setSuccessMessage(
        editingDimeId ? "Répartition mise à jour avec succès." : "Répartition créée avec succès."
      );
      setIsCreateModalOpen(false);
      setEditingDimeId(null);
      await chargerDimes();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible");
    } finally {
      setMutationLoading(false);
    }
  }

  async function ouvrirDetailDime(item: DimeListItem): Promise<void> {
    setDetailLoading(true);
    setError(null);
    setSelectedDime(null);
    setIsDetailModalOpen(true);

    try {
      const detail = await fetchWithAuth<RepartitionDimeResponseDTO>(`/api/dimes/${item.id}`);
      setSelectedDime(detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement du détail impossible");
      setIsDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleDelete(item: DimeListItem): Promise<void> {
    if (!canDelete) {
      setError("Seul un ADMIN peut supprimer une répartition de dîme.");
      return;
    }

    if (!window.confirm(`Supprimer la répartition #${item.id} ?`)) {
      return;
    }

    setMutationLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await fetchWithAuth(`/api/dimes/${item.id}`, { method: "DELETE" });
      setSuccessMessage(`Répartition #${item.id} supprimée.`);
      await chargerDimes();
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
              Répartition sacrée
            </p>
            <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">Dîmes</h1>
            <p className="mt-2 max-w-2xl text-bodytext">
              Liste des dîmes enregistrées. Cliquez sur une carte pour voir le détail
              complet d&apos;une dîme et ses répartitions séparées.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-border dark:border-darkborder px-4 py-2 text-sm font-medium text-link dark:text-white"
          >
            <ArrowRight size={16} />
            Retour au dashboard
          </Link>
        </div>
      </header>

      <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-dark dark:text-white">Liste des dîmes</h2>
            <p className="mt-1 text-sm text-bodytext">
              Affichage par enregistrements, sans agrégation globale de montants.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-border dark:border-darkborder overflow-hidden">
              {([
                { value: "RECENT", label: "Plus récentes" },
                { value: "MONTANT", label: "Montants élevés" },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setSortFilter(option.value);
                  }}
                  className={`px-3 py-2 text-sm font-medium ${
                    sortFilter === option.value
                      ? "bg-primary text-white"
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
              disabled={!canCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Plus size={15} />
              Nouveau Dîme
            </button>
          </div>
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

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="rounded-xl border border-border dark:border-darkborder p-4 bg-lightgray/40 dark:bg-dark"
              >
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                <div className="mt-3 h-6 w-40 bg-muted rounded animate-pulse" />
                <div className="mt-3 h-3 w-full bg-muted rounded animate-pulse" />
                <div className="mt-2 h-3 w-4/5 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-border dark:border-darkborder p-8 text-center text-bodytext">
            Aucune dîme trouvée.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((dime) => (
              <article
                key={dime.id}
                role="button"
                tabIndex={0}
                onClick={() => ouvrirDetailDime(dime)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    ouvrirDetailDime(dime);
                  }
                }}
                className="rounded-xl border border-border dark:border-darkborder bg-white dark:bg-dark p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-lg bg-lightprimary px-2 py-1 text-xs font-semibold text-primary">
                    <Coins size={13} />
                    Dîme #{dime.id}
                  </div>

                  <button
                    type="button"
                    disabled={!canUpdate || mutationLoading}
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditModal(dime);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-border dark:border-darkborder px-2 py-1 text-xs font-medium text-link dark:text-white disabled:opacity-50"
                  >
                    <Pencil size={12} />
                  </button>

                  <button
                    type="button"
                    disabled={!canDelete || mutationLoading}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(dime);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-lighterror px-2 py-1 text-xs font-medium text-error disabled:opacity-50"
                  >
                    <Trash size={12} />
                  </button>
                </div>

                <p className="mt-3 text-xl font-bold text-dark dark:text-white">
                  {formatMoney(dime.totalDime)}
                </p>

                <p className="mt-2 text-sm text-bodytext line-clamp-2" title={dime.transactionDescription}>
                  {dime.transactionDescription}
                </p>

                <div className="mt-4 space-y-1 text-xs text-bodytext">
                  <p>Opération: {formatDate(dime.transactionDate)}</p>
                  <p>Créée le: {formatDate(dime.creeLe)}</p>
                </div>

                <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  <Eye size={13} />
                  Voir le détail complet
                </div>
              </article>
            ))}
          </div>
        )}

        <footer className="flex items-center justify-between gap-3 pt-2">
          <p className="text-sm text-bodytext">
            {loading ? "Chargement..." : `Page ${page} sur ${Math.max(1, totalPages)} | Total: ${total}`}
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

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-darkgray border border-border dark:border-darkborder shadow-xl">
            <div className="border-b border-border dark:border-darkborder px-5 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark dark:text-white">
                {editingDimeId ? "Modifier une répartition de dîme" : "Créer une répartition de dîme"}
              </h2>
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="text-sm text-bodytext">Fermer</button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleCreateOrUpdate();
              }}
              className="p-5 space-y-4"
            >
              <label className="text-sm text-bodytext space-y-1 block">
                <span>Montant</span>
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  required
                  value={form.montant}
                  onChange={(e) => setForm((current) => ({ ...current, montant: e.target.value }))}
                  className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                />
              </label>

              <label className="text-sm text-bodytext space-y-1 block">
                <span>Date d&apos;opération</span>
                <input
                  type="datetime-local"
                  step={1}
                  required
                  value={form.dateOperation}
                  onChange={(e) => setForm((current) => ({ ...current, dateOperation: e.target.value }))}
                  max={now}
                  className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                />
              </label>

              <label className="text-sm text-bodytext space-y-1 block">
                <span>Description (optionnel)</span>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                  className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-bodytext space-y-1 block">
                  <span>Mode de paiement (optionnel)</span>
                  <input
                    value={form.modePaiement}
                    onChange={(e) => setForm((current) => ({ ...current, modePaiement: e.target.value }))}
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  />
                </label>

                <label className="text-sm text-bodytext space-y-1 block">
                  <span>Évènement (optionnel)</span>
                  <select
                    value={form.evenementId}
                    onChange={(e) => setForm((current) => ({ ...current, evenementId: e.target.value }))}
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  >
                    <option value="">Aucun</option>
                    {evenementOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.nom}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="rounded-xl border border-border px-4 py-2 text-sm text-link dark:text-white">Annuler</button>
                <button type="submit" disabled={mutationLoading} className="rounded-xl bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">
                  {mutationLoading
                    ? "Enregistrement..."
                    : editingDimeId
                      ? "Mettre à jour"
                      : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isDetailModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-darkgray border border-border dark:border-darkborder shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-darkgray border-b border-border dark:border-darkborder px-5 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark dark:text-white">Détail complet de la dîme</h2>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="inline-flex items-center gap-1 text-sm text-bodytext"
              >
                <X size={14} />
                Fermer
              </button>
            </div>

            <div className="p-5">
              {detailLoading ? (
                <p className="text-bodytext">Chargement du détail...</p>
              ) : !selectedDime ? (
                <p className="text-bodytext">Aucun détail disponible.</p>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-xl border border-border dark:border-darkborder p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-bodytext">Information principale</p>
                    <p className="mt-2 text-2xl font-bold text-dark dark:text-white">
                      {formatMoney(selectedDime.totalDime)}
                    </p>
                    <p className="mt-2 text-sm text-bodytext">
                      {selectedDime.transactionEntree.description || "Sans description"}
                    </p>
                    <p className="mt-2 text-xs text-bodytext">
                      Date opération: {formatDate(String(selectedDime.transactionEntree.dateOperation))}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border dark:border-darkborder p-4">
                      <p className="text-sm font-semibold text-dark dark:text-white inline-flex items-center gap-2">
                        <Landmark size={15} /> Paroisse mère
                      </p>
                      <p className="mt-2 text-xl font-bold text-primary">
                        {formatMoney(selectedDime.partParoisseMere)}
                      </p>
                      <p className="text-xs text-bodytext mt-1">
                        Transaction: #{selectedDime.transactionsGeneres.paroisseMere.id}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border dark:border-darkborder p-4">
                      <p className="text-sm font-semibold text-dark dark:text-white inline-flex items-center gap-2">
                        <Coins size={15} /> Caisse locale
                      </p>
                      <p className="mt-2 text-xl font-bold text-primary">
                        {formatMoney(selectedDime.partCaisseLocale)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border dark:border-darkborder p-4">
                      <p className="text-sm font-semibold text-dark dark:text-white inline-flex items-center gap-2">
                        <Wallet size={15} /> Responsable
                      </p>
                      <p className="mt-2 text-xl font-bold text-primary">
                        {formatMoney(selectedDime.partResponsable)}
                      </p>
                      <p className="text-xs text-bodytext mt-1">
                        Transaction: #{selectedDime.transactionsGeneres.responsable.id}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border dark:border-darkborder p-4">
                      <p className="text-sm font-semibold text-dark dark:text-white inline-flex items-center gap-2">
                        <Scale size={15} /> Lévites
                      </p>
                      <p className="mt-2 text-xl font-bold text-primary">
                        {formatMoney(selectedDime.partLevites)}
                      </p>
                      <p className="text-xs text-bodytext mt-1">
                        Transaction: #{selectedDime.transactionsGeneres.levites.id}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
