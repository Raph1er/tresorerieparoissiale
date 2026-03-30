"use client";
/**
 * app/dashboard/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Page d'accueil du dashboard.
 *
 * Objectif : garder la logique existante de chargement des données API, mais
 * afficher ces données avec une interface cohérente avec le layout MatDash.
 *
 * Données chargées :
 *   - /api/rapports         → résumé financier global
 *   - /api/transactions     → dernières transactions
 *
 * Cette page reste 100% côté client car elle dépend du token stocké en local.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, fetchWithAuth } from "@/lib/api-client";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  ChevronRight,
  Clock,
  CreditCard,
  FolderTree,
  Landmark,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

interface RapportResume {
  totalEntrees: number;
  totalSorties: number;
  solde: number;
  nombreTransactions: number;
}

interface RapportResponse {
  resume: RapportResume;
}

interface TransactionItem {
  id: number;
  type: "ENTREE" | "SORTIE";
  montant: number;
  description: string | null;
  dateOperation: string;
  categorie?:
  | string
  | {
    id: number;
    nom: string;
    type: "ENTREE" | "SORTIE";
  };
}

interface TransactionsResponse {
  data: TransactionItem[];
}

interface DashboardTransaction {
  id: number;
  type: "ENTREE" | "SORTIE";
  montant: number;
  description: string | null;
  dateOperation: string;
  categorieNom: string | null;
}

const CURRENCY_LABEL = "FCFA";

function formatAmount(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMoney(value: number): string {
  return `${formatAmount(value)} ${CURRENCY_LABEL}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resume, setResume] = useState<RapportResume | null>(null);
  const [transactions, setTransactions] = useState<DashboardTransaction[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [rapport, tx] = await Promise.all([
          fetchWithAuth<RapportResponse>("/api/rapports"),
          fetchWithAuth<TransactionsResponse>("/api/transactions?page=1&limit=5"),
        ]);

        if (!mounted) {
          return;
        }

        setResume(rapport.resume);

        // Normalise la payload API pour éviter les rendus d'objets React (ex: categorie objet).
        const transactionsNormalisees: DashboardTransaction[] = (tx.data ?? []).map((item) => ({
          id: item.id,
          type: item.type,
          montant: item.montant,
          description: item.description,
          dateOperation: item.dateOperation,
          categorieNom:
            typeof item.categorie === "string"
              ? item.categorie
              : item.categorie?.nom ?? null,
        }));

        setTransactions(transactionsNormalisees);
      } catch (err) {
        if (!mounted) {
          return;
        }

        const message =
          err instanceof ApiError ? err.message : "Chargement des données impossible";
        setError(message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    if (!resume) {
      return [];
    }

    return [
      {
        label: "Entrées",
        value: formatAmount(resume.totalEntrees),
        currency: CURRENCY_LABEL,
        icon: TrendingUp,
        accentClass: "bg-lightsuccess text-success",
        // trend: "+12% vs mois dernier",
      },
      {
        label: "Sorties",
        value: formatAmount(resume.totalSorties),
        currency: CURRENCY_LABEL,
        icon: TrendingDown,
        accentClass: "bg-lighterror text-error",
        // trend: "+5% vs mois dernier",
      },
      {
        label: "Solde",
        value: formatAmount(resume.solde),
        currency: CURRENCY_LABEL,
        icon: Wallet,
        accentClass: "bg-lightprimary text-primary",
        trend: "Disponible",
      },
      {
        label: "Transactions",
        value: resume.nombreTransactions.toString(),
        icon: CreditCard,
        accentClass: "bg-lightinfo text-info",
        // trend: "Ce mois",
      },
    ];
  }, [resume]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="h-8 w-56 rounded-lg bg-muted animate-pulse" />
            <div className="h-4 w-72 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-10 w-40 rounded-xl bg-muted animate-pulse" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-tw bg-white dark:bg-darkgray shadow-md p-6 border border-border dark:border-darkborder space-y-4"
            >
              <div className="h-12 w-12 rounded-xl bg-muted animate-pulse" />
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-7 w-32 rounded bg-muted animate-pulse" />
              <div className="h-4 w-28 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-tw border border-lighterror bg-white dark:bg-darkgray shadow-md p-8 text-center max-w-xl mx-auto">
        <div className="mx-auto h-14 w-14 rounded-full bg-lighterror text-error flex items-center justify-center mb-4">
          <AlertCircle size={28} />
        </div>
        <h2 className="card-title">Erreur de chargement</h2>
        <p className="text-bodytext mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-white font-medium shadow-btnshdw"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-bb bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder overflow-hidden">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 p-6 lg:p-8">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-lightprimary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <Landmark size={14} />
              Vue financière
            </span>

            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-dark dark:text-white">
                Tableau de bord
              </h1>
              <p className="mt-2 flex items-center gap-2 text-sm text-bodytext capitalize">
                <Calendar size={14} />
                {new Date().toLocaleDateString("fr-FR", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            <p className="max-w-2xl text-bodytext leading-7">
              Suivez le solde de la paroisse, les dernières opérations et les priorités de gestion depuis un seul écran.
            </p>
          </div>

          <div className="rounded-tw bg-lightgray dark:bg-dark border border-border dark:border-darkborder p-5 flex flex-col justify-between gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bodytext">
                Résumé rapide
              </p>
              <p className="mt-2 text-2xl font-bold text-dark dark:text-white">
                {resume ? formatMoney(resume.solde) : formatMoney(0)}
              </p>
              <p className="mt-1 text-sm text-bodytext">
                Solde actuel disponible pour les activités pastorales.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Link
                href="/dashboard/transactions"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white shadow-btnshdw"
              >
                <ReceiptText size={16} />
                Voir les transactions
              </Link>
              <Link
                href="/dashboard/rapports"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border dark:border-darkborder px-4 py-3 text-sm font-medium text-link dark:text-white"
              >
                <BarChart3 size={16} />
                Voir les rapports
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              key={stat.label}
              className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-bodytext">{stat.label}</p>
                  <p className="mt-2 text-2xl font-bold text-dark dark:text-white">{stat.value}</p>
                  {"currency" in stat ? (
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-bodytext">
                      {stat.currency}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs font-medium text-bodytext">{stat.trend}</p>
                </div>
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${stat.accentClass}`}>
                  <Icon size={22} />
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid xl:grid-cols-[1.5fr_1fr] gap-6">
        <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="card-title">Dernières transactions</h2>
              <p className="card-subtitle">Les cinq mouvements les plus récents enregistrés.</p>
            </div>
            <Link href="/dashboard/transactions" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              Voir tout
              <ChevronRight size={16} />
            </Link>
          </div>

          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="rounded-xl bg-lightgray dark:bg-dark p-5 text-sm text-bodytext text-center">
                Aucune transaction récente.
              </div>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border dark:border-darkborder p-4 hover:bg-lightgray/60 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${tx.type === "ENTREE" ? "bg-lightsuccess text-success" : "bg-lighterror text-error"
                        }`}
                    >
                      {tx.type === "ENTREE" ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold text-dark dark:text-white truncate">
                        {tx.description || "Sans description"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-bodytext">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} />
                          {formatDate(tx.dateOperation)}
                        </span>
                        {tx.categorieNom ? <span>Categorie : {tx.categorieNom}</span> : null}
                      </div>
                    </div>
                  </div>

                  <p className={`text-sm md:text-base font-bold flex-shrink-0 ${tx.type === "ENTREE" ? "text-success" : "text-error"}`}>
                    {tx.type === "ENTREE" ? "+" : "-"} {formatMoney(tx.montant)}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <div className="space-y-6">
          {/* <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="card-title">Priorités</h2>
                <p className="card-subtitle">Actions de pilotage à suivre cette semaine.</p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-link dark:text-white/80">
                3 actions
              </span>
            </div>

            <div className="space-y-4">
              {[
                {
                  tone: "bg-error",
                  title: "Vérifier les catégories inactives",
                  meta: "En retard • 2 catégories",
                },
                {
                  tone: "bg-warning",
                  title: "Publier le rapport mensuel",
                  meta: "À faire • échéance demain",
                },
                {
                  tone: "bg-success",
                  title: "Transactions sans justificatif",
                  meta: "5 transactions en attente",
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 rounded-xl bg-lightgray dark:bg-dark p-4">
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0 ${item.tone}`} />
                  <div>
                    <p className="font-semibold text-dark dark:text-white">{item.title}</p>
                    <p className="text-sm text-bodytext mt-1">{item.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </article> */}

          <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-6">
            <div className="mb-6">
              <h2 className="card-title">Actions rapides</h2>
              <p className="card-subtitle">Raccourcis vers les modules principaux.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {[
                {
                  href: "/dashboard/evenements",
                  label: "Gérer les événements",
                  icon: Calendar,
                },
                {
                  href: "/dashboard/categories",
                  label: "Voir les catégories",
                  icon: FolderTree,
                },
                {
                  href: "/dashboard/transactions",
                  label: "Consulter les transactions",
                  icon: CreditCard,
                },
                {
                  href: "/dashboard/rapports",
                  label: "Consulter les rapports",
                  icon: BarChart3,
                },
              ].map((action) => {
                const ActionIcon = action.icon;

                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="rounded-xl border border-border dark:border-darkborder p-4 hover:bg-lightgray dark:hover:bg-dark transition-colors"
                  >
                    <div className="h-11 w-11 rounded-xl bg-lightprimary text-primary flex items-center justify-center mb-3">
                      <ActionIcon size={20} />
                    </div>
                    <p className="font-semibold text-dark dark:text-white leading-6">
                      {action.label}
                    </p>
                  </Link>
                );
              })}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
