/**
 * Service metier du module Dimes.
 * Cree automatiquement 1 transaction ENTREE et 3 transactions SORTIE.
 */

import logger from '@/lib/logger';
import prisma from '@/lib/prisma';
import { dimeRepository } from './dime.repository';
import { calculerRepartitionDime } from './dime.calcul';
import type {
  CreateRepartitionDimeDTO,
  PaginatedResponse,
  PaginationOptions,
  RepartitionDimeFilter,
  RepartitionDimeResponseDTO,
} from './dime.types';

const NOM_CATEGORIE_ENTREE = 'Dimes';
const NOM_CATEGORIE_PAROISSE_MERE = 'Dimes - Paroisse Mere';
const NOM_CATEGORIE_RESPONSABLE = 'Dimes - Responsable';
const NOM_CATEGORIE_LEVITES = 'Dimes - Levites';

export class DimeService {
  /**
   * Recupere ou cree les categories systeme pour les dimes.
   */
  private async obtenirCategoriesDimes() {
    const [catEntree, catParoisse, catResponsable, catLevites] = await Promise.all([
      prisma.categorie.findFirst({
        where: { nom: NOM_CATEGORIE_ENTREE, type: 'ENTREE', actif: true },
      }),
      prisma.categorie.findFirst({
        where: { nom: NOM_CATEGORIE_PAROISSE_MERE, type: 'SORTIE', actif: true },
      }),
      prisma.categorie.findFirst({
        where: { nom: NOM_CATEGORIE_RESPONSABLE, type: 'SORTIE', actif: true },
      }),
      prisma.categorie.findFirst({
        where: { nom: NOM_CATEGORIE_LEVITES, type: 'SORTIE', actif: true },
      }),
    ]);

    if (!catEntree) {
      throw new Error(
        `Categorie "${NOM_CATEGORIE_ENTREE}" (ENTREE) introuvable. Creez-la d'abord.`
      );
    }
    if (!catParoisse) {
      throw new Error(
        `Categorie "${NOM_CATEGORIE_PAROISSE_MERE}" (SORTIE) introuvable. Creez-la d'abord.`
      );
    }
    if (!catResponsable) {
      throw new Error(
        `Categorie "${NOM_CATEGORIE_RESPONSABLE}" (SORTIE) introuvable. Creez-la d'abord.`
      );
    }
    if (!catLevites) {
      throw new Error(
        `Categorie "${NOM_CATEGORIE_LEVITES}" (SORTIE) introuvable. Creez-la d'abord.`
      );
    }

    return {
      entree: catEntree,
      paroisseMere: catParoisse,
      responsable: catResponsable,
      levites: catLevites,
    };
  }

