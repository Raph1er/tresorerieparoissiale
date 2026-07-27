/**
 * Repository pour les repartitions de dimes.
 */

import supabaseDb from '@/lib/supabase-db';
import { TypeTransaction } from '@/types/enums';
import type {
  PaginatedResponse,
  PaginationOptions,
  RepartitionDimeFilter,
  RepartitionDimeResponseDTO,
  RepartitionMontants,
} from './dime.types';

type RepartitionDbPayload = {
  id: number;
  transactionId: number;
  totalDime: number;
  partParoisseMere: number;
  partCaisseLocale: number;
  partResponsable: number;
  partLevites: number;
  creeLe: Date;
  transaction: {
    id: number;
    montant: number;
    type: TypeTransaction;
    description: string | null;
    dateOperation: Date;
    utilisateurId: number;
  };
};

function versRepartitionDTO(item: RepartitionDbPayload): RepartitionDimeResponseDTO {
  return {
    id: item.id,
    transactionId: item.transactionId,
    totalDime: item.totalDime,
    partParoisseMere: item.partParoisseMere,
    partCaisseLocale: item.partCaisseLocale,
    partResponsable: item.partResponsable,
    partLevites: item.partLevites,
    creeLe: item.creeLe,
    transactionEntree: {
      id: item.transaction.id,
      montant: item.transaction.montant,
      description: item.transaction.description,
      dateOperation: item.transaction.dateOperation,
    },
    transactionsGeneres: {
      paroisseMere: { id: 0, montant: item.partParoisseMere },
      responsable: { id: 0, montant: item.partResponsable },
      levites: { id: 0, montant: item.partLevites },
    },
  };
}

export class DimeRepository {
  private readonly selectRepartition = {
    id: true,
    transactionId: true,
    totalDime: true,
    partParoisseMere: true,
    partCaisseLocale: true,
    partResponsable: true,
    partLevites: true,
    creeLe: true,
    transaction: {
      select: {
        id: true,
        montant: true,
        type: true,
        description: true,
        dateOperation: true,
        utilisateurId: true,
      },
    },
  } as const;

  async create(
    transactionId: number,
    montants: RepartitionMontants
  ): Promise<RepartitionDimeResponseDTO> {
    const created = await supabaseDb.repartitionDime.create({
      data: {
        transactionId,
        totalDime: montants.totalDime,
        partParoisseMere: montants.partParoisseMere,
        partCaisseLocale: montants.partCaisseLocale,
        partResponsable: montants.partResponsable,
        partLevites: montants.partLevites,
      },
      select: this.selectRepartition,
    });

    return versRepartitionDTO(created as RepartitionDbPayload);
  }

  async findById(id: number, utilisateurId?: number): Promise<RepartitionDimeResponseDTO | null> {
    const item = await supabaseDb.repartitionDime.findUnique({
      where: { id },
      select: this.selectRepartition,
    });

    if (!item) {
      return null;
    }

    if (utilisateurId !== undefined && item.transaction.utilisateurId !== utilisateurId) {
      return null;
    }

    return versRepartitionDTO(item as RepartitionDbPayload);
  }

  async findByTransactionId(
    transactionId: number,
    utilisateurId?: number
  ): Promise<RepartitionDimeResponseDTO | null> {
    const item = await supabaseDb.repartitionDime.findUnique({
      where: { transactionId },
      select: this.selectRepartition,
    });

    if (!item) {
      return null;
    }

    if (utilisateurId !== undefined && item.transaction.utilisateurId !== utilisateurId) {
      return null;
    }

    return versRepartitionDTO(item as RepartitionDbPayload);
  }

  async findAll(
    pagination: PaginationOptions,
    filters: RepartitionDimeFilter
  ): Promise<PaginatedResponse<RepartitionDimeResponseDTO>> {
    const where: any = {};

    if (filters.utilisateurId !== undefined) {
      const transactionWhere: any = { utilisateurId: filters.utilisateurId };
      if (filters.transactionId !== undefined) {
        transactionWhere.id = filters.transactionId;
      }
      const transactions = await supabaseDb.transaction.findMany({
        where: transactionWhere,
        select: { id: true },
      });
      const transactionIds = transactions.map((transaction: any) => transaction.id);

      if (transactionIds.length === 0) {
        return {
          data: [],
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: 0,
            totalPages: 0,
          },
        };
      }

      where.transactionId = { in: transactionIds };
    } else if (filters.transactionId) {
      where.transactionId = filters.transactionId;
    }

    if (filters.dateDe || filters.dateJusqua) {
      where.creeLe = {};
      if (filters.dateDe) {
        where.creeLe.gte = filters.dateDe;
      }
      if (filters.dateJusqua) {
        where.creeLe.lte = filters.dateJusqua;
      }
    }

    const orderBy: any = {};
    if (filters.orderBy) {
      orderBy[filters.orderBy] = filters.order ?? 'desc';
    } else {
      orderBy.creeLe = 'desc';
    }

    const skip = (pagination.page - 1) * pagination.limit;

    const [items, total] = await Promise.all([
      supabaseDb.repartitionDime.findMany({
        where,
        select: this.selectRepartition,
        orderBy,
        skip,
        take: pagination.limit,
      }),
      supabaseDb.repartitionDime.count({ where }),
    ]);

    return {
      data: items.map((item: any) => versRepartitionDTO(item as RepartitionDbPayload)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  async delete(id: number): Promise<RepartitionDimeResponseDTO> {
    const item = await supabaseDb.repartitionDime.delete({
      where: { id },
      select: this.selectRepartition,
    });

    return versRepartitionDTO(item as RepartitionDbPayload);
  }
}

export const dimeRepository = new DimeRepository();
