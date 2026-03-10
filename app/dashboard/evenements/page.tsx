"use client";

import { useEffect, useState } from "react";
import { ApiError, fetchWithAuth } from "@/lib/api-client";

interface Evenement {
  id: number;
  nom: string;
  actif: boolean;
  dateDebut: string;
}

interface EvenementsResponse {
  data: Evenement[];
  total: number;
}

export default function DashboardEvenementsPage() {
  const [data, setData] = useState<EvenementsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWithAuth<EvenementsResponse>("/api/evenements?page=1&limit=8")
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible")
      );
  }, []);

  return (
    <section className="module-page">
      <h2>Module Evenements</h2>
      <p>Suivi des evenements et de leurs impacts financiers.</p>
      <p className="module-meta">Total: {data?.total ?? 0}</p>
      {error ? <p className="error-text">{error}</p> : null}
      <ul className="simple-list">
        {(data?.data ?? []).map((e) => (
          <li key={e.id}>
            {e.nom} - {e.actif ? "Actif" : "Inactif"} - {new Date(e.dateDebut).toLocaleDateString("fr-FR")}
          </li>
        ))}
      </ul>
    </section>
  );
}