  /**
   * Cree une repartition de dime complete:
   * - 1 transaction ENTREE
   * - 3 transactions SORTIE
   * - 1 enregistrement RepartitionDime
   */
  async createRepartition(
    data: CreateRepartitionDimeDTO,
    createdById: number
  ): Promise<RepartitionDimeResponseDTO> {
    if (data.montant <= 0) {
      throw new Error('Le montant de la dime doit etre superieur a 0');
    }

    // Verifier que l'evenement existe si fourni
    if (data.evenementId) {
      const evenement = await prisma.evenement.findUnique({
        where: { id: data.evenementId },
        select: { id: true, actif: true },
      });
      if (!evenement || !evenement.actif) {
        throw new Error('Evenement introuvable ou inactif');
      }
    }

    // Obtenir les categories systeme
    const categories = await this.obtenirCategoriesDimes();

    // Calculer la repartition
    const montants = calculerRepartitionDime(data.montant);

    const dateOp =
      typeof data.dateOperation === 'string'
        ? new Date(data.dateOperation)
        : data.dateOperation;

    // Transaction atomique pour tout creer en une fois
    const resultat = await prisma.$transaction(async (tx) => {
      // 1) Creer la transaction ENTREE
      const transactionEntree = await tx.transaction.create({
        data: {
          type: 'ENTREE',
          montant: data.montant,
          description: data.description ?? 'Dime recue',
          dateOperation: dateOp,
          modePaiement: data.modePaiement ?? null,
          categorieId: categories.entree.id,
          utilisateurId: createdById,
          evenementId: data.evenementId ?? null,
        },
      });

      // 2) Creer les 3 transactions SORTIE
      const descriptionBase = `Repartition dime #${transactionEntree.id}`;

      const transParoisse = await tx.transaction.create({
        data: {
          type: 'SORTIE',
          montant: montants.partParoisseMere,
          description: `${descriptionBase} - Paroisse Mere`,
          dateOperation: dateOp,
          categorieId: categories.paroisseMere.id,
          utilisateurId: createdById,
          evenementId: data.evenementId ?? null,
        },
      });

      const transResponsable = await tx.transaction.create({
        data: {
          type: 'SORTIE',
          montant: montants.partResponsable,
          description: `${descriptionBase} - Responsable`,
          dateOperation: dateOp,
          categorieId: categories.responsable.id,
          utilisateurId: createdById,
          evenementId: data.evenementId ?? null,
        },
      });

      const transLevites = await tx.transaction.create({
        data: {
          type: 'SORTIE',
          montant: montants.partLevites,
          description: `${descriptionBase} - Levites`,
          dateOperation: dateOp,
          categorieId: categories.levites.id,
          utilisateurId: createdById,
          evenementId: data.evenementId ?? null,
        },
      });

      // 3) Creer l'enregistrement RepartitionDime
      const repartition = await tx.repartitionDime.create({
        data: {
          transactionId: transactionEntree.id,
          totalDime: montants.totalDime,
          partParoisseMere: montants.partParoisseMere,
          partCaisseLocale: montants.partCaisseLocale,
          partResponsable: montants.partResponsable,
          partLevites: montants.partLevites,
        },
      });

      return {
        repartition,
        transactionEntree,
        transParoisse,
        transResponsable,
        transLevites,
      };
    });

    await logger.log(
      'TITHES_CREATED',
      `Repartition dime creee: ${data.montant} => Paroisse ${montants.partParoisseMere}, Responsable ${montants.partResponsable}, Levites ${montants.partLevites}, Caisse locale ${montants.partCaisseLocale}`,
      createdById
    );

    return {
      id: resultat.repartition.id,
      transactionId: resultat.transactionEntree.id,
      totalDime: montants.totalDime,
      partParoisseMere: montants.partParoisseMere,
      partCaisseLocale: montants.partCaisseLocale,
      partResponsable: montants.partResponsable,
      partLevites: montants.partLevites,
      creeLe: resultat.repartition.creeLe,
      transactionEntree: {
        id: resultat.transactionEntree.id,
        montant: resultat.transactionEntree.montant,
        description: resultat.transactionEntree.description,
        dateOperation: resultat.transactionEntree.dateOperation,
      },
      transactionsGeneres: {
        paroisseMere: {
          id: resultat.transParoisse.id,
          montant: resultat.transParoisse.montant,
        },
        responsable: {
          id: resultat.transResponsable.id,
          montant: resultat.transResponsable.montant,
        },
        levites: {
          id: resultat.transLevites.id,
          montant: resultat.transLevites.montant,
        },
      },
    };
  }

