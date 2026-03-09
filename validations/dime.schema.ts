/**
 * Validation du module Dimes.
 */

import type {
  CreateRepartitionDimeDTO,
  PaginationOptions,
  RepartitionDimeFilter,
} from '@/types/dime';

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function parserEntierPositif(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function parserDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

export function validerCreateRepartitionDimeDTO(
  body: unknown
): ValidationResult<CreateRepartitionDimeDTO> {
  if (typeof body !== 'object' || body === null) {
    return { success: false, error: 'Corps de requete invalide' };
  }

  const data = body as Record<string, unknown>;

  // Montant requis
  const montant = typeof data.montant === 'number' ? data.montant : null;
  if (montant === null || montant <= 0) {
    return {
      success: false,
      error: 'Le champ "montant" est requis et doit etre un nombre positif',
    };
  }

  // Date d'opération requise
  const dateOperation = parserDate(data.dateOperation);
  if (!dateOperation) {
    return {
      success: false,
      error: 'Le champ "dateOperation" est requis et doit etre une date valide',
    };
  }

  // Description optionnelle
  let description: string | undefined;
  if (data.description !== undefined) {
    if (typeof data.description !== 'string') {
      return { success: false, error: 'Le champ "description" doit etre une chaine' };
    }
    description = data.description.trim();
  }

  // Mode de paiement optionnel
  let modePaiement: string | undefined;
  if (data.modePaiement !== undefined) {
    if (typeof data.modePaiement !== 'string') {
      return { success: false, error: 'Le champ "modePaiement" doit etre une chaine' };
    }
    modePaiement = data.modePaiement.trim();
  }

  // Événement ID optionnel
  let evenementId: number | undefined;
  if (data.evenementId !== undefined && data.evenementId !== null) {
    const parsedEvenementId = parserEntierPositif(data.evenementId);
    if (!parsedEvenementId) {
      return {
        success: false,
        error: 'Le champ "evenementId" doit etre un entier positif ou null',
      };
    }
    evenementId = parsedEvenementId;
  }

  return {
    success: true,
    data: { montant, description, dateOperation, modePaiement, evenementId },
  };
}

export function validerIdRepartitionDime(id: unknown): ValidationResult<number> {
  const parsedId = parserEntierPositif(id);

  if (!parsedId) {
    return { success: false, error: 'ID invalide: entier positif requis' };
  }

  return { success: true, data: parsedId };
}

export function validerPaginationDimeQuery(
  query: URLSearchParams | Record<string, unknown>
): ValidationResult<{ pagination: PaginationOptions; filters: RepartitionDimeFilter }> {
  const getValue = (key: string): unknown => {
    if (query instanceof URLSearchParams) {
      return query.get(key) ?? undefined;
    }
    return query[key];
  };

  const pagination: PaginationOptions = { page: 1, limit: 20 };
  const filters: RepartitionDimeFilter = {};

  const rawPage = getValue('page');
  if (rawPage !== undefined) {
    const page = parserEntierPositif(rawPage);
    if (!page) {
      return { success: false, error: 'Le parametre "page" doit etre un entier positif' };
    }
    pagination.page = page;
  }

  const rawLimit = getValue('limit');
  if (rawLimit !== undefined) {
    const limit = parserEntierPositif(rawLimit);
    if (!limit || limit > 100) {
      return {
        success: false,
        error: 'Le parametre "limit" doit etre un entier entre 1 et 100',
      };
    }
    pagination.limit = limit;
  }

  const rawTransactionId = getValue('transactionId');
  if (rawTransactionId !== undefined) {
    const transactionId = parserEntierPositif(rawTransactionId);
    if (!transactionId) {
      return {
        success: false,
        error: 'Le parametre "transactionId" doit etre un entier positif',
      };
    }
    filters.transactionId = transactionId;
  }

  const rawDateDe = getValue('dateDe');
  if (rawDateDe !== undefined) {
    const dateDe = parserDate(rawDateDe);
    if (!dateDe) {
      return { success: false, error: 'Le parametre "dateDe" doit etre une date valide' };
    }
    filters.dateDe = dateDe;
  }

  const rawDateJusqua = getValue('dateJusqua');
  if (rawDateJusqua !== undefined) {
    const dateJusqua = parserDate(rawDateJusqua);
    if (!dateJusqua) {
      return {
        success: false,
        error: 'Le parametre "dateJusqua" doit etre une date valide',
      };
    }
    filters.dateJusqua = dateJusqua;
  }

  const rawOrderBy = getValue('orderBy');
  if (rawOrderBy !== undefined) {
    if (rawOrderBy !== 'creeLe' && rawOrderBy !== 'totalDime') {
      return {
        success: false,
        error: 'Le parametre "orderBy" doit etre "creeLe" ou "totalDime"',
      };
    }
    filters.orderBy = rawOrderBy;
  }

  const rawOrder = getValue('order');
  if (rawOrder !== undefined) {
    if (rawOrder !== 'asc' && rawOrder !== 'desc') {
      return { success: false, error: 'Le parametre "order" doit etre "asc" ou "desc"' };
    }
    filters.order = rawOrder;
  }

  if (filters.dateDe && filters.dateJusqua && filters.dateDe > filters.dateJusqua) {
    return {
      success: false,
      error: 'La date "dateDe" doit etre inferieure ou egale a "dateJusqua"',
    };
  }

  return {
    success: true,
    data: { pagination, filters },
  };
}
