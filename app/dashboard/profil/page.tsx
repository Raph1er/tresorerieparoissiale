"use client";
/**
 * app/dashboard/profil/page.tsx
 * Page de modification du profil utilisateur personnel
 * Permet à l'utilisateur de modifier nom, email et password
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, fetchWithAuth } from "@/lib/api-client";
import { getAuthUser, setAuthUser } from "@/lib/client-auth";
import type { AuthUser } from "@/lib/client-auth";
import {
    AlertCircle,
    ArrowRight,
    Check,
    Eye,
    EyeOff,
    Lock,
    Mail,
    Save,
    User,
} from "lucide-react";

interface ProfileFormData {
    nom: string;
    email: string;
    motDePasseActuel: string;
    motDePasseNouveau: string;
    confirmationMotDePasse: string;
}

interface ProfileResponse {
    id: number;
    nom: string;
    email: string;
    role: string;
    actif: boolean;
    creeLe: string;
    modifieLe: string;
}

export default function ProfilePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false,
    });

    const [form, setForm] = useState<ProfileFormData>({
        nom: "",
        email: "",
        motDePasseActuel: "",
        motDePasseNouveau: "",
        confirmationMotDePasse: "",
    });

    // Charger le profil initial
    useEffect(() => {
        let mounted = true;

        async function loadProfile() {
            try {
                const authUser = getAuthUser();
                if (!authUser) {
                    router.replace("/login");
                    return;
                }

                setUser(authUser);
                setForm((current) => ({
                    ...current,
                    nom: authUser.nom,
                    email: authUser.email,
                }));

                // Optionnel: charger les données fraîches du serveur
                const profile = await fetchWithAuth<ProfileResponse>("/api/profile");
                if (mounted) {
                    setForm((current) => ({
                        ...current,
                        nom: profile.nom,
                        email: profile.email,
                    }));
                }
            } catch (err) {
                if (mounted) {
                    const message =
                        err instanceof ApiError ? err.message : "Erreur lors du chargement du profil";
                    setError(message);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadProfile();
        return () => {
            mounted = false;
        };
    }, [router]);

    // Traiter la soumission du formulaire
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setSubmitting(true);

        try {
            // Validation client minimal
            if (!form.nom.trim()) {
                setError("Le nom est requis");
                return;
            }

            if (!form.email.trim()) {
                setError("L'email est requis");
                return;
            }

            // Validation password
            const wantsChangePassword =
                form.motDePasseActuel.length > 0 ||
                form.motDePasseNouveau.length > 0 ||
                form.confirmationMotDePasse.length > 0;

            if (wantsChangePassword) {
                if (!form.motDePasseActuel) {
                    setError("Veuillez saisir l'ancien mot de passe");
                    return;
                }

                if (!form.motDePasseNouveau) {
                    setError("Veuillez saisir le nouveau mot de passe");
                    return;
                }

                if (form.motDePasseNouveau.length < 8) {
                    setError("Le mot de passe doit faire au moins 8 caractères");
                    return;
                }

                if (form.motDePasseNouveau !== form.confirmationMotDePasse) {
                    setError("Les mots de passe ne correspondent pas");
                    return;
                }
            }

            // Construire le payload
            const payload: Record<string, unknown> = {
                nom: form.nom,
                email: form.email,
            };

            if (wantsChangePassword) {
                payload.motDePasseActuel = form.motDePasseActuel;
                payload.motDePasseNouveau = form.motDePasseNouveau;
            }

            // Envoyer au serveur
            const response = await fetchWithAuth<ProfileResponse>("/api/profile", {
                method: "PUT",
                body: JSON.stringify(payload),
            });

            // Mettre à jour le localStorage avec les nouvelles données
            const updatedUser: AuthUser = {
                id: response.id,
                nom: response.nom,
                email: response.email,
                role: response.role,
            };

            setAuthUser(updatedUser);
            setUser(updatedUser);

            // Réinitialiser les champs password
            setForm((current) => ({
                ...current,
                nom: response.nom,
                email: response.email,
                motDePasseActuel: "",
                motDePasseNouveau: "",
                confirmationMotDePasse: "",
            }));

            setSuccessMessage(
                wantsChangePassword
                    ? "Profil et mot de passe mis à jour avec succès"
                    : "Profil mis à jour avec succès"
            );

            // Effacer le message de succès après 5 secondes
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : "Erreur lors de la mise à jour du profil";
            setError(message);
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-3">
                        <div className="h-8 w-56 rounded-lg bg-muted animate-pulse" />
                        <div className="h-4 w-72 rounded bg-muted animate-pulse" />
                    </div>
                </div>

                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-16 rounded-lg bg-muted animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* En-tête */}
            <header className="rounded-bb bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-4 sm:p-6 lg:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-bodytext font-semibold">
                            Gestion personnelle
                        </p>
                        <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-dark dark:text-white">
                            Mon profil
                        </h1>
                        <p className="mt-2 text-bodytext">
                            Modifiez vos informations personnelles et votre mot de passe en sécurité.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 rounded-xl border border-border dark:border-darkborder px-4 py-2 text-sm font-medium text-link dark:text-white"
                    >
                        <ArrowRight size={16} />
                        Retour
                    </button>
                </div>
            </header>

            {/* Messages */}
            {error && (
                <div className="rounded-xl bg-lighterror border border-lighterror p-4 text-error text-sm flex items-start gap-3">
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {successMessage && (
                <div className="rounded-xl bg-lightsuccess border border-lightsuccess p-4 text-success text-sm flex items-start gap-3">
                    <Check size={18} className="mt-0.5 flex-shrink-0" />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* Formulaire */}
            <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-4 sm:p-6 space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Section 1: Infos de base */}
                    <div className="space-y-4 pb-6 border-b border-border dark:border-darkborder">
                        <h2 className="text-lg font-semibold text-dark dark:text-white flex items-center gap-2">
                            <User size={20} />
                            Informations personnelles
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="text-sm text-bodytext space-y-1.5 block">
                                <span className="font-medium">Nom complet *</span>
                                <input
                                    type="text"
                                    value={form.nom}
                                    onChange={(e) =>
                                        setForm((current) => ({ ...current, nom: e.target.value }))
                                    }
                                    placeholder="Ex: Jean Dupont"
                                    required
                                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2.5 text-sm text-dark dark:text-white placeholder-bodytext/50"
                                />
                            </label>

                            <label className="text-sm text-bodytext space-y-1.5 block">
                                <span className="font-medium flex items-center gap-2">
                                    <Mail size={16} /> Email *
                                </span>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) =>
                                        setForm((current) => ({ ...current, email: e.target.value }))
                                    }
                                    placeholder="Ex: jean@example.com"
                                    required
                                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2.5 text-sm text-dark dark:text-white placeholder-bodytext/50"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Section 2: Changement de mot de passe */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-dark dark:text-white flex items-center gap-2">
                            <Lock size={20} />
                            Changement de mot de passe
                        </h2>
                        <p className="text-sm text-bodytext">
                            Laissez ces champs vides si vous ne souhaitez pas changer de mot de passe.
                        </p>

                        <div className="grid grid-cols-1 gap-4">
                            <label className="text-sm text-bodytext space-y-1.5 block">
                                <span className="font-medium">Ancien mot de passe</span>
                                <div className="relative">
                                    <input
                                        type={showPasswords.current ? "text" : "password"}
                                        value={form.motDePasseActuel}
                                        onChange={(e) =>
                                            setForm((current) => ({
                                                ...current,
                                                motDePasseActuel: e.target.value,
                                            }))
                                        }
                                        placeholder="Saisissez l'ancien mot de passe"
                                        autoComplete="new-password"
                                        className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2.5 pr-10 text-sm text-dark dark:text-white placeholder-bodytext/50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPasswords((current) => ({
                                                ...current,
                                                current: !current.current,
                                            }))
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-bodytext hover:text-primary transition-colors"
                                    >
                                        {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </label>

                            <label className="text-sm text-bodytext space-y-1.5 block">
                                <span className="font-medium">Nouveau mot de passe (min. 8 caractères)</span>
                                <div className="relative">
                                    <input
                                        type={showPasswords.new ? "text" : "password"}
                                        value={form.motDePasseNouveau}
                                        onChange={(e) =>
                                            setForm((current) => ({
                                                ...current,
                                                motDePasseNouveau: e.target.value,
                                            }))
                                        }
                                        placeholder="Saisissez le nouveau mot de passe"
                                        autoComplete="new-password"
                                        className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2.5 pr-10 text-sm text-dark dark:text-white placeholder-bodytext/50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPasswords((current) => ({
                                                ...current,
                                                new: !current.new,
                                            }))
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-bodytext hover:text-primary transition-colors"
                                    >
                                        {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </label>

                            <label className="text-sm text-bodytext space-y-1.5 block">
                                <span className="font-medium">Confirmation du nouveau mot de passe</span>
                                <div className="relative">
                                    <input
                                        type={showPasswords.confirm ? "text" : "password"}
                                        value={form.confirmationMotDePasse}
                                        onChange={(e) =>
                                            setForm((current) => ({
                                                ...current,
                                                confirmationMotDePasse: e.target.value,
                                            }))
                                        }
                                        placeholder="Confirmez le nouveau mot de passe"
                                        autoComplete="new-password"
                                        className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2.5 pr-10 text-sm text-dark dark:text-white placeholder-bodytext/50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPasswords((current) => ({
                                                ...current,
                                                confirm: !current.confirm,
                                            }))
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-bodytext hover:text-primary transition-colors"
                                    >
                                        {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Boutons d'action */}
                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-border dark:border-darkborder">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="rounded-xl border border-border dark:border-darkborder px-4 py-2.5 text-sm font-medium text-link dark:text-white hover:bg-lightgray dark:hover:bg-darkborder transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-all"
                        >
                            <Save size={16} />
                            {submitting ? "Enregistrement..." : "Enregistrer"}
                        </button>
                    </div>
                </form>
            </article>

            {/* Info supplémentaire */}
            <div className="rounded-tw bg-lightprimary dark:bg-darkgray border border-primary/20 dark:border-primary/30 p-4 text-sm text-bodytext space-y-2">
                <p className="font-medium text-primary">💡 Conseils de sécurité :</p>
                <ul className="space-y-1 list-disc list-inside text-xs">
                    <li>Ne partagez jamais votre mot de passe avec quelqu'un d'autre</li>
                    <li>Utilisez un mot de passe unique et complexe</li>
                    <li>Modifiez votre mot de passe régulièrement</li>
                    <li>Si vous suspectez une compromission, contactez l'administrateur</li>
                </ul>
            </div>
        </div>
    );
}