  /**
   * Retourne une repartition par ID.
   */
  async getRepartitionById(id: number): Promise<RepartitionDimeResponseDTO> {
    const repartition = await dimeRepository.findById(id);
    if (!repartition) {
      throw new Error(`Repartition avec l'ID ${id} introuvable`);
    }

    // Recuperer les transactions generees
    const transactionsGeneres = await prisma.transaction.findMany({
      where: {
        description: {
          contains: `Repartition dime #${repartition.transactionId}`,
        },
        type: 'SORTIE',
      },
      select: { id: true, montant: true, description: true },
    });

    const paroisse = transactionsGeneres.find((t) => t.description?.includes('Paroisse Mere'));
    const responsable = transactionsGeneres.find((t) => t.description?.includes('Responsable'));
    const levites = transactionsGeneres.find((t) => t.description?.includes('Levites'));

    return {
      ...repartition,
      transactionEntree: repartition.transactionEntree,
      transactionsGeneres: {
        paroisseMere: paroisse
          ? { id: paroisse.id, montant: paroisse.montant }
          : { id: 0, montant: 0 },
        responsable: responsable
          ? { id: responsable.id, montant: responsable.montant }
          : { id: 0, montant: 0 },
        levites: levites ? { id: levites.id, montant: levites.montant } : { id: 0, montant: 0 },
      },
    };
  }

  /**
   * Liste paginee des repartitions.
   */
  async getAllRepartitions(
    options: PaginationOptions,
    filters: RepartitionDimeFilter
  ): Promise<PaginatedResponse<RepartitionDimeResponseDTO>> {
    if (options.page < 1) {
      throw new Error('Le numero de page doit etre superieur ou egal a 1');
    }

    if (options.limit < 1 || options.limit > 100) {
      throw new Error('La limite doit etre comprise entre 1 et 100');
    }

    const resultBase = await dimeRepository.findAll(options, filters);

    // Enrichir chaque item avec les transactions generes
    const dataEnrichi = await Promise.all(
      resultBase.data.map(async (item) => {
        const transactionsGeneres = await prisma.transaction.findMany({
          where: {
            description: {
              contains: `Repartition dime #${item.transactionId}`,
            },
            type: 'SORTIE',
          },
          select: { id: true, montant: true, description: true },
        });

        const paroisse = transactionsGeneres.find((t) =>
          t.description?.includes('Paroisse Mere')
        );
        const responsable = transactionsGeneres.find((t) => t.description?.includes('Responsable'));
        const levites = transactionsGeneres.find((t) => t.description?.includes('Levites'));

        return {
          ...item,
          transactionEntree: item.transactionEntree,
          transactionsGeneres: {
            paroisseMere: paroisse
              ? { id: paroisse.id, montant: paroisse.montant }
              : { id: 0, montant: 0 },
            responsable: responsable
              ? { id: responsable.id, montant: responsable.montant }
              : { id: 0, montant: 0 },
            levites: levites ? { id: levites.id, montant: levites.montant } : { id: 0, montant: 0 },
          },
        };
      })
    );

    return {
      ...resultBase,
      data: dataEnrichi,
    };
  }

  /**
   * Supprime une repartition (et ses transactions associees).
   */
  async deleteRepartition(id: number, deletedById: number): Promise<RepartitionDimeResponseDTO> {
    const repartition = await dimeRepository.findById(id);
    if (!repartition) {
      throw new Error(`Repartition avec l'ID ${id} introuvable`);
    }

    // Retrouver les transactions generes
    const transactionsGeneres = await prisma.transaction.findMany({
      where: {
        OR: [
          { id: repartition.transactionId },
          {
            description: {
              contains: `Repartition dime #${repartition.transactionId}`,
            },
          },
        ],
      },
    });

    // Supprimer en transaction atomique
    await prisma.$transaction(async (tx) => {
      // Supprimer la repartition d'abord (FK)
      await tx.repartitionDime.delete({ where: { id } });

      // Supprimer logiquement les transactions
      await tx.transaction.updateMany({
        where: {
          id: {
            in: transactionsGeneres.map((t) => t.id),
          },
        },
        data: { estSupprime: true },
      });
    });

    await logger.log(
      'TITHES_DELETED',
      `Repartition dime supprimee (ID ${id}, ${transactionsGeneres.length} transactions)`,
      deletedById
    );

    return this.getRepartitionById(id);
  }
}

export const dimeService = new DimeService();
