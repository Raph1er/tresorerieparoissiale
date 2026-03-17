"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, fetchWithAuth } from "@/lib/api-client";
import { getAuthUser } from "@/lib/client-auth";
import type { EvenementResponseDTO, PaginatedResponse } from "@/types/evenement";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pencil,
  Plus,
  Search,
  Trash,
  Wallet,
} from "lucide-react";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type TimelineFilter = "ALL" | "ONGOING";

interface EventListItem {
  id: number;
  nom: string;
  description: string;
  dateDebut: string;
  dateFin: string | null;
  actif: boolean;
  creeLe: string;
  transactionCount: number;
  periodeLabel: string;
  phase: "A_VENIR" | "EN_COURS" | "TERMINE";
}

interface EventFormState {
  nom: string;
  description: string;
  dateDebut: string;
  dateFin: string;
  actif: boolean;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function resolvePhase(dateDebut: string, dateFin: string | null): EventListItem["phase"] {
  const now = Date.now();
  const start = new Date(dateDebut).getTime();
  const end = dateFin ? new Date(dateFin).getTime() : null;

  if (start > now) {
    return "A_VENIR";
  }

  if (end !== null && end < now) {
    return "TERMINE";
  }

  return "EN_COURS";
}

function normalizeEvenement(item: EvenementResponseDTO): EventListItem {
  const dateDebut = String(item.dateDebut);
  const dateFin = item.dateFin ? String(item.dateFin) : null;
  const phase = resolvePhase(dateDebut, dateFin);

  return {
    id: item.id,
    nom: item.nom,
    description: item.description?.trim() || "Aucune description",
    dateDebut,
    dateFin,
    actif: item.actif,
    creeLe: String(item.creeLe),
    transactionCount: item.transactionCount,
    periodeLabel: dateFin
      ? `${formatDate(dateDebut)} au ${formatDate(dateFin)}`
      : `Depuis le ${formatDate(dateDebut)}`,
    phase,
  };
}

function getTodayInputValue(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function DashboardEvenementsPage() {
  const today = getTodayInputValue();
  const currentUser = getAuthUser();
  const canMutate = currentUser?.role === "ADMIN" || currentUser?.role === "RESPONSABLE" || currentUser?.role === "TRESORIER";
  const canDelete = currentUser?.role === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [mutationLoading, setMutationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [items, setItems] = useState<EventListItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [form, setForm] = useState<EventFormState>({
    nom: "",
    description: "",
    dateDebut: today,
    dateFin: today,
    actif: true,
  });

  async function chargerEvenements(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (statusFilter !== "ALL") {
        params.set("actif", String(statusFilter === "ACTIVE"));
      }

      if (timelineFilter === "ONGOING") {
        params.set("enCours", "true");
      }

      if (searchTerm.trim().length > 0) {
        params.set("search", searchTerm.trim());
      }

      const response = await fetchWithAuth<PaginatedResponse<EvenementResponseDTO>>(
        `/api/evenements?${params.toString()}`
      );

      setItems(response.data.map(normalizeEvenement));
      setTotal(response.total);
      setTotalPages(response.totalPages || 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    chargerEvenements();
  }, [page, limit, statusFilter, timelineFilter, searchTerm]);

  const resume = useMemo(() => {
    const actifs = items.filter((item) => item.actif).length;
    const enCours = items.filter((item) => item.phase === "EN_COURS").length;
    const transactionsLiees = items.reduce(
      (acc, item) => acc + item.transactionCount,
      0
    );

    return {
      actifs,
      enCours,
      transactionsLiees,
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

  function handleTimelineChange(nextTimeline: TimelineFilter) {
    setPage(1);
    setTimelineFilter(nextTimeline);
  }

  function toDateInputValue(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function openCreateModal() {
    setEditingEventId(null);
    setForm({ nom: "", description: "", dateDebut: today, dateFin: today, actif: true });
    setError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  }

  function openEditModal(item: EventListItem) {
    setEditingEventId(item.id);
    setForm({
      nom: item.nom,
      description: item.description === "Aucune description" ? "" : item.description,
      dateDebut: toDateInputValue(item.dateDebut),
      dateFin: item.dateFin ? toDateInputValue(item.dateFin) : "",
      actif: item.actif,
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

    const payload = {
      nom: form.nom.trim(),
      description: form.description.trim() || undefined,
      dateDebut: form.dateDebut,
      dateFin: form.dateFin || null,
      actif: form.actif,
    };

    try {
      if (editingEventId) {
        await fetchWithAuth(`/api/evenements/${editingEventId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Évènement mis à jour avec succès.");
      } else {
        await fetchWithAuth("/api/evenements", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Évènement créé avec succès.");
      }

      setIsModalOpen(false);
      await chargerEvenements();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible");
    } finally {
      setMutationLoading(false);
    }
  }

  async function handleDelete(item: EventListItem): Promise<void> {
    if (!canDelete) {
      setError("Seul un ADMIN peut supprimer un évènement.");
      return;
    }

    if (!window.confirm(`Supprimer l'évènement ${item.nom} ?`)) {
      return;
    }

    setMutationLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await fetchWithAuth(`/api/evenements/${item.id}`, { method: "DELETE" });
      setSuccessMessage(`Évènement ${item.nom} supprimé.`);
      await chargerEvenements();
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
              Vie paroissiale
            </p>
            <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">
              Évènements
            </h1>
            <p className="mt-2 max-w-2xl text-bodytext">
              Pilotage des activités, des périodes actives et de leur impact sur les
              transactions associées.
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
          <p className="text-sm text-bodytext">Total évènements</p>
          <p className="mt-2 text-2xl font-bold text-dark dark:text-white">{loading ? "..." : total}</p>
        </article>
        <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
          <p className="text-sm text-bodytext">Actifs sur cette page</p>
          <p className="mt-2 text-2xl font-bold text-success">{loading ? "..." : resume.actifs}</p>
        </article>
        <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
          <p className="text-sm text-bodytext">En cours</p>
          <p className="mt-2 text-2xl font-bold text-primary">{loading ? "..." : resume.enCours}</p>
        </article>
        <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
          <p className="text-sm text-bodytext">Transactions liées</p>
          <p className="mt-2 text-2xl font-bold text-warning">{loading ? "..." : resume.transactionsLiees}</p>
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
                placeholder="Rechercher un évènement"
                className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent py-2.5 pl-9 pr-3 text-sm text-dark dark:text-white"
              />
            </div>
          </form>

          <div className="inline-flex rounded-xl border border-border dark:border-darkborder overflow-hidden">
            {([
              { value: "ALL", label: "Tous" },
              { value: "ACTIVE", label: "Actifs" },
              { value: "INACTIVE", label: "Inactifs" },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleStatusChange(option.value)}
                className={`px-3 py-2 text-sm font-medium ${
                  statusFilter === option.value
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
              { value: "ALL", label: "Toutes périodes" },
              { value: "ONGOING", label: "En cours" },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleTimelineChange(option.value)}
                className={`px-3 py-2 text-sm font-medium ${
                  timelineFilter === option.value
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
            disabled={!canMutate}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Plus size={15} />
            Nouvel évènement
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
                <th className="py-3 pr-3 font-semibold">Évènement</th>
                <th className="py-3 px-3 font-semibold">Période</th>
                <th className="py-3 px-3 font-semibold">Phase</th>
                <th className="py-3 px-3 font-semibold">Création</th>
                <th className="py-3 px-3 font-semibold">Impact</th>
                <th className="py-3 px-3 text-right font-semibold">Statut</th>
                <th className="py-3 pl-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-bodytext">
                    Chargement des évènements...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-bodytext">
                    Aucun évènement trouvé.
                  </td>
                </tr>
              ) : (
                items.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b border-border/60 dark:border-darkborder/60 hover:bg-lightgray/50"
                  >
                    <td className="py-3 pr-3 align-top">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-lightprimary text-primary">
                          <CalendarDays size={16} />
                        </span>
                        <div>
                          <p className="font-semibold text-dark dark:text-white">{event.nom}</p>
                          <p className="mt-1 max-w-[300px] text-bodytext line-clamp-2">
                            {event.description}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top text-bodytext">
                      {event.periodeLabel}
                    </td>
                    <td className="py-3 px-3 align-top">
                      <span
                        className={`inline-flex rounded-lg px-2 py-1 text-xs font-semibold ${
                          event.phase === "EN_COURS"
                            ? "bg-lightprimary text-primary"
                            : event.phase === "A_VENIR"
                              ? "bg-lightwarning text-warning"
                              : "bg-lightgray text-bodytext"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={13} />
                          {event.phase === "EN_COURS"
                            ? "En cours"
                            : event.phase === "A_VENIR"
                              ? "À venir"
                              : "Terminé"}
                        </span>
                      </span>
                    </td>
                    <td className="py-3 px-3 align-top text-bodytext">
                      {formatDate(event.creeLe)}
                    </td>
                    <td className="py-3 px-3 align-top">
                      <span className="inline-flex items-center gap-2 text-bodytext">
                        <Wallet size={14} />
                        {event.transactionCount} transaction(s)
                      </span>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="flex justify-end">
                        <span
                          className={`inline-flex rounded-lg px-2 py-1 text-xs font-semibold ${
                            event.actif
                              ? "bg-lightsuccess text-success"
                              : "bg-lightwarning text-warning"
                          }`}
                        >
                          {event.actif ? "Actif" : "Inactif"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pl-3 align-top">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={!canMutate}
                          onClick={() => openEditModal(event)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border dark:border-darkborder px-2.5 py-1.5 text-xs font-medium text-link dark:text-white disabled:opacity-50"
                        >
                          <Pencil size={13} />
                          Modifier
                        </button>
                        <button
                          type="button"
                          disabled={!canDelete || mutationLoading}
                          onClick={() => handleDelete(event)}
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
                {editingEventId ? "Modifier l'évènement" : "Créer un évènement"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-sm text-bodytext"
              >
                Fermer
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 space-y-4">
              <label className="text-sm text-bodytext space-y-1 block">
                <span>Nom</span>
                <input
                  value={form.nom}
                  onChange={(e) => setForm((current) => ({ ...current, nom: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                />
              </label>

              <label className="text-sm text-bodytext space-y-1 block">
                <span>Description</span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                  className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-bodytext space-y-1 block">
                  <span>Date début</span>
                  <input
                    type="date"
                    value={form.dateDebut}
                    onChange={(e) => setForm((current) => ({ ...current, dateDebut: e.target.value }))}
                    max={today}
                    required
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  />
                </label>

                <label className="text-sm text-bodytext space-y-1 block">
                  <span>Date fin (optionnel)</span>
                  <input
                    type="date"
                    value={form.dateFin}
                    onChange={(e) => setForm((current) => ({ ...current, dateFin: e.target.value }))}
                    max={today}
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  />
                </label>
              </div>

              {editingEventId ? (
                <label className="text-sm text-bodytext space-y-2 block">
                  <span>Statut</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.actif}
                      onChange={(e) => setForm((current) => ({ ...current, actif: e.target.checked }))}
                    />
                    <span>Évènement actif</span>
                  </span>
                </label>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-sm text-link dark:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={mutationLoading}
                  className="rounded-xl bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {mutationLoading ? "Enregistrement..." : editingEventId ? "Mettre à jour" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
