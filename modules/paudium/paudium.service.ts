/**
 * Service métier du module Paudium.
 * Gère la logique des Cahiers et des Enregistrements,
 * notamment la génération automatique des codes uniques.
 */

import logger from '@/lib/logger';
import { cahierRepository, enregistrementRepository } from './paudium.repository';
import {
	CahierFilter,
	CahierResponseDTO,
	CreateCahierDTO,
	CreateEnregistrementDTO,
	EnregistrementFilter,
	EnregistrementResponseDTO,
	PaginatedResponse,
	PaginationOptions,
	StatistiquesCahier,
	UpdateCahierDTO,
	UpdateEnregistrementDTO,
} from './paudium.types';

/**
 * Service principal du module Paudium.
 */
export class PaudiumService {
	// ── Gestion des Cahiers ─────────────────────────────────────────────────

	/**
	 * Crée un cahier après validations métier.
	 */
	async createCahier(
		data: CreateCahierDTO,
		createdById: number,
		isAdmin = false
	): Promise<CahierResponseDTO> {
		const nomNettoye = data.nom.trim();
		const prefixeNettoye = data.prefixeCode.trim().toUpperCase();

		if (!nomNettoye) {
			throw new Error('Le nom du cahier est requis');
		}

		if (!prefixeNettoye || prefixeNettoye.length < 2) {
			throw new Error('Le préfixe du code doit faire au moins 2 caractères');
		}

		// Vérifie l'unicité du nom (éventuellement dans le cadre d'un événement)
		const nomDejaUtilise = await cahierRepository.nomExists(
			nomNettoye,
			data.evenementId,
			undefined
		);
		if (nomDejaUtilise) {
			throw new Error(`Un cahier nommé "${nomNettoye}" existe déjà`);
		}

		const utilisateurId = isAdmin ? undefined : createdById;

		const cahier = await cahierRepository.create({
			...data,
			nom: nomNettoye,
			prefixeCode: prefixeNettoye,
			description: data.description?.trim() || undefined,
			utilisateurId: utilisateurId ?? null,
		});

		await logger.log(
			'CAHIER_CREATED',
			`Cahier créé: ${cahier.nom} (préfixe: ${cahier.prefixeCode})`,
			createdById
		);

		return cahier;
	}

	/**
	 * Retourne un cahier par ID.
	 */
	async getCahierById(id: number): Promise<CahierResponseDTO> {
		const cahier = await cahierRepository.findById(id, true);
		if (!cahier) {
			throw new Error(`Cahier avec l'ID ${id} introuvable`);
		}
		return cahier;
	}

	/**
	 * Retourne la liste paginée des cahiers.
	 */
	async getAllCahiers(
		options: PaginationOptions,
		filters?: CahierFilter,
		utilisateurId?: number
	): Promise<PaginatedResponse<CahierResponseDTO>> {
		if (options.page < 1) throw new Error('Le numéro de page doit être >= 1');
		if (options.limit < 1 || options.limit > 100) {
			throw new Error('La limite doit être comprise entre 1 et 100');
		}

		return cahierRepository.findAll(options, filters, utilisateurId);
	}

	/**
	 * Retourne tous les cahiers actifs (pour les listes déroulantes).
	 */
	async getCahiersActifs(): Promise<CahierResponseDTO[]> {
		return cahierRepository.findAllActifs();
	}

