/**
 * Service métier du module Catégories.
 * Il applique les règles métier avant d'appeler le repository.
 */

import { TypeTransaction } from '@prisma/client';
import logger from '@/lib/logger';
import { categorieRepository } from './categorie.repository';
import {
	CategorieFilter,
	CategorieResponseDTO,
	CreateCategorieDTO,
	PaginatedResponse,
	PaginationOptions,
	UpdateCategorieDTO,
} from './categorie.types';

/**
 * Service principal de gestion des catégories.
 */
export class CategorieService {
	/**
	 * Crée une catégorie après validations métier.
	 */
	async createCategorie(
		data: CreateCategorieDTO,
		createdById: number
	): Promise<CategorieResponseDTO> {
		const nomNettoye = data.nom.trim();

		if (!nomNettoye) {
			throw new Error('Le nom de la catégorie est requis');
		}

		// Le nom doit rester unique par type (ENTREE/SORTIE).
		const nomDejaUtilise = await categorieRepository.nomExists(nomNettoye, data.type);
		if (nomDejaUtilise) {
			throw new Error(`La catégorie "${nomNettoye}" existe déjà pour le type ${data.type}`);
		}

		// Si on rattache à un parent, on vérifie sa cohérence.
		if (data.parentId !== undefined) {
			const parent = await categorieRepository.findById(data.parentId, false);
			if (!parent) {
				throw new Error('La catégorie parent est introuvable ou inactive');
			}

			if (parent.type !== data.type) {
				throw new Error('Le type de la sous-catégorie doit être identique à celui du parent');
			}
		}

		const categorie = await categorieRepository.create({
			...data,
			nom: nomNettoye,
			description: data.description?.trim() || undefined,
		});

		await logger.log(
			'CATEGORY_CREATED',
			`Catégorie créée: ${categorie.nom} (${categorie.type})`,
			createdById
		);

		return categorie;
	}

	/**
	 * Retourne une catégorie par ID.
	 */
	async getCategorieById(id: number): Promise<CategorieResponseDTO> {
		const categorie = await categorieRepository.findById(id, true);
		if (!categorie) {
			throw new Error(`Catégorie avec l'ID ${id} introuvable`);
		}

		return categorie;
	}

	/**
	 * Retourne la liste paginée des catégories.
	 */
	async getAllCategories(
		options: PaginationOptions,
		filters?: CategorieFilter
	): Promise<PaginatedResponse<CategorieResponseDTO>> {
		if (options.page < 1) {
			throw new Error('Le numéro de page doit être supérieur ou égal à 1');
		}

		if (options.limit < 1 || options.limit > 100) {
			throw new Error('La limite doit être comprise entre 1 et 100');
		}

		return categorieRepository.findAll(options, filters);
	}

	/**
	 * Met à jour une catégorie.
	 */
	async updateCategorie(
		id: number,
		data: UpdateCategorieDTO,
		updatedById: number
	): Promise<CategorieResponseDTO> {
		const categorieExistante = await categorieRepository.findById(id, true);
		if (!categorieExistante) {
			throw new Error(`Catégorie avec l'ID ${id} introuvable`);
		}

		const nomNettoye = data.nom?.trim();
		const typeFinal = data.type ?? categorieExistante.type;

		if (nomNettoye !== undefined) {
			if (!nomNettoye) {
				throw new Error('Le nom de la catégorie ne peut pas être vide');
			}

			const nomExiste = await categorieRepository.nomExists(nomNettoye, typeFinal, id);
			if (nomExiste) {
				throw new Error(`La catégorie "${nomNettoye}" existe déjà pour le type ${typeFinal}`);
			}
		}

		// Vérifie la cohérence de parentage si le parent est modifié.
		if (data.parentId !== undefined) {
			if (data.parentId === id) {
				throw new Error('Une catégorie ne peut pas être son propre parent');
			}

			if (data.parentId !== null) {
				const parent = await categorieRepository.findById(data.parentId, false);
				if (!parent) {
					throw new Error('La catégorie parent est introuvable ou inactive');
				}

				if (parent.type !== typeFinal) {
					throw new Error('Le type de la catégorie doit correspondre à celui du parent');
				}
			}
		}

		// Une catégorie avec des sous-catégories actives ne peut pas être désactivée directement.
		if (data.actif === false) {
			const aDesEnfantsActifs = await categorieRepository.hasActiveChildren(id);
			if (aDesEnfantsActifs) {
				throw new Error('Impossible de désactiver une catégorie qui possède des sous-catégories actives');
			}
		}

		const categorieMiseAJour = await categorieRepository.update(id, {
			...data,
			nom: nomNettoye,
			description: data.description !== undefined ? data.description.trim() : undefined,
		});

		await logger.log(
			'CATEGORY_UPDATED',
			`Catégorie mise à jour: ${categorieMiseAJour.nom} (${categorieMiseAJour.type})`,
			updatedById
		);

		return categorieMiseAJour;
	}

	/**
	 * Supprime (logiquement) une catégorie.
	 */
	async deleteCategorie(id: number, deletedById: number): Promise<CategorieResponseDTO> {
		const categorie = await categorieRepository.findById(id, true);
		if (!categorie) {
			throw new Error(`Catégorie avec l'ID ${id} introuvable`);
		}

		if (categorie.estSysteme) {
			throw new Error('Les catégories système ne peuvent pas être supprimées');
		}

		const aDesEnfantsActifs = await categorieRepository.hasActiveChildren(id);
		if (aDesEnfantsActifs) {
			throw new Error('Impossible de supprimer une catégorie qui possède des sous-catégories actives');
		}

		const utiliseeParTransactions = await categorieRepository.isUsedByTransactions(id);
		if (utiliseeParTransactions) {
			throw new Error('Impossible de supprimer une catégorie déjà utilisée par des transactions');
		}

		const categorieSupprimee = await categorieRepository.delete(id);

		await logger.log(
			'CATEGORY_DELETED',
			`Catégorie désactivée: ${categorieSupprimee.nom} (${categorieSupprimee.type})`,
			deletedById
		);

		return categorieSupprimee;
	}

	/**
	 * Retourne des statistiques simples sur les catégories.
	 */
	async getStatistiques(): Promise<Record<TypeTransaction, number>> {
		return categorieRepository.countByType();
	}
}

// Instance singleton utilisée dans les routes API.
export const categorieService = new CategorieService();

