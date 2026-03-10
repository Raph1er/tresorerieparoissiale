"use client";

import { useEffect, useState } from "react";
import { ApiError, fetchWithAuth } from "@/lib/api-client";

interface Categorie {
  id: number;
  nom: string;
  type: "ENTREE" | "SORTIE";
  actif: boolean;
}

interface CategoriesResponse {
  data: Categorie[];
  total: number;
}

export default function DashboardCategoriesPage() {
  const [data, setData] = useState<CategoriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWithAuth<CategoriesResponse>("/api/categories?page=1&limit=8")
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible")
      );
  }, []);

  return (
    <section className="module-page">
      <h2>Module Categories</h2>
      <p>Configuration des categories ENTREE et SORTIE.</p>
      <p className="module-meta">Total: {data?.total ?? 0}</p>
      {error ? <p className="error-text">{error}</p> : null}
      <ul className="simple-list">
        {(data?.data ?? []).map((c) => (
          <li key={c.id}>
            {c.nom} - {c.type} - {c.actif ? "Actif" : "Inactif"}
          </li>
        ))}
      </ul>
    </section>
  );
}
