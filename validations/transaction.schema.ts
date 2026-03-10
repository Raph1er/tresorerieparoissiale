/**
 * Schémas de validation pour le module Transactions.
 * Gère la validation des payloads et query params pour les opérations financières.
 */

import { TypeTransaction } from '@prisma/client';
import type {
  CreateTransactionDTO,
  UpdateTransactionDTO,
  TransactionFilter,
  PaginationOptions,
} from '@/types/transaction';

/**
 * Type de résultat de validation.
 */
type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Parse une date depuis une chaîne ISO ou un objet Date.
 */
function parserDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Parse un nombre décimal positif.
 */
function parserMontant(value: unknown): number | null {
  if (typeof value === 'number' && value >= 0) return value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) return num;
  }
  return null;
}

/**
 * Parse un entier positif.
 */
function parserEntier(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) return num;
  }
  return null;
}

/**
 * Parse un boolean depuis string ou boolean.
 */
function parserBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

/**
 * Valide le type de transaction.
 */
function validerTypeTransaction(type: unknown): TypeTransaction | null {
  if (type === 'ENTREE' || type === 'SORTIE') return type;
  return null;
}

/**
 * Valide les données pour créer une transaction.
 */
export function validerCreateTransactionDTO(
  body: unknown
): ValidationResult<CreateTransactionDTO> {
  if (typeof body !== 'object' || body === null) {
    return { success: false, error: 'Corps de la requête invalide' };
  }

  const data = body as Record<string, unknown>;

  // Type (requis)
  const type = validerTypeTransaction(data.type);
  if (!type) {
    return {
      success: false,
      error: 'Le champ "type" est requis et doit être "ENTREE" ou "SORTIE"',
    };
  }

  // Montant (requis, positif)
  const montant = parserMontant(data.montant);
  if (montant === null) {
    return {
      success: false,
      error: 'Le champ "montant" est requis et doit être un nombre positif',
    };
  }
  if (montant === 0) {
    return {
      success: false,
      error: 'Le montant doit être supérieur à 0',
    };
  }

  // Date d'opération (requis)
  const dateOperation = parserDate(data.dateOperation);
  if (!dateOperation) {
    return {
      success: false,
      error: 'Le champ "dateOperation" est requis et doit être une date valide (format ISO 8601)',
    };
  }

  // Catégorie ID (requis)
  const categorieId = parserEntier(data.categorieId);
  if (!categorieId) {
    return {
      success: false,
      error: 'Le champ "categorieId" est requis et doit être un entier positif',
    };
  }

  // Description (optionnel)
  let description: string | undefined;
  if (data.description !== undefined) {
    if (typeof data.description !== 'string') {
      return { success: false, error: 'Le champ "description" doit être une chaîne' };
    }
    description = data.description.trim();
  }

  // Mode de paiement (optionnel)
  let modePaiement: string | undefined;
  if (data.modePaiement !== undefined) {
    if (typeof data.modePaiement !== 'string') {
      return { success: false, error: 'Le champ "modePaiement" doit être une chaîne' };
    }
    modePaiement = data.modePaiement.trim();
  }

  // Pièce justificative (optionnel)
  let pieceJustificative: string | undefined;
  if (data.pieceJustificative !== undefined) {
    if (typeof data.pieceJustificative !== 'string') {
      return { success: false, error: 'Le champ "pieceJustificative" doit être une chaîne' };
    }
    pieceJustificative = data.pieceJustificative.trim();
  }

  // Évènement ID (optionnel)
  let evenementId: number | undefined;
  if (data.evenementId !== undefined && data.evenementId !== null) {
    const parsedEvenementId = parserEntier(data.evenementId);
    if (!parsedEvenementId) {
      return {
        success: false,
        error: 'Le champ "evenementId" doit être un entier positif ou null',
      };
    }
    evenementId = parsedEvenementId;
  }

  return {
    success: true,
    data: {
      type,
      montant,
      description,
      dateOperation,
      modePaiement,
      pieceJustificative,
      categorieId,
      evenementId,
    },
  };
}

/**
 * Valide les données pour mettre à jour une transaction.
 * Au moins un champ doit être fourni.
 */
