/**
 * Service métier pour les transactions.
 * Contient la logique métier et appelle le repository pour l'accès aux données.
 */

import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { TransactionRepository } from './transaction.repository';
import { dimeService } from '@/modules/dimes/dime.service';
import {
  CreateTransactionDTO,
  UpdateTransactionDTO,
  TransactionResponseDTO,
  PaginationOptions,
  PaginatedResponse,
  TransactionFilter,
} from './transaction.types';

/**
 * Classe de service pour les transactions.
 */
export class TransactionService {
  private repository: TransactionRepository;

  constructor() {
    this.repository = new TransactionRepository();
  }

  /**
   * Crée une nouvelle transaction.
   * Valide que la catégorie existe, est active et le type correspond.
   * Valide que l'évènement existe et est actif si fourni.
   */
  async create(
    data: CreateTransactionDTO,
    utilisateurId: number
  ): Promise<TransactionResponseDTO> {
    // Vérifier que la catégorie existe et est active
    const categorie = await prisma.categorie.findUnique({
      where: { id: data.categorieId },
      select: { id: true, nom: true, type: true, actif: true },
    });

    if (!categorie) {
      throw new Error(`Catégorie avec l'ID ${data.categorieId} introuvable`);
    }

    if (!categorie.actif) {
      throw new Error(`La catégorie "${categorie.nom}" est désactivée`);
    }

    // Vérifier que le type de transaction correspond au type de catégorie
    if (data.type !== categorie.type) {
      throw new Error(
        `Le type de transaction "${data.type}" ne correspond pas au type de catégorie "${categorie.type}"`
      );
    }

    // Vérifier que l'évènement existe et est actif si fourni
    if (data.evenementId) {
      const evenement = await prisma.evenement.findUnique({
        where: { id: data.evenementId },
        select: { id: true, nom: true, actif: true },
      });

      if (!evenement) {
        throw new Error(`Évènement avec l'ID ${data.evenementId} introuvable`);
      }

      if (!evenement.actif) {
        throw new Error(`L'évènement "${evenement.nom}" est désactivé`);
      }
    }

    // Créer la transaction
    const transaction = await this.repository.create(data, utilisateurId);

    // Logger l'action
    await logger.log(
      'TRANSACTION_CREATED',
      `Transaction ${transaction.type} de ${transaction.montant} créée (catégorie: ${categorie.nom})`,
      utilisateurId
    );

    return transaction;
  }

  /**
   * Liste les transactions avec pagination et filtres.
   */
  async findMany(
    pagination: PaginationOptions,
    filters: TransactionFilter
  ): Promise<PaginatedResponse<TransactionResponseDTO>> {
    return this.repository.findMany(pagination, filters);
  }

  /**
   * Récupère une transaction par son ID.
   */
  async findById(id: number): Promise<TransactionResponseDTO | null> {
    return this.repository.findById(id);
  }

