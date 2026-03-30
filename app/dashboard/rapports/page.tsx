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
  Mail,
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
  } | null;
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

interface EnvoyerRapportEmailResponse {
  message: string;
  destinataire: string;
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

function formatDateOnly(value: string): string {
  return parseDateForDisplay(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMoneyForPdf(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${abs} XOF`;
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

  const [sendingEmail, setSendingEmail] = useState(false);
  // Message de confirmation visible apres un envoi email reussi
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Construit le PDF une seule fois pour reutiliser la meme logique:
  // 1) telechargement local
  // 2) envoi par email
  async function construirePdfRapport(): Promise<{ dataUri: string; fileName: string }> {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const headerLines = [
      "EGLISE DU CHRISTIANISME CELESTE",
      "SAINT SIEGE DE PORTO-NOVO",
      "DIOCESE DU BENIN",
      "REGION MONO",
      "SOUS-REGION LOKOSSA",
      "PAROISSE SAINT MICHEL DE LOKOSSA CENTRE",
      "BP : 202 LOKOSSA",
      "Trésorerie Paroissiale",
    ];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    let cursorY = 12;
    for (const line of headerLines) {
      doc.text(line, pageWidth / 2, cursorY, { align: "center" });
      cursorY += 5;
    }

    cursorY += 2;
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.5);
    doc.line(12, cursorY, pageWidth - 12, cursorY);

    cursorY += 8;
    doc.setFontSize(14);
    doc.text("RAPPORT DES TRANSACTIONS", pageWidth / 2, cursorY, { align: "center" });

    cursorY += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Période: ${formatDateOnly(isoFromDateInput(dateDebut))} au ${formatDateOnly(isoFromDateInput(dateFin, true))}`,
      12,
      cursorY
    );
    doc.text(`Généré le: ${new Date().toLocaleString("fr-FR")}`, pageWidth - 12, cursorY, {
      align: "right",
    });

    cursorY += 6;
    const filtres = [
      `Type: ${typeFilter === "ALL" ? "Tous" : typeFilter}`,
      `Catégorie: ${categorieId ? categories.find((c) => String(c.id) === categorieId)?.nom ?? "-" : "Toutes"
      }`,
      `Évènement: ${evenementId ? evenements.find((e) => String(e.id) === evenementId)?.nom ?? "-" : "Tous"
      }`,
      `Recherche: ${search.trim() ? search.trim() : "-"}`,
    ];
    doc.text(filtres.join(" | "), 12, cursorY);

    const tableBody = rows.map((row, index) => [
      String(index + 1),
      formatDate(row.dateOperation),
      row.type,
      row.description || "Sans description",
      row.categorie?.nom || "-",
      row.evenement?.nom || "-",
      row.modePaiement || "-",
      formatMoneyForPdf(row.montant),
    ]);

    autoTable(doc, {
      startY: cursorY + 4,
      head: [["#", "Date", "Type", "Description", "Catégorie", "Évènement", "Mode paiement", "Montant"]],
      body: tableBody,
      margin: { left: 8, right: 8, bottom: 18 },
      styles: {
        fontSize: 8,
        lineColor: [150, 150, 150],
        lineWidth: 0.2,
        cellPadding: 1.8,
        valign: "middle",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [30, 64, 175],
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: { textColor: [30, 30, 30] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 34 },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 86 },
        4: { cellWidth: 38 },
        5: { cellWidth: 38 },
        6: { cellWidth: 30 },
        7: { cellWidth: 27, halign: "right" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const value = String(data.cell.raw);
          if (value === "ENTREE") data.cell.styles.textColor = [22, 163, 74];
          if (value === "SORTIE") data.cell.styles.textColor = [220, 38, 38];
        }
        if (data.section === "body" && data.column.index === 7) {
          data.cell.styles.halign = "right";
        }
      },
    });

    const autoTableState = doc as unknown as { lastAutoTable?: { finalY: number } };
    doc.setPage(doc.getNumberOfPages());
    let finalY = autoTableState.lastAutoTable?.finalY ?? 170;
    const espaceNecessaire = 30;
    if (finalY + espaceNecessaire > pageHeight - 10) {
      doc.addPage();
      finalY = 20;
    }

    const totalEntreesTexte = formatMoneyForPdf(totals.totalEntrees);
    const totalSortiesTexte = formatMoneyForPdf(totals.totalSorties);
    const soldeTexte = formatMoneyForPdf(totals.solde);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text(`Total Entrées: ${totalEntreesTexte}`, 12, finalY + 8);
    doc.text(`Total Sorties: ${totalSortiesTexte}`, 110, finalY + 8);
    doc.text(`Solde: ${soldeTexte}`, 208, finalY + 8);

    const visaY = pageHeight - 14;
    const leftLineStart = 20;
    const leftLineEnd = 100;
    const rightLineStart = pageWidth - 100;
    const rightLineEnd = pageWidth - 20;
    doc.setDrawColor(70, 70, 70);
    doc.setLineWidth(0.3);
    doc.line(leftLineStart, visaY - 6, leftLineEnd, visaY - 6);
    doc.line(rightLineStart, visaY - 6, rightLineEnd, visaY - 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Visa du Trésorier Général", (leftLineStart + leftLineEnd) / 2, visaY, { align: "center" });
    doc.text("Visa du Chargé Paroissial", (rightLineStart + rightLineEnd) / 2, visaY, {
      align: "center",
    });

    const nombrePagesFinal = doc.getNumberOfPages();
    for (let page = 1; page <= nombrePagesFinal; page += 1) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(`Page ${page} / ${nombrePagesFinal}`, pageWidth - 8, pageHeight - 6, { align: "right" });
    }

    const fileName = `rapport-transactions-${dateDebut}-au-${dateFin}.pdf`;

    // datauristring = data:application/pdf;filename=generated.pdf;base64,XXXXX
    const dataUri = doc.output("datauristring") as string;
    return { dataUri, fileName };
  }

  async function exporterPdfRapport() {
    if (!hasGenerated || rows.length === 0) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    try {
      const { dataUri, fileName } = await construirePdfRapport();

      // Telechargement local a partir du data URI
      const anchor = document.createElement("a");
      anchor.href = dataUri;
      anchor.download = fileName;
      anchor.click();
    } catch {
      setError("Export PDF impossible pour le moment.");
    }
  }

  async function envoyerRapportParEmail() {
    if (!hasGenerated || rows.length === 0) {
      return;
    }

    setSendingEmail(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { dataUri, fileName } = await construirePdfRapport();

      // Extrait uniquement la partie base64 apres la virgule
      const pdfBase64 = dataUri.split(",")[1] ?? "";
      if (!pdfBase64) {
        throw new Error("PDF base64 vide");
      }

      const response = await fetchWithAuth<EnvoyerRapportEmailResponse>("/api/rapports", {
        method: "POST",
        body: JSON.stringify({
          fileName,
          pdfBase64,
        }),
      });

      setSuccessMessage(`${response.message} à ${response.destinataire}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Envoi email impossible pour le moment.");
    } finally {
      setSendingEmail(false);
    }
  }

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
                setSuccessMessage(null);
              }}
              className="rounded-xl border border-border dark:border-darkborder px-4 py-2 text-sm text-link dark:text-white"
            >
              Réinitialiser
            </button>

            <button
              type="button"
              disabled={!hasGenerated || rows.length === 0}
              onClick={exporterPdfRapport}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Exporter le rapport en PDF"
            >
              <FileText size={14} />
              Télécharger le PDF
            </button>


            <button
              type="button"
              disabled={!hasGenerated || rows.length === 0 || sendingEmail}
              onClick={envoyerRapportParEmail}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Envoyer le rapport PDF par email"
            >
              <Mail size={14} />
              {sendingEmail ? "Envoi en cours..." : "Envoyer par mail"}
            </button>
          </div>
        </form>

        {error ? (
          <div className="rounded-xl bg-lighterror border border-lighterror p-4 text-error text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-xl bg-lightsuccess border border-lightsuccess p-4 text-success text-sm">
            <span>{successMessage}</span>
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
                    <th className="py-3 px-3 font-semibold border-r border-border dark:border-darkborder">Date</th>
                    <th className="py-3 px-3 font-semibold border-r border-border dark:border-darkborder">Type</th>
                    <th className="py-3 px-3 font-semibold border-r border-border dark:border-darkborder">Description</th>
                    <th className="py-3 px-3 font-semibold border-r border-border dark:border-darkborder">Catégorie</th>
                    <th className="py-3 px-3 font-semibold border-r border-border dark:border-darkborder">Évènement</th>
                    {/* <th className="py-3 px-3 font-semibold">Utilisateur</th> */}
                    <th className="py-3 px-3 font-semibold border-r border-border dark:border-darkborder">Mode paiement</th>
                    <th className="py-3 px-3 text-right font-semibold">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-bodytext border-r border-border/60 dark:border-darkborder/60">
                        Aucune transaction pour ces filtres.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="border-b border-border/60 dark:border-darkborder/60">
                        <td className="py-3 px-3 text-bodytext border-r border-border/60 dark:border-darkborder/60">{formatDate(row.dateOperation)}</td>
                        <td className="py-3 px-3 border-r border-border/60 dark:border-darkborder/60">
                          <span
                            className={`inline-flex rounded-lg px-2 py-1 text-xs font-semibold ${row.type === "ENTREE" ? "bg-lightsuccess text-success" : "bg-lighterror text-error"
                              }`}
                          >
                            {row.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-dark dark:text-white max-w-[260px] truncate border-r border-border/60 dark:border-darkborder/60" title={row.description || "Sans description"}>
                          {row.description || "Sans description"}
                        </td>
                        <td className="py-3 px-3 text-bodytext border-r border-border/60 dark:border-darkborder/60">{row.categorie?.nom || "-"}</td>
                        <td className="py-3 px-3 text-bodytext border-r border-border/60 dark:border-darkborder/60">{row.evenement?.nom || "-"}</td>
                        {/* <td className="py-3 px-3 text-bodytext">{row.utilisateur?.nom || "-"}</td> */}
                        <td className="py-3 px-3 text-bodytext border-r border-border/60 dark:border-darkborder/60">{row.modePaiement || "-"}</td>
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