export function validerUpdateTransactionDTO(
  body: unknown
): ValidationResult<UpdateTransactionDTO> {
  if (typeof body !== 'object' || body === null) {
    return { success: false, error: 'Corps de la requête invalide' };
  }

  const data = body as Record<string, unknown>;
  const updates: UpdateTransactionDTO = {};

  // Type (optionnel)
  if (data.type !== undefined) {
    const type = validerTypeTransaction(data.type);
    if (!type) {
      return {
        success: false,
        error: 'Le champ "type" doit être "ENTREE" ou "SORTIE"',
      };
    }
    updates.type = type;
  }

  // Montant (optionnel)
  if (data.montant !== undefined) {
    const montant = parserMontant(data.montant);
    if (montant === null) {
      return {
        success: false,
        error: 'Le champ "montant" doit être un nombre positif',
      };
    }
    if (montant === 0) {
      return {
        success: false,
        error: 'Le montant doit être supérieur à 0',
      };
    }
    updates.montant = montant;
  }

  // Description (optionnel)
  if (data.description !== undefined) {
    if (typeof data.description !== 'string' && data.description !== null) {
      return {
        success: false,
        error: 'Le champ "description" doit être une chaîne ou null',
      };
    }
    updates.description = typeof data.description === 'string' ? data.description.trim() : '';
  }

  // Date d'opération (optionnel)
  if (data.dateOperation !== undefined) {
    const dateOperation = parserDate(data.dateOperation);
    if (!dateOperation) {
      return {
        success: false,
        error: 'Le champ "dateOperation" doit être une date valide (format ISO 8601)',
      };
    }
    updates.dateOperation = dateOperation;
  }

  // Mode de paiement (optionnel)
  if (data.modePaiement !== undefined) {
    if (typeof data.modePaiement !== 'string' && data.modePaiement !== null) {
      return {
        success: false,
        error: 'Le champ "modePaiement" doit être une chaîne ou null',
      };
    }
    updates.modePaiement = typeof data.modePaiement === 'string' ? data.modePaiement.trim() : '';
  }

  // Pièce justificative (optionnel)
  if (data.pieceJustificative !== undefined) {
    if (typeof data.pieceJustificative !== 'string' && data.pieceJustificative !== null) {
      return {
        success: false,
        error: 'Le champ "pieceJustificative" doit être une chaîne ou null',
      };
    }
    updates.pieceJustificative = typeof data.pieceJustificative === 'string' ? data.pieceJustificative.trim() : '';
  }

  // Catégorie ID (optionnel)
  if (data.categorieId !== undefined) {
    const categorieId = parserEntier(data.categorieId);
    if (!categorieId) {
      return {
        success: false,
        error: 'Le champ "categorieId" doit être un entier positif',
      };
    }
    updates.categorieId = categorieId;
  }

  // Évènement ID (optionnel)
  if (data.evenementId !== undefined) {
    if (data.evenementId === null) {
      updates.evenementId = null;
    } else {
      const evenementId = parserEntier(data.evenementId);
      if (!evenementId) {
        return {
          success: false,
          error: 'Le champ "evenementId" doit être un entier positif ou null',
        };
      }
      updates.evenementId = evenementId;
    }
  }

  // estSupprime (optionnel, pour suppression logique)
  if (data.estSupprime !== undefined) {
    const estSupprime = parserBoolean(data.estSupprime);
    if (estSupprime === null) {
      return {
        success: false,
        error: 'Le champ "estSupprime" doit être un boolean',
      };
    }
    updates.estSupprime = estSupprime;
  }

  // Vérifier qu'au moins un champ est fourni
  if (Object.keys(updates).length === 0) {
    return {
      success: false,
      error: 'Au moins un champ doit être fourni pour la mise à jour',
    };
  }

  return { success: true, data: updates };
}

/**
 * Valide les query params pour la pagination et les filtres des transactions.
 */