  /**
   * Met à jour une transaction.
   * Valide les contraintes métier si les champs concernés changent.
   */
  async update(
    id: number,
    data: UpdateTransactionDTO,
    utilisateurId: number
  ): Promise<TransactionResponseDTO> {
    // Vérifier que la transaction existe
    const transactionExistante = await this.repository.findById(id);
    if (!transactionExistante) {
      throw new Error(`Transaction avec l'ID ${id} introuvable`);
    }

    // Si on change la catégorie, vérifier qu'elle existe et est active
    if (data.categorieId && data.categorieId !== transactionExistante.categorieId) {
      const categorie = await prisma.categorie.findUnique({
        where: { id: data.categorieId },
        select: { id: true, nom: true, type: true, actif: true },
      });

      if (!categorie) {
        throw new Error(`Catégorie avec l'ID ${data.categorieId} introuvable`);
      }

      if (!categorie.actif) {
        throw new Error(`La catégorie "${categorie.nom}" est désactivée`);
      }

      // Vérifier la cohérence du type si on change aussi le type de transaction
      const nouveauType = data.type ?? transactionExistante.type;
      if (nouveauType !== categorie.type) {
        throw new Error(
          `Le type de transaction "${nouveauType}" ne correspond pas au type de catégorie "${categorie.type}"`
        );
      }
    }

    // Si on change le type sans changer la catégorie, vérifier la cohérence
    if (data.type && !data.categorieId && data.type !== transactionExistante.type) {
      const categorieActuelle = await prisma.categorie.findUnique({
        where: { id: transactionExistante.categorieId },
        select: { type: true },
      });

      if (categorieActuelle && data.type !== categorieActuelle.type) {
        throw new Error(
          `Le nouveau type "${data.type}" ne correspond pas au type de la catégorie actuelle "${categorieActuelle.type}"`
        );
      }
    }

    // Si on change l'évènement, vérifier qu'il existe et est actif
    if (data.evenementId && data.evenementId !== transactionExistante.evenementId) {
      const evenement = await prisma.evenement.findUnique({
        where: { id: data.evenementId },
        select: { id: true, nom: true, actif: true },
      });

      if (!evenement) {
        throw new Error(`Évènement avec l'ID ${data.evenementId} introuvable`);
      }

      if (!evenement.actif) {
        throw new Error(`L'évènement "${evenement.nom}" est désactivé`);
      }
    }

    // Si la transaction est la transaction ENTREE d'une dîme,
    // synchroniser via le module dîmes pour maintenir toutes les répartitions cohérentes.
    const repartitionLiee = await prisma.repartitionDime.findUnique({
      where: { transactionId: id },
      select: { id: true },
    });

    if (repartitionLiee) {
      const changementType =
        data.type !== undefined && data.type !== transactionExistante.type;
      const changementCategorie =
        data.categorieId !== undefined && data.categorieId !== transactionExistante.categorieId;

      const champsInterdits = [
        changementType,
        changementCategorie,
        data.pieceJustificative !== undefined,
        data.estSupprime !== undefined,
      ];

      if (champsInterdits.some(Boolean)) {
        throw new Error(
          'Cette transaction est liée à une dîme. Modifiez uniquement montant, description, date, mode de paiement et évènement.'
        );
      }

      await dimeService.syncFromTransactionUpdate(
        id,
        {
          montant: data.montant,
          description: data.description,
          dateOperation: data.dateOperation,
          modePaiement: data.modePaiement,
          evenementId: data.evenementId,
        },
        utilisateurId
      );

      const transactionSynchronisee = await this.repository.findById(id);
      if (!transactionSynchronisee) {
        throw new Error(`Transaction avec l'ID ${id} introuvable`);
      }

      await logger.log(
        'TRANSACTION_UPDATED',
        `Transaction ID ${id} mise à jour et synchronisée avec sa répartition de dîme`,
        utilisateurId
      );

      return transactionSynchronisee;
    }

    // Mettre à jour
    const transactionModifiee = await this.repository.update(id, data);

    // Logger l'action
    await logger.log('TRANSACTION_UPDATED', `Transaction ID ${id} mise à jour`, utilisateurId);

    return transactionModifiee;
  }

  /**
   * Suppression logique d'une transaction.
   * Vérifie qu'elle n'a pas de répartition de dîme.
   */
  async softDelete(id: number, utilisateurId: number): Promise<TransactionResponseDTO> {
    // Vérifier que la transaction existe
    const transaction = await this.repository.findById(id);
    if (!transaction) {
      throw new Error(`Transaction avec l'ID ${id} introuvable`);
    }

    // Vérifier qu'elle n'a pas de répartition de dîme
    const hasRepartition = await this.repository.hasRepartitionDime(id);
    if (hasRepartition) {
      throw new Error(
        'Cette transaction a une répartition de dîme associée. Supprimez d\'abord la répartition.'
      );
    }

    // Supprimer logiquement
    const transactionSupprimee = await this.repository.softDelete(id);

    // Logger l'action
    await logger.log(
      'TRANSACTION_DELETED',
      `Transaction ID ${id} supprimée logiquement`,
      utilisateurId
    );

    return transactionSupprimee;
  }

  /**
   * Calcule le total des transactions selon des filtres.
   * Utile pour les rapports et statistiques.
   */
  async calculateTotal(filters: TransactionFilter): Promise<number> {
    return this.repository.sumMontant(filters);
  }
}
