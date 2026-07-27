/**
 * Repository pour l'accès aux données du module Paudium.
 * Utilise directement le client Supabase natif (sans passer par l'adaptateur Prisma).
 */

import { supabaseServer } from '@/lib/supabase';
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

// ── Fonctions utilitaires ────────────────────────────────────────────────────

function toSnakeCase(str: string): string {
	return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function formatDateForDb(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toISOString();
}

// ── Repository Cahiers ───────────────────────────────────────────────────────

export class CahierRepository {
	async create(data: CreateCahierDTO & { utilisateurId?: number | null }): Promise<CahierResponseDTO> {
		console.log('🔍 [CAHIER CREATE] Données reçues:', data);

		const payload = {
			nom: data.nom,
			prefixe_code: data.prefixeCode.toUpperCase(),
			description: data.description ?? null,
			actif: data.actif ?? true,
			utilisateur_id: data.utilisateurId ?? null,
			evenement_id: data.evenementId ?? null,
		};

		console.log('🔍 [CAHIER CREATE] Payload Supabase:', payload);

		const { data: cahier, error } = await supabaseServer
			.from('cahiers')
			.insert(payload)
			.select()
			.single();

		if (error) {
			console.error('🔥 [CAHIER CREATE] Erreur Supabase:', error);
			throw new Error(`Erreur création cahier: ${error.message || JSON.stringify(error)}`);
		}

		console.log('✅ [CAHIER CREATE] Cahier créé:', cahier);

		return this.enrichirCahier(cahier);
	}

	async findById(id: number, includeInactive = true): Promise<CahierResponseDTO | null> {
		const { data: cahier, error } = await supabaseServer
			.from('cahiers')
			.select()
			.eq('id', id)
			.maybeSingle();

		if (error) {
			console.error('🔥 [CAHIER FIND] Erreur:', error);
			return null;
		}

		if (!cahier) return null;
		if (!includeInactive && !cahier.actif) return null;

		return this.enrichirCahier(cahier);
	}

	async findAll(
		options: PaginationOptions,
		filters?: CahierFilter,
		utilisateurId?: number
	): Promise<PaginatedResponse<CahierResponseDTO>> {
		let query = supabaseServer.from('cahiers').select('*', { count: 'exact' });

		if (utilisateurId !== undefined) {
			query = query.eq('utilisateur_id', utilisateurId);
		}

		if (filters?.search) {
			query = query.or(`nom.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
		}

		if (filters?.actif !== undefined) {
			query = query.eq('actif', filters.actif);
		}

		if (filters?.evenementId !== undefined) {
			query = query.eq('evenement_id', filters.evenementId);
		}

		const orderBy = options.orderBy || 'cree_le';
		const order = options.order || 'desc';
		query = query.order(toSnakeCase(orderBy), { ascending: order === 'asc' });

		const skip = (options.page - 1) * options.limit;
		query = query.range(skip, skip + options.limit - 1);

		const { data: cahiers, error, count } = await query;

		if (error) {
			console.error('🔥 [CAHIER FINDALL] Erreur:', error);
			throw new Error(`Erreur liste cahiers: ${error.message}`);
		}

		const enrichedCahiers = await Promise.all(
			(cahiers || []).map((c) => this.enrichirCahier(c))
		);

		const totalPages = Math.ceil((count || 0) / options.limit) || 1;

		return {
			data: enrichedCahiers,
			page: options.page,
			total: count || 0,
			totalPages,
			limit: options.limit,
			hasNextPage: options.page < totalPages,
			hasPreviousPage: options.page > 1,
		};
	}

	async update(id: number, data: UpdateCahierDTO): Promise<CahierResponseDTO> {
		const payload: any = {};

		if (data.nom !== undefined) payload.nom = data.nom;
		if (data.prefixeCode !== undefined) payload.prefixe_code = data.prefixeCode.toUpperCase();
		if (data.description !== undefined) payload.description = data.description;
		if (data.actif !== undefined) payload.actif = data.actif;
		if (data.evenementId !== undefined) payload.evenement_id = data.evenementId;

		const { data: cahier, error } = await supabaseServer
			.from('cahiers')
			.update(payload)
			.eq('id', id)
			.select()
			.single();

		if (error) {
			console.error('🔥 [CAHIER UPDATE] Erreur:', error);
			throw new Error(`Erreur mise à jour: ${error.message}`);
		}

		return this.enrichirCahier(cahier);
	}

	async delete(id: number): Promise<CahierResponseDTO> {
		const { data: cahier, error } = await supabaseServer
			.from('cahiers')
			.delete()
			.eq('id', id)
			.select()
			.single();

		if (error) {
			console.error('🔥 [CAHIER DELETE] Erreur:', error);
			throw new Error(`Erreur suppression: ${error.message}`);
		}

		return this.enrichirCahier(cahier);
	}

	async nomExists(nom: string, evenementId?: number | null, exceptId?: number): Promise<boolean> {
		let query = supabaseServer
			.from('cahiers')
			.select('id', { count: 'exact', head: true })
			.eq('nom', nom);

		if (evenementId !== undefined) {
			if (evenementId === null) {
				query = query.is('evenement_id', null);
			} else {
				query = query.eq('evenement_id', evenementId);
			}
		}

		if (exceptId) {
			query = query.neq('id', exceptId);
		}

		const { count, error } = await query;

		if (error) {
			console.error('🔥 [CAHIER NOMEXISTS] Erreur:', error);
			return false;
		}

		return (count || 0) > 0;
	}

	async findAllActifs(): Promise<CahierResponseDTO[]> {
		const { data: cahiers, error } = await supabaseServer
			.from('cahiers')
			.select()
			.eq('actif', true)
			.order('nom', { ascending: true });

		if (error) {
			console.error('🔥 [CAHIER FINDALLACTIFS] Erreur:', error);
			return [];
		}

		return Promise.all((cahiers || []).map((c) => this.enrichirCahier(c)));
	}

	private async enrichirCahier(cahier: any): Promise<CahierResponseDTO> {
		// Récupère le nom de l'événement
		let evenementNom: string | null = null;
		if (cahier.evenement_id) {
			const { data: evenement } = await supabaseServer
				.from('evenements')
				.select('nom')
				.eq('id', cahier.evenement_id)
				.maybeSingle();
			evenementNom = evenement?.nom ?? null;
		}

		// Compte les enregistrements
		const { count: nombreEnregistrements } = await supabaseServer
			.from('enregistrements_cahier')
			.select('*', { count: 'exact', head: true })
			.eq('cahier_id', cahier.id);

		// Somme des montants
		const { data: enregistrements } = await supabaseServer
			.from('enregistrements_cahier')
			.select('montant')
			.eq('cahier_id', cahier.id);

		const totalMontant = (enregistrements || []).reduce(
			(sum: number, e: any) => sum + (e.montant || 0),
			0
		);

		return {
			id: cahier.id,
			nom: cahier.nom,
			prefixeCode: cahier.prefixe_code,
			description: cahier.description,
			actif: cahier.actif,
			creeLe: new Date(cahier.cree_le),
			utilisateurId: cahier.utilisateur_id,
			evenementId: cahier.evenement_id,
			evenementNom,
			nombreEnregistrements: nombreEnregistrements || 0,
			totalMontant,
		};
	}
}

// ── Repository Enregistrements ───────────────────────────────────────────────

export class EnregistrementRepository {
	async create(data: CreateEnregistrementDTO & { code: string }): Promise<EnregistrementResponseDTO> {
		const payload = {
			cahier_id: data.cahierId,
			code: data.code,
			nom_personne: data.nomPersonne,
			note: data.note ?? null,
			montant: data.montant,
			date_heure: data.dateHeure ? formatDateForDb(data.dateHeure) : new Date().toISOString(),
			utilisateur_id: data.utilisateurId,
		};

		const { data: enreg, error } = await supabaseServer
			.from('enregistrements_cahier')
			.insert(payload)
			.select()
			.single();

		if (error) {
			console.error('🔥 [ENREG CREATE] Erreur:', error);
			throw new Error(`Erreur création enregistrement: ${error.message}`);
		}

		return this.toDTO(enreg);
	}

	async findById(id: number): Promise<EnregistrementResponseDTO | null> {
		const { data: enreg, error } = await supabaseServer
			.from('enregistrements_cahier')
			.select()
			.eq('id', id)
			.maybeSingle();

		if (error || !enreg) return null;

		return this.toDTO(enreg);
	}

	async findByCahierId(
		cahierId: number,
		options: PaginationOptions,
		filters?: EnregistrementFilter
	): Promise<PaginatedResponse<EnregistrementResponseDTO>> {
		let query = supabaseServer
			.from('enregistrements_cahier')
			.select('*', { count: 'exact' })
			.eq('cahier_id', cahierId);

		if (filters?.search) {
			query = query.or(`nom_personne.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
		}

		if (filters?.dateDebut) {
			query = query.gte('date_heure', formatDateForDb(filters.dateDebut));
		}
		if (filters?.dateFin) {
			query = query.lte('date_heure', formatDateForDb(filters.dateFin));
		}

		const orderBy = options.orderBy || 'date_heure';
		const order = options.order || 'desc';
		query = query.order(toSnakeCase(orderBy), { ascending: order === 'asc' });

		const skip = (options.page - 1) * options.limit;
		query = query.range(skip, skip + options.limit - 1);

		const { data: enregistrements, error, count } = await query;

		if (error) {
			console.error('🔥 [ENREG FINDBYCAHIER] Erreur:', error);
			throw new Error(`Erreur liste enregistrements: ${error.message}`);
		}

		const totalPages = Math.ceil((count || 0) / options.limit) || 1;

		return {
			data: (enregistrements || []).map((e) => this.toDTO(e)),
			page: options.page,
			total: count || 0,
			totalPages,
			limit: options.limit,
			hasNextPage: options.page < totalPages,
			hasPreviousPage: options.page > 1,
		};
	}

	async compterParCahier(cahierId: number): Promise<number> {
		const { count, error } = await supabaseServer
			.from('enregistrements_cahier')
			.select('*', { count: 'exact', head: true })
			.eq('cahier_id', cahierId);

		if (error) {
			console.error('🔥 [ENREG COUNT] Erreur:', error);
			return 0;
		}

		return count || 0;
	}

	async update(id: number, data: UpdateEnregistrementDTO): Promise<EnregistrementResponseDTO> {
		const payload: any = {};

		if (data.nomPersonne !== undefined) payload.nom_personne = data.nomPersonne;
		if (data.note !== undefined) payload.note = data.note;
		if (data.montant !== undefined) payload.montant = data.montant;
		if (data.dateHeure !== undefined) payload.date_heure = formatDateForDb(data.dateHeure);

		const { data: enreg, error } = await supabaseServer
			.from('enregistrements_cahier')
			.update(payload)
			.eq('id', id)
			.select()
			.single();

		if (error) {
			console.error('🔥 [ENREG UPDATE] Erreur:', error);
			throw new Error(`Erreur mise à jour: ${error.message}`);
		}

		return this.toDTO(enreg);
	}

	async delete(id: number): Promise<EnregistrementResponseDTO> {
		const { data: enreg, error } = await supabaseServer
			.from('enregistrements_cahier')
			.delete()
			.eq('id', id)
			.select()
			.single();

		if (error) {
			console.error('[ENREG DELETE] Erreur:', error);
			throw new Error(`Erreur suppression: ${error.message}`);
		}

		return this.toDTO(enreg);
	}

	async getStatistiques(cahierId: number): Promise<StatistiquesCahier> {
		const { data: enregistrements, error } = await supabaseServer
			.from('enregistrements_cahier')
			.select('montant')
			.eq('cahier_id', cahierId);

		if (error) {
			console.error('🔥 [ENREG STATS] Erreur:', error);
			return {
				nombreEnregistrements: 0,
				totalMontant: 0,
				moyenneMontant: 0,
				montantMax: 0,
				montantMin: 0,
			};
		}

		const montants: number[] = (enregistrements || []).map((e: any) => e.montant || 0);
		const total: number = montants.reduce((sum: number, val: number) => sum + val, 0);
		const moyenne: number = montants.length > 0 ? total / montants.length : 0;
		const max: number = montants.length > 0 ? Math.max(...montants) : 0;
		const min: number = montants.length > 0 ? Math.min(...montants) : 0;

		return {
			nombreEnregistrements: montants.length,
			totalMontant: total,
			moyenneMontant: moyenne,
			montantMax: max,
			montantMin: min,
		};
	}

	private toDTO(enreg: any): EnregistrementResponseDTO {
		return {
			id: enreg.id,
			cahierId: enreg.cahier_id,
			code: enreg.code,
			nomPersonne: enreg.nom_personne,
			note: enreg.note,
			montant: enreg.montant,
			dateHeure: new Date(enreg.date_heure),
			utilisateurId: enreg.utilisateur_id,
			creeLe: new Date(enreg.cree_le),
		};
	}
}

// ── Instances singletons ─────────────────────────────────────────────────────

export const cahierRepository = new CahierRepository();
export const enregistrementRepository = new EnregistrementRepository();