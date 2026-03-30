/**
 * Types globaux pour la gestion du profil personnel utilisateur.
 */

/**
 * DTO pour la mise à jour du profil utilisateur (l'utilisateur modifie SON PROPRE profil)
 */
export interface UpdateProfileDTO {
    nom?: string;
    email?: string;
    motDePasseActuel?: string;
    motDePasseNouveau?: string;
}

/**
 * DTO pour le changement de password sécurisé
 */
export interface ChangePasswordDTO {
    motDePasseActuel: string;
    motDePasseNouveau: string;
}
