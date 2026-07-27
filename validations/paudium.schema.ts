/**
 * Schémas de validation Zod pour le module Paudium.
 */

import { z } from 'zod';

// ── Schémas pour les Cahiers ─────────────────────────────────────────────────

export const createCahierSchema = z.object({
	nom: z
		.string()
		.min(2, 'Le nom doit faire au moins 2 caractères')
		.max(100, 'Le nom ne peut pas dépasser 100 caractères'),
	prefixeCode: z
		.string()
		.min(2, 'Le préfixe doit faire au moins 2 caractères')
		.max(10, 'Le préfixe ne peut pas dépasser 10 caractères')
		.regex(/^[A-Z0-9]+$/, 'Le préfixe ne peut contenir que des lettres majuscules et des chiffres'),
	description: z.string().max(500, 'La description ne peut pas dépasser 500 caractères').optional(),
	actif: z.boolean().optional(),
	evenementId: z.number().int().positive().optional(),
});

export const updateCahierSchema = createCahierSchema.partial();

export const paginationCahierQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().min(1).max(100).default(10),
	orderBy: z.enum(['nom', 'creeLe', 'nombreEnregistrements', 'totalMontant']).default('creeLe'),
	order: z.enum(['asc', 'desc']).default('desc'),
	search: z.string().optional(),
	actif: z
		.string()
		.optional()
		.transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
	evenementId: z.coerce.number().int().positive().optional(),
});

// ── Schémas pour les Enregistrements ─────────────────────────────────────────

export const createEnregistrementSchema = z.object({
	nomPersonne: z
		.string()
		.min(2, 'Le nom doit faire au moins 2 caractères')
		.max(200, 'Le nom ne peut pas dépasser 200 caractères'),
	note: z.string().max(500, 'La note ne peut pas dépasser 500 caractères').optional(),
	montant: z.number().positive('Le montant doit être strictement positif'),
	dateHeure: z.coerce.date().optional(),
});

export const updateEnregistrementSchema = createEnregistrementSchema.partial();

export const paginationEnregistrementQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	orderBy: z.enum(['code', 'nomPersonne', 'montant', 'dateHeure', 'creeLe']).default('dateHeure'),
	order: z.enum(['asc', 'desc']).default('desc'),
	search: z.string().optional(),
	dateDebut: z.coerce.date().optional(),
	dateFin: z.coerce.date().optional(),
});

// ── Types inférés ────────────────────────────────────────────────────────────

export type CreateCahierDTO = z.infer<typeof createCahierSchema>;
export type UpdateCahierDTO = z.infer<typeof updateCahierSchema>;
export type PaginationCahierQuery = z.infer<typeof paginationCahierQuerySchema>;

export type CreateEnregistrementDTO = z.infer<typeof createEnregistrementSchema>;
export type UpdateEnregistrementDTO = z.infer<typeof updateEnregistrementSchema>;
export type PaginationEnregistrementQuery = z.infer<typeof paginationEnregistrementQuerySchema>;