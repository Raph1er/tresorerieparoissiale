/**
 * Repository pour l'accès aux données des transactions.
 * Cette couche centralise toutes les requêtes Prisma du module.
 */

import supabaseDb from '@/lib/supabase-db';
import { TypeTransaction } from '@/types/enums';
import { nettoyerDescriptionRepartition } from '@/utils/repartition-description';
import {
    TransactionFilter,
    TransactionResponseDTO,
    CreateTransactionDTO,
    PaginatedResponse,
    PaginationOptions,
    UpdateTransactionDTO,
} from './transaction.types';

type TransactionDbPayload = {
    id: number;
    type: TypeTransaction;
    montant: number;
    description: string | null;
    dateOperation: Date;
    modePaiement: string | null;
    pieceJustificative: string | null;
    estSupprime: boolean;
    creeLe: Date;
    modifieLe: Date;
    categorieId: number | null;
    categorie: {
        id: number;
        nom: string;
        type: TypeTransaction;
    } | null;
    utilisateurId: number;
    utilisateur: {
        id: number;
        nom: string;
        email: string;
    };
    evenementId: number | null;
    evenement: {
        id: number;
        nom: string;
    } | null;
};

/**
 * Convertit un résultat Prisma en DTO de réponse API.
 */
function versTransactionResponseDTO(transaction: TransactionDbPayload): TransactionResponseDTO {
    const estJamaisModifie =
        transaction.modifieLe.getTime() === transaction.creeLe.getTime();

    return {
        id: transaction.id,
        type: transaction.type,
        montant: transaction.montant,
        description: nettoyerDescriptionRepartition(
            transaction.description,
            transaction.categorie?.nom
        ),
        dateOperation: transaction.dateOperation,
        modePaiement: transaction.modePaiement,
        pieceJustificative: transaction.pieceJustificative,
        estSupprime: transaction.estSupprime,
        creeLe: transaction.creeLe,
        modifieLe: estJamaisModifie ? null : transaction.modifieLe,
        categorieId: transaction.categorieId,
        categorie: transaction.categorie,
        utilisateurId: transaction.utilisateurId,
        utilisateur: transaction.utilisateur,
        evenementId: transaction.evenementId,
        evenement: transaction.evenement,
    };
}

/**
 * Classe repository du module Transactions.
 */
export class TransactionRepository {
    private readonly selectTransaction = {
        id: true,
        type: true,
        montant: true,
        description: true,
        dateOperation: true,
        modePaiement: true,
        pieceJustificative: true,
        estSupprime: true,
        creeLe: true,
        modifieLe: true,
        categorieId: true,
        categorie: {
            select: {
                id: true,
                nom: true,
                type: true,
            },
        },
        utilisateurId: true,
        utilisateur: {
            select: {
                id: true,
                nom: true,
                email: true,
            },
        },
        evenementId: true,
        evenement: {
            select: {
                id: true,
                nom: true,
            },
        },
    } as const;

    /**
     * Crée une nouvelle transaction.
     */
    async create(
        data: CreateTransactionDTO,
        utilisateurId: number
    ): Promise<TransactionResponseDTO> {
        const transaction = await supabaseDb.transaction.create({
            data: {
                type: data.type,
                montant: data.montant,
                description: data.description ?? null,
                dateOperation: typeof data.dateOperation === 'string'
                    ? new Date(data.dateOperation)
                    : data.dateOperation,
                modePaiement: data.modePaiement ?? null,
                pieceJustificative: data.pieceJustificative ?? null,
                categorieId: data.categorieId ?? null,
                utilisateurId: utilisateurId,
                evenementId: data.evenementId ?? null,
                estSupprime: false,
            },
            select: this.selectTransaction,
        });

        return versTransactionResponseDTO(transaction as TransactionDbPayload);
    }

