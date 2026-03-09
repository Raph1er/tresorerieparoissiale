/**
 * Service métier du module Évènements.
 * Il applique les règles métier avant d'appeler le repository.
 */

import logger from '@/lib/logger';
import { evenementRepository } from './evenement.repository';
import {
  CreateEvenementDTO,
  EvenementFilter,
  EvenementResponseDTO,
  PaginatedResponse,
  PaginationOptions,
  UpdateEvenementDTO,
} from './evenement.types';

/**
 * Service principal de gestion des évènements.
 */
export class EvenementService {
  /**
   * Crée un évènement après validations métier.
   */
  async createEvenement(
    data: CreateEvenementDTO,
    createdById: number
  ): Promise<EvenementResponseDTO> {
    const nomNettoye = data.nom.trim();

    if (!nomNettoye) {
      throw new Error("Le nom de l'évènement est requis");
    }

    // Le nom doit rester unique.
    const nomDejaUtilise = await evenementRepository.nomExists(nomNettoye);
    if (nomDejaUtilise) {
      throw new Error(`L'évènement "${nomNettoye}" existe déjà`);
    }

    // Vérifie que la date de début n'est pas dans un passé trop lointain.
    const dateDebut = new Date(data.dateDebut);
    const maintenant = new Date();
    const unAnAvant = new Date();
    unAnAvant.setFullYear(maintenant.getFullYear() - 1);

    if (dateDebut < unAnAvant) {
      throw new Error("La date de début ne peut pas être plus d'un an dans le passé");
    }

    const evenement = await evenementRepository.create({
      ...data,
      nom: nomNettoye,
      description: data.description?.trim() || undefined,
    });

    await logger.log(
      'EVENT_CREATED',
      `Évènement créé: ${evenement.nom} (du ${evenement.dateDebut.toISOString()})`,
      createdById
    );

    return evenement;
  }

  /**
   * Retourne un évènement par ID.
   */
  async getEvenementById(id: number): Promise<EvenementResponseDTO> {
    const evenement = await evenementRepository.findById(id, true);
    if (!evenement) {
      throw new Error(`Évènement avec l'ID ${id} introuvable`);
    }

    return evenement;
  }

  /**
   * Retourne la liste paginée des évènements.
   */
  async getAllEvenements(
    options: PaginationOptions,
    filters?: EvenementFilter
  ): Promise<PaginatedResponse<EvenementResponseDTO>> {
    if (options.page < 1) {
      throw new Error('Le numéro de page doit être supérieur ou égal à 1');
    }

    if (options.limit < 1 || options.limit > 100) {
      throw new Error('La limite doit être comprise entre 1 et 100');
    }

    return evenementRepository.findAll(options, filters);
  }

  /**
   * Met à jour un évènement.
   */
  async updateEvenement(
    id: number,
    data: UpdateEvenementDTO,
    updatedById: number
  ): Promise<EvenementResponseDTO> {
    const evenementExistant = await evenementRepository.findById(id, true);
    if (!evenementExistant) {
      throw new Error(`Évènement avec l'ID ${id} introuvable`);
    }

    const nomNettoye = data.nom?.trim();

    if (nomNettoye !== undefined) {
      if (!nomNettoye) {
        throw new Error("Le nom de l'évènement ne peut pas être vide");
      }

      const nomExiste = await evenementRepository.nomExists(nomNettoye, id);
      if (nomExiste) {
        throw new Error(`L'évènement "${nomNettoye}" existe déjà`);
      }
    }

    // Vérifie la cohérence des dates si modification.
    if (data.dateDebut || data.dateFin) {
      const dateDebutFinale = data.dateDebut ? new Date(data.dateDebut) : evenementExistant.dateDebut;
      const dateFinFinale = data.dateFin === undefined
        ? evenementExistant.dateFin
        : data.dateFin === null
          ? null
          : new Date(data.dateFin);

      if (dateFinFinale && dateFinFinale < dateDebutFinale) {
        throw new Error('La date de fin doit être postérieure à la date de début');
      }
    }

    const evenementMiseAJour = await evenementRepository.update(id, {
      ...data,
      nom: nomNettoye,
      description: data.description !== undefined ? data.description.trim() : undefined,
    });

    await logger.log(
      'EVENT_UPDATED',
      `Évènement mis à jour: ${evenementMiseAJour.nom}`,
      updatedById
    );

    return evenementMiseAJour;
  }

  /**
   * Supprime (logiquement) un évènement.
   */
  async deleteEvenement(id: number, deletedById: number): Promise<EvenementResponseDTO> {
    const evenement = await evenementRepository.findById(id, true);
    if (!evenement) {
      throw new Error(`Évènement avec l'ID ${id} introuvable`);
    }

    const utiliseeParTransactions = await evenementRepository.isUsedByTransactions(id);
    if (utiliseeParTransactions) {
      throw new Error("Impossible de supprimer un évènement déjà utilisé par des transactions");
    }

    const evenementSupprime = await evenementRepository.delete(id);

    await logger.log(
      'EVENT_DELETED',
      `Évènement désactivé: ${evenementSupprime.nom}`,
      deletedById
    );

    return evenementSupprime;
  }

  /**
   * Retourne des statistiques simples sur les évènements.
   */
  async getStatistiques(): Promise<{ totalActifs: number }> {
    const totalActifs = await evenementRepository.countActifs();
    return { totalActifs };
  }
}

// Instance singleton utilisée dans les routes API.
export const evenementService = new EvenementService();
