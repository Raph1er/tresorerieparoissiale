/**
 * Service d'authentification
 * Gère la création, la validation et la gestion des tokens JWT
 * ainsi que les opérations de connexion/déconnexion
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Récupération de la clé secrète depuis les variables d'environnement
// Cette clé est utilisée pour signer et vérifier les tokens JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Durée de validité du token (en heures)
// Le token expirera après cette période, forçant l'utilisateur à se reconnecter
const TOKEN_EXPIRATION = '24h';

/**
 * Interface pour le payload du JWT
 * Contient les informations essentielles de l'utilisateur encodées dans le token
 */
interface JWTPayload {
  // Identifiant unique de l'utilisateur
  userId: number;
  // Adresse email de l'utilisateur
  email: string;
  // Rôle de l'utilisateur (ADMIN, TRESORIER, RESPONSABLE, AUDITEUR)
  role: string;
  // Timestamp de création du token
  iat?: number;
  // Timestamp d'expiration du token
  exp?: number;
}

/**
 * Fonction pour créer un hash du mot de passe
 * Utilise bcrypt pour sécuriser le mot de passe avant stockage en base de données
 * @param motDePasse - Le mot de passe en texte clair
 * @returns Promise<string> - Le mot de passe hashé
 */
export async function hasherMotDePasse(motDePasse: string): Promise<string> {
  // Nombre de rounds de salage bcrypt (plus élevé = plus sécurisé mais plus lent)
  // 10 rounds est un bon équilibre entre sécurité et performance
  const saltRounds = 10;
  
  // Génère un hash du mot de passe avec un salt aléatoire
  return bcrypt.hash(motDePasse, saltRounds);
}

/**
 * Fonction pour vérifier si un mot de passe correspond à un hash
 * Utilisée lors de la tentative de connexion
 * @param motDePasse - Le mot de passe en texte clair saisi par l'utilisateur
 * @param hash - Le hash stocké en base de données
 * @returns Promise<boolean> - true si le mot de passe correspond, false sinon
 */
export async function verifierMotDePasse(
  motDePasse: string,
  hash: string
): Promise<boolean> {
  // Compare le mot de passe en texte clair avec le hash
  // Retourne un booléen indiquant si la comparaison est positive
  return bcrypt.compare(motDePasse, hash);
}

/**
 * Fonction pour générer un JWT
 * Crée un token qui sera utilisé pour authentifier les requêtes suivantes
 * @param payload - Les données à encoder dans le token
 * @returns string - Le token JWT signé
 */
export function genererToken(payload: JWTPayload): string {
  // Signe le payload avec la clé secrète et l'expiration définie
  // Le token contient les informations de l'utilisateur de manière sécurisée
  return jwt.sign(payload, JWT_SECRET, {
    // Définit la durée de vie du token
    expiresIn: TOKEN_EXPIRATION,
    // Algorithme de signature utilisé (HS256 = HMAC with SHA-256)
    algorithm: 'HS256',
  });
}

/**
 * Fonction pour vérifier et décoder un JWT
 * Valide la signature et l'expiration du token
 * @param token - Le token JWT à vérifier
 * @returns JWTPayload | null - Les données du token si valide, null sinon
 */
export function verifierToken(token: string): JWTPayload | null {
  try {
    // Vérifie la signature du token avec la clé secrète
    // Lève une exception si le token est invalide ou expiré
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Retourne les données du token si la vérification réussit
    return decoded;
  } catch (error) {
    // En cas d'erreur (token expiré, signature invalide, etc.)
    // On retourne null pour indiquer que le token est invalide
    console.error('Erreur de vérification du token:', error);
    return null;
  }
}

/**
 * Fonction pour extraire le token depuis l'en-tête Authorization
 * Récupère le token depuis le format "Bearer <token>"
 * @param authHeader - La valeur de l'en-tête Authorization
 * @returns string | null - Le token extrait ou null
 */
export function extraireToken(authHeader: string | null): string | null {
  // Vérifie que l'en-tête existe
  if (!authHeader) {
    return null;
  }

  // Vérifie que l'en-tête commence par "Bearer "
  // Le format attendu est "Bearer <token>"
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  // Extrait le token en supprimant le préfixe "Bearer "
  // Retourne la partie après "Bearer "
  return authHeader.substring(7);
}

/**
 * Fonction pour créer les données d'authentification
 * Combine le hachage du mot de passe et la génération du token
 * @param email - Email de l'utilisateur
 * @param motDePasse - Mot de passe en texte clair
 * @param userId - ID de l'utilisateur
 * @param role - Rôle de l'utilisateur
 * @returns Promise<{hash: string, token: string}> - Le hash et le token générés
 */
export async function creerAuthentification(
  email: string,
  motDePasse: string,
  userId: number,
  role: string
): Promise<{ hash: string; token: string }> {
  // Génère le hash du mot de passe
  // Ce hash sera stocké en base de données
  const hash = await hasherMotDePasse(motDePasse);

  // Génère le token JWT avec les informations de l'utilisateur
  // Ce token sera retourné au client
  const token = genererToken({
    userId,
    email,
    role,
  });

  // Retourne les deux éléments générés
  return { hash, token };
}