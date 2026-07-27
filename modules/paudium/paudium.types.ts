/**
 * Types et DTOs pour le module Paudium (Cahiers et Enregistrements).
 */

// ── Types de pagination (définis localement pour éviter les dépendances) ──────

/** Options de pagination pour les requêtes. */
export interface PaginationOptions {
  page: number;
  limit: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

/** Structure de réponse paginée générique. */
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  total: number;
  totalPages: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ── Cahiers ──────────────────────────────────────────────────────────────────

/** Données pour créer un nouveau cahier. */
export interface CreateCahierDTO {
  nom: string;
  prefixeCode: string; // Ex: "VNT", "BZR"
  description?: string;
  actif?: boolean;
  evenementId?: number;
}

/** Données pour mettre à jour un cahier. */
export interface UpdateCahierDTO {
  nom?: string;
  prefixeCode?: string;
  description?: string;
  actif?: boolean;
  evenementId?: number | null;
}

/** Réponse API pour un cahier. */
export interface CahierResponseDTO {
  id: number;
  nom: string;
  prefixeCode: string;
  description: string | null;
  actif: boolean;
  creeLe: Date;
  utilisateurId: number | null;
  evenementId: number | null;
  evenementNom?: string | null;
  nombreEnregistrements: number;
  totalMontant: number;
}

/** Filtres pour la liste des cahiers. */
export interface CahierFilter {
  search?: string;
  actif?: boolean;
  evenementId?: number;
}

// ── Enregistrements ──────────────────────────────────────────────────────────

/** Données pour créer un enregistrement (le code est généré automatiquement). */
export interface CreateEnregistrementDTO {
  cahierId: number;
  nomPersonne: string;
  note?: string;
  montant: number;
  dateHeure?: Date;
  utilisateurId?: number;
}

/** Données pour mettre à jour un enregistrement. */
export interface UpdateEnregistrementDTO {
  nomPersonne?: string;
  note?: string;
  montant?: number;
  dateHeure?: Date;
}

/** Réponse API pour un enregistrement. */
export interface EnregistrementResponseDTO {
  id: number;
  cahierId: number;
  code: string;
  nomPersonne: string;
  note: string | null;
  montant: number;
  dateHeure: Date;
  utilisateurId: number;
  creeLe: Date;
}

/** Filtres pour la liste des enregistrements. */
export interface EnregistrementFilter {
  search?: string; // Recherche par nom ou code
  dateDebut?: Date;
  dateFin?: Date;
}

// ── Statistiques ─────────────────────────────────────────────────────────────

/** Statistiques d'un cahier. */
export interface StatistiquesCahier {
  nombreEnregistrements: number;
  totalMontant: number;
  moyenneMontant: number;
  montantMax: number;
  montantMin: number;
}