	/**
	 * Met à jour un cahier.
	 */
	async updateCahier(
		id: number,
		data: UpdateCahierDTO,
		updatedById: number
	): Promise<CahierResponseDTO> {
		const cahierExistante = await cahierRepository.findById(id, true);
		if (!cahierExistante) {
			throw new Error(`Cahier avec l'ID ${id} introuvable`);
		}

		const nomNettoye = data.nom?.trim();
		if (nomNettoye !== undefined) {
			if (!nomNettoye) throw new Error('Le nom ne peut pas être vide');

			const nomExiste = await cahierRepository.nomExists(
				nomNettoye,
				data.evenementId ?? cahierExistante.evenementId,
				id
			);
			if (nomExiste) {
				throw new Error(`Un cahier nommé "${nomNettoye}" existe déjà`);
			}
		}

		if (data.prefixeCode !== undefined) {
			const prefixeNettoye = data.prefixeCode.trim().toUpperCase();
			if (!prefixeNettoye || prefixeNettoye.length < 2) {
				throw new Error('Le préfixe doit faire au moins 2 caractères');
			}
			data.prefixeCode = prefixeNettoye;
		}

		const cahierMAJ = await cahierRepository.update(id, {
			...data,
			nom: nomNettoye,
			description: data.description !== undefined ? data.description.trim() : undefined,
		});

		await logger.log(
			'CAHIER_UPDATED',
			`Cahier mis à jour: ${cahierMAJ.nom}`,
			updatedById
		);

		return cahierMAJ;
	}

	/**
	 * Supprime définitivement un cahier.
	 */
	async deleteCahier(id: number, deletedById: number): Promise<CahierResponseDTO> {
		const cahier = await cahierRepository.findById(id, true);
		if (!cahier) {
			throw new Error(`Cahier avec l'ID ${id} introuvable`);
		}

		const cahierSupprime = await cahierRepository.delete(id);

		await logger.log(
			'CAHIER_DELETED',
			`Cahier désactivé: ${cahierSupprime.nom}`,
			deletedById
		);

		return cahierSupprime;
	}

	// ── Gestion des Enregistrements ─────────────────────────────────────────

	/**
	 * Génère un code unique pour un enregistrement dans un cahier.
	 * Format : PREFIXE-XXXX (ex: VNT-0001)
	 *
	 * En cas de conflit (deux créations simultanées), on réessaie automatiquement.
	 */
	private async genererCodeUnique(cahierId: number, prefixe: string): Promise<string> {
		const MAX_TENTATIVES = 5;

		for (let tentative = 0; tentative < MAX_TENTATIVES; tentative++) {
			const nombreActuel = await enregistrementRepository.compterParCahier(cahierId);
			const numeroStr = String(nombreActuel + 1).padStart(4, '0');
			const code = `${prefixe}-${numeroStr}`;

			// On pourrait vérifier ici si le code existe déjà, mais la contrainte UNIQUE
			// en base de données gérera le cas. On rattrape l'erreur dans createEnregistrement.
			return code;
		}

		// Fallback : on ajoute un timestamp pour garantir l'unicité
		const nombreActuel = await enregistrementRepository.compterParCahier(cahierId);
		return `${prefixe}-${String(nombreActuel + 1).padStart(4, '0')}-${Date.now().toString().slice(-4)}`;
	}

	/**
	 * Crée un enregistrement avec génération automatique du code.
	 */
	async createEnregistrement(
		data: CreateEnregistrementDTO,
		createdById: number
	): Promise<EnregistrementResponseDTO> {
		// 1. Valide le cahier parent
		const cahier = await cahierRepository.findById(data.cahierId, false);
		if (!cahier) {
			throw new Error('Le cahier est introuvable ou inactif');
		}

		// 2. Valide les données
		const nomNettoye = data.nomPersonne.trim();
		if (!nomNettoye) {
			throw new Error('Le nom de la personne est requis');
		}

		if (data.montant <= 0) {
			throw new Error('Le montant doit être strictement positif');
		}

		// 3. Génère le code unique
		const code = await this.genererCodeUnique(data.cahierId, cahier.prefixeCode);

		// 4. Crée l'enregistrement
		try {
			const enreg = await enregistrementRepository.create({
				...data,
				code,
				nomPersonne: nomNettoye,
				note: data.note?.trim() || undefined,
				utilisateurId: createdById,
			});

			await logger.log(
				'ENREGISTREMENT_CREATED',
				`Enregistrement créé: ${enreg.code} - ${enreg.nomPersonne} (${enreg.montant} FCFA)`,
				createdById
			);

			return enreg;
		} catch (error: any) {
			// En cas de conflit de code UNIQUE, on réessaie une fois
			if (error?.code === 'P2002' || error?.message?.includes('unique')) {
				logger.log('WARN', `Conflit de code détecté, nouvelle tentative pour cahier ${data.cahierId}`);
				const codeSecours = `${cahier.prefixeCode}-${Date.now().toString().slice(-6)}`;
				return enregistrementRepository.create({
					...data,
					code: codeSecours,
					nomPersonne: nomNettoye,
					note: data.note?.trim() || undefined,
					utilisateurId: createdById,
				});
			}
			throw error;
		}
	}

