/**
 * Types globaux du module Utilisateurs.
 * Ce fichier est la référence pour les routes API et validations.
 */

import { RoleUtilisateur } from '@prisma/client';

/**
 * Données nécessaires à la création d'un utilisateur.
 */
export interface CreateUtilisateurDTO {
	nom: string;
	email: string;
	motDePasse: string;
	role: RoleUtilisateur;
}

/**
 * Données autorisées pour la mise à jour d'un utilisateur.
 */
export interface UpdateUtilisateurDTO {
	nom?: string;
	email?: string;
	role?: RoleUtilisateur;
	actif?: boolean;
}

/**
 * Structure de réponse d'un utilisateur (sans mot de passe).
 */
export interface UtilisateurResponseDTO {
	id: number;
	nom: string;
	email: string;
	role: RoleUtilisateur;
	actif: boolean;
	creeLe: Date;
	modifieLe: Date;
}

/**
 * Pagination standard.
 */
export interface PaginationOptions {
	page: number;
	limit: number;
	orderBy?: 'nom' | 'email' | 'creeLe' | 'modifieLe';
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
 * Filtres disponibles pour la liste utilisateurs.
 */
export interface UtilisateurFilter {
	search?: string;
	role?: RoleUtilisateur;
	actif?: boolean;
	creeLeDe?: Date;
	creerJusqua?: Date;
}