    /**
     * Récupère toutes les transactions avec pagination et filtres.
     */
    async findMany(
        pagination: PaginationOptions,
        filters: TransactionFilter
    ): Promise<PaginatedResponse<TransactionResponseDTO>> {
        const where: any = {};

        // Filtre par type
        if (filters.type) {
            where.type = filters.type;
        }

        // Filtre par catégorie
        if (filters.categorieId) {
            where.categorieId = filters.categorieId;
        }

        // Filtre par évènement
        if (filters.evenementId !== undefined) {
            where.evenementId = filters.evenementId;
        }

        // Filtre par utilisateur
        if (filters.utilisateurId) {
            where.utilisateurId = filters.utilisateurId;
        }

        // Filtre par date d'opération
        if (filters.dateOperationDe || filters.dateOperationJusqua) {
            where.dateOperation = {};
            if (filters.dateOperationDe) {
                where.dateOperation.gte = filters.dateOperationDe;
            }
            if (filters.dateOperationJusqua) {
                where.dateOperation.lte = filters.dateOperationJusqua;
            }
        }

        // Filtre par montant
        if (filters.montantMin !== undefined || filters.montantMax !== undefined) {
            where.montant = {};
            if (filters.montantMin !== undefined) {
                where.montant.gte = filters.montantMin;
            }
            if (filters.montantMax !== undefined) {
                where.montant.lte = filters.montantMax;
            }
        }

        // Recherche textuelle dans description
        if (filters.search) {
            where.description = {
                contains: filters.search,
            };
        }

        // Filtre par suppression logique
        if (filters.estSupprime !== undefined) {
            where.estSupprime = filters.estSupprime;
        } else {
            // Par défaut, ne montrer que les transactions non supprimées
            where.estSupprime = false;
        }

        // Tri
        const orderBy: any = {};
        if (filters.orderBy) {
            orderBy[filters.orderBy] = filters.order ?? 'desc';
        } else {
            // Tri par défaut : date d'opération décroissante (plus récentes d'abord)
            orderBy.dateOperation = 'desc';
        }

        // Calcul de pagination
        const skip = (pagination.page - 1) * pagination.limit;

        // Requêtes en parallèle
        const [transactions, total] = await Promise.all([
            supabaseDb.transaction.findMany({
                where,
                select: this.selectTransaction,
                orderBy,
                skip,
                take: pagination.limit,
            }),
            supabaseDb.transaction.count({ where }),
        ]);

        return {
            data: transactions.map((t: any) => versTransactionResponseDTO(t as TransactionDbPayload)),
            pagination: {
                page: pagination.page,
                limit: pagination.limit,
                total,
                totalPages: Math.ceil(total / pagination.limit),
            },
        };
    }

    /**
     * Récupère une transaction par son ID.
     */
    async findById(id: number): Promise<TransactionResponseDTO | null> {
        const transaction = await supabaseDb.transaction.findUnique({
            where: { id },
            select: this.selectTransaction,
        });

        if (!transaction) return null;

        return versTransactionResponseDTO(transaction as TransactionDbPayload);
    }

    /**
     * Met à jour une transaction.
     */
    async update(id: number, data: UpdateTransactionDTO): Promise<TransactionResponseDTO> {
        const updateData: any = {};

        if (data.type !== undefined) updateData.type = data.type;
        if (data.montant !== undefined) updateData.montant = data.montant;
        if (data.description !== undefined) updateData.description = data.description || null;
        if (data.dateOperation !== undefined) {
            updateData.dateOperation = typeof data.dateOperation === 'string'
                ? new Date(data.dateOperation)
                : data.dateOperation;
        }
        if (data.modePaiement !== undefined) updateData.modePaiement = data.modePaiement || null;
        if (data.pieceJustificative !== undefined) {
            updateData.pieceJustificative = data.pieceJustificative || null;
        }
        if (data.categorieId !== undefined) {
            if (data.categorieId === null) {
                updateData.categorie = {
                    disconnect: true,
                };
            } else {
                updateData.categorie = {
                    connect: { id: data.categorieId },
                };
            }
        }
        if (data.evenementId !== undefined) {
            if (data.evenementId === null) {
                updateData.evenement = {
                    disconnect: true,
                };
            } else {
                updateData.evenement = {
                    connect: { id: data.evenementId },
                };
            }
        }
        if (data.estSupprime !== undefined) updateData.estSupprime = data.estSupprime;

        const transaction = await supabaseDb.transaction.update({
            where: { id },
            data: updateData,
            select: this.selectTransaction,
        });

        return versTransactionResponseDTO(transaction as TransactionDbPayload);
    }

    /**
     * Suppression logique d'une transaction.
     */
    async softDelete(id: number): Promise<TransactionResponseDTO> {
        const transaction = await supabaseDb.transaction.update({
            where: { id },
            data: { estSupprime: true },
            select: this.selectTransaction,
        });

        return versTransactionResponseDTO(transaction as TransactionDbPayload);
    }

    /**
     * Vérifie si une transaction a déjà une répartition de dîme.
     */
    async hasRepartitionDime(id: number): Promise<boolean> {
        const count = await supabaseDb.repartitionDime.count({
            where: { transactionId: id },
        });
        return count > 0;
    }

    /**
     * Calcule la somme totale des transactions selon des filtres.
     * Utile pour les rapports financiers.
     */
    async sumMontant(filters: TransactionFilter): Promise<number> {
        const where: any = {};

        if (filters.type) where.type = filters.type;
        if (filters.categorieId) where.categorieId = filters.categorieId;
        if (filters.evenementId !== undefined) where.evenementId = filters.evenementId;
        if (filters.utilisateurId) where.utilisateurId = filters.utilisateurId;
        if (filters.dateOperationDe || filters.dateOperationJusqua) {
            where.dateOperation = {};
            if (filters.dateOperationDe) where.dateOperation.gte = filters.dateOperationDe;
            if (filters.dateOperationJusqua) where.dateOperation.lte = filters.dateOperationJusqua;
        }
        if (filters.estSupprime !== undefined) {
            where.estSupprime = filters.estSupprime;
        } else {
            where.estSupprime = false;
        }

        const result = await supabaseDb.transaction.aggregate({
            where,
            _sum: {
                montant: true,
            },
        });

        return result._sum.montant ?? 0;
    }
}
