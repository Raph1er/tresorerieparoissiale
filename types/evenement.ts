/**
 * Types globaux du module Évènements.
 * Ces types sont utilisés par les routes API et validations.
 */

/**
 * Données nécessaires à la création d'un évènement.
 */
export interface CreateEvenementDTO {
  nom: string;
  description?: string;
  dateDebut: Date | string;
  dateFin?: Date | string | null;
}

/**
 * Données autorisées pour la mise à jour d'un évènement.
 */
export interface UpdateEvenementDTO {
  nom?: string;
  description?: string;
  dateDebut?: Date | string;
  dateFin?: Date | string | null;
  actif?: boolean;
}

/**
 * Structure de réponse d'un évènement.
 */
export interface EvenementResponseDTO {
  id: number;
  nom: string;
  description: string | null;
  dateDebut: Date;
  dateFin: Date | null;
  actif: boolean;
  creeLe: Date;
  transactionCount: number;
}

/**
 * Options de pagination standard.
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  orderBy?: 'nom' | 'dateDebut' | 'dateFin' | 'creeLe';
  order?: 'asc' | 'desc';
}

/**
 * Réponse paginée standard.
 */
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  total: number;
  totalPages: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Filtres disponibles pour la liste des évènements.
 */
export interface EvenementFilter {
  search?: string;
  actif?: boolean;
  dateDebutDe?: Date | string;
  dateDebutJusqua?: Date | string;
  enCours?: boolean;
}
