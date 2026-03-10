"use client";

import { useEffect, useState } from "react";
import { ApiError, fetchWithAuth } from "@/lib/api-client";

interface Transaction {
  id: number;
  type: "ENTREE" | "SORTIE";
  montant: number;
  description: string | null;
}

interface TransactionsResponse {
  data: Transaction[];
  pagination: {
    total: number;
  };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(value));
}

export default function DashboardTransactionsPage() {
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWithAuth<TransactionsResponse>("/api/transactions?page=1&limit=10")
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible")
      );
  }, []);

  return (
    <section className="module-page">
      <h2>Module Transactions</h2>
      <p>Controle des entrees, sorties, filtres et justificatifs.</p>
      <p className="module-meta">Total: {data?.pagination?.total ?? 0}</p>
      {error ? <p className="error-text">{error}</p> : null}
      <ul className="simple-list">
        {(data?.data ?? []).map((t) => (
          <li key={t.id}>
            {t.type} - {formatMoney(t.montant)} FCFA - {t.description || "Sans description"}
          </li>
        ))}
      </ul>
    </section>
  );
}
