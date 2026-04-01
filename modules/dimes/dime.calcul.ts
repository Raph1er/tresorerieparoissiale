/**
 * Fonctions de calcul pour la repartition des dimes.
 * Regle appliquee:
 * - 33.33% Paroisse Mere (SORTIE)
 * - 22.22% Responsable Paroisse (SORTIE)
 * - 11.11% Levites (SORTIE)
 * - 33.34% reste en Caisse Locale (pas de transaction)
 */

import type { RepartitionMontants } from './dime.types';

const BASIS_POINTS = {
  paroisseMere: 3333,
  caisseLocale: 3334,
  responsable: 2222,
  levites: 1111,
} as const;

const TOTAL_BASIS_POINTS = 10_000;

function allouerMontantsEntiers(total: number): RepartitionMontants {
  const parts = [
    { key: 'paroisseMere' as const, raw: (total * BASIS_POINTS.paroisseMere) / TOTAL_BASIS_POINTS },
    { key: 'caisseLocale' as const, raw: (total * BASIS_POINTS.caisseLocale) / TOTAL_BASIS_POINTS },
    { key: 'responsable' as const, raw: (total * BASIS_POINTS.responsable) / TOTAL_BASIS_POINTS },
    { key: 'levites' as const, raw: (total * BASIS_POINTS.levites) / TOTAL_BASIS_POINTS },
  ];

  const base = parts.map((part) => ({
    key: part.key,
    value: Math.floor(part.raw),
    remainder: part.raw - Math.floor(part.raw),
  }));

  let restant = total - base.reduce((sum, part) => sum + part.value, 0);

  base
    .slice()
    .sort((a, b) => b.remainder - a.remainder)
    .forEach((part) => {
      if (restant <= 0) return;
      const found = base.find((entry) => entry.key === part.key);
      if (found) {
        found.value += 1;
        restant -= 1;
      }
    });

  const partParoisseMere = base.find((part) => part.key === 'paroisseMere')?.value ?? 0;
  const partCaisseLocale = base.find((part) => part.key === 'caisseLocale')?.value ?? 0;
  const partResponsable = base.find((part) => part.key === 'responsable')?.value ?? 0;
  const partLevites = base.find((part) => part.key === 'levites')?.value ?? 0;

  return {
    totalDime: total,
    partParoisseMere,
    partCaisseLocale,
    partResponsable,
    partLevites,
  };
}

/**
 * Calcule la repartition complete d'une dime.
 */
export function calculerRepartitionDime(totalDime: number): RepartitionMontants {
  if (!Number.isFinite(totalDime) || totalDime <= 0) {
    throw new Error('Le montant de la dime doit etre un nombre positif');
  }

  if (!Number.isInteger(totalDime)) {
    throw new Error('Le montant de la dime doit etre un entier en FCFA');
  }

  return allouerMontantsEntiers(totalDime);
}