export function validerPaginationTransactionQuery(
  query: Record<string, unknown>
): ValidationResult<PaginationOptions & TransactionFilter> {
  const result: PaginationOptions & TransactionFilter = {
    page: 1,
    limit: 20,
  };

  // Page
  if (query.page !== undefined) {
    const page = parserEntier(query.page);
    if (!page) {
      return { success: false, error: 'Le paramètre "page" doit être un entier positif' };
    }
    result.page = page;
  }

  // Limit
  if (query.limit !== undefined) {
    const limit = parserEntier(query.limit);
    if (!limit || limit > 100) {
      return {
        success: false,
        error: 'Le paramètre "limit" doit être un entier entre 1 et 100',
      };
    }
    result.limit = limit;
  }

  // Type de transaction
  if (query.type !== undefined) {
    const type = validerTypeTransaction(query.type);
    if (!type) {
      return {
        success: false,
        error: 'Le paramètre "type" doit être "ENTREE" ou "SORTIE"',
      };
    }
    result.type = type;
  }

  // Catégorie ID
  if (query.categorieId !== undefined) {
    const categorieId = parserEntier(query.categorieId);
    if (!categorieId) {
      return {
        success: false,
        error: 'Le paramètre "categorieId" doit être un entier positif',
      };
    }
    result.categorieId = categorieId;
  }

  // Évènement ID
  if (query.evenementId !== undefined) {
    const evenementId = parserEntier(query.evenementId);
    if (!evenementId) {
      return {
        success: false,
        error: 'Le paramètre "evenementId" doit être un entier positif',
      };
    }
    result.evenementId = evenementId;
  }

  // Utilisateur ID
  if (query.utilisateurId !== undefined) {
    const utilisateurId = parserEntier(query.utilisateurId);
    if (!utilisateurId) {
      return {
        success: false,
        error: 'Le paramètre "utilisateurId" doit être un entier positif',
      };
    }
    result.utilisateurId = utilisateurId;
  }

  // Date d'opération - De
  if (query.dateOperationDe !== undefined) {
    const dateOperationDe = parserDate(query.dateOperationDe);
    if (!dateOperationDe) {
      return {
        success: false,
        error: 'Le paramètre "dateOperationDe" doit être une date valide (format ISO 8601)',
      };
    }
    result.dateOperationDe = dateOperationDe;
  }

  // Date d'opération - Jusqu'à
  if (query.dateOperationJusqua !== undefined) {
    const dateOperationJusqua = parserDate(query.dateOperationJusqua);
    if (!dateOperationJusqua) {
      return {
        success: false,
        error: 'Le paramètre "dateOperationJusqua" doit être une date valide (format ISO 8601)',
      };
    }
    result.dateOperationJusqua = dateOperationJusqua;
  }

  // Montant minimum
  if (query.montantMin !== undefined) {
    const montantMin = parserMontant(query.montantMin);
    if (montantMin === null) {
      return {
        success: false,
        error: 'Le paramètre "montantMin" doit être un nombre positif',
      };
    }
    result.montantMin = montantMin;
  }

  // Montant maximum
  if (query.montantMax !== undefined) {
    const montantMax = parserMontant(query.montantMax);
    if (montantMax === null) {
      return {
        success: false,
        error: 'Le paramètre "montantMax" doit être un nombre positif',
      };
    }
    result.montantMax = montantMax;
  }

  // Recherche textuelle
  if (query.search !== undefined) {
    if (typeof query.search !== 'string') {
      return {
        success: false,
        error: 'Le paramètre "search" doit être une chaîne',
      };
    }
    result.search = query.search.trim();
  }

  // estSupprime
  if (query.estSupprime !== undefined) {
    const estSupprime = parserBoolean(query.estSupprime);
    if (estSupprime === null) {
      return {
        success: false,
        error: 'Le paramètre "estSupprime" doit être un boolean',
      };
    }
    result.estSupprime = estSupprime;
  }

  // OrderBy
  if (query.orderBy !== undefined) {
    if (
      query.orderBy !== 'dateOperation' &&
      query.orderBy !== 'montant' &&
      query.orderBy !== 'creeLe'
    ) {
      return {
        success: false,
        error: 'Le paramètre "orderBy" doit être "dateOperation", "montant" ou "creeLe"',
      };
    }
    result.orderBy = query.orderBy;
  }

  // Order
  if (query.order !== undefined) {
    if (query.order !== 'asc' && query.order !== 'desc') {
      return {
        success: false,
        error: 'Le paramètre "order" doit être "asc" ou "desc"',
      };
    }
    result.order = query.order;
  }

  return { success: true, data: result };
}

/**
 * Valide un ID de transaction.
 */
export function validerIdTransaction(id: unknown): ValidationResult<number> {
  const idNum = parserEntier(id);
  if (!idNum) {
    return {
      success: false,
      error: 'L\'ID de la transaction doit être un entier positif',
    };
  }
  return { success: true, data: idNum };
}
