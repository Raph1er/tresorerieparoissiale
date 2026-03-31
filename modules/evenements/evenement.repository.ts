/**
 * Repository pour l'accès aux données des évènements.
 * Cette couche centralise toutes les requêtes Prisma.
 */

import supabaseDb from '@/lib/supabase-db';
import {
  CreateEvenementDTO,
  EvenementFilter,
  EvenementResponseDTO,
  PaginatedResponse,
  PaginationOptions,
  UpdateEvenementDTO,
} from './evenement.types';

type EvenementDbPayload = {
  id: number;
  nom: string;
  description: string | null;
  dateDebut: Date;
  dateFin: Date | null;
  actif: boolean;
  creeLe: Date;
  _count: {
    transactions: number;
  };
};

/**
 * Convertit un résultat Prisma en DTO de réponse API.
 */
function versEvenementResponseDTO(evenement: EvenementDbPayload): EvenementResponseDTO {
  return {
    id: evenement.id,
    nom: evenement.nom,
    description: evenement.description,
    dateDebut: evenement.dateDebut,
    dateFin: evenement.dateFin,
    actif: evenement.actif,
    creeLe: evenement.creeLe,
    transactionCount: evenement._count.transactions,
  };
}

/**
 * Classe repository du module Évènements.
 */
export class EvenementRepository {
  private readonly selectEvenement = {
    id: true,
    nom: true,
    description: true,
    dateDebut: true,
    dateFin: true,
    actif: true,
    creeLe: true,
    _count: {
      select: {
        transactions: true,
      },
    },
  } as const;

  /**
   * Crée un nouvel évènement.
   */
  async create(data: CreateEvenementDTO): Promise<EvenementResponseDTO> {
    const evenement = await supabaseDb.evenement.create({
      data: {
        nom: data.nom,
        description: data.description ?? null,
        dateDebut: new Date(data.dateDebut),
        dateFin: data.dateFin ? new Date(data.dateFin) : null,
        actif: true,
      },
      select: this.selectEvenement,
    });

    return versEvenementResponseDTO(evenement as EvenementDbPayload);
  }

  /**
   * Récupère un évènement par son ID.
   */
  async findById(id: number, includeInactive = true): Promise<EvenementResponseDTO | null> {
    const where: any = { id };

    const evenement = await supabaseDb.evenement.findUnique({
      where,
      select: this.selectEvenement,
    });

    if (!evenement) {
      return null;
    }

    if (!includeInactive && !evenement.actif) {
      return null;
    }

    return versEvenementResponseDTO(evenement as EvenementDbPayload);
  }

  /**
   * Met à jour un évènement existant.
   */
  async update(id: number, data: UpdateEvenementDTO): Promise<EvenementResponseDTO> {
    const updateData: any = {};

    if (data.nom !== undefined) updateData.nom = data.nom;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.dateDebut !== undefined) updateData.dateDebut = new Date(data.dateDebut);
    if (data.dateFin !== undefined) {
      updateData.dateFin = data.dateFin === null ? null : new Date(data.dateFin);
    }
    if (data.actif !== undefined) updateData.actif = data.actif;

    const evenement = await supabaseDb.evenement.update({
      where: { id },
      data: updateData,
      select: this.selectEvenement,
    });

    return versEvenementResponseDTO(evenement as EvenementDbPayload);
  }

  /**
   * Désactive un évènement (suppression logique).
   */
  async delete(id: number): Promise<EvenementResponseDTO> {
    const evenement = await supabaseDb.evenement.update({
      where: { id },
      data: {
        actif: false,
      },
      select: this.selectEvenement,
    });

    return versEvenementResponseDTO(evenement as EvenementDbPayload);
  }

  /**
   * Liste paginée des évènements avec filtres.
   */
  async findAll(
    options: PaginationOptions,
    filters?: EvenementFilter
  ): Promise<PaginatedResponse<EvenementResponseDTO>> {
    const where: any = {};

    // Filtre textuel sur le nom et la description.
    if (filters?.search) {
      where.OR = [
        { nom: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    if (filters?.actif !== undefined) {
      where.actif = filters.actif;
    }

    // Filtre par plage de dates de début.
    if (filters?.dateDebutDe || filters?.dateDebutJusqua) {
      where.dateDebut = {};
      if (filters.dateDebutDe) {
        where.dateDebut.gte = new Date(filters.dateDebutDe);
      }
      if (filters.dateDebutJusqua) {
        where.dateDebut.lte = new Date(filters.dateDebutJusqua);
      }
    }

    // Filtre évènements en cours (dateDebut <= maintenant <= dateFin OU dateFin null).
    if (filters?.enCours !== undefined && filters.enCours) {
      const maintenant = new Date();
      where.dateDebut = { lte: maintenant };
      where.OR = [
        { dateFin: null },
        { dateFin: { gte: maintenant } },
      ];
    }

    const total = await supabaseDb.evenement.count({ where });
    const totalPages = Math.ceil(total / options.limit) || 1;
    const skip = (options.page - 1) * options.limit;

    const orderBy: any = {
      [options.orderBy ?? 'dateDebut']: options.order ?? 'desc',
    };

    const evenements = await supabaseDb.evenement.findMany({
      where,
      select: this.selectEvenement,
      skip,
      take: options.limit,
      orderBy,
    });

    return {
      data: evenements.map((evenement: any) => versEvenementResponseDTO(evenement as EvenementDbPayload)),
      page: options.page,
      total,
      totalPages,
      limit: options.limit,
      hasNextPage: options.page < totalPages,
      hasPreviousPage: options.page > 1,
    };
  }

  /**
   * Vérifie si un nom d'évènement existe déjà.
   */
  async nomExists(nom: string, exceptId?: number): Promise<boolean> {
    const where: any = {
      nom,
    };

    if (exceptId) {
      where.id = { not: exceptId };
    }

    const count = await supabaseDb.evenement.count({ where });
    return count > 0;
  }

  /**
   * Vérifie si un évènement est utilisé par des transactions.
   */
  async isUsedByTransactions(id: number): Promise<boolean> {
    const count = await supabaseDb.transaction.count({
      where: {
        evenementId: id,
        estSupprime: false,
      },
    });

    return count > 0;
  }

  /**
   * Compte les évènements actifs.
   */
  async countActifs(): Promise<number> {
    return supabaseDb.evenement.count({
      where: {
        actif: true,
      },
    });
  }
}

// Instance singleton utilisée par le service.
export const evenementRepository = new EvenementRepository();
