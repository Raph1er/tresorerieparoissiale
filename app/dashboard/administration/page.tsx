"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ApiError, fetchWithAuth } from "@/lib/api-client";
import { AlertCircle, Check, ChevronDown, ChevronUp, ShieldCheck, UserRound } from "lucide-react";
import { usePermissionContext } from "@/components/dashboard/PermissionContext";

interface AdminModule {
  key: string;
  name: string;
  path: string;
}

interface ManagedUser {
  id: number;
  nom: string;
  email: string;
  role: string;
  actif: boolean;
  creeLe: string;
  permissions: string[];
}

interface AdminUsersResponse {
  utilisateurs: ManagedUser[];
  modules: AdminModule[];
}

interface CreateUserForm {
  nom: string;
  email: string;
  role: string;
  motDePasse: string;
  permissions: string[];
}

const PERMISSIONS_SECRETAIRE_PAR_DEFAUT = ["dashboard", "secretariat"];

export default function AdministrationPage() {
  const currentUserId = usePermissionContext()?.id;
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [modules, setModules] = useState<AdminModule[]>([]);
  const [draftPermissions, setDraftPermissions] = useState<Record<number, string[]>>({});
  const [draftRoles, setDraftRoles] = useState<Record<number, string>>({});
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    nom: "",
    email: "",
    role: "AUDITEUR",
    motDePasse: "",
    permissions: [],
  });
  const [loading, setLoading] = useState(true);
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth<AdminUsersResponse>("/api/admin/utilisateurs");
      setUsers(response.utilisateurs);
      setModules(response.modules);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger les comptes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  function toggleModule(userId: number, moduleKey: string) {
    setDraftPermissions((current) => {
      const selected = current[userId] ?? users.find((user) => user.id === userId)?.permissions ?? [];
      const next = selected.includes(moduleKey)
        ? selected.filter((key) => key !== moduleKey)
        : [...selected, moduleKey];
      return { ...current, [userId]: next };
    });
  }

  function toggleCreateModule(moduleKey: string) {
    setCreateForm((current) => ({
      ...current,
      permissions: current.permissions.includes(moduleKey)
        ? current.permissions.filter((key) => key !== moduleKey)
        : [...current.permissions, moduleKey],
    }));
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      await fetchWithAuth("/api/admin/utilisateurs", {
        method: "POST",
        body: JSON.stringify({
          nom: createForm.nom,
          email: createForm.email,
          role: createForm.role,
          motDePasse: createForm.motDePasse,
          permissions: createForm.role === "ADMIN" ? [] : createForm.permissions,
        }),
      });
      setCreateDialogOpen(false);
      setCreateForm({ nom: "", email: "", role: "AUDITEUR", motDePasse: "", permissions: [] });
      setSuccess(`Le compte de ${createForm.nom.trim()} a été créé.`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La création du compte a échoué.");
    } finally {
      setCreating(false);
    }
  }

  async function changeStatus(user: ManagedUser) {
    if (user.id === currentUserId) {
      return;
    }
    if (user.actif && !window.confirm(`Désactiver le compte de ${user.nom} ? Ses sessions ne pourront plus accéder à la plateforme.`)) {
      return;
    }

    setPendingUserId(user.id);
    setError(null);
    setSuccess(null);
    try {
      await fetchWithAuth(`/api/admin/utilisateurs/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ actif: !user.actif }),
      });
      setSuccess(`Le compte de ${user.nom} a été ${user.actif ? "désactivé" : "réactivé"}.`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "La modification du statut a échoué.");
    } finally {
      setPendingUserId(null);
    }
  }

  async function saveRoleAndPermissions(user: ManagedUser) {
    const role = draftRoles[user.id] ?? user.role;
    if (user.id === currentUserId) {
      return;
    }

    const permissions = draftPermissions[user.id] ?? user.permissions;
    setPendingUserId(user.id);
    setError(null);
    setSuccess(null);
    try {
      await fetchWithAuth(`/api/admin/utilisateurs/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          role,
          ...(role === "ADMIN" ? {} : { permissions }),
        }),
      });
      setSuccess(`Le rôle et les accès de ${user.nom} ont été enregistrés.`);
      await loadUsers();
      setDraftPermissions((current) => {
        const next = { ...current };
        delete next[user.id];
        return next;
      });
      setDraftRoles((current) => {
        const next = { ...current };
        delete next[user.id];
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L’enregistrement des accès a échoué.");
    } finally {
      setPendingUserId(null);
    }
  }

  const activeCount = users.filter((user) => user.actif).length;

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-border bg-white p-6 shadow-md dark:border-darkborder dark:bg-darkgray lg:p-8">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-lightprimary text-primary">
            <ShieldCheck size={24} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bodytext">Espace administrateur</p>
            <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">Gestion des accès</h1>
            <p className="mt-2 text-bodytext">
              Créez des comptes, choisissez leurs rôles et modules, et suspendez ou réactivez leur accès.
              Les changements sont vérifiés par le serveur à chaque requête.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-xl bg-lightprimary px-3 py-2 font-medium text-primary">{users.length} comptes</span>
            <span className="rounded-xl bg-lightsuccess px-3 py-2 font-medium text-success">{activeCount} actifs</span>
          </div>
          <button
            type="button"
            onClick={() => setCreateDialogOpen(true)}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
          >
            Créer un utilisateur
          </button>
        </div>
      </header>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-lighterror bg-lighterror p-4 text-sm text-error">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {success ? (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-lightsuccess bg-lightsuccess/60 p-4 text-sm text-success">
          <Check size={17} />
          <span>{success}</span>
        </div>
      ) : null}

      <article className="overflow-hidden rounded-2xl border border-border bg-white shadow-md dark:border-darkborder dark:bg-darkgray">
        <div className="border-b border-border p-5 dark:border-darkborder">
          <h2 className="text-lg font-semibold text-dark dark:text-white">Comptes de la plateforme</h2>
          <p className="mt-1 text-sm text-bodytext">Les administrateurs disposent toujours de tous les modules.</p>
        </div>
        {loading ? (
          <p className="p-8 text-center text-sm text-bodytext">Chargement des utilisateurs…</p>
        ) : users.length === 0 ? (
          <p className="p-8 text-center text-sm text-bodytext">Aucun utilisateur trouvé.</p>
        ) : (
          <div className="divide-y divide-border dark:divide-darkborder">
            {users.map((user) => {
              const isExpanded = expandedUserId === user.id;
              const selectedRole = draftRoles[user.id] ?? user.role;
              const selectedPermissions = draftPermissions[user.id]
                ?? (user.role === "ADMIN" && selectedRole !== "ADMIN" ? modules.map((module) => module.key) : user.permissions);
              const isPending = pendingUserId === user.id;
              return (
                <div key={user.id} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lightprimary text-primary">
                        <UserRound size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-dark dark:text-white">{user.nom}</p>
                        <p className="truncate text-sm text-bodytext">{user.email}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-lightgray px-2 py-1 text-xs font-medium text-bodytext">{selectedRole}</span>
                          <span className={`rounded-md px-2 py-1 text-xs font-semibold ${user.actif ? "bg-lightsuccess text-success" : "bg-lightwarning text-warning"}`}>
                            {user.actif ? "Actif" : "Désactivé"}
                          </span>
                          {user.id === currentUserId ? (
                            <span className="text-xs text-bodytext">Votre compte</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        disabled={user.id === currentUserId}
                        onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-link disabled:opacity-50 dark:border-darkborder dark:text-white"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        Modifier rôle et accès
                      </button>
                      <button
                        type="button"
                        disabled={user.id === currentUserId || isPending}
                        onClick={() => void changeStatus(user)}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${user.actif ? "border-lighterror text-error" : "border-lightsuccess text-success"}`}
                      >
                        {isPending ? "En cours…" : user.actif ? "Désactiver" : "Réactiver"}
                      </button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="mt-5 rounded-xl border border-border bg-lightgray/40 p-4 dark:border-darkborder">
                      <div className="mb-4 flex flex-col gap-2 sm:max-w-xs">
                        <label htmlFor={`role-${user.id}`} className="text-sm font-medium text-dark dark:text-white">Rôle</label>
                        <select
                          id={`role-${user.id}`}
                          value={selectedRole}
                          disabled={user.id === currentUserId || isPending}
                          onChange={(event) => {
                            const nextRole = event.target.value;
                            setDraftRoles((current) => ({ ...current, [user.id]: nextRole }));
                            if (nextRole === "SECRETAIRE") {
                              setDraftPermissions((current) => ({
                                ...current,
                                [user.id]: PERMISSIONS_SECRETAIRE_PAR_DEFAUT,
                              }));
                            } else if (user.role === "ADMIN" && nextRole !== "ADMIN") {
                              setDraftPermissions((current) => ({
                                ...current,
                                [user.id]: modules.map((module) => module.key),
                              }));
                            }
                          }}
                          className="rounded-xl border border-border bg-white px-3 py-2 text-sm text-dark dark:border-darkborder dark:bg-darkgray dark:text-white"
                        >
                          <option value="TRESORIER">Trésorier</option>
                          <option value="RESPONSABLE">Responsable</option>
                          <option value="AUDITEUR">Auditeur</option>
                          <option value="SECRETAIRE">Secrétaire</option>
                          <option value="ADMIN">Administrateur</option>
                        </select>
                      </div>
                      {selectedRole !== "ADMIN" ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {modules.map((module) => (
                          <label key={module.key} className="flex cursor-pointer items-start gap-3 rounded-lg bg-white p-3 text-sm dark:bg-darkgray">
                            <input
                              type="checkbox"
                              checked={selectedPermissions.includes(module.key)}
                              disabled={user.id === currentUserId || isPending}
                              onChange={() => toggleModule(user.id, module.key)}
                              className="mt-0.5 h-4 w-4 accent-primary"
                            />
                            <span>
                              <span className="block font-medium text-dark dark:text-white">{module.name}</span>
                              <span className="block text-xs text-bodytext">{module.path}</span>
                            </span>
                          </label>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-lg bg-lightprimary p-3 text-sm text-primary">
                          Les administrateurs disposent automatiquement de tous les modules.
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-bodytext">
                          Sans accès, le module et ses API renvoient un refus 403.
                        </p>
                        <button
                          type="button"
                          disabled={user.id === currentUserId || isPending}
                          onClick={() => void saveRoleAndPermissions(user)}
                          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {isPending ? "Enregistrement…" : "Enregistrer rôle et accès"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </article>
      {createDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <form
            onSubmit={createUser}
            className="my-auto max-h-[92vh] w-full max-w-3xl space-y-5 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-darkgray"
          >
            <div>
              <h2 className="text-2xl font-bold text-dark dark:text-white">Créer un utilisateur</h2>
              <p className="mt-1 text-sm text-bodytext">
                Le mot de passe provisoire sera transmis à l’utilisateur, qui pourra le changer depuis son profil.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-dark dark:text-white">
                Nom
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={createForm.nom}
                  onChange={(event) => setCreateForm((current) => ({ ...current, nom: event.target.value }))}
                  className="w-full rounded-xl border border-border px-3 py-2 text-dark dark:border-darkborder dark:bg-darkgray dark:text-white"
                />
              </label>
              <label className="space-y-1 text-sm font-medium text-dark dark:text-white">
                Adresse email
                <input
                  required
                  type="email"
                  maxLength={191}
                  autoComplete="email"
                  value={createForm.email}
                  onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-xl border border-border px-3 py-2 text-dark dark:border-darkborder dark:bg-darkgray dark:text-white"
                />
              </label>
              <label className="space-y-1 text-sm font-medium text-dark dark:text-white">
                Rôle
                <select
                  value={createForm.role}
                  onChange={(event) => {
                    const role = event.target.value;
                    setCreateForm((current) => ({
                      ...current,
                      role,
                      permissions: role === "SECRETAIRE"
                        ? PERMISSIONS_SECRETAIRE_PAR_DEFAUT
                        : current.permissions,
                    }));
                  }}
                  className="w-full rounded-xl border border-border px-3 py-2 text-dark dark:border-darkborder dark:bg-darkgray dark:text-white"
                >
                  <option value="TRESORIER">Trésorier</option>
                  <option value="RESPONSABLE">Responsable</option>
                  <option value="AUDITEUR">Auditeur</option>
                  <option value="SECRETAIRE">Secrétaire</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-dark dark:text-white">
                Mot de passe provisoire
                <input
                  required
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  value={createForm.motDePasse}
                  onChange={(event) => setCreateForm((current) => ({ ...current, motDePasse: event.target.value }))}
                  className="w-full rounded-xl border border-border px-3 py-2 text-dark dark:border-darkborder dark:bg-darkgray dark:text-white"
                />
              </label>
            </div>
            {createForm.role === "ADMIN" ? (
              <p className="rounded-xl bg-lightprimary p-3 text-sm text-primary">
                Ce rôle dispose automatiquement de tous les modules.
              </p>
            ) : (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-dark dark:text-white">Permissions des modules</legend>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {modules.map((module) => (
                    <label key={module.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm dark:border-darkborder">
                      <input
                        type="checkbox"
                        checked={createForm.permissions.includes(module.key)}
                        onChange={() => toggleCreateModule(module.key)}
                        className="mt-0.5 h-4 w-4 accent-primary"
                      />
                      <span>
                        <span className="block font-medium text-dark dark:text-white">{module.name}</span>
                        <span className="block text-xs text-bodytext">{module.path}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4 dark:border-darkborder">
              <button
                type="button"
                disabled={creating}
                onClick={() => setCreateDialogOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-link disabled:opacity-50 dark:border-darkborder dark:text-white"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={creating}
                className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {creating ? "Création…" : "Créer le compte"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
