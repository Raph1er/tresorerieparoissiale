/**
 * Types et interfaces pour le module Catégories.
 * Ces structures sont partagées entre routes, service et repository.
 */

import { TypeTransaction } from '@prisma/client';

/**
 * Données requises pour créer une catégorie.
 */
export interface CreateCategorieDTO {
	nom: string;
	type: TypeTransaction;
	description?: string;
	parentId?: number;
	estSysteme?: boolean;
}

/**
 * Données autorisées pour mettre à jour une catégorie.
 */
export interface UpdateCategorieDTO {
	nom?: string;
	type?: TypeTransaction;
	description?: string;
	parentId?: number | null;
	actif?: boolean;
}

/**
 * Représentation simplifiée d'une catégorie parente.
 */
export interface CategorieParentDTO {
	id: number;
	nom: string;
	type: TypeTransaction;
}

/**
 * Réponse API d'une catégorie.
 */
export interface CategorieResponseDTO {
	id: number;
	nom: string;
	type: TypeTransaction;
	description: string | null;
	estSysteme: boolean;
	actif: boolean;
	parentId: number | null;
	parent: CategorieParentDTO | null;
	creeLe: Date;
	sousCategorieCount: number;
	transactionCount: number;
}

/**
 * Options de pagination et tri pour les listes.
 */
export interface PaginationOptions {
	page: number;
	limit: number;
	orderBy?: 'nom' | 'type' | 'creeLe';
	order?: 'asc' | 'desc';
}

/**
 * Structure standard de réponse paginée.
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
 * Filtres disponibles pour la recherche des catégories.
 */
export interface CategorieFilter {
	search?: string;
	type?: TypeTransaction;
	actif?: boolean;
	estSysteme?: boolean;
	parentId?: number | null;
}

