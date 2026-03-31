/**
 * Service metier du module Rapports.
 */

import supabaseDb from '@/lib/supabase-db';
import { TypeTransaction } from '@/types/enums';
import type {
  RapportFilters,
  RapportGlobalResponse,
  RapportParCategorie,
  RapportParEvenement,
  RapportParType,
  RapportMensuel,
} from './rapport.types';

interface TransactionRapportRow {
  id: number;
  type: TypeTransaction;
  montant: number;
  dateOperation: Date;
  categorie: {
    id: number;
    nom: string;
    type: TypeTransaction;
  } | null;
  evenement: {
    id: number;
    nom: string;
  } | null;
}

function keyMois(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function construireWhere(filters: RapportFilters): any {
  const where: any = {
    estSupprime: false,
  };

  if (filters.dateDe || filters.dateJusqua) {
    where.dateOperation = {};
    if (filters.dateDe) {
      where.dateOperation.gte = filters.dateDe;
    }
    if (filters.dateJusqua) {
      where.dateOperation.lte = filters.dateJusqua;
    }
  }

  if (filters.categorieId) {
    where.categorieId = filters.categorieId;
  }

  if (filters.evenementId) {
    where.evenementId = filters.evenementId;
  }

  if (filters.utilisateurId) {
    where.utilisateurId = filters.utilisateurId;
  }

  return where;
}

export class RapportService {
  async getRapportGlobal(filters: RapportFilters): Promise<RapportGlobalResponse> {
    const where = construireWhere(filters);

    const transactions = await supabaseDb.transaction.findMany({
      where,
      select: {
        id: true,
        type: true,
        montant: true,
        dateOperation: true,
        categorie: {
          select: {
            id: true,
            nom: true,
            type: true,
          },
        },
        evenement: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
      orderBy: { dateOperation: 'asc' },
    });

    let totalEntrees = 0;
    let totalSorties = 0;

    const parCategorieMap = new Map<number, RapportParCategorie>();
    const parEvenementMap = new Map<number, RapportParEvenement>();
    const parMoisMap = new Map<string, RapportMensuel>();

    for (const transaction of transactions as TransactionRapportRow[]) {
      if (transaction.type === 'ENTREE') {
        totalEntrees += transaction.montant;
      } else {
        totalSorties += transaction.montant;
      }

      if (transaction.categorie) {
        const categorieExistante = parCategorieMap.get(transaction.categorie.id);
        if (!categorieExistante) {
          parCategorieMap.set(transaction.categorie.id, {
            categorieId: transaction.categorie.id,
            categorieNom: transaction.categorie.nom,
            type: transaction.categorie.type,
            total: transaction.montant,
            nombreTransactions: 1,
          });
        } else {
          categorieExistante.total += transaction.montant;
          categorieExistante.nombreTransactions += 1;
        }
      }

      if (transaction.evenement) {
        const evenementExistant = parEvenementMap.get(transaction.evenement.id);

        if (!evenementExistant) {
          parEvenementMap.set(transaction.evenement.id, {
            evenementId: transaction.evenement.id,
            evenementNom: transaction.evenement.nom,
            totalEntrees: transaction.type === 'ENTREE' ? transaction.montant : 0,
            totalSorties: transaction.type === 'SORTIE' ? transaction.montant : 0,
            solde: transaction.type === 'ENTREE' ? transaction.montant : -transaction.montant,
            nombreTransactions: 1,
          });
        } else {
          if (transaction.type === 'ENTREE') {
            evenementExistant.totalEntrees += transaction.montant;
            evenementExistant.solde += transaction.montant;
          } else {
            evenementExistant.totalSorties += transaction.montant;
            evenementExistant.solde -= transaction.montant;
          }
          evenementExistant.nombreTransactions += 1;
        }
      }

      const mois = keyMois(transaction.dateOperation);
      const moisExistant = parMoisMap.get(mois);

      if (!moisExistant) {
        parMoisMap.set(mois, {
          mois,
          totalEntrees: transaction.type === 'ENTREE' ? transaction.montant : 0,
          totalSorties: transaction.type === 'SORTIE' ? transaction.montant : 0,
          solde: transaction.type === 'ENTREE' ? transaction.montant : -transaction.montant,
          nombreTransactions: 1,
        });
      } else {
        if (transaction.type === 'ENTREE') {
          moisExistant.totalEntrees += transaction.montant;
          moisExistant.solde += transaction.montant;
        } else {
          moisExistant.totalSorties += transaction.montant;
          moisExistant.solde -= transaction.montant;
        }
        moisExistant.nombreTransactions += 1;
      }
    }

    const parType: RapportParType[] = [
      {
        type: 'ENTREE',
        total: totalEntrees,
        nombreTransactions: transactions.filter((t: TransactionRapportRow) => t.type === 'ENTREE').length,
      },
      {
        type: 'SORTIE',
        total: totalSorties,
        nombreTransactions: transactions.filter((t: TransactionRapportRow) => t.type === 'SORTIE').length,
      },
    ];

    return {
      periode: {
        dateDe: filters.dateDe ? filters.dateDe.toISOString() : null,
        dateJusqua: filters.dateJusqua ? filters.dateJusqua.toISOString() : null,
      },
      filtresAppliques: {
        categorieId: filters.categorieId ?? null,
        evenementId: filters.evenementId ?? null,
        utilisateurId: filters.utilisateurId ?? null,
      },
      resume: {
        totalEntrees,
        totalSorties,
        solde: totalEntrees - totalSorties,
        nombreTransactions: transactions.length,
      },
      parType,
      parCategorie: Array.from(parCategorieMap.values()).sort((a, b) => b.total - a.total),
      parEvenement: Array.from(parEvenementMap.values()).sort((a, b) => b.solde - a.solde),
      evolutionMensuelle: Array.from(parMoisMap.values()).sort((a, b) =>
        a.mois.localeCompare(b.mois)
      ),
    };
  }
}

export const rapportService = new RapportService();
