/**
 * Validations du module Évènements.
 * Centralise la validation des payloads et query params.
 */

import {
  CreateEvenementDTO,
  EvenementFilter,
  PaginationOptions,
  UpdateEvenementDTO,
} from '@/types/evenement';

interface ValidationSuccess<T> {
  success: true;
  data: T;
}

interface ValidationError {
  success: false;
  error: string;
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

function estObjet(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parserEntierPositif(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = parseInt(value, 10);
    return parsed > 0 ? parsed : null;
  }

  return null;
}

function parserBooleen(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }

  return null;
}

function parserDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    // Support both ISO 8601 UTC format and local datetime format
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function estDateDansLeFutur(date: Date): boolean {
  // Compare only the UTC dates (ignoring time) to avoid timezone issues
  // between client and server
  const dateUtc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const todayUtc = new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  ));
  return dateUtc.getTime() > todayUtc.getTime();
}

export function validerIdEvenement(id: number): ValidationResult<number> {
  if (Number.isNaN(id) || id < 1) {
    return { success: false, error: 'ID invalide' };
  }

  return { success: true, data: id };
}

export function validerCreateEvenementDTO(payload: unknown): ValidationResult<CreateEvenementDTO> {
  if (!estObjet(payload)) {
    return { success: false, error: 'Payload JSON invalide' };
  }

  const { nom, description, dateDebut, dateFin } = payload;

  // Nom obligatoire
  if (typeof nom !== 'string' || !nom.trim()) {
    return { success: false, error: 'Le nom est requis et doit être valide' };
  }

  // Description optionnelle
  if (description !== undefined && typeof description !== 'string') {
    return { success: false, error: 'La description doit être une chaîne' };
  }

  // Date de début obligatoire
  const dateDebutParsed = parserDate(dateDebut);
  if (!dateDebutParsed) {
    return { success: false, error: 'La date de début est requise et doit être valide' };
  }
  if (estDateDansLeFutur(dateDebutParsed)) {
    return { success: false, error: 'La date de début ne peut pas dépasser la date actuelle' };
  }

  // Date de fin optionnelle
  let dateFinParsed: Date | null = null;
  if (dateFin !== undefined && dateFin !== null) {
    dateFinParsed = parserDate(dateFin);
    if (dateFin !== null && !dateFinParsed) {
      return { success: false, error: 'La date de fin doit être valide' };
    }
    if (dateFinParsed && estDateDansLeFutur(dateFinParsed)) {
      return { success: false, error: 'La date de fin ne peut pas dépasser la date actuelle' };
    }
  }

  // Vérifie que dateFin >= dateDebut
  if (dateFinParsed && dateFinParsed < dateDebutParsed) {
    return { success: false, error: 'La date de fin doit être postérieure à la date de début' };
  }

  return {
    success: true,
    data: {
      nom: nom.trim(),
      description: typeof description === 'string' ? description.trim() : undefined,
      dateDebut: dateDebutParsed,
      dateFin: dateFinParsed,
    },
  };
}

