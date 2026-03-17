/**
 * Service de logging pour l'audit
 * Enregistre toutes les actions importantes du système
 * Utilisé pour la traçabilité et la conformité
 */

import prisma from './prisma';

/**
 * Types d'actions pouvant être loggées
 * Chaque action est tracée pour audit interne
 */
export type TypeAction =
  // Authentification
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGIN_ERROR'
  | 'LOGOUT'
  | 'LOGOUT_ERROR'
  // Authentification et autorisation
  | 'AUTH_MISSING'
  | 'AUTH_INVALID_FORMAT'
  | 'AUTH_INVALID_TOKEN'
  | 'AUTH_FORBIDDEN'
  | 'AUTH_ERROR'
  // Gestion des utilisateurs
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'USER_DISABLED'
  | 'ERROR' // Pour les erreurs générales, comme les erreurs serveur ou les exceptions non gérées
  // Gestion des catégories
  | 'CATEGORY_CREATED'
  | 'CATEGORY_UPDATED'
  | 'CATEGORY_DELETED'
  // Gestion des transactions
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_UPDATED'
  | 'TRANSACTION_DELETED'
  | 'TRANSACTION_VALIDATED'
  | 'TRANSACTION_REJECTED'
  // Gestion des événements
  | 'EVENT_CREATED'
  | 'EVENT_UPDATED'
  | 'EVENT_DELETED'
  // Gestion des dîmes
  | 'TITHES_CREATED'
  | 'TITHES_UPDATED'
  | 'TITHES_DELETED'
  | 'TITHES_CALCULATED';

/**
 * Classe Logger pour la gestion centralisée des logs
 * Enregistre les actions dans la base de données pour audit
 */
class Logger {
  /**
   * Méthode pour enregistrer une action
   * @param action - Le type d'action effectuée
   * @param description - Description détaillée de l'action
   * @param userId - ID de l'utilisateur (optionnel, peut être null)
   * @param adresseIP - Adresse IP de la requête (optionnel)
   * @returns Promise<void>
   */
  async log(
    action: TypeAction,
    description: string,
    userId?: number,
    adresseIP?: string
  ): Promise<void> {
    try {
      // Le schéma actuel impose utilisateurId NOT NULL avec FK.
      // Si on n'a pas d'utilisateur identifié (ex: login échoué avant lookup),
      // on évite l'insert pour ne pas déclencher P2003.
      if (!userId) {
        console.log(`[${action}] ${description}`);
        return;
      }

      // Crée un enregistrement dans la table JournalAction
      // Cet enregistrement sera utilisé pour l'audit
      await prisma.journalAction.create({
        data: {
          // ID de l'utilisateur authentifié ou identifié
          utilisateurId: userId,
          // Type d'action effectuée
          action,
          // Description détaillée de ce qui s'est passé
          description,
          // Adresse IP de la personne qui a effectué l'action
          // Utile pour la sécurité et l'audit
          adresseIP: adresseIP || 'UNKNOWN',
        },
      });

      // Log également dans la console pour le développement
      console.log(`[${action}] ${description}`);

    } catch (error) {
      // En cas d'erreur lors de l'enregistrement du log
      // On enregistre l'erreur mais on ne la propage pas
      console.error('Erreur lors de l\'enregistrement du log:', error);
    }
  }

  /**
   * Méthode pour récupérer l'adresse IP d'une requête
   * @param request - La requête HTTP
   * @returns string - L'adresse IP extraite
   */
  extraireAdresseIP(request: any): string {
    // Vérifie d'abord les en-têtes de proxy (pour les déploiements derrière un proxy)
    const forwardedFor = request.headers.get('x-forwarded-for');
    
    // Si x-forwarded-for existe, prend la première IP
    // (peut contenir plusieurs IPs en cas de proxies multiples)
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    // Essaie de récupérer l'en-tête x-real-ip (utilisé par certains proxies)
    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
      return realIp;
    }

    // En dernier recours, utilise l'IP directe du socket
    // request.socket.remoteAddress contient l'IP du client direct
    return request.socket?.remoteAddress || 'UNKNOWN';
  }
}

// Exporte une instance singleton du logger
// Permet d'utiliser le logger dans toute l'application
export default new Logger();