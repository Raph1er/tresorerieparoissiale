"use client";

import { useEffect, useState } from "react";
import { ApiError, fetchWithAuth } from "@/lib/api-client";

interface Utilisateur {
  id: number;
  nom: string;
  email: string;
  role: string;
  actif: boolean;
}

interface UtilisateursResponse {
  data: Utilisateur[];
  total: number;
}

export default function DashboardUtilisateursPage() {
  const [data, setData] = useState<UtilisateursResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWithAuth<UtilisateursResponse>("/api/utilisateurs?page=1&limit=8")
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible")
      );
  }, []);

  return (
    <section className="module-page">
      <h2>Module Utilisateurs</h2>
      <p>Gestion des comptes, roles et statuts des utilisateurs.</p>
      <p className="module-meta">Total: {data?.total ?? 0}</p>
      {error ? <p className="error-text">{error}</p> : null}
      <ul className="simple-list">
        {(data?.data ?? []).map((u) => (
          <li key={u.id}>
            {u.nom} - {u.role} - {u.actif ? "Actif" : "Inactif"}
          </li>
        ))}
      </ul>
    </section>
  );
}
