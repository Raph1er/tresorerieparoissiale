/**
 * Repository pour l'accès aux données des catégories.
 * Cette couche centralise toutes les requêtes Prisma du module.
 */

import supabaseDb from '@/lib/supabase-db';
import { TypeTransaction } from '@/types/enums';
import {
	CategorieFilter,
	CategorieResponseDTO,
	CreateCategorieDTO,
	PaginatedResponse,
	PaginationOptions,
	UpdateCategorieDTO,
} from './categorie.types';

type CategorieDbPayload = {
	id: number;
	nom: string;
	type: TypeTransaction;
	description: string | null;
	estSysteme: boolean;
	actif: boolean;
	parentId: number | null;
	parent: {
		id: number;
		nom: string;
		type: TypeTransaction;
	} | null;
	creeLe: Date;
	_count: {
		sousCategories: number;
		transactions: number;
	};
};

/**
 * Convertit un résultat Prisma en DTO de réponse API.
 */
function versCategorieResponseDTO(categorie: CategorieDbPayload): CategorieResponseDTO {
	return {
		id: categorie.id,
		nom: categorie.nom,
		type: categorie.type,
		description: categorie.description,
		estSysteme: categorie.estSysteme,
		actif: categorie.actif,
		parentId: categorie.parentId,
		parent: categorie.parent,
		creeLe: categorie.creeLe,
		sousCategorieCount: categorie._count.sousCategories,
		transactionCount: categorie._count.transactions,
	};
}

/**
 * Classe repository du module Catégories.
 */
export class CategorieRepository {
	private readonly selectCategorie = {
		id: true,
		nom: true,
		type: true,
		description: true,
		estSysteme: true,
		actif: true,
		parentId: true,
		parent: {
			select: {
				id: true,
				nom: true,
				type: true,
			},
		},
		creeLe: true,
		_count: {
			select: {
				sousCategories: true,
				transactions: true,
			},
		},
	} as const;

	/**
	 * Crée une nouvelle catégorie.
	 */
	async create(data: CreateCategorieDTO): Promise<CategorieResponseDTO> {
		const categorie = await supabaseDb.categorie.create({
			data: {
				nom: data.nom,
				type: data.type,
				description: data.description ?? null,
				parentId: data.parentId,
				estSysteme: data.estSysteme ?? false,
				actif: true,
			},
			select: this.selectCategorie,
		});

		return versCategorieResponseDTO(categorie as CategorieDbPayload);
	}

	/**
	 * Récupère une catégorie par son ID.
	 */
	async findById(id: number, includeInactive = true): Promise<CategorieResponseDTO | null> {
		const where: any = { id };

		const categorie = await supabaseDb.categorie.findUnique({
			where,
			select: this.selectCategorie,
		});

		if (!categorie) {
			return null;
		}

		if (!includeInactive && !categorie.actif) {
			return null;
		}

		return versCategorieResponseDTO(categorie as CategorieDbPayload);
	}

	/**
	 * Met à jour une catégorie existante.
	 */
	async update(id: number, data: UpdateCategorieDTO): Promise<CategorieResponseDTO> {
		const updateData: any = {};

		if (data.nom !== undefined) updateData.nom = data.nom;
		if (data.type !== undefined) updateData.type = data.type;
		if (data.description !== undefined) updateData.description = data.description;
		if (data.parentId !== undefined) updateData.parent = data.parentId === null ? { disconnect: true } : { connect: { id: data.parentId } };
		if (data.actif !== undefined) updateData.actif = data.actif;

		const categorie = await supabaseDb.categorie.update({
			where: { id },
			data: updateData,
			select: this.selectCategorie,
		});

		return versCategorieResponseDTO(categorie as CategorieDbPayload);
	}

	/**
	 * Désactive une catégorie (suppression logique).
	 */
	async delete(id: number): Promise<CategorieResponseDTO> {
		const categorie = await supabaseDb.categorie.update({
			where: { id },
			data: {
				actif: false,
			},
			select: this.selectCategorie,
		});

		return versCategorieResponseDTO(categorie as CategorieDbPayload);
	}

	/**
	 * Liste paginée des catégories avec filtres.
	 */
	async findAll(
		options: PaginationOptions,
		filters?: CategorieFilter
	): Promise<PaginatedResponse<CategorieResponseDTO>> {
		const where: any = {};

		// Filtre textuel sur le nom et la description.
		if (filters?.search) {
			where.OR = [
				{ nom: { contains: filters.search } },
				{ description: { contains: filters.search } },
			];
		}

		if (filters?.type) {
			where.type = filters.type;
		}

		if (filters?.actif !== undefined) {
			where.actif = filters.actif;
		}

		if (filters?.estSysteme !== undefined) {
			where.estSysteme = filters.estSysteme;
		}

		if (filters?.parentId !== undefined) {
			where.parentId = filters.parentId;
		}

		const total = await supabaseDb.categorie.count({ where });
		const totalPages = Math.ceil(total / options.limit) || 1;
		const skip = (options.page - 1) * options.limit;

		const orderBy: any = {
			[options.orderBy ?? 'creeLe']: options.order ?? 'desc',
		};

		const categories = await supabaseDb.categorie.findMany({
			where,
			select: this.selectCategorie,
			skip,
			take: options.limit,
			orderBy,
		});

		return {
			data: categories.map((categorie: any) => versCategorieResponseDTO(categorie as CategorieDbPayload)),
			page: options.page,
			total,
			totalPages,
			limit: options.limit,
			hasNextPage: options.page < totalPages,
			hasPreviousPage: options.page > 1,
		};
	}

	/**
	 * Vérifie si un nom de catégorie existe déjà pour un type donné.
	 */
	async nomExists(nom: string, type: TypeTransaction, exceptId?: number): Promise<boolean> {
		const where: any = {
			nom,
			type,
		};

		if (exceptId) {
			where.id = { not: exceptId };
		}

		const count = await supabaseDb.categorie.count({ where });
		return count > 0;
	}

	/**
	 * Vérifie si une catégorie a des sous-catégories actives.
	 */
	async hasActiveChildren(id: number): Promise<boolean> {
		const count = await supabaseDb.categorie.count({
			where: {
				parentId: id,
				actif: true,
			},
		});

		return count > 0;
	}

	/**
	 * Vérifie si une catégorie est utilisée par des transactions.
	 */
	async isUsedByTransactions(id: number): Promise<boolean> {
		const count = await supabaseDb.transaction.count({
			where: {
				categorieId: id,
				estSupprime: false,
			},
		});

		return count > 0;
	}

	/**
	 * Compte les catégories actives par type.
	 */
	async countByType(): Promise<Record<TypeTransaction, number>> {
		const result = await supabaseDb.categorie.groupBy({
			by: ['type'],
			where: {
				actif: true,
			},
			_count: {
				id: true,
			},
		});

		const compte: Record<TypeTransaction, number> = {
			ENTREE: 0,
			SORTIE: 0,
		};

		result.forEach((ligne: any) => {
			compte[ligne.type as TypeTransaction] = ligne._count.id;
		});

		return compte;
	}
}

// Instance singleton utilisée par le service.
export const categorieRepository = new CategorieRepository();

