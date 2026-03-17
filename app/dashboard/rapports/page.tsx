"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, fetchWithAuth } from "@/lib/api-client";
import {
  AlertCircle,
  ArrowRight,
  FileSpreadsheet,
  FileText,
  Filter,
  Search,
} from "lucide-react";

function getTodayInputValue(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type TypeFilter = "ALL" | "ENTREE" | "SORTIE";

interface TransactionRow {
  id: number;
  type: "ENTREE" | "SORTIE";
  montant: number;
  description: string | null;
  dateOperation: string;
  modePaiement: string | null;
  categorie: {
    id: number;
    nom: string;
    type: "ENTREE" | "SORTIE";
  };
  evenement: {
    id: number;
    nom: string;
  } | null;
  utilisateur: {
    id: number;
    nom: string;
    email: string;
  };
}

interface TransactionsApiResponse {
  data: TransactionRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface OptionItem {
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

function parseDateForDisplay(value: string): Date {
  const midnightUtcPattern = /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/;

  if (midnightUtcPattern.test(value)) {
    const dateOnly = value.slice(0, 10);
    const [year, month, day] = dateOnly.split("-").map(Number);
    return new Date(year, month - 1, day, 0, 0, 0);
  }

  return new Date(value);
}

function formatDate(value: string): string {
  return parseDateForDisplay(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function isoFromDateInput(value: string, endOfDay = false): string {
  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  return `${value}${suffix}`;
}

export default function DashboardRapportsPage() {
  const today = getTodayInputValue();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const [dateDebut, setDateDebut] = useState(today);
  const [dateFin, setDateFin] = useState(today);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [categorieId, setCategorieId] = useState("");
  const [evenementId, setEvenementId] = useState("");
  const [search, setSearch] = useState("");

  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [evenements, setEvenements] = useState<OptionItem[]>([]);
  const [rows, setRows] = useState<TransactionRow[]>([]);

  useEffect(() => {
    fetchWithAuth<{ data: Array<{ id: number; nom: string }> }>(
      "/api/categories?page=1&limit=100&actif=true&orderBy=nom&order=asc"
    )
      .then((response) => {
        setCategories(response.data.map((item) => ({ id: item.id, nom: item.nom })));
      })
      .catch(() => setCategories([]));

    fetchWithAuth<{ data: Array<{ id: number; nom: string }> }>(
      "/api/evenements?page=1&limit=100&actif=true&orderBy=nom&order=asc"
    )
      .then((response) => {
        setEvenements(response.data.map((item) => ({ id: item.id, nom: item.nom })));
      })
      .catch(() => setEvenements([]));
  }, []);

  const totals = useMemo(() => {
    const totalEntrees = rows
      .filter((row) => row.type === "ENTREE")
      .reduce((acc, row) => acc + row.montant, 0);

    const totalSorties = rows
      .filter((row) => row.type === "SORTIE")
      .reduce((acc, row) => acc + row.montant, 0);

    return {
      totalEntrees,
      totalSorties,
      solde: totalEntrees - totalSorties,
    };
  }, [rows]);

  async function genererRapport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const paramsBase = new URLSearchParams();
      paramsBase.set("limit", "100");
      paramsBase.set("orderBy", "dateOperation");
      paramsBase.set("order", "asc");

      if (typeFilter !== "ALL") {
        paramsBase.set("type", typeFilter);
      }

      if (dateDebut) {
        paramsBase.set("dateOperationDe", isoFromDateInput(dateDebut));
      }

      if (dateFin) {
        paramsBase.set("dateOperationJusqua", isoFromDateInput(dateFin, true));
      }

      if (categorieId) {
        paramsBase.set("categorieId", categorieId);
      }

      if (evenementId) {
        paramsBase.set("evenementId", evenementId);
      }

      if (search.trim()) {
        paramsBase.set("search", search.trim());
      }

      const allRows: TransactionRow[] = [];
      let currentPage = 1;
      let totalPages = 1;

      // Récupère toutes les pages pour produire un vrai rapport de période.
      do {
        const pageParams = new URLSearchParams(paramsBase);
        pageParams.set("page", String(currentPage));

        const response = await fetchWithAuth<TransactionsApiResponse>(
          `/api/transactions?${pageParams.toString()}`
        );

        allRows.push(...response.data);
        totalPages = Math.max(1, response.pagination.totalPages);
        currentPage += 1;
      } while (currentPage <= totalPages);

      setRows(allRows);
      setHasGenerated(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Génération du rapport impossible");
      setRows([]);
      setHasGenerated(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="rounded-bb bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-bodytext font-semibold">
              Analyse financière
            </p>
            <h1 className="mt-2 text-3xl font-bold text-dark dark:text-white">Rapports</h1>
            <p className="mt-2 text-bodytext max-w-3xl">
              Sélectionnez vos filtres puis cliquez sur Générer le rapport. Le tableau
              affichera les transactions de la période avec les détails catégorie,
              évènement et les totaux finaux.
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
        <form onSubmit={genererRapport} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <label className="text-sm text-bodytext space-y-1 block">
              <span>Date début</span>
              <input
                type="date"
                value={dateDebut}
                onChange={(event) => setDateDebut(event.target.value)}
                max={today}
                className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
              />
            </label>

            <label className="text-sm text-bodytext space-y-1 block">
              <span>Date fin</span>
              <input
                type="date"
                value={dateFin}
                onChange={(event) => setDateFin(event.target.value)}
                max={today}
                className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
              />
            </label>

            <label className="text-sm text-bodytext space-y-1 block">
              <span>Type</span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
                className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
              >
                <option value="ALL">Tous</option>
                <option value="ENTREE">Entrées</option>
                <option value="SORTIE">Sorties</option>
              </select>
            </label>

            <label className="text-sm text-bodytext space-y-1 block">
              <span>Catégorie</span>
              <select
                value={categorieId}
                onChange={(event) => setCategorieId(event.target.value)}
                className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
              >
                <option value="">Toutes</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nom}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-bodytext space-y-1 block">
              <span>Évènement</span>
              <select
                value={evenementId}
                onChange={(event) => setEvenementId(event.target.value)}
                className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
              >
                <option value="">Tous</option>
                {evenements.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nom}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-bodytext space-y-1 block">
              <span>Recherche</span>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-bodytext" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Description..."
                  className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent pl-8 pr-3 py-2 text-sm text-dark dark:text-white"
                />
              </div>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Filter size={14} />
              {loading ? "Génération..." : "Générer le rapport"}
            </button>

            <button
              type="button"
              onClick={() => {
                setDateDebut(today);
                setDateFin(today);
                setTypeFilter("ALL");
                setCategorieId("");
                setEvenementId("");
                setSearch("");
                setRows([]);
                setHasGenerated(false);
                setError(null);
              }}
              className="rounded-xl border border-border dark:border-darkborder px-4 py-2 text-sm text-link dark:text-white"
            >
              Réinitialiser
            </button>

            <button
              type="button"
              disabled={!hasGenerated || rows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-border dark:border-darkborder px-4 py-2 text-sm text-link dark:text-white disabled:opacity-50"
              title="Export PDF: prochaine étape"
            >
              <FileText size={14} />
              Exporter PDF (étape suivante)
            </button>
          </div>
        </form>

        {error ? (
          <div className="rounded-xl bg-lighterror border border-lighterror p-4 text-error text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        {!hasGenerated ? (
          <div className="rounded-xl border border-border dark:border-darkborder p-8 text-center text-bodytext">
            <p className="font-medium">Aucun rapport généré pour le moment.</p>
            <p className="mt-2 text-sm">Choisissez vos filtres, puis cliquez sur Générer le rapport.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-border dark:border-darkborder">
              <table className="min-w-full text-sm">
                <thead className="bg-lightgray/60 dark:bg-dark">
                  <tr className="text-left text-bodytext border-b border-border dark:border-darkborder">
                    <th className="py-3 px-3 font-semibold">Date</th>
                    <th className="py-3 px-3 font-semibold">Type</th>
                    <th className="py-3 px-3 font-semibold">Description</th>
                    <th className="py-3 px-3 font-semibold">Catégorie</th>
                    <th className="py-3 px-3 font-semibold">Évènement</th>
                    {/* <th className="py-3 px-3 font-semibold">Utilisateur</th> */}
                    <th className="py-3 px-3 font-semibold">Mode paiement</th>
                    <th className="py-3 px-3 text-right font-semibold">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-bodytext">
                        Aucune transaction pour ces filtres.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="border-b border-border/60 dark:border-darkborder/60">
                        <td className="py-3 px-3 text-bodytext">{formatDate(row.dateOperation)}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex rounded-lg px-2 py-1 text-xs font-semibold ${
                              row.type === "ENTREE" ? "bg-lightsuccess text-success" : "bg-lighterror text-error"
                            }`}
                          >
                            {row.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-dark dark:text-white max-w-[260px] truncate" title={row.description || "Sans description"}>
                          {row.description || "Sans description"}
                        </td>
                        <td className="py-3 px-3 text-bodytext">{row.categorie?.nom || "-"}</td>
                        <td className="py-3 px-3 text-bodytext">{row.evenement?.nom || "-"}</td>
                        {/* <td className="py-3 px-3 text-bodytext">{row.utilisateur?.nom || "-"}</td> */}
                        <td className="py-3 px-3 text-bodytext">{row.modePaiement || "-"}</td>
                        <td className={`py-3 px-3 text-right font-semibold ${row.type === "ENTREE" ? "text-success" : "text-error"}`}>
                          {row.type === "ENTREE" ? "+" : "-"} {formatMoney(row.montant)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-border dark:border-darkborder p-4 bg-lightgray/40 dark:bg-dark">
              <div className="flex items-center gap-2 text-sm text-bodytext font-medium">
                <FileSpreadsheet size={15} />
                Totaux de la période sélectionnée
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg bg-white dark:bg-darkgray border border-border dark:border-darkborder p-3">
                  <p className="text-xs text-bodytext">Total Entrées</p>
                  <p className="mt-1 text-lg font-bold text-success">{formatMoney(totals.totalEntrees)}</p>
                </div>
                <div className="rounded-lg bg-white dark:bg-darkgray border border-border dark:border-darkborder p-3">
                  <p className="text-xs text-bodytext">Total Sorties</p>
                  <p className="mt-1 text-lg font-bold text-error">{formatMoney(totals.totalSorties)}</p>
                </div>
                <div className="rounded-lg bg-white dark:bg-darkgray border border-border dark:border-darkborder p-3">
                  <p className="text-xs text-bodytext">Reste en caisse (solde)</p>
                  <p className={`mt-1 text-lg font-bold ${totals.solde >= 0 ? "text-primary" : "text-error"}`}>
                    {formatMoney(totals.solde)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
