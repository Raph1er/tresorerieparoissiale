"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, fetchWithAuth } from "@/lib/api-client";
import { getAuthUser } from "@/lib/client-auth";
import type { PaginatedResponse, UtilisateurResponseDTO } from "@/types/utilisateur";
import {
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash,
  UserRound,
} from "lucide-react";

type RoleValue = "ADMIN" | "TRESORIER" | "RESPONSABLE" | "AUDITEUR";
type RoleFilter = "ALL" | RoleValue;

interface UserFormState {
  nom: string;
  email: string;
  role: RoleValue;
  actif: boolean;
  motDePasse: string;
}

interface UserListItem {
  id: number;
  nom: string;
  email: string;
  role: RoleValue;
  actif: boolean;
  creeLe: string;
}

export default function DashboardUtilisateursPage() {
  const currentUser = getAuthUser();
  const isAdmin = currentUser?.role === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [mutationLoading, setMutationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [items, setItems] = useState<UserListItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [form, setForm] = useState<UserFormState>({
    nom: "",
    email: "",
    role: "AUDITEUR",
    actif: true,
    motDePasse: "",
  });

  async function chargerUtilisateurs(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim());
      }

      if (roleFilter !== "ALL") {
        params.set("role", roleFilter);
      }

      if (statusFilter !== "ALL") {
        params.set("actif", String(statusFilter === "ACTIVE"));
      }

      const response = await fetchWithAuth<PaginatedResponse<UtilisateurResponseDTO>>(
        `/api/utilisateurs?${params.toString()}`
      );

      setItems(
        response.data.map((item) => ({
          id: item.id,
          nom: item.nom,
          email: item.email,
          role: item.role,
          actif: item.actif,
          creeLe: String(item.creeLe),
        }))
      );
      setTotal(response.total);
      setTotalPages(response.totalPages || 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    chargerUtilisateurs();
  }, [page, limit, searchTerm, roleFilter, statusFilter]);

  function openCreateModal() {
    setEditingUserId(null);
    setForm({ nom: "", email: "", role: "AUDITEUR", actif: true, motDePasse: "" });
    setError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  }

  function openEditModal(item: UserListItem) {
    setEditingUserId(item.id);
    setForm({
      nom: item.nom,
      email: item.email,
      role: item.role,
      actif: item.actif,
      motDePasse: "",
    });
    setError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  }

  async function handleDelete(item: UserListItem): Promise<void> {
    if (!isAdmin) {
      setError("Seul un ADMIN peut supprimer un utilisateur.");
      return;
    }

    if (!window.confirm(`Supprimer le compte de ${item.nom} ?`)) {
      return;
    }

    setMutationLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await fetchWithAuth(`/api/utilisateurs/${item.id}`, {
        method: "DELETE",
      });
      setSuccessMessage(`Utilisateur ${item.nom} supprimé.`);
      await chargerUtilisateurs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Suppression impossible");
    } finally {
      setMutationLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMutationLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (editingUserId) {
        const payload: {
          nom: string;
          email: string;
          role?: RoleValue;
          actif?: boolean;
        } = {
          nom: form.nom.trim(),
          email: form.email.trim(),
        };

        if (isAdmin) {
          payload.role = form.role;
          payload.actif = form.actif;
        }

        await fetchWithAuth(`/api/utilisateurs/${editingUserId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Utilisateur mis à jour avec succès.");
      } else {
        if (!isAdmin) {
          throw new ApiError("Seul un ADMIN peut créer un utilisateur.", 403);
        }

        await fetchWithAuth("/api/utilisateurs", {
          method: "POST",
          body: JSON.stringify({
            nom: form.nom.trim(),
            email: form.email.trim(),
            role: form.role,
            motDePasse: form.motDePasse,
          }),
        });
        setSuccessMessage("Utilisateur créé avec succès.");
      }

      setIsModalOpen(false);
      await chargerUtilisateurs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible");
    } finally {
      setMutationLoading(false);
    }
  }

  function formatDate(value: string): string {
    return new Date(value).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <section className="space-y-6">
      <header className="rounded-bb bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-bodytext font-semibold">Administration</p>
            <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">Utilisateurs</h1>
            <p className="mt-2 text-bodytext">Gestion des comptes, rôles et statuts d'accès.</p>
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
        <div className="flex flex-wrap items-center gap-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearchTerm(searchInput);
            }}
            className="flex-1 min-w-[260px]"
          >
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-bodytext" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Rechercher nom/email"
                className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent py-2.5 pl-9 pr-3 text-sm text-dark dark:text-white"
              />
            </div>
          </form>

          <select
            value={roleFilter}
            onChange={(event) => {
              setPage(1);
              setRoleFilter(event.target.value as RoleFilter);
            }}
            className="rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
          >
            <option value="ALL">Tous les rôles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="TRESORIER">TRESORIER</option>
            <option value="RESPONSABLE">RESPONSABLE</option>
            <option value="AUDITEUR">AUDITEUR</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE");
            }}
            className="rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
          >
            <option value="ALL">Tout statut</option>
            <option value="ACTIVE">Actifs</option>
            <option value="INACTIVE">Inactifs</option>
          </select>

          <button
            type="button"
            onClick={openCreateModal}
            disabled={!isAdmin}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Plus size={15} />
            Nouvel utilisateur
          </button>
        </div>

        {error ? (
          <div className="rounded-xl bg-lighterror border border-lighterror p-4 text-error text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-xl border border-lightsuccess bg-lightsuccess/60 p-4 text-success text-sm">{successMessage}</div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-bodytext border-b border-border dark:border-darkborder">
                <th className="py-3 pr-3 font-semibold">Utilisateur</th>
                <th className="py-3 px-3 font-semibold">Rôle</th>
                <th className="py-3 px-3 font-semibold">Création</th>
                <th className="py-3 px-3 text-right font-semibold">Statut</th>
                <th className="py-3 pl-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-bodytext">Chargement des utilisateurs...</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-bodytext">Aucun utilisateur trouvé.</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-border/60 dark:border-darkborder/60 hover:bg-lightgray/50">
                    <td className="py-3 pr-3 align-top">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-lightprimary text-primary">
                          <UserRound size={16} />
                        </span>
                        <div>
                          <p className="font-semibold text-dark dark:text-white">{item.nom}</p>
                          <p className="mt-1 text-bodytext">{item.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top text-bodytext">{item.role}</td>
                    <td className="py-3 px-3 align-top text-bodytext">{formatDate(item.creeLe)}</td>
                    <td className="py-3 px-3 align-top text-right">
                      <span
                        className={`inline-flex rounded-lg px-2 py-1 text-xs font-semibold ${
                          item.actif ? "bg-lightsuccess text-success" : "bg-lightwarning text-warning"
                        }`}
                      >
                        {item.actif ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="py-3 pl-3 align-top">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border dark:border-darkborder px-2.5 py-1.5 text-xs font-medium text-link dark:text-white"
                        >
                          <Pencil size={13} />
                          Modifier
                        </button>
                        <button
                          type="button"
                          disabled={!isAdmin || mutationLoading}
                          onClick={() => handleDelete(item)}
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
          <p className="text-sm text-bodytext">{loading ? "Chargement..." : `Page ${page} sur ${Math.max(1, totalPages)} | Total: ${total}`}</p>
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
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-darkgray border border-border dark:border-darkborder shadow-xl">
            <div className="border-b border-border dark:border-darkborder px-5 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark dark:text-white">
                {editingUserId ? "Modifier utilisateur" : "Créer un utilisateur"}
              </h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-sm text-bodytext">Fermer</button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <label className="text-sm text-bodytext space-y-1 block">
                <span>Nom</span>
                <input
                  value={form.nom}
                  onChange={(event) => setForm((current) => ({ ...current, nom: event.target.value }))}
                  required
                  className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                />
              </label>

              <label className="text-sm text-bodytext space-y-1 block">
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  required
                  className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-bodytext space-y-1 block">
                  <span>Rôle</span>
                  <select
                    value={form.role}
                    disabled={!isAdmin}
                    onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as RoleValue }))}
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white disabled:opacity-50"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="TRESORIER">TRESORIER</option>
                    <option value="RESPONSABLE">RESPONSABLE</option>
                    <option value="AUDITEUR">AUDITEUR</option>
                  </select>
                </label>

                {editingUserId ? (
                  <label className="text-sm text-bodytext space-y-2 block">
                    <span>Statut</span>
                    <span className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        disabled={!isAdmin}
                        checked={form.actif}
                        onChange={(event) => setForm((current) => ({ ...current, actif: event.target.checked }))}
                      />
                      <span>Compte actif</span>
                    </span>
                  </label>
                ) : (
                  <label className="text-sm text-bodytext space-y-1 block">
                    <span>Mot de passe</span>
                    <input
                      type="password"
                      value={form.motDePasse}
                      onChange={(event) => setForm((current) => ({ ...current, motDePasse: event.target.value }))}
                      minLength={8}
                      required
                      className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                    />
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl border border-border px-4 py-2 text-sm text-link dark:text-white">Annuler</button>
                <button type="submit" disabled={mutationLoading} className="rounded-xl bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">
                  {mutationLoading ? "Enregistrement..." : editingUserId ? "Mettre à jour" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
