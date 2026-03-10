"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";  // ← Un seul import Link
import { ApiError, fetchWithAuth } from "@/lib/api-client";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Clock,
  Calendar,
  BarChart3,    // ← Ajouté
  FolderTree,   // ← Ajouté
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
  date: string;
  categorie?: string;
}

interface TransactionsResponse {
  data: TransactionItem[];
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
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
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [rapport, tx] = await Promise.all([
          fetchWithAuth<RapportResponse>("/api/rapports"),
          fetchWithAuth<TransactionsResponse>("/api/transactions?page=1&limit=5"),
        ]);

        if (!mounted) return;

        setResume(rapport.resume);
        setTransactions(tx.data ?? []);
      } catch (err) {
        if (!mounted) return;

        const message =
          err instanceof ApiError ? err.message : "Chargement des données impossible";
        setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => { mounted = false; };
  }, []);

  const stats = useMemo(() => {
    if (!resume) return [];

    return [
      {
        label: "Entrées",
        value: formatMoney(resume.totalEntrees),
        icon: TrendingUp,
        color: "success",
        trend: "+12% vs mois dernier",
      },
      {
        label: "Sorties",
        value: formatMoney(resume.totalSorties),
        icon: TrendingDown,
        color: "danger",
        trend: "+5% vs mois dernier",
      },
      {
        label: "Solde",
        value: formatMoney(resume.solde),
        icon: Wallet,
        color: "primary",
        trend: "Disponible",
      },
      {
        label: "Transactions",
        value: resume.nombreTransactions.toString(),
        icon: CreditCard,
        color: "info",
        trend: "Ce mois",
      },
    ];
  }, [resume]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Chargement du tableau de bord...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <AlertCircle size={48} />
        <h3>Erreur de chargement</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="btn-primary">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">
            <Calendar size={14} />
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="header-actions">
          <Link href="/dashboard/rapports" className="btn-secondary">
            <BarChart3 size={18} />
            Voir les rapports
          </Link>
          <Link href="/dashboard/transactions/ajouter" className="btn-primary">
            <CreditCard size={18} />
            Nouvelle transaction
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`stat-card ${stat.color}`}>
              <div className="stat-icon">
                <Icon size={24} />
              </div>
              <div className="stat-content">
                <p className="stat-label">{stat.label}</p>
                <p className="stat-value">{stat.value}</p>
                <p className="stat-trend">{stat.trend}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Recent Transactions */}
        <div className="dashboard-panel">
          <div className="panel-header">
            <h2>Dernières transactions</h2>
            <Link href="/dashboard/transactions" className="panel-link">
              Voir tout
              <ArrowUpRight size={16} />
            </Link>
          </div>

          <div className="transactions-list">
            {transactions.length === 0 ? (
              <p className="empty-state">Aucune transaction récente</p>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="transaction-item">
                  <div className={`transaction-type ${tx.type.toLowerCase()}`}>
                    {tx.type === "ENTREE" ? (
                      <ArrowUpRight size={16} />
                    ) : (
                      <ArrowDownRight size={16} />
                    )}
                  </div>
                  <div className="transaction-details">
                    <div>
                      <p className="transaction-description">
                        {tx.description || "Sans description"}
                      </p>
                      <p className="transaction-meta">
                        <Clock size={12} />
                        {formatDate(tx.date)}
                      </p>
                    </div>
                    <p className={`transaction-amount ${tx.type.toLowerCase()}`}>
                      {formatMoney(tx.montant)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Priorities & Quick Actions */}
        <div className="dashboard-panel">
          <div className="panel-header">
            <h2>Priorités</h2>
            <span className="badge">3 actions</span>
          </div>

          <div className="priorities-list">
            <div className="priority-item high">
              <div className="priority-indicator"></div>
              <div className="priority-content">
                <p className="priority-title">Vérifier les catégories inactives</p>
                <p className="priority-meta">En retard • 2 catégories</p>
              </div>
            </div>
            
            <div className="priority-item medium">
              <div className="priority-indicator"></div>
              <div className="priority-content">
                <p className="priority-title">Publier le rapport mensuel</p>
                <p className="priority-meta">À faire • Échéance demain</p>
              </div>
            </div>
            
            <div className="priority-item low">
              <div className="priority-indicator"></div>
              <div className="priority-content">
                <p className="priority-title">Transactions sans justificatif</p>
                <p className="priority-meta">5 transactions en attente</p>
              </div>
            </div>
          </div>

          <div className="quick-actions">
            <h3>Actions rapides</h3>
            <div className="actions-grid">
              <Link href="/dashboard/evenements/ajouter" className="quick-action">
                <Calendar size={20} />
                <span>Nouvel événement</span>
              </Link>
              <Link href="/dashboard/categories/ajouter" className="quick-action">
                <FolderTree size={20} />
                <span>Nouvelle catégorie</span>
              </Link>
              <Link href="/dashboard/rapports/generer" className="quick-action">
                <BarChart3 size={20} />
                <span>Générer rapport</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}