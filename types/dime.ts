/**
 * Types globaux pour le module Dimes.
 */

export interface CreateRepartitionDimeDTO {
  montant: number;
  description?: string;
  dateOperation: Date | string;
  modePaiement?: string;
  evenementId?: number;
}

export interface RepartitionMontants {
  totalDime: number;
  partParoisseMere: number;
  partCaisseLocale: number;
  partResponsable: number;
  partLevites: number;
}

export interface RepartitionDimeResponseDTO extends RepartitionMontants {
  id: number;
  transactionId: number;
  creeLe: Date;
  transactionEntree: {
    id: number;
    montant: number;
    description: string | null;
    dateOperation: Date;
  };
  transactionsGeneres: {
    paroisseMere: { id: number; montant: number };
    responsable: { id: number; montant: number };
    levites: { id: number; montant: number };
  };
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RepartitionDimeFilter {
  transactionId?: number;
  dateDe?: Date;
  dateJusqua?: Date;
  orderBy?: 'creeLe' | 'totalDime';
  order?: 'asc' | 'desc';
}
