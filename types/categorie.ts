/**
 * Types globaux du module Catégories.
 * Ils servent côté interface pour consommer l'API sans dupliquer les structures.
 */

import { TypeTransaction } from '@prisma/client';

/**
 * Résumé léger d'une catégorie parent.
 */
export interface CategorieParentDTO {
	id: number;
	nom: string;
	type: TypeTransaction;
}

/**
 * Catégorie renvoyée par l'API.
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
	creeLe: Date | string;
	sousCategorieCount: number;
	transactionCount: number;
}

/**
 * Réponse paginée standard utilisée par les listes de catégories.
 */
export interface PaginatedCategorieResponse {
	data: CategorieResponseDTO[];
	page: number;
	total: number;
	totalPages: number;
	limit: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
}
