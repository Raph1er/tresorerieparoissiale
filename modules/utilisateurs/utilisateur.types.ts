/**
 * Types et interfaces pour le module Utilisateurs
 * Définit les structures de données pour les opérations sur les utilisateurs
 */

import { RoleUtilisateur } from '@prisma/client';

/**
 * Interface pour les données de création d'un utilisateur
 * Utilisée lors de l'inscription ou création par un admin
 */
export interface CreateUtilisateurDTO {
  // Nom complet de l'utilisateur
  nom: string;
  // Email unique pour la connexion
  email: string;
  // Mot de passe en texte clair (sera hashé)
  motDePasse: string;
  // Rôle de l'utilisateur (ADMIN, TRESORIER, RESPONSABLE, AUDITEUR)
  role: RoleUtilisateur;
}

/**
 * Interface pour les données de mise à jour d'un utilisateur
 * Tous les champs sont optionnels sauf l'ID
 */
export interface UpdateUtilisateurDTO {
  // Nom complet (optionnel)
  nom?: string;
  // Email (optionnel, mais doit rester unique)
  email?: string;
  // Rôle (optionnel)
  role?: RoleUtilisateur;
  // Statut actif/inactif (optionnel)
  actif?: boolean;
}

/**
 * Interface pour la réponse de l'API (sans données sensibles)
 * Jamais retourner le mot de passe au client
 */
export interface UtilisateurResponseDTO {
  // Identifiant unique
  id: number;
  // Nom complet
  nom: string;
  // Email
  email: string;
  // Rôle assigné
  role: RoleUtilisateur;
  // Statut de l'utilisateur
  actif: boolean;
  // Date de création
  creeLe: Date;
  // Date de dernière modification
  modifieLe: Date;
}

/**
 * Interface pour les options de pagination
 * Utilisée pour les appels API listant les utilisateurs
 */
export interface PaginationOptions {
  // Numéro de la page (1-indexed)
  page: number;
  // Nombre d'éléments par page
  limit: number;
  // Champ de tri
  orderBy?: 'nom' | 'email' | 'creeLe' | 'modifieLe';
  // Ordre de tri (asc ou desc)
  order?: 'asc' | 'desc';
}

/**
 * Interface pour la réponse paginée
 * Contient les données et les métadonnées de pagination
 */
export interface PaginatedResponse<T> {
  // Les données demandées
  data: T[];
  // Numéro de la page actuelle
  page: number;
  // Nombre total d'éléments
  total: number;
  // Nombre total de pages
  totalPages: number;
  // Nombre d'éléments par page
  limit: number;
  // Y a-t-il une page suivante ?
  hasNextPage: boolean;
  // Y a-t-il une page précédente ?
  hasPreviousPage: boolean;
}

/**
 * Interface pour les résultats de filtrage/recherche
 * Utilisée lors de la recherche d'utilisateurs par critères
 */
export interface UtilisateurFilter {
  // Recherche par nom ou email
  search?: string;
  // Filtrer par rôle
  role?: RoleUtilisateur;
  // Filtrer par statut actif
  actif?: boolean;
  // Date de création minimale
  creeLeDe?: Date;
  // Date de création maximale
  creerJusqua?: Date;
}