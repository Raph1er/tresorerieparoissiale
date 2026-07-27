"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApiError, fetchWithAuth } from "@/lib/api-client";
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Package,
  Pencil,
  Plus,
  Search,
  Trash,
  User,
} from "lucide-react";
import { getParoisseReportHeaderLines } from "@/lib/paroisse-config";

interface CahierDetail {
  id: number;
  nom: string;
  prefixeCode: string;
  description: string | null;
  actif: boolean;
  evenementNom: string | null;
  nombreEnregistrements: number;
  totalMontant: number;
}

interface EnregistrementListItem {
  id: number;
  code: string;
  nomPersonne: string;
  note: string | null;
  montant: number;
  dateHeure: string;
}

interface EnregistrementFormState {
  nomPersonne: string;
  note: string;
  montant: string;
}

interface StatistiquesCahier {
  nombreEnregistrements: number;
  totalMontant: number;
  moyenneMontant: number;
  montantMax: number;
  montantMin: number;
}

function formatMontant(montant: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
  }).format(montant);
}

function formatDateHeure(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTimeForPdf(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

async function fetchAllEnregistrementsCahier(cahierId: number, search?: string) {
  const allItems: EnregistrementListItem[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const params = new URLSearchParams({
      page: String(page),
      limit: "100",
      orderBy: "dateHeure",
      order: "desc",
    });
    if (search?.trim()) {
      params.set("search", search.trim());
    }

    const response = await fetchWithAuth<{
      data: EnregistrementListItem[];
      page: number;
      totalPages: number;
    }>(`/api/paudium/${cahierId}/enregistrements?${params.toString()}`);

    allItems.push(...response.data);
    totalPages = response.totalPages;
    page += 1;
  } while (page <= totalPages);

  return allItems;
}

async function construirePdfRapport(cahier: CahierDetail, enregistrements: EnregistrementListItem[]) {
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
    ...getParoisseReportHeaderLines(),
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
  doc.text("RAPPORT DU CAHIER", pageWidth / 2, cursorY, { align: "center" });

  cursorY += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Cahier: ${cahier.nom}`, 12, cursorY);
  doc.text(`Généré le : ${new Date().toLocaleString("fr-FR")}`, pageWidth - 12, cursorY, {
    align: "right",
  });

  cursorY += 6;
  doc.text(`Description : ${cahier.description || "-"}`, 12, cursorY);
  if (cahier.evenementNom) {
    cursorY += 5;
    doc.text(`Événement : ${cahier.evenementNom}`, 12, cursorY);
  }

  cursorY += 8;
  const tableBody = enregistrements.map((row, index) => [
    String(index + 1),
    row.code,
    row.nomPersonne,
    row.note || "-",
    formatMoneyForPdf(row.montant),
    formatDateTimeForPdf(row.dateHeure),
  ]);

  const tableWidth = 10 + 25 + 70 + 60 + 30 + 40;
  const horizontalMargin = Math.max(8, (pageWidth - tableWidth) / 2);

  autoTable(doc, {
    startY: cursorY,
    head: [["#", "Code", "Désignation", "Note", "Montant", "Date & Heure"]],
    body: tableBody,
    margin: { left: horizontalMargin, right: horizontalMargin, bottom: 18 },
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
      1: { cellWidth: 25 },
      2: { cellWidth: 70 },
      3: { cellWidth: 60 },
      4: { cellWidth: 30, halign: "right" },
      5: { cellWidth: 40 },
    },
  });

  const totalMontant = enregistrements.reduce((sum, row) => sum + row.montant, 0);
  const autoTableState = doc as unknown as { lastAutoTable?: { finalY: number } };
  let finalY = autoTableState.lastAutoTable?.finalY ?? 170;
  const espaceNecessaire = 20;
  if (finalY + espaceNecessaire > pageHeight - 18) {
    doc.addPage();
    finalY = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Total du cahier : ${formatMoneyForPdf(totalMontant)}`, 12, finalY + 8);

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Page ${page} / ${totalPages}`, pageWidth - 12, pageHeight - 6, { align: "right" });
  }

  const fileName = `rapport-cahier-${cahier.nom.replace(/\s+/g, "-").toLowerCase()}.pdf`;
  const dataUri = doc.output("datauristring") as string;
  return { dataUri, fileName };
}

async function telechargerRapportCahier(
  cahier: CahierDetail | null,
  searchTerm: string,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
  setDownloadLoading: React.Dispatch<React.SetStateAction<boolean>>
) {
  if (!cahier) return;

  setDownloadLoading(true);
  setError(null);

  try {
    const itemsForReport = await fetchAllEnregistrementsCahier(cahier.id, searchTerm);
    if (itemsForReport.length === 0) {
      setError("Aucun enregistrement disponible pour générer le rapport.");
      return;
    }
    const { dataUri, fileName } = await construirePdfRapport(cahier, itemsForReport);
    const anchor = document.createElement("a");
    anchor.href = dataUri;
    anchor.download = fileName;
    anchor.click();
  } catch (err) {
    setError(err instanceof Error ? err.message : "Téléchargement du rapport impossible");
  } finally {
    setDownloadLoading(false);
  }
}

export default function CahierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cahierId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cahier, setCahier] = useState<CahierDetail | null>(null);
  const [stats, setStats] = useState<StatistiquesCahier | null>(null);
  const [items, setItems] = useState<EnregistrementListItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [mutationLoading, setMutationLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<EnregistrementFormState>({
    nomPersonne: "",
    note: "",
    montant: "",
  });

  async function chargerCahier(): Promise<void> {
    try {
      const response = await fetchWithAuth<CahierDetail>(`/api/paudium/${cahierId}`);
      setCahier(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement impossible");
    }
  }

  async function chargerStatistiques(): Promise<void> {
    try {
      const response = await fetchWithAuth<StatistiquesCahier>(
        `/api/paudium/${cahierId}/statistiques`
      );
      setStats(response);
    } catch {
      // Les stats sont optionnelles
    }
  }

  async function chargerEnregistrements(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (searchTerm.trim().length > 0) {
        params.set("search", searchTerm.trim());
      }

      const response = await fetchWithAuth<any>(
        `/api/paudium/${cahierId}/enregistrements?${params.toString()}`
      );

      setItems(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages || 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (cahierId) {
      chargerCahier();
      chargerStatistiques();
    }
  }, [cahierId]);

  useEffect(() => {
    if (cahierId) {
      chargerEnregistrements();
    }
  }, [cahierId, page, limit, searchTerm]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearchTerm(searchInput);
  }

  function openCreateModal() {
    setEditingId(null);
    setForm({
      nomPersonne: "",
      note: "",
      montant: "",
    });
    setError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  }

  function openEditModal(enreg: EnregistrementListItem) {
    setEditingId(enreg.id);
    setForm({
      nomPersonne: enreg.nomPersonne,
      note: enreg.note || "",
      montant: String(enreg.montant),
    });
    setError(null);
    setSuccessMessage(null);
    setIsModalOpen(true);
  }

  async function handleDelete(enreg: EnregistrementListItem): Promise<void> {
    const confirmed = window.confirm(
      `Confirmer la suppression de l'enregistrement "${enreg.code}" ?`
    );
    if (!confirmed) return;

    setMutationLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await fetchWithAuth(`/api/paudium/${cahierId}/enregistrements/${enreg.id}`, {
        method: "DELETE",
      });

      setSuccessMessage(`Enregistrement "${enreg.code}" supprimé.`);
      await Promise.all([chargerEnregistrements(), chargerStatistiques()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Suppression impossible");
    } finally {
      setMutationLoading(false);
    }
  }

  async function handleSubmitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMutationLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (!form.nomPersonne.trim()) {
      setMutationLoading(false);
      setError("Le nom est requis.");
      return;
    }

    const montantNum = parseFloat(form.montant);
    if (isNaN(montantNum) || montantNum <= 0) {
      setMutationLoading(false);
      setError("Le montant doit être un nombre positif.");
      return;
    }

    try {
      const payload = {
        nomPersonne: form.nomPersonne.trim(),
        note: form.note.trim() || undefined,
        montant: montantNum,
      };

      if (editingId) {
        await fetchWithAuth(`/api/paudium/${cahierId}/enregistrements/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Enregistrement mis à jour.");
      } else {
        await fetchWithAuth(`/api/paudium/${cahierId}/enregistrements`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccessMessage("Enregistrement créé avec succès.");
      }

      setIsModalOpen(false);
      await Promise.all([chargerEnregistrements(), chargerStatistiques(), chargerCahier()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible");
    } finally {
      setMutationLoading(false);
    }
  }

  if (!cahier && !loading) {
    return (
      <section className="p-8">
        <p className="text-bodytext">Cahier introuvable.</p>
        <Link href="/dashboard/paudium" className="text-primary mt-4 inline-block">
          Retour à la liste
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="rounded-bb bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/dashboard/paudium"
              className="inline-flex items-center gap-2 text-sm text-bodytext hover:text-primary mb-2"
            >
              <ArrowLeft size={16} />
              Retour aux cahiers
            </Link>
            <h1 className="text-3xl font-bold text-dark dark:text-white">
              {cahier?.nom || "Chargement..."}
            </h1>
            <p className="mt-2 text-bodytext">
              {cahier?.description || "Aucune description"}
            </p>
            {cahier?.evenementNom && (
              <p className="mt-1 text-sm text-primary">Événement : {cahier.evenementNom}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => telechargerRapportCahier(cahier, searchTerm, setError, setDownloadLoading)}
              disabled={downloadLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-gray-50 disabled:opacity-50 dark:bg-darkgray dark:text-white dark:hover:bg-darkgray/90"
            >
              <Download size={15} />
              {downloadLoading ? "Téléchargement..." : "Télécharger le rapport"}
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus size={15} />
              Nouvel enregistrement
            </button>
          </div>
        </div>
      </header>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
            <p className="text-sm text-bodytext">Enregistrements</p>
            <p className="mt-2 text-2xl font-bold text-dark dark:text-white">
              {stats.nombreEnregistrements}
            </p>
          </article>
          <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
            <p className="text-sm text-bodytext">Total collecté</p>
            <p className="mt-2 text-2xl font-bold text-success">
              {formatMontant(stats.totalMontant)}
            </p>
          </article>
          <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
            <p className="text-sm text-bodytext">Moyenne</p>
            <p className="mt-2 text-2xl font-bold text-primary">
              {formatMontant(stats.moyenneMontant)}
            </p>
          </article>
          <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
            <p className="text-sm text-bodytext">Max</p>
            <p className="mt-2 text-2xl font-bold text-warning">
              {formatMontant(stats.montantMax)}
            </p>
          </article>
          <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5">
            <p className="text-sm text-bodytext">Min</p>
            <p className="mt-2 text-2xl font-bold text-error">
              {formatMontant(stats.montantMin)}
            </p>
          </article>
        </div>
      )}

      <article className="rounded-tw bg-white dark:bg-darkgray shadow-md border border-border dark:border-darkborder p-5 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[260px]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-bodytext" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Rechercher par nom ou code"
                className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent py-2.5 pl-9 pr-3 text-sm text-dark dark:text-white"
              />
            </div>
          </form>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus size={15} />
            Nouvel enregistrement
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
                <th className="py-3 pr-3 font-semibold">Code</th>
                <th className="py-3 px-3 font-semibold">Désignation</th>
                <th className="py-3 px-3 font-semibold">Note</th>
                <th className="py-3 px-3 font-semibold">Montant</th>
                <th className="py-3 px-3 font-semibold">Date & Heure</th>
                <th className="py-3 pl-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-bodytext">
                    Chargement des enregistrements...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-bodytext">
                    Aucun enregistrement trouvé.
                  </td>
                </tr>
              ) : (
                items.map((enreg) => (
                  <tr
                    key={enreg.id}
                    className="border-b border-border/60 dark:border-darkborder/60 hover:bg-lightgray/50"
                  >
                    <td className="py-3 pr-3 align-top">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-lightprimary px-2 py-1 text-xs font-semibold text-primary">
                        <FileText size={12} />
                        {enreg.code}
                      </span>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="flex items-center gap-2">
                        <Package size={14} className="text-bodytext" />  {/* ou l'icône de votre choix */}
                        <span className="font-semibold text-dark dark:text-white">
                          {enreg.nomPersonne}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top text-bodytext max-w-[200px]">
                      {enreg.note || "—"}
                    </td>
                    <td className="py-3 px-3 align-top">
                      <span className="font-semibold text-success">
                        {formatMontant(enreg.montant)}
                      </span>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="flex items-center gap-1 text-bodytext text-xs">
                        <Clock size={12} />
                        {formatDateHeure(enreg.dateHeure)}
                      </div>
                    </td>
                    <td className="py-3 pl-3 align-top">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(enreg)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border dark:border-darkborder px-2.5 py-1.5 text-xs font-medium text-link dark:text-white"
                        >
                          <Pencil size={13} />
                          Modifier
                        </button>
                        <button
                          type="button"
                          disabled={mutationLoading}
                          onClick={() => handleDelete(enreg)}
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
          <p className="text-sm text-bodytext">
            {loading ? "Chargement..." : `Page ${page} sur ${Math.max(1, totalPages)}`}
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

      {isModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-darkgray border border-border dark:border-darkborder shadow-xl">
            <div className="border-b border-border dark:border-darkborder px-5 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dark dark:text-white">
                {editingId ? "Modifier l'enregistrement" : "Nouvel enregistrement"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-sm text-bodytext hover:text-dark dark:hover:text-white"
              >
                Fermer
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm text-bodytext space-y-1">
                  <span>Désignation du produit</span>
                  <input
                    value={form.nomPersonne}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, nomPersonne: event.target.value }))
                    }
                    required
                    placeholder="Ex: Pannier de fruit"
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  />
                </label>

                <label className="text-sm text-bodytext space-y-1">
                  <span>Montant (FCFA)</span>
                  <input
                    type="number"
                    value={form.montant}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, montant: event.target.value }))
                    }
                    required
                    min="1"
                    step="1"
                    placeholder="15000"
                    className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                  />
                </label>
              </div>

              <label className="text-sm text-bodytext space-y-1 block">
                <span>Note (optionnelle)</span>
                <textarea
                  value={form.note}
                  onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  rows={3}
                  placeholder="Ex: Achat de 3 pagnes"
                  className="w-full rounded-xl border border-border dark:border-darkborder bg-transparent px-3 py-2 text-sm text-dark dark:text-white"
                />
              </label>

              {!editingId && (
                <p className="text-xs text-bodytext bg-lightprimary/30 rounded-lg p-3">
                  💡 Le code sera généré automatiquement (ex: {cahier?.prefixeCode}-0001)
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-border dark:border-darkborder px-4 py-2 text-sm text-link dark:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={mutationLoading}
                  className="rounded-xl bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {mutationLoading ? "Enregistrement..." : editingId ? "Mettre à jour" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}