/**
 * Service metier du module Dimes.
 * Cree automatiquement 1 transaction ENTREE et 3 transactions SORTIE.
 */

import logger from '@/lib/logger';
import supabaseDb from '@/lib/supabase-db';
import { supabaseServer } from '@/lib/supabase';
import { dimeRepository } from './dime.repository';
import { calculerRepartitionDime } from './dime.calcul';
import type {
  CreateRepartitionDimeDTO,
  PaginatedResponse,
  PaginationOptions,
  RepartitionDimeFilter,
  RepartitionDimeResponseDTO,
  UpdateRepartitionDimeDTO,
} from './dime.types';

const NOM_CATEGORIE_ENTREE = 'Dîme totale Décaissée';
const NOM_CATEGORIE_PAROISSE_MERE = 'Dîme la Paroisse Mère';
const NOM_CATEGORIE_RESPONSABLE = 'Dîme au Chargé';
const NOM_CATEGORIE_LEVITES = 'Dîme aux Lévites';

function parseDateInput(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }

  const trimmed = value.trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  return new Date(trimmed);
}

function toDbTimestamp(value: Date | string): string {
  const date = parseDateInput(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const seconds = `${date.getSeconds()}`.padStart(2, '0');
  const milliseconds = `${date.getMilliseconds()}`.padStart(3, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
}

export class DimeService {
  private construireDescriptionBase(transactionId: number): string {
    return `Repartition - `;
  }

  private async validerEvenementActif(evenementId: number | null | undefined): Promise<void> {
    if (evenementId === undefined || evenementId === null) {
      return;
    }

    const evenement = await supabaseDb.evenement.findUnique({
      where: { id: evenementId },
      select: { id: true, actif: true },
    });

    if (!evenement || !evenement.actif) {
      throw new Error('Evenement introuvable ou inactif');
    }
  }

  private async trouverTransactionsGenerees(transactionEntreeId: number) {
    const descriptionBase = this.construireDescriptionBase(transactionEntreeId);

    const transactionsGeneres = await supabaseDb.transaction.findMany({
      where: {
        description: {
          contains: descriptionBase,
        },
        type: 'SORTIE',
        estSupprime: false,
      },
      select: { id: true, montant: true, description: true },
    });

    return {
      descriptionBase,
      paroisse: transactionsGeneres.find((t: any) => t.description?.includes('Paroisse Mere')),
      responsable: transactionsGeneres.find((t: any) => t.description?.includes('Responsable')),
      levites: transactionsGeneres.find((t: any) => t.description?.includes('Levites')),
    };
  }

  private async synchroniserRepartitionParTransactionId(
    transactionEntreeId: number,
    data: UpdateRepartitionDimeDTO,
    updatedById: number,
    source: 'DIME' | 'TRANSACTION'
  ): Promise<RepartitionDimeResponseDTO> {
    const repartition = await dimeRepository.findByTransactionId(transactionEntreeId);
    if (!repartition) {
      throw new Error(`Aucune repartition de dime trouvee pour la transaction ${transactionEntreeId}`);
    }

    const transactionEntree = await supabaseDb.transaction.findUnique({
      where: { id: transactionEntreeId },
      select: {
        id: true,
        montant: true,
        description: true,
        dateOperation: true,
        modePaiement: true,
        evenementId: true,
      },
    });

    if (!transactionEntree) {
      throw new Error(`Transaction ENTREE de dime introuvable (ID ${transactionEntreeId})`);
    }

    await this.validerEvenementActif(data.evenementId);

    const montantFinal = data.montant ?? transactionEntree.montant;
    if (montantFinal <= 0) {
      throw new Error('Le montant de la dime doit etre superieur a 0');
    }

    const dateOperationFinale =
      data.dateOperation !== undefined
        ? typeof data.dateOperation === 'string'
          ? parseDateInput(data.dateOperation)
          : data.dateOperation
        : transactionEntree.dateOperation;

    const descriptionFinale =
      data.description !== undefined ? data.description.trim() || null : transactionEntree.description;

    const modePaiementFinal =
      data.modePaiement !== undefined ? data.modePaiement.trim() || null : transactionEntree.modePaiement;

    const evenementIdFinal =
      data.evenementId !== undefined ? data.evenementId : transactionEntree.evenementId;

    const montants = calculerRepartitionDime(montantFinal);
    const generated = await this.trouverTransactionsGenerees(transactionEntreeId);

    const { error: syncError } = await supabaseServer.rpc('rpc_dime_sync_repartition', {
      p_repartition_id: repartition.id,
      p_transaction_entree_id: transactionEntreeId,
      p_montant: montantFinal,
      p_description: descriptionFinale,
      p_date_operation: toDbTimestamp(dateOperationFinale),
      p_mode_paiement: modePaiementFinal,
      p_evenement_id: evenementIdFinal ?? null,
      p_part_paroisse_mere: montants.partParoisseMere,
      p_part_caisse_locale: montants.partCaisseLocale,
      p_part_responsable: montants.partResponsable,
      p_part_levites: montants.partLevites,
      p_generated_description_base: generated.descriptionBase,
      p_generated_paroisse_id: generated.paroisse?.id ?? null,
      p_generated_responsable_id: generated.responsable?.id ?? null,
      p_generated_levites_id: generated.levites?.id ?? null,
    });

    if (syncError) {
      throw new Error(`Echec synchronisation atomique RPC: ${syncError.message}`);
    }

    await logger.log(
      'TITHES_UPDATED',
      `Repartition dime synchronisee depuis ${source === 'DIME' ? 'le module dimes' : 'une transaction'} (transaction ENTREE ${transactionEntreeId})`,
      updatedById
    );

    return this.getRepartitionById(repartition.id);
  }

  /**
   * Recupere ou cree les categories systeme pour les dimes.
   */
  private async obtenirCategoriesDimes() {
    const [catEntree, catParoisse, catResponsable, catLevites] = await Promise.all([
      supabaseDb.categorie.findFirst({
        where: { nom: NOM_CATEGORIE_ENTREE, type: 'ENTREE', actif: true },
      }),
      supabaseDb.categorie.findFirst({
        where: { nom: NOM_CATEGORIE_PAROISSE_MERE, type: 'SORTIE', actif: true },
      }),
      supabaseDb.categorie.findFirst({
        where: { nom: NOM_CATEGORIE_RESPONSABLE, type: 'SORTIE', actif: true },
      }),
      supabaseDb.categorie.findFirst({
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
      const evenement = await supabaseDb.evenement.findUnique({
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
        ? parseDateInput(data.dateOperation)
        : data.dateOperation;

    const descriptionEntree = data.description ?? 'Dime recue';
    const descriptionBase = 'Repartition - ';

    const { data: creationRpcRows, error: creationRpcError } = await supabaseServer.rpc(
      'rpc_dime_create_repartition',
      {
        p_montant: data.montant,
        p_description: descriptionEntree,
        p_date_operation: toDbTimestamp(dateOp),
        p_mode_paiement: data.modePaiement ?? null,
        p_evenement_id: data.evenementId ?? null,
        p_utilisateur_id: createdById,
        p_categorie_entree_id: categories.entree.id,
        p_categorie_paroisse_id: categories.paroisseMere.id,
        p_categorie_responsable_id: categories.responsable.id,
        p_categorie_levites_id: categories.levites.id,
        p_part_paroisse_mere: montants.partParoisseMere,
        p_part_caisse_locale: montants.partCaisseLocale,
        p_part_responsable: montants.partResponsable,
        p_part_levites: montants.partLevites,
        p_description_base: descriptionBase,
      }
    );

    if (creationRpcError) {
      throw new Error(`Echec creation atomique RPC: ${creationRpcError.message}`);
    }

    const rpcPayload = Array.isArray(creationRpcRows) ? creationRpcRows[0] : null;
    if (!rpcPayload) {
      throw new Error('RPC creation dime: aucune donnee retournee');
    }

    await logger.log(
      'TITHES_CREATED',
      `Repartition dime creee: ${data.montant} => Paroisse ${montants.partParoisseMere}, Responsable ${montants.partResponsable}, Levites ${montants.partLevites}, Caisse locale ${montants.partCaisseLocale}`,
      createdById
    );

    return {
      id: rpcPayload.repartition_id,
      transactionId: rpcPayload.transaction_entree_id,
      totalDime: montants.totalDime,
      partParoisseMere: montants.partParoisseMere,
      partCaisseLocale: montants.partCaisseLocale,
      partResponsable: montants.partResponsable,
      partLevites: montants.partLevites,
      creeLe: new Date(rpcPayload.repartition_cree_le),
      transactionEntree: {
        id: rpcPayload.transaction_entree_id,
        montant: data.montant,
        description: descriptionEntree,
        dateOperation: dateOp,
      },
      transactionsGeneres: {
        paroisseMere: {
          id: rpcPayload.trans_paroisse_id,
          montant: montants.partParoisseMere,
        },
        responsable: {
          id: rpcPayload.trans_responsable_id,
          montant: montants.partResponsable,
        },
        levites: {
          id: rpcPayload.trans_levites_id,
          montant: montants.partLevites,
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
    const transactionsGeneres = await supabaseDb.transaction.findMany({
      where: {
        description: {
          contains: `Repartition - `,
        },
        type: 'SORTIE',
      },
      select: { id: true, montant: true, description: true },
    });

    const paroisse = transactionsGeneres.find((t: any) => t.description?.includes('Paroisse Mere'));
    const responsable = transactionsGeneres.find((t: any) => t.description?.includes('Responsable'));
    const levites = transactionsGeneres.find((t: any) => t.description?.includes('Levites'));

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
   * Met a jour une repartition de dime depuis le module Dimes,
   * puis synchronise les transactions associees.
   */
  async updateRepartition(
    id: number,
    data: UpdateRepartitionDimeDTO,
    updatedById: number
  ): Promise<RepartitionDimeResponseDTO> {
    const repartition = await dimeRepository.findById(id);
    if (!repartition) {
      throw new Error(`Repartition avec l'ID ${id} introuvable`);
    }

    return this.synchroniserRepartitionParTransactionId(
      repartition.transactionId,
      data,
      updatedById,
      'DIME'
    );
  }

  /**
   * Synchronise une repartition de dime lorsqu'une transaction ENTREE
   * liee a une dime est modifiee depuis le module Transactions.
   */
  async syncFromTransactionUpdate(
    transactionEntreeId: number,
    data: UpdateRepartitionDimeDTO,
    updatedById: number
  ): Promise<RepartitionDimeResponseDTO> {
    return this.synchroniserRepartitionParTransactionId(
      transactionEntreeId,
      data,
      updatedById,
      'TRANSACTION'
    );
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
        const transactionsGeneres = await supabaseDb.transaction.findMany({
          where: {
            description: {
              contains: `Repartition - ${item.transactionId}`,
            },
            type: 'SORTIE',
          },
          select: { id: true, montant: true, description: true },
        });

        const paroisse = transactionsGeneres.find((t: any) =>
          t.description?.includes('Paroisse Mere')
        );
        const responsable = transactionsGeneres.find((t: any) => t.description?.includes('Responsable'));
        const levites = transactionsGeneres.find((t: any) => t.description?.includes('Levites'));

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

    const generated = await this.trouverTransactionsGenerees(repartition.transactionId);
    const transactionIds = [
      repartition.transactionId,
      generated.paroisse?.id,
      generated.responsable?.id,
      generated.levites?.id,
    ].filter((idValue): idValue is number => typeof idValue === 'number');

    const { error: deleteRpcError } = await supabaseServer.rpc('rpc_dime_delete_repartition', {
      p_repartition_id: id,
      p_transaction_ids: transactionIds,
    });

    if (deleteRpcError) {
      throw new Error(`Echec suppression atomique RPC: ${deleteRpcError.message}`);
    }

    await logger.log(
      'TITHES_DELETED',
      `Repartition dime supprimee (ID ${id}, ${transactionIds.length} transactions)`,
      deletedById
    );

    return this.getRepartitionById(id);
  }
}

export const dimeService = new DimeService();
