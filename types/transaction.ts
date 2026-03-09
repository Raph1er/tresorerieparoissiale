/**
 * Types globaux pour le module Transactions.
 * Définit les structures de données pour les opérations financières de la paroisse.
 */

import { TypeTransaction } from '@prisma/client';

/**
 * DTO pour créer une transaction.
 */
export interface CreateTransactionDTO {
  type: TypeTransaction;
  montant: number;
  description?: string;
  dateOperation: Date | string;
  modePaiement?: string;
  pieceJustificative?: string; // Chemin du fichier uploadé
  categorieId: number;
  evenementId?: number;
}

/**
 * DTO pour mettre à jour une transaction.
 * Tous les champs sont optionnels.
 */
export interface UpdateTransactionDTO {
  type?: TypeTransaction;
  montant?: number;
  description?: string;
  dateOperation?: Date | string;
  modePaiement?: string;
  pieceJustificative?: string;
  categorieId?: number;
  evenementId?: number;
  estSupprime?: boolean;
}

/**
 * Structure de réponse pour une transaction.
 * Inclut les relations avec catégorie, utilisateur, évènement.
 */
export interface TransactionResponseDTO {
  id: number;
  type: TypeTransaction;
  montant: number;
  description: string | null;
  dateOperation: Date;
  modePaiement: string | null;
  pieceJustificative: string | null;
  estSupprime: boolean;
  creeLe: Date;
  modifieLe: Date | null;
  
  // Relations
  categorieId: number;
  categorie: {
    id: number;
    nom: string;
    type: TypeTransaction;
  };
  
  utilisateurId: number;
  utilisateur: {
    id: number;
    nom: string;
    email: string;
  };
  
  evenementId: number | null;
  evenement: {
    id: number;
    nom: string;
  } | null;
}

/**
 * Options de pagination pour les listes.
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Réponse paginée générique.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Filtres pour les transactions.
 */
export interface TransactionFilter {
  type?: TypeTransaction;
  categorieId?: number;
  evenementId?: number;
  utilisateurId?: number;
  dateOperationDe?: Date;
  dateOperationJusqua?: Date;
  montantMin?: number;
  montantMax?: number;
  search?: string; // Recherche dans description
  estSupprime?: boolean;
  orderBy?: 'dateOperation' | 'montant' | 'creeLe';
  order?: 'asc' | 'desc';
}
