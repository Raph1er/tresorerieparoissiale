/**
 * Validations pour la mise à jour du profil utilisateur personnel.
 */

import { UpdateProfileDTO, ChangePasswordDTO } from '@/types/profile';

interface ValidationSuccess<T> {
    success: true;
    data: T;
}

interface ValidationError {
    success: false;
    error: string;
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function estObjet(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/**
 * Valide les données de mise à jour du profil utilisateur.
 * Un utilisateur peut modifier : nom, email, et changer de password (optionnel).
 */
export function validerUpdateProfileDTO(payload: unknown): ValidationResult<UpdateProfileDTO> {
    if (!estObjet(payload)) {
        return { success: false, error: 'Payload JSON invalide' };
    }

    const { nom, email, motDePasseActuel, motDePasseNouveau } = payload;
    const data: UpdateProfileDTO = {};

    let hasChanges = false;

    // Validation du nom (optionnel)
    if (nom !== undefined) {
        if (typeof nom !== 'string' || !nom.trim()) {
            return { success: false, error: 'Nom invalide' };
        }
        data.nom = nom.trim();
        hasChanges = true;
    }

    // Validation de l'email (optionnel)
    if (email !== undefined) {
        if (typeof email !== 'string' || !email.trim() || !EMAIL_REGEX.test(email.trim())) {
            return { success: false, error: 'Email invalide' };
        }
        data.email = email.trim().toLowerCase();
        hasChanges = true;
    }

    // Validation du changement de password.
    // Les chaines vides sont traitees comme "non fournies" pour permettre
    // une mise a jour du nom/email sans imposer un changement de mot de passe.
    const oldPasswordValue = typeof motDePasseActuel === 'string' ? motDePasseActuel : undefined;
    const newPasswordValue = typeof motDePasseNouveau === 'string' ? motDePasseNouveau : undefined;

    const hasOldPassword = typeof oldPasswordValue === 'string' && oldPasswordValue.length > 0;
    const hasNewPassword = typeof newPasswordValue === 'string' && newPasswordValue.length > 0;

    if (hasOldPassword || hasNewPassword) {
        if (!hasOldPassword || !hasNewPassword) {
            return {
                success: false,
                error: 'Pour changer le mot de passe, veuillez fournir l\'ancien et le nouveau',
            };
        }

        if (!newPasswordValue || newPasswordValue.length < MIN_PASSWORD_LENGTH) {
            return {
                success: false,
                error: `Le nouveau mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères`,
            };
        }

        if (oldPasswordValue === newPasswordValue) {
            return {
                success: false,
                error: 'Le nouveau mot de passe doit être différent de l\'ancien',
            };
        }

        data.motDePasseActuel = oldPasswordValue;
        data.motDePasseNouveau = newPasswordValue;
        hasChanges = true;
    }

    if (!hasChanges) {
        return { success: false, error: 'Aucune donnée valide à mettre à jour' };
    }

    return { success: true, data };
}

/**
 * Valide le changement de password (form séparé, optionnel).
 */
export function validerChangePasswordDTO(payload: unknown): ValidationResult<ChangePasswordDTO> {
    if (!estObjet(payload)) {
        return { success: false, error: 'Payload JSON invalide' };
    }

    const { motDePasseActuel, motDePasseNouveau } = payload;

    if (typeof motDePasseActuel !== 'string' || !motDePasseActuel) {
        return { success: false, error: 'L\'ancien mot de passe est requis' };
    }

    if (typeof motDePasseNouveau !== 'string' || motDePasseNouveau.length < MIN_PASSWORD_LENGTH) {
        return {
            success: false,
            error: `Le nouveau mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères`,
        };
    }

    if (motDePasseActuel === motDePasseNouveau) {
        return {
            success: false,
            error: 'Le nouveau mot de passe doit être différent de l\'ancien',
        };
    }

    return { success: true, data: { motDePasseActuel, motDePasseNouveau } };
}