	/**
	 * Retourne les enregistrements d'un cahier avec pagination.
	 */
	async getEnregistrementsByCahier(
		cahierId: number,
		options: PaginationOptions,
		filters?: EnregistrementFilter
	): Promise<PaginatedResponse<EnregistrementResponseDTO>> {
		const cahier = await cahierRepository.findById(cahierId, true);
		if (!cahier) {
			throw new Error(`Cahier avec l'ID ${cahierId} introuvable`);
		}

		return enregistrementRepository.findByCahierId(cahierId, options, filters);
	}

	/**
	 * Retourne un enregistrement par ID.
	 */
	async getEnregistrementById(id: number): Promise<EnregistrementResponseDTO> {
		const enreg = await enregistrementRepository.findById(id);
		if (!enreg) {
			throw new Error(`Enregistrement avec l'ID ${id} introuvable`);
		}
		return enreg;
	}

	/**
	 * Met à jour un enregistrement (le code ne change jamais).
	 */
	async updateEnregistrement(
		id: number,
		data: UpdateEnregistrementDTO,
		updatedById: number
	): Promise<EnregistrementResponseDTO> {
		const existant = await enregistrementRepository.findById(id);
		if (!existant) {
			throw new Error(`Enregistrement avec l'ID ${id} introuvable`);
		}

		if (data.nomPersonne !== undefined) {
			const nomNettoye = data.nomPersonne.trim();
			if (!nomNettoye) throw new Error('Le nom ne peut pas être vide');
			data.nomPersonne = nomNettoye;
		}

		if (data.montant !== undefined && data.montant <= 0) {
			throw new Error('Le montant doit être strictement positif');
		}

		const enregMAJ = await enregistrementRepository.update(id, {
			...data,
			note: data.note !== undefined ? data.note.trim() : undefined,
		});

		await logger.log(
			'ENREGISTREMENT_UPDATED',
			`Enregistrement mis à jour: ${enregMAJ.code}`,
			updatedById
		);

		return enregMAJ;
	}

	/**
	 * Supprime un enregistrement.
	 */
	async deleteEnregistrement(id: number, deletedById: number): Promise<EnregistrementResponseDTO> {
		const existant = await enregistrementRepository.findById(id);
		if (!existant) {
			throw new Error(`Enregistrement avec l'ID ${id} introuvable`);
		}

		const enregSupprime = await enregistrementRepository.delete(id);

		await logger.log(
			'ENREGISTREMENT_DELETED',
			`Enregistrement supprimé: ${enregSupprime.code}`,
			deletedById
		);

		return enregSupprime;
	}

	/**
	 * Retourne les statistiques d'un cahier.
	 */
	async getStatistiquesCahier(cahierId: number): Promise<StatistiquesCahier> {
		const cahier = await cahierRepository.findById(cahierId, true);
		if (!cahier) {
			throw new Error(`Cahier avec l'ID ${cahierId} introuvable`);
		}

		return enregistrementRepository.getStatistiques(cahierId);
	}
}

// Instance singleton utilisée dans les routes API.
export const paudiumService = new PaudiumService();