"use client";

import { useEffect, useState } from "react";
import { ApiError, fetchWithAuth } from "@/lib/api-client";

interface RapportResponse {
  resume: {
    totalEntrees: number;
    totalSorties: number;
    solde: number;
    nombreTransactions: number;
  };
  evolutionMensuelle: {
    mois: string;
    totalEntrees: number;
    totalSorties: number;
    solde: number;
  }[];
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(value));
}

export default function DashboardRapportsPage() {
  const [data, setData] = useState<RapportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWithAuth<RapportResponse>("/api/rapports")
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible")
      );
  }, []);

  return (
    <section className="module-page">
      <h2>Module Rapports</h2>
      <p>Analyses, bilans, export et vision periodique.</p>
      {error ? <p className="error-text">{error}</p> : null}

      {data ? (
        <>
          <p className="module-meta">
            Entrees: {formatMoney(data.resume.totalEntrees)} FCFA | Sorties: {formatMoney(data.resume.totalSorties)} FCFA | Solde: {formatMoney(data.resume.solde)} FCFA
          </p>
          <ul className="simple-list">
            {data.evolutionMensuelle.slice(-6).map((m) => (
              <li key={m.mois}>
                {m.mois} - E {formatMoney(m.totalEntrees)} / S {formatMoney(m.totalSorties)} / Solde {formatMoney(m.solde)}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
