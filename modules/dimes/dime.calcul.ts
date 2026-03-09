/**
 * Fonctions de calcul pour la repartition des dimes.
 * Regle appliquee:
 * - 33.33% Paroisse Mere (SORTIE)
 * - 22.22% Responsable Paroisse (SORTIE)
 * - 11.11% Levites (SORTIE)
 * - 33.34% reste en Caisse Locale (pas de transaction)
 */

import type { RepartitionMontants } from './dime.types';

function arrondir2(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}

/**
 * Calcule la repartition complete d'une dime.
 */
export function calculerRepartitionDime(totalDime: number): RepartitionMontants {
  if (!Number.isFinite(totalDime) || totalDime <= 0) {
    throw new Error('Le montant de la dime doit etre un nombre positif');
  }

  // Calcul des pourcentages
  const partParoisseMere = arrondir2(totalDime * 0.3333);
  const partResponsable = arrondir2(totalDime * 0.2222);
  const partLevites = arrondir2(totalDime * 0.1111);

  // La caisse locale garde le reste
  const partCaisseLocale = arrondir2(
    totalDime - partParoisseMere - partResponsable - partLevites
  );

  return {
    totalDime,
    partParoisseMere,
    partCaisseLocale,
    partResponsable,
    partLevites,
  };
}
