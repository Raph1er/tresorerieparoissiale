/**
 * Types globaux du module Rapports.
 */

export interface RapportFilters {
  dateDe?: Date;
  dateJusqua?: Date;
  categorieId?: number;
  evenementId?: number;
  utilisateurId?: number;
}

export interface RapportResume {
  totalEntrees: number;
  totalSorties: number;
  solde: number;
  nombreTransactions: number;
}

export interface RapportParType {
  type: 'ENTREE' | 'SORTIE';
  total: number;
  nombreTransactions: number;
}

export interface RapportParCategorie {
  categorieId: number;
  categorieNom: string;
  type: 'ENTREE' | 'SORTIE';
  total: number;
  nombreTransactions: number;
}

export interface RapportParEvenement {
  evenementId: number;
  evenementNom: string;
  totalEntrees: number;
  totalSorties: number;
  solde: number;
  nombreTransactions: number;
}

export interface RapportMensuel {
  mois: string;
  totalEntrees: number;
  totalSorties: number;
  solde: number;
  nombreTransactions: number;
}

export interface RapportGlobalResponse {
  periode: {
    dateDe: string | null;
    dateJusqua: string | null;
  };
  filtresAppliques: {
    categorieId: number | null;
    evenementId: number | null;
    utilisateurId: number | null;
  };
  resume: RapportResume;
  parType: RapportParType[];
  parCategorie: RapportParCategorie[];
  parEvenement: RapportParEvenement[];
  evolutionMensuelle: RapportMensuel[];
}
