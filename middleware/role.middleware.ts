/**
 * Middleware de contrôle d'accès basé sur les rôles (RBAC)
 * Gère les permissions selon le rôle de l'utilisateur
 * Rôles disponibles: ADMIN, TRESORIER, RESPONSABLE, AUDITEUR
 */

import { ContexteAuth } from './auth.middleware';

/**
 * Définition des permissions par rôle
 * Chaque rôle a accès à certaines ressources et actions
 */
const PERMISSIONS_PAR_ROLE: Record<string, string[]> = {
  // Rôle ADMIN : accès complet à toutes les ressources
  ADMIN: [
    // Gestion complète des utilisateurs
    'utilisateurs:lire',
    'utilisateurs:creer',
    'utilisateurs:modifier',
    'utilisateurs:supprimer',
    // Gestion complète des catégories
    'categories:lire',
    'categories:creer',
    'categories:modifier',
    'categories:supprimer',
    // Gestion complète des transactions
    'transactions:lire',
    'transactions:creer',
    'transactions:modifier',
    'transactions:supprimer',
    // Gestion des événements
    'evenements:lire',
    'evenements:creer',
    'evenements:modifier',
    'evenements:supprimer',
    // Accès aux rapports et audits
    'rapports:lire',
    'audit:lire',
    // Accès aux dîmes
    'dimes:lire',
    'dimes:creer',
    'dimes:modifier',
    'dimes:supprimer',
    // Paramétrage du système
    'parametres:modifier',
  ],

  // Rôle TRESORIER : gestion complète des transactions et dîmes
  TRESORIER: [
    // Lecture seule des utilisateurs
    'utilisateurs:lire',
    // Lecture seule des catégories
    'categories:lire',
    // Gestion complète des transactions
    'transactions:lire',
    'transactions:creer',
    'transactions:modifier',
    // Lecture seule des événements
    'evenements:lire',
    // Accès complet aux dîmes (création et calculs)
    'dimes:lire',
    'dimes:creer',
    'dimes:modifier',
    // Accès aux rapports
    'rapports:lire',
  ],

  // Rôle RESPONSABLE : supervision et rapport de la paroisse
  RESPONSABLE: [
    // Lecture seule des utilisateurs
    'utilisateurs:lire',
    // Lecture seule des catégories
    'categories:lire',
    // Lecture seule des transactions
    'transactions:lire',
    // Lecture seule des événements
    'evenements:lire',
    // Lecture des dîmes et rapports
    'dimes:lire',
    // Accès aux rapports complets
    'rapports:lire',
  ],

  // Rôle AUDITEUR : accès en lecture seule pour audit interne
  AUDITEUR: [
    // Lecture seule des utilisateurs
    'utilisateurs:lire',
    // Lecture seule des catégories
    'categories:lire',
    // Lecture seule des transactions
    'transactions:lire',
    // Lecture seule des événements
    'evenements:lire',
    // Lecture seule des dîmes
    'dimes:lire',
    // Accès à l'audit et rapports
    'audit:lire',
    'rapports:lire',
  ],
};

/**
 * Fonction pour vérifier si un utilisateur a une permission
 * @param contexte - Le contexte d'authentification de l'utilisateur
 * @param permission - La permission à vérifier (format: "ressource:action")
 * @returns boolean - true si l'utilisateur a la permission, false sinon
 */
export function verifierPermission(
  contexte: ContexteAuth,
  permission: string
): boolean {
  // Récupère la liste des permissions pour le rôle de l'utilisateur
  // Si le rôle n'existe pas, retourne un tableau vide
  const permissionsUtilisateur = PERMISSIONS_PAR_ROLE[contexte.role] || [];

  // Vérifie si la permission demandée est dans la liste des permissions
  // Retourne true si la permission existe, false sinon
  return permissionsUtilisateur.includes(permission);
}

/**
 * Fonction pour vérifier si un utilisateur a au moins une des permissions listées
 * Utile pour les actions qui peuvent être réalisées par plusieurs rôles
 * @param contexte - Le contexte d'authentification
 * @param permissions - Liste de permissions (une seule doit être vraie)
 * @returns boolean - true si l'utilisateur a au moins une permission
 */
export function verifierUneParmesPermissions(
  contexte: ContexteAuth,
  permissions: string[]
): boolean {
  // Récupère les permissions de l'utilisateur
  const permissionsUtilisateur = PERMISSIONS_PAR_ROLE[contexte.role] || [];

  // Vérifie que l'utilisateur a au moins une des permissions demandées
  // Retourne true si au moins une permission correspond
  return permissions.some((permission) =>
    permissionsUtilisateur.includes(permission)
  );
}

/**
 * Fonction pour obtenir toutes les permissions d'un utilisateur
 * Utile pour l'affichage conditionnel en frontend
 * @param contexte - Le contexte d'authentification
 * @returns string[] - Liste complète des permissions de l'utilisateur
 */
export function obtenirPermissionsUtilisateur(
  contexte: ContexteAuth
): string[] {
  // Récupère la liste des permissions pour le rôle
  // Retourne un tableau vide si le rôle n'existe pas
  return PERMISSIONS_PAR_ROLE[contexte.role] || [];
}

/**
 * Fonction pour vérifier tous les rôles autorisés pour une action
 * Retourne les rôles qui peuvent exécuter cette action
 * @param permission - La permission à vérifier
 * @returns string[] - Liste des rôles autorisés
 */
export function obtenirRolesParPermission(permission: string): string[] {
  // Parcourt tous les rôles et leurs permissions
  // Retourne les rôles qui ont la permission demandée
  return Object.entries(PERMISSIONS_PAR_ROLE)
    .filter(([_, permissions]) => permissions.includes(permission))
    .map(([role, _]) => role);
}