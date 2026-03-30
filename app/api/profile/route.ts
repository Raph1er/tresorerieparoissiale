/**
 * Route API pour la gestion du profil personnel de l'utilisateur connecté.
 * GET: Récupère le profil de l'utilisateur connecté
 * PUT: Met à jour le profil (nom, email, password)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification } from '@/middleware/auth.middleware';
import { utilisateurService } from '@/modules/utilisateurs/utilisateur.service';
import { validerUpdateProfileDTO } from '@/validations/profile.schema';
import logger from '@/lib/logger';
import { hasherMotDePasse, verifierMotDePasse } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/profile
 * Récupère le profil de l'utilisateur connecté
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const contexte = await validerAuthentification(request);
        if (contexte instanceof NextResponse) {
            return contexte;
        }

        const utilisateur = await utilisateurService.getUtilisateurById(contexte.userId);
        return NextResponse.json(utilisateur, { status: 200 });
    } catch (error) {
        if (error instanceof Error && error.message.includes('non trouvé')) {
            return NextResponse.json({ erreur: error.message }, { status: 404 });
        }

        console.error('Erreur GET profile:', error);
        await logger.log('ERROR', `Erreur GET profile: ${error}`);

        return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * PUT /api/profile
 * Met à jour le profil de l'utilisateur connecté (nom, email, password)
 * L'utilisateur ne peut modifier que SON profil.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
    try {
        // ================================================================
        // ÉTAPE 1 : Valider l'authentification
        // ================================================================

        const contexte = await validerAuthentification(request);
        if (contexte instanceof NextResponse) {
            return contexte;
        }

        // ================================================================
        // ÉTAPE 2 : Extraire et valider les données
        // ================================================================

        const body: unknown = await request.json();
        const validationBody = validerUpdateProfileDTO(body);

        if (!validationBody.success) {
            return NextResponse.json({ erreur: validationBody.error }, { status: 400 });
        }

        const donnees = validationBody.data;

        // ================================================================
        // ÉTAPE 3 : Si changement de password, vérifier l'ancien password
        // ================================================================

        if (donnees.motDePasseActuel && donnees.motDePasseNouveau) {
            // Récupère l'utilisateur avec le password depuis la base de données
            const utilisateur = await prisma.utilisateur.findUnique({
                where: { id: contexte.userId },
                select: { motDePasse: true },
            });

            if (!utilisateur) {
                return NextResponse.json({ erreur: 'Utilisateur non trouvé' }, { status: 404 });
            }

            // Vérifier que l'ancien password est correct
            const passwordCorrect = await verifierMotDePasse(donnees.motDePasseActuel, utilisateur.motDePasse);

            if (!passwordCorrect) {
                return NextResponse.json({ erreur: 'L\'ancien mot de passe est incorrect' }, { status: 401 });
            }

            // Hasher le nouveau password
            donnees.motDePasseNouveau = await hasherMotDePasse(donnees.motDePasseNouveau);
        }

        // ================================================================
        // ÉTAPE 4 : Mettre à jour le profil
        // ================================================================

        const updateData: Record<string, unknown> = {};

        if (donnees.nom) {
            updateData.nom = donnees.nom;
        }

        if (donnees.email) {
            updateData.email = donnees.email;
        }

        // Mettre à jour les données via le service (nom, email)
        await utilisateurService.updateUtilisateur(
            contexte.userId,
            updateData as any,
            contexte.userId
        );

        // Si le password a changé, le mettre à jour directement (déjà hashé à l'étape 3)
        if (donnees.motDePasseNouveau) {
            await prisma.utilisateur.update({
                where: { id: contexte.userId },
                data: { motDePasse: donnees.motDePasseNouveau },
            });
        }

        // Récupérer l'utilisateur mis à jour (sans le password)
        const utilisateurMiseAjour = await utilisateurService.getUtilisateurById(contexte.userId);

        return NextResponse.json(utilisateurMiseAjour, { status: 200 });
    } catch (error) {
        // ================================================================
        // GESTION DES ERREURS
        // ================================================================

        if (error instanceof Error) {
            if (error.message.includes('non trouvé')) {
                return NextResponse.json({ erreur: error.message }, { status: 404 });
            }

            if (error.message.includes('déjà utilisé')) {
                return NextResponse.json({ erreur: error.message }, { status: 409 });
            }
        }

        console.error('Erreur PUT profile:', error);
        await logger.log('ERROR', `Erreur PUT profile: ${error}`);

        return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
    }
}
