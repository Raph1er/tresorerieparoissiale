/**
 * Route POST /api/auth/login
 * Gère la connexion des utilisateurs
 * Valide les identifiants et retourne un token JWT
 */

import { NextRequest, NextResponse } from 'next/server';
import supabaseDb from '@/lib/supabase-db';
import { verifierMotDePasse, genererToken } from '@/lib/auth';
import logger from '@/lib/logger';

/**
 * Fonction POST pour la connexion
 * @param request - La requête HTTP contenant les identifiants
 * @returns NextResponse - La réponse avec le token ou un message d'erreur
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Récupère le corps de la requête en JSON
    // Le client doit envoyer { email, motDePasse }
    const body = await request.json();

    // Extrait l'email du corps de la requête
    const { email } = body;

    // Extrait le mot de passe du corps de la requête
    const { motDePasse } = body;

    // Valide que l'email est fourni
    // Si l'email manque, retourne une erreur 400
    if (!email) {
      return NextResponse.json(
        { erreur: 'Email requis' },
        { status: 400 }
      );
    }

    // Valide que le mot de passe est fourni
    // Si le mot de passe manque, retourne une erreur 400
    if (!motDePasse) {
      return NextResponse.json(
        { erreur: 'Mot de passe requis' },
        { status: 400 }
      );
    }

    // Recherche l'utilisateur en base de données par son email
    // La recherche est sensible à la casse
    const utilisateur = await supabaseDb.utilisateur.findUnique({
      where: { email },
    });

    // Vérifie que l'utilisateur existe
    // Si l'utilisateur n'existe pas, retourne une erreur 401 (Unauthorized)
    if (!utilisateur) {
      // Log l'tentative de connexion échouée pour audit
      await logger.log('LOGIN_FAILED', `Tentative avec email inexistant: ${email}`);

      return NextResponse.json(
        { erreur: 'Email ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    // Vérifie que l'utilisateur est actif
    // Un utilisateur inactif ne peut pas se connecter
    if (!utilisateur.actif) {
      // Log l'tentative de connexion d'un utilisateur désactivé
      await logger.log('LOGIN_FAILED', `Compte désactivé: ${email}`, utilisateur.id);

      return NextResponse.json(
        { erreur: 'Compte désactivé' },
        { status: 403 }
      );
    }

    // Vérifie le mot de pass
    // e en comparant avec le hash en base
    // Utilise bcrypt pour une comparaison sécurisée
    const motDePasseValide = await verifierMotDePasse(
      motDePasse,
      utilisateur.motDePasse
    );

    // Si le mot de passe ne correspond pas
    if (!motDePasseValide) {
      // Log l'tentative échouée
      await logger.log('LOGIN_FAILED', `Mauvais mot de passe: ${email}`, utilisateur.id);

      return NextResponse.json(
        { erreur: 'Email ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    // Génère un token JWT avec les informations de l'utilisateur
    // Ce token sera utilisé pour authentifier les requêtes suivantes
    const token = genererToken({
      userId: utilisateur.id,
      email: utilisateur.email,
      role: utilisateur.role,
    });

    // Log la connexion réussie
    await logger.log('LOGIN_SUCCESS', `Connexion réussie: ${email}`, utilisateur.id);

    // Retourne le token et les infos de l'utilisateur au client
    // Le statut 200 indique une réponse réussie
    return NextResponse.json({
      // Le token JWT à utiliser dans les en-têtes Authorization
      token,
      // Les informations de l'utilisateur connecté
      utilisateur: {
        // Identifiant unique
        id: utilisateur.id,
        // Nom complet de l'utilisateur
        nom: utilisateur.nom,
        // Adresse email
        email: utilisateur.email,
        // Rôle de l'utilisateur (ADMIN, TRESORIER, etc.)
        role: utilisateur.role,
      },
    }, { status: 200 });

  } catch (error) {
    // En cas d'erreur serveur (exception non prévue)
    // Log l'erreur pour debug
    console.error('Erreur lors de la connexion:', error);

    // Log l'erreur dans le système d'audit
    await logger.log('LOGIN_ERROR', `Erreur serveur: ${error}`);

    // Retourne une erreur 500 (Internal Server Error)
    return NextResponse.json(
      { erreur: 'Erreur serveur' },
      { status: 500 }
    );
  }
}