/**
 * Validations du module Catégories.
 * Ce fichier remplace un schéma externe par des fonctions TypeScript explicites.
 */

import { TypeTransaction } from '@prisma/client';
import {
	CategorieFilter,
	CreateCategorieDTO,
	PaginationOptions,
	UpdateCategorieDTO,
} from '@/modules/categories/categorie.types';

interface ValidationSuccess<T> {
	success: true;
	data: T;
}

interface ValidationError {
	success: false;
	error: string;
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

/**
 * Type guard simple pour vérifier un objet JSON.
 */
function estObjet(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/**
 * Vérifie qu'une valeur correspond à un enum TypeTransaction.
 */
function estTypeTransaction(value: unknown): value is TypeTransaction {
	return value === 'ENTREE' || value === 'SORTIE';
}

/**
 * Parse un entier strictement positif.
 */
function parserEntierPositif(value: unknown): number | null {
	if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
		return value;
	}

	if (typeof value === 'string' && /^\d+$/.test(value)) {
		const parsed = parseInt(value, 10);
		return parsed > 0 ? parsed : null;
	}

	return null;
}

/**
 * Parse un booléen depuis string/boolean.
 */
function parserBooleen(value: unknown): boolean | null {
	if (typeof value === 'boolean') {
		return value;
	}

	if (typeof value === 'string') {
		if (value.toLowerCase() === 'true') return true;
		if (value.toLowerCase() === 'false') return false;
	}

	return null;
}

/**
 * Valide les données de création d'une catégorie.
 */
export function validerCreateCategorieDTO(payload: unknown): ValidationResult<CreateCategorieDTO> {
	if (!estObjet(payload)) {
		return { success: false, error: 'Payload JSON invalide' };
	}

	const { nom, type, description, parentId, estSysteme } = payload;

	if (typeof nom !== 'string' || !nom.trim()) {
		return { success: false, error: 'Le champ nom est requis' };
	}

	if (!estTypeTransaction(type)) {
		return { success: false, error: 'Le champ type doit être ENTREE ou SORTIE' };
	}

	if (description !== undefined && typeof description !== 'string') {
		return { success: false, error: 'Le champ description doit être une chaîne' };
	}

	let parentIdValide: number | undefined;
	if (parentId !== undefined) {
		const parsedParentId = parserEntierPositif(parentId);
		if (!parsedParentId) {
			return { success: false, error: 'Le champ parentId doit être un entier positif' };
		}
		parentIdValide = parsedParentId;
	}

	let estSystemeValide: boolean | undefined;
	if (estSysteme !== undefined) {
		const parsedEstSysteme = parserBooleen(estSysteme);
		if (parsedEstSysteme === null) {
			return { success: false, error: 'Le champ estSysteme doit être un booléen' };
		}
		estSystemeValide = parsedEstSysteme;
	}

	return {
		success: true,
		data: {
			nom: nom.trim(),
			type,
			description: typeof description === 'string' ? description.trim() : undefined,
			parentId: parentIdValide,
			estSysteme: estSystemeValide,
		},
	};
}

/**
 * Valide les données de mise à jour d'une catégorie.
 */
export function validerUpdateCategorieDTO(payload: unknown): ValidationResult<UpdateCategorieDTO> {
	if (!estObjet(payload)) {
		return { success: false, error: 'Payload JSON invalide' };
	}

	const { nom, type, description, parentId, actif } = payload;
	const data: UpdateCategorieDTO = {};

	if (nom !== undefined) {
		if (typeof nom !== 'string' || !nom.trim()) {
			return { success: false, error: 'Le champ nom doit être une chaîne non vide' };
		}
		data.nom = nom.trim();
	}

	if (type !== undefined) {
		if (!estTypeTransaction(type)) {
			return { success: false, error: 'Le champ type doit être ENTREE ou SORTIE' };
		}
		data.type = type;
	}

	if (description !== undefined) {
		if (typeof description !== 'string') {
			return { success: false, error: 'Le champ description doit être une chaîne' };
		}
		data.description = description.trim();
	}

	if (parentId !== undefined) {
		// null signifie "retirer le parent".
		if (parentId === null) {
			data.parentId = null;
		} else {
			const parsedParentId = parserEntierPositif(parentId);
			if (!parsedParentId) {
				return { success: false, error: 'Le champ parentId doit être un entier positif ou null' };
			}
			data.parentId = parsedParentId;
		}
	}

	if (actif !== undefined) {
		const parsedActif = parserBooleen(actif);
		if (parsedActif === null) {
			return { success: false, error: 'Le champ actif doit être un booléen' };
		}
		data.actif = parsedActif;
	}

	if (Object.keys(data).length === 0) {
		return { success: false, error: 'Aucune donnée valide à mettre à jour' };
	}

	return { success: true, data };
}

export interface ValidationCategorieQueryResult {
	pagination: PaginationOptions;
	filters: CategorieFilter;
}

/**
 * Valide les query params de la route GET /api/categories.
 */
export function validerPaginationCategorieQuery(
	searchParams: URLSearchParams
): ValidationResult<ValidationCategorieQueryResult> {
	const pageRaw = searchParams.get('page') ?? '1';
	const limitRaw = searchParams.get('limit') ?? '10';
	const orderByRaw = searchParams.get('orderBy') ?? 'creeLe';
	const orderRaw = searchParams.get('order') ?? 'desc';

	const page = parserEntierPositif(pageRaw);
	if (!page) {
		return { success: false, error: 'page doit être un entier positif' };
	}

	const limit = parserEntierPositif(limitRaw);
	if (!limit || limit > 100) {
		return { success: false, error: 'limit doit être un entier positif <= 100' };
	}

	if (!['nom', 'type', 'creeLe'].includes(orderByRaw)) {
		return { success: false, error: 'orderBy doit être nom, type ou creeLe' };
	}

	if (!['asc', 'desc'].includes(orderRaw)) {
		return { success: false, error: 'order doit être asc ou desc' };
	}

	const filters: CategorieFilter = {};

	const search = searchParams.get('search');
	if (search && search.trim()) {
		filters.search = search.trim();
	}

	const type = searchParams.get('type');
	if (type) {
		if (!estTypeTransaction(type)) {
			return { success: false, error: 'type doit être ENTREE ou SORTIE' };
		}
		filters.type = type;
	}

	const actif = searchParams.get('actif');
	if (actif !== null) {
		const parsedActif = parserBooleen(actif);
		if (parsedActif === null) {
			return { success: false, error: 'actif doit être true ou false' };
		}
		filters.actif = parsedActif;
	}

	const estSysteme = searchParams.get('estSysteme');
	if (estSysteme !== null) {
		const parsedEstSysteme = parserBooleen(estSysteme);
		if (parsedEstSysteme === null) {
			return { success: false, error: 'estSysteme doit être true ou false' };
		}
		filters.estSysteme = parsedEstSysteme;
	}

	const parentId = searchParams.get('parentId');
	if (parentId !== null) {
		if (parentId.toLowerCase() === 'null') {
			filters.parentId = null;
		} else {
			const parsedParentId = parserEntierPositif(parentId);
			if (!parsedParentId) {
				return { success: false, error: 'parentId doit être un entier positif ou null' };
			}
			filters.parentId = parsedParentId;
		}
	}

	return {
		success: true,
		data: {
			pagination: {
				page,
				limit,
				orderBy: orderByRaw as PaginationOptions['orderBy'],
				order: orderRaw as PaginationOptions['order'],
			},
			filters,
		},
	};
}

