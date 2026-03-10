"use client";

import { useEffect, useState } from "react";
import { ApiError, fetchWithAuth } from "@/lib/api-client";

interface Repartition {
  id: number;
  totalDime: number;
  partParoisseMere: number;
  partResponsable: number;
  partLevites: number;
}

interface DimesResponse {
  data: Repartition[];
  pagination: {
    total: number;
  };
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(value));
}

export default function DashboardDimesPage() {
  const [data, setData] = useState<DimesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWithAuth<DimesResponse>("/api/dimes?page=1&limit=8")
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible")
      );
  }, []);

  return (
    <section className="module-page">
      <h2>Module Dimes</h2>
      <p>Repartition automatique et suivi des dimes.</p>
      <p className="module-meta">Total: {data?.pagination?.total ?? 0}</p>
      {error ? <p className="error-text">{error}</p> : null}
      <ul className="simple-list">
        {(data?.data ?? []).map((d) => (
          <li key={d.id}>
            Total {formatMoney(d.totalDime)} FCFA - Paroisse {formatMoney(d.partParoisseMere)} - Responsable {formatMoney(d.partResponsable)} - Levites {formatMoney(d.partLevites)}
          </li>
        ))}
      </ul>
    </section>
  );
}
