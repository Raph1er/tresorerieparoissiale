/**
 * Validations du module Rapports.
 */

import type { RapportFilters } from '@/types/rapport';

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function parserEntierPositif(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function parserDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function validerRapportQuery(
  searchParams: URLSearchParams
): ValidationResult<RapportFilters> {
  const dateDe = parserDate(searchParams.get('dateDe'));
  const dateJusqua = parserDate(searchParams.get('dateJusqua'));

  if (searchParams.get('dateDe') && !dateDe) {
    return { success: false, error: 'Le parametre "dateDe" est invalide' };
  }

  if (searchParams.get('dateJusqua') && !dateJusqua) {
    return { success: false, error: 'Le parametre "dateJusqua" est invalide' };
  }

  if (dateDe && dateJusqua && dateDe > dateJusqua) {
    return {
      success: false,
      error: 'Le parametre "dateDe" doit etre inferieur ou egal a "dateJusqua"',
    };
  }

  const categorieId = parserEntierPositif(searchParams.get('categorieId'));
  const evenementId = parserEntierPositif(searchParams.get('evenementId'));
  const utilisateurId = parserEntierPositif(searchParams.get('utilisateurId'));

  if (searchParams.get('categorieId') && !categorieId) {
    return { success: false, error: 'Le parametre "categorieId" est invalide' };
  }

  if (searchParams.get('evenementId') && !evenementId) {
    return { success: false, error: 'Le parametre "evenementId" est invalide' };
  }

  if (searchParams.get('utilisateurId') && !utilisateurId) {
    return { success: false, error: 'Le parametre "utilisateurId" est invalide' };
  }

  return {
    success: true,
    data: {
      dateDe: dateDe ?? undefined,
      dateJusqua: dateJusqua ?? undefined,
      categorieId: categorieId ?? undefined,
      evenementId: evenementId ?? undefined,
      utilisateurId: utilisateurId ?? undefined,
    },
  };
}
