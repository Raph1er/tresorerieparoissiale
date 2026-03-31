/**
 * Repository pour l'accès aux données des utilisateurs
 * Encapsule toutes les interactions avec la base de données
 * Pattern Repository pour l'abstraction de la couche données
 */

import supabaseDb from '@/lib/supabase-db';
import { RoleUtilisateur } from '@/types/enums';
import {
  CreateUtilisateurDTO,
  UpdateUtilisateurDTO,
  PaginationOptions,
  UtilisateurFilter,
  UtilisateurResponseDTO,
  PaginatedResponse,
} from './utilisateur.types';

/**
 * Classe Repository pour les opérations sur les utilisateurs
 * Gère toutes les requêtes à la base de données
 */
export class UtilisateurRepository {
  /**
   * Crée un nouvel utilisateur en base de données
   * @param data - Les données du nouvel utilisateur
   * @returns L'utilisateur créé
   */
  async create(data: CreateUtilisateurDTO & { motDePasse: string }) {
    // Crée un nouvel enregistrement dans la table utilisateur
    return supabaseDb.utilisateur.create({
      data: {
        // Nom complet
        nom: data.nom,
        // Email normalisé
        email: data.email.toLowerCase(),
        // Mot de passe hashé (normalement hashé avant d'arriver ici)
        motDePasse: data.motDePasse,
        // Rôle assigné
        role: data.role,
        // Actif par défaut
        actif: true,
      },
      // Exclut les champs sensibles de la réponse
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        actif: true,
        creeLe: true,
        modifieLe: true,
        // Exclut le mot de passe
        motDePasse: false,
      },
    });
  }

  /**
   * Trouve un utilisateur par son ID
   * @param id - L'ID de l'utilisateur
   * @returns L'utilisateur ou null s'il n'existe pas
   */
  async findById(id: number) {
    // Recherche l'utilisateur par ID
    return supabaseDb.utilisateur.findUnique({
      where: { id },
      // Exclut le mot de passe
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        actif: true,
        creeLe: true,
        modifieLe: true,
        motDePasse: false,
      },
    });
  }

  /**
   * Trouve un utilisateur par son email
   * Utilisé lors de la connexion
   * @param email - L'email de l'utilisateur
   * @returns L'utilisateur avec mot de passe inclus (pour vérification)
   */
  async findByEmail(email: string) {
    // Recherche l'utilisateur par email (sensible à la casse)
    return supabaseDb.utilisateur.findUnique({
      where: { email: email.toLowerCase() },
      // Inclut le mot de passe pour la vérification
      select: {
        id: true,
        nom: true,
        email: true,
        motDePasse: true,
        role: true,
        actif: true,
        creeLe: true,
        modifieLe: true,
      },
    });
  }

  /**
   * Met à jour un utilisateur
   * @param id - L'ID de l'utilisateur à mettre à jour
   * @param data - Les données à mettre à jour
   * @returns L'utilisateur mis à jour
   */
  async update(id: number, data: UpdateUtilisateurDTO) {
    // Prépare les données de mise à jour
    const updateData: any = {};

    // Ajoute le nom s'il est fourni
    if (data.nom !== undefined) {
      updateData.nom = data.nom;
    }

    // Ajoute l'email s'il est fourni (normalisé)
    if (data.email !== undefined) {
      updateData.email = data.email.toLowerCase();
    }

    // Ajoute le rôle s'il est fourni
    if (data.role !== undefined) {
      updateData.role = data.role;
    }

    // Ajoute le statut actif s'il est fourni
    if (data.actif !== undefined) {
      updateData.actif = data.actif;
    }

    // Met à jour l'utilisateur en base de données
    return supabaseDb.utilisateur.update({
      where: { id },
      data: updateData,
      // Exclut le mot de passe
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        actif: true,
        creeLe: true,
        modifieLe: true,
        motDePasse: false,
      },
    });
  }

  /**
   * Supprime un utilisateur (suppression logique)
   * Change le statut actif à false au lieu de supprimer physiquement
   * @param id - L'ID de l'utilisateur à désactiver
   * @returns L'utilisateur désactivé
   */
  async delete(id: number) {
    // Désactive l'utilisateur (suppression logique)
    return supabaseDb.utilisateur.update({
      where: { id },
      data: {
        // Marque comme inactif
        actif: false,
      },
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        actif: true,
        creeLe: true,
        modifieLe: true,
        motDePasse: false,
      },
    });
  }

  /**
   * Récupère tous les utilisateurs avec pagination et filtres
   * @param options - Options de pagination
   * @param filters - Filtres optionnels
   * @returns Réponse paginée avec les utilisateurs
   */
  async findAll(
    options: PaginationOptions,
    filters?: UtilisateurFilter
  ): Promise<PaginatedResponse<UtilisateurResponseDTO>> {
    // Construit les critères WHERE
    const where: any = {};

    // Ajoute le filtre de recherche (nom ou email)
    if (filters?.search) {
      // Recherche dans le nom ou l'email (insensible à la casse)
      where.OR = [
        { nom: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Ajoute le filtre de rôle
    if (filters?.role) {
      where.role = filters.role;
    }

    // Ajoute le filtre de statut actif
    if (filters?.actif !== undefined) {
      where.actif = filters.actif;
    }

    // Ajoute les filtres de date
    if (filters?.creeLeDe || filters?.creerJusqua) {
      where.creeLe = {};
      if (filters.creeLeDe) {
        where.creeLe.gte = filters.creeLeDe; // >= date
      }
      if (filters.creerJusqua) {
        where.creeLe.lte = filters.creerJusqua; // <= date
      }
    }

    // Compte le nombre total d'utilisateurs correspondant aux critères
    const total = await supabaseDb.utilisateur.count({ where });

    // Calcule le nombre total de pages
    const totalPages = Math.ceil(total / options.limit);

    // Calcule le décalage pour la pagination
    const skip = (options.page - 1) * options.limit;

    // Construit l'ordre de tri
    const orderBy: any = {};
    const orderField = options.orderBy || 'creeLe';
    orderBy[orderField] = options.order || 'desc';

    // Récupère les utilisateurs avec pagination
    const utilisateurs = await supabaseDb.utilisateur.findMany({
      where,
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        actif: true,
        creeLe: true,
        modifieLe: true,
        motDePasse: false,
      },
      // Saute les n premiers éléments
      skip,
      // Limite le nombre de résultats
      take: options.limit,
      // Ordre de tri
      orderBy,
    });

    // Retourne la réponse paginée
    return {
      data: utilisateurs as UtilisateurResponseDTO[],
      page: options.page,
      total,
      totalPages,
      limit: options.limit,
      hasNextPage: options.page < totalPages,
      hasPreviousPage: options.page > 1,
    };
  }

  /**
   * Récupère tous les utilisateurs d'un rôle spécifique
   * Utile pour les rapports ou tâches administratives
   * @param role - Le rôle à rechercher
   * @returns Liste des utilisateurs avec ce rôle
   */
  async findByRole(role: RoleUtilisateur) {
    // Récupère tous les utilisateurs du rôle spécifié
    return supabaseDb.utilisateur.findMany({
      where: { role },
      select: {
        id: true,
        nom: true,
        email: true,
        role: true,
        actif: true,
        creeLe: true,
        modifieLe: true,
        motDePasse: false,
      },
      // Trie par nom
      orderBy: { nom: 'asc' },
    });
  }

  /**
   * Vérifie si un email est déjà utilisé
   * @param email - L'email à vérifier
   * @param exceptUserId - ID de l'utilisateur à exclure (pour mise à jour)
   * @returns true si l'email existe, false sinon
   */
  async emailExists(email: string, exceptUserId?: number): Promise<boolean> {
    // Construit les critères de recherche
    const where: any = { email: email.toLowerCase() };

    // Exclut un utilisateur spécifique (utile lors de la mise à jour)
    if (exceptUserId) {
      where.id = { not: exceptUserId };
    }

    // Compte les utilisateurs avec cet email
    const count = await supabaseDb.utilisateur.count({ where });

    // Retourne true s'il y en a au moins un
    return count > 0;
  }

  /**
   * Compte le nombre total d'utilisateurs
   * Utile pour les statistiques
   * @returns Nombre total d'utilisateurs
   */
  async count(): Promise<number> {
    // Compte tous les utilisateurs
    return supabaseDb.utilisateur.count();
  }

  /**
   * Compte les utilisateurs par rôle
   * Utile pour les statistiques et rapports
   * @returns Objet avec le nombre d'utilisateurs par rôle
   */
  async countByRole(): Promise<Record<RoleUtilisateur, number>> {
    // Utilise groupBy pour compter par rôle
    const result = await supabaseDb.utilisateur.groupBy({
      by: ['role'],
      _count: true,
    });

    // Crée un objet avec les rôles comme clés
    const roleCount: any = {};

    // Peuple l'objet avec les résultats
    result.forEach((r: any) => {
      roleCount[r.role] = r._count;
    });

    return roleCount;
  }
}

// Exporte une instance singleton du repository
export const utilisateurRepository = new UtilisateurRepository();