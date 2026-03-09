/**
 * Route POST /api/auth/register
 * Gère l'enregistrement des nouveaux utilisateurs
 * Crée un compte avec validation des données
 * Seul l'ADMIN peut créer de nouveaux comptes en production
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hasherMotDePasse, genererToken } from '@/lib/auth';
import logger from '@/lib/logger';

/**
 * Interface pour les données d'inscription
 * Contient les informations requises pour créer un nouvel utilisateur
 */
interface DataInscription {
  // Nom complet de l'utilisateur
  nom: string;
  // Adresse email unique pour la connexion
  email: string;
  // Mot de passe en texte clair (sera hashé)
  motDePasse: string;
  // Confirmation du mot de passe pour vérification
  confirmationMotDePasse: string;
  // Rôle de l'utilisateur (ADMIN, TRESORIER, RESPONSABLE, AUDITEUR)
  role: string;
}

/**
 * Constantes de validation
 */

// Longueur minimale requise pour le mot de passe
const MIN_PASSWORD_LENGTH = 8;

// Expression régulière pour valider un email
// Valide les formats email standard
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rôles autorisés dans le système
const ROLES_AUTORISES = ['ADMIN', 'TRESORIER', 'RESPONSABLE', 'AUDITEUR'];

/**
 * Fonction POST pour l'inscription
 * @param request - La requête HTTP contenant les données d'inscription
 * @returns NextResponse - Confirmation ou message d'erreur
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Récupère le corps de la requête en JSON
    // Le client doit envoyer { nom, email, motDePasse, confirmationMotDePasse, role }
    const body: Partial<DataInscription> = await request.json();

    // Extraction des champs du corps de la requête
    // On utilise Partial pour permettre des champs manquants
    const { nom, email, motDePasse, confirmationMotDePasse, role } = body;

    // ============================================================
    // VALIDATION 1 : Vérifier la présence de tous les champs requis
    // ============================================================

    // Valide que le nom est fourni
    if (!nom || typeof nom !== 'string' || nom.trim().length === 0) {
      return NextResponse.json(
        { erreur: 'Nom requis et doit être une chaîne valide' },
        { status: 400 }
      );
    }

    // Valide que l'email est fourni
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return NextResponse.json(
        { erreur: 'Email requis' },
        { status: 400 }
      );
    }

    // Valide que le mot de passe est fourni
    if (!motDePasse || typeof motDePasse !== 'string') {
      return NextResponse.json(
        { erreur: 'Mot de passe requis' },
        { status: 400 }
      );
    }

    // Valide que la confirmation du mot de passe est fournie
    if (!confirmationMotDePasse || typeof confirmationMotDePasse !== 'string') {
      return NextResponse.json(
        { erreur: 'Confirmation du mot de passe requise' },
        { status: 400 }
      );
    }

    // Valide que le rôle est fourni
    if (!role || typeof role !== 'string') {
      return NextResponse.json(
        { erreur: 'Rôle requis' },
        { status: 400 }
      );
    }

    // ============================================================
    // VALIDATION 2 : Normaliser et nettoyer les données
    // ============================================================

    // Normalise le nom : supprime les espaces inutiles
    const nomNormalise = nom.trim();

    // Normalise l'email : convertit en minuscules et supprime les espaces
    const emailNormalise = email.toLowerCase().trim();

    // Normalise le rôle : convertit en majuscules
    const roleNormalise = role.toUpperCase();

    // ============================================================
    // VALIDATION 3 : Valider le format de l'email
    // ============================================================

    // Vérifie que l'email respecte le format standard
    if (!EMAIL_REGEX.test(emailNormalise)) {
      return NextResponse.json(
        { erreur: 'Format d\'email invalide' },
        { status: 400 }
      );
    }

    // ============================================================
    // VALIDATION 4 : Valider la longueur du mot de passe
    // ============================================================

    // Vérifie que le mot de passe a une longueur minimale
    if (motDePasse.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          erreur: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`,
        },
        { status: 400 }
      );
    }

    // ============================================================
    // VALIDATION 5 : Vérifier que les mots de passe correspondent
    // ============================================================

    // Vérifie que le mot de passe et sa confirmation sont identiques
    if (motDePasse !== confirmationMotDePasse) {
      return NextResponse.json(
        { erreur: 'Les mots de passe ne correspondent pas' },
        { status: 400 }
      );
    }

    // ============================================================
    // VALIDATION 6 : Vérifier que le rôle est autorisé
    // ============================================================

    // Vérifie que le rôle est parmi les rôles autorisés du système
    if (!ROLES_AUTORISES.includes(roleNormalise)) {
      return NextResponse.json(
        {
          erreur: `Rôle invalide. Rôles autorisés: ${ROLES_AUTORISES.join(
            ', '
          )}`,
        },
        { status: 400 }
      );
    }

    // ============================================================
    // VALIDATION 7 : Vérifier l'unicité de l'email
    // ============================================================

    // Recherche si un utilisateur avec cet email existe déjà
    const utilisateurExistant = await prisma.utilisateur.findUnique({
      where: { email: emailNormalise },
    });

    // Si un utilisateur avec cet email existe, rejette l'inscription
    if (utilisateurExistant) {
      // Log la tentative de création avec un email existant
      await logger.log(
        'USER_CREATED',
        `Tentative d'inscription avec email existant: ${emailNormalise}`
      );

      return NextResponse.json(
        { erreur: 'Cet email est déjà utilisé' },
        { status: 409 } // 409 Conflict - ressource existe déjà
      );
    }

    // ============================================================
    // VALIDATION 8 : Validation complète réussie
    // ============================================================

    // Tout est valide, on peut procéder à la création de l'utilisateur
    // Hache le mot de passe avec bcrypt
    // Le hash ne sera jamais égal au mot de passe en clair
    const motDePasseHashe = await hasherMotDePasse(motDePasse);

    // ============================================================
    // CRÉATION 1 : Créer le nouvel utilisateur en base de données
    // ============================================================

    // Crée le nouvel utilisateur avec les données validées
    const nouvelUtilisateur = await prisma.utilisateur.create({
      data: {
        // Nom complet de l'utilisateur
        nom: nomNormalise,
        // Email normalisé (clé unique)
        email: emailNormalise,
        // Hash du mot de passe
        motDePasse: motDePasseHashe,
        // Rôle de l'utilisateur
        role: roleNormalise as any,
        // L'utilisateur est actif par défaut lors de la création
        actif: true,
      },
    });

    // ============================================================
    // CRÉATION 2 : Générer le token JWT
    // ============================================================

    // Génère un token JWT pour l'utilisateur nouvellement créé
    // Permet une connexion automatique après inscription
    const token = genererToken({
      // ID de l'utilisateur généré par la base de données
      userId: nouvelUtilisateur.id,
      // Email de l'utilisateur
      email: nouvelUtilisateur.email,
      // Rôle de l'utilisateur
      role: nouvelUtilisateur.role,
    });

    // ============================================================
    // AUDIT : Enregistrer l'action
    // ============================================================

    // Log la création réussie de l'utilisateur
    await logger.log(
      'USER_CREATED',
      `Nouvel utilisateur créé: ${emailNormalise} (Rôle: ${roleNormalise})`,
      nouvelUtilisateur.id
    );

    // ============================================================
    // RÉPONSE 1 : Retourner les informations de l'utilisateur créé
    // ============================================================

    // Retourne un code 201 (Created) indiquant que la ressource a été créée
    return NextResponse.json(
      {
        // Message de confirmation
        message: 'Inscription réussie',
        // Token JWT pour l'authentification automatique
        token,
        // Informations de l'utilisateur créé
        utilisateur: {
          // ID généré par la base de données
          id: nouvelUtilisateur.id,
          // Nom complet
          nom: nouvelUtilisateur.nom,
          // Email
          email: nouvelUtilisateur.email,
          // Rôle assigné
          role: nouvelUtilisateur.role,
          // Date de création
          creeLe: nouvelUtilisateur.creeLe,
        },
      },
      { status: 201 } // 201 Created - ressource créée avec succès
    );

  } catch (error) {
    // ============================================================
    // GESTION DES ERREURS
    // ============================================================

    // Log l'erreur non prévisible
    console.error('Erreur lors de l\'inscription:', error);

    // Enregistre l'erreur dans le journal d'audit
    await logger.log(
      'USER_CREATED',
      `Erreur lors de l'inscription: ${error}`
    );

    // Retourne une erreur 500 (Internal Server Error)
    return NextResponse.json(
      { erreur: 'Erreur serveur lors de l\'inscription' },
      { status: 500 }
    );
  }
}