export function validerUpdateEvenementDTO(payload: unknown): ValidationResult<UpdateEvenementDTO> {
  if (!estObjet(payload)) {
    return { success: false, error: 'Payload JSON invalide' };
  }

  const { nom, description, dateDebut, dateFin, actif } = payload;
  const data: UpdateEvenementDTO = {};

  if (nom !== undefined) {
    if (typeof nom !== 'string' || !nom.trim()) {
      return { success: false, error: 'Le nom doit être une chaîne non vide' };
    }
    data.nom = nom.trim();
  }

  if (description !== undefined) {
    if (typeof description !== 'string') {
      return { success: false, error: 'La description doit être une chaîne' };
    }
    data.description = description.trim();
  }

  if (dateDebut !== undefined) {
    const dateDebutParsed = parserDate(dateDebut);
    if (!dateDebutParsed) {
      return { success: false, error: 'La date de début doit être valide' };
    }
    if (estDateDansLeFutur(dateDebutParsed)) {
      return { success: false, error: 'La date de début ne peut pas dépasser la date actuelle' };
    }
    data.dateDebut = dateDebutParsed;
  }

  if (dateFin !== undefined) {
    if (dateFin === null) {
      data.dateFin = null;
    } else {
      const dateFinParsed = parserDate(dateFin);
      if (!dateFinParsed) {
        return { success: false, error: 'La date de fin doit être valide ou null' };
      }
      if (estDateDansLeFutur(dateFinParsed)) {
        return { success: false, error: 'La date de fin ne peut pas dépasser la date actuelle' };
      }
      data.dateFin = dateFinParsed;
    }
  }

  if (actif !== undefined) {
    const actifParsed = parserBooleen(actif);
    if (actifParsed === null) {
      return { success: false, error: 'Le champ actif doit être true ou false' };
    }
    data.actif = actifParsed;
  }

  // Vérifie cohérence des dates si les deux sont modifiées
  if (data.dateDebut && data.dateFin && data.dateFin < data.dateDebut) {
    return { success: false, error: 'La date de fin doit être postérieure à la date de début' };
  }

  if (Object.keys(data).length === 0) {
    return { success: false, error: 'Aucune donnée valide à mettre à jour' };
  }

  return { success: true, data };
}

export interface ValidationEvenementQueryResult {
  pagination: PaginationOptions;
  filters: EvenementFilter;
}

export function validerPaginationEvenementQuery(
  searchParams: URLSearchParams
): ValidationResult<ValidationEvenementQueryResult> {
  const page = parserEntierPositif(searchParams.get('page') ?? '1');
  const limit = parserEntierPositif(searchParams.get('limit') ?? '10');
  const orderBy = searchParams.get('orderBy') ?? 'dateDebut';
  const order = searchParams.get('order') ?? 'desc';

  if (!page) {
    return { success: false, error: 'page doit être un entier positif' };
  }

  if (!limit || limit > 100) {
    return { success: false, error: 'limit doit être un entier positif <= 100' };
  }

  if (!['nom', 'dateDebut', 'dateFin', 'creeLe'].includes(orderBy)) {
    return { success: false, error: 'orderBy invalide' };
  }

  if (!['asc', 'desc'].includes(order)) {
    return { success: false, error: 'order doit être asc ou desc' };
  }

  const filters: EvenementFilter = {};

  const search = searchParams.get('search');
  if (search && search.trim()) {
    filters.search = search.trim();
  }

  const actif = searchParams.get('actif');
  if (actif !== null) {
    const actifParsed = parserBooleen(actif);
    if (actifParsed === null) {
      return { success: false, error: 'actif doit être true ou false' };
    }
    filters.actif = actifParsed;
  }

  const dateDebutDe = searchParams.get('dateDebutDe');
  if (dateDebutDe) {
    const parsed = parserDate(dateDebutDe);
    if (!parsed) {
      return { success: false, error: 'dateDebutDe doit être une date valide' };
    }
    filters.dateDebutDe = parsed;
  }

  const dateDebutJusqua = searchParams.get('dateDebutJusqua');
  if (dateDebutJusqua) {
    const parsed = parserDate(dateDebutJusqua);
    if (!parsed) {
      return { success: false, error: 'dateDebutJusqua doit être une date valide' };
    }
    filters.dateDebutJusqua = parsed;
  }

  const enCours = searchParams.get('enCours');
  if (enCours !== null) {
    const enCoursParsed = parserBooleen(enCours);
    if (enCoursParsed === null) {
      return { success: false, error: 'enCours doit être true ou false' };
    }
    filters.enCours = enCoursParsed;
  }

  return {
    success: true,
    data: {
      pagination: {
        page,
        limit,
        orderBy: orderBy as PaginationOptions['orderBy'],
        order: order as PaginationOptions['order'],
      },
      filters,
    },
  };
}
