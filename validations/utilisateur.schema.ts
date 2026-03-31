/**
 * Validations du module Utilisateurs.
 * Centralise la validation des payloads et query params.
 */

import { RoleUtilisateur } from '@/types/enums';
import {
	CreateUtilisateurDTO,
	PaginationOptions,
	UpdateUtilisateurDTO,
	UtilisateurFilter,
} from '@/types/utilisateur';

interface ValidationSuccess<T> {
	success: true;
	data: T;
}

interface ValidationError {
	success: false;
	error: string;
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES: RoleUtilisateur[] = ['ADMIN', 'TRESORIER', 'RESPONSABLE', 'AUDITEUR'];

function estObjet(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

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

function parserRole(value: unknown): RoleUtilisateur | null {
	if (typeof value !== 'string') {
		return null;
	}

	const role = value.toUpperCase() as RoleUtilisateur;
	return ROLES.includes(role) ? role : null;
}

export function validerIdUtilisateur(id: number): ValidationResult<number> {
	if (Number.isNaN(id) || id < 1) {
		return { success: false, error: 'ID invalide' };
	}

	return { success: true, data: id };
}

export function validerCreateUtilisateurDTO(payload: unknown): ValidationResult<CreateUtilisateurDTO> {
	if (!estObjet(payload)) {
		return { success: false, error: 'Payload JSON invalide' };
	}

	const { nom, email, motDePasse, role } = payload;

	if (typeof nom !== 'string' || !nom.trim()) {
		return { success: false, error: 'Nom requis et doit être valide' };
	}

	if (typeof email !== 'string' || !email.trim() || !EMAIL_REGEX.test(email.trim())) {
		return { success: false, error: 'Email invalide' };
	}

	if (typeof motDePasse !== 'string' || motDePasse.length < 8) {
		return { success: false, error: 'Le mot de passe doit faire au moins 8 caractères' };
	}

	const roleValide = parserRole(role);
	if (!roleValide) {
		return { success: false, error: 'Rôle invalide' };
	}

	return {
		success: true,
		data: {
			nom: nom.trim(),
			email: email.trim().toLowerCase(),
			motDePasse,
			role: roleValide,
		},
	};
}

export function validerUpdateUtilisateurDTO(payload: unknown): ValidationResult<UpdateUtilisateurDTO> {
	if (!estObjet(payload)) {
		return { success: false, error: 'Payload JSON invalide' };
	}

	const { nom, email, role, actif } = payload;
	const data: UpdateUtilisateurDTO = {};

	if (nom !== undefined) {
		if (typeof nom !== 'string' || !nom.trim()) {
			return { success: false, error: 'Nom invalide' };
		}
		data.nom = nom.trim();
	}

	if (email !== undefined) {
		if (typeof email !== 'string' || !email.trim() || !EMAIL_REGEX.test(email.trim())) {
			return { success: false, error: 'Email invalide' };
		}
		data.email = email.trim().toLowerCase();
	}

	if (role !== undefined) {
		const roleValide = parserRole(role);
		if (!roleValide) {
			return { success: false, error: 'Rôle invalide' };
		}
		data.role = roleValide;
	}

	if (actif !== undefined) {
		const actifValide = parserBooleen(actif);
		if (actifValide === null) {
			return { success: false, error: 'Le champ actif doit être true ou false' };
		}
		data.actif = actifValide;
	}

	if (Object.keys(data).length === 0) {
		return { success: false, error: 'Aucune donnée valide à mettre à jour' };
	}

	return { success: true, data };
}

export interface ValidationUtilisateurQueryResult {
	pagination: PaginationOptions;
	filters: UtilisateurFilter;
}

export function validerPaginationUtilisateurQuery(
	searchParams: URLSearchParams
): ValidationResult<ValidationUtilisateurQueryResult> {
	const page = parserEntierPositif(searchParams.get('page') ?? '1');
	const limit = parserEntierPositif(searchParams.get('limit') ?? '10');
	const orderBy = searchParams.get('orderBy') ?? 'creeLe';
	const order = searchParams.get('order') ?? 'desc';

	if (!page) {
		return { success: false, error: 'page doit être un entier positif' };
	}

	if (!limit || limit > 100) {
		return { success: false, error: 'limit doit être un entier positif <= 100' };
	}

	if (!['nom', 'email', 'creeLe', 'modifieLe'].includes(orderBy)) {
		return { success: false, error: 'orderBy invalide' };
	}

	if (!['asc', 'desc'].includes(order)) {
		return { success: false, error: 'order doit être asc ou desc' };
	}

	const filters: UtilisateurFilter = {};

	const search = searchParams.get('search');
	if (search && search.trim()) {
		filters.search = search.trim();
	}

	const role = searchParams.get('role');
	if (role) {
		const roleValide = parserRole(role);
		if (!roleValide) {
			return { success: false, error: 'role invalide' };
		}
		filters.role = roleValide;
	}

	const actif = searchParams.get('actif');
	if (actif !== null) {
		const actifValide = parserBooleen(actif);
		if (actifValide === null) {
			return { success: false, error: 'actif doit être true ou false' };
		}
		filters.actif = actifValide;
	}

	return {
		success: true,
		data: {
			pagination: {
				page,
				limit,
				orderBy: orderBy as PaginationOptions['orderBy'],
				order: order as PaginationOptions['order'],
			},
			filters,
		},
	};
}

