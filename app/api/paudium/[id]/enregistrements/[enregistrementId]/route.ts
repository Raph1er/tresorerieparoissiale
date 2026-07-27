import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import { paudiumService } from '@/modules/paudium/paudium.service';
import logger from '@/lib/logger';
import { updateEnregistrementSchema } from '@/validations/paudium.schema';

// Next.js 15+: params est une Promise
interface RouteContext {
    params: Promise<{ id: string; enregistrementId: string }>;
}

/**
 * DELETE /api/paudium/[id]/enregistrements/[enregistrementId]
 * Autorisé pour: ADMIN, RESPONSABLE, TRESORIER
 */
export async function DELETE(
    request: NextRequest,
    context: RouteContext
): Promise<NextResponse> {
    try {
        const contexte = await validerAuthentification(request);
        if (contexte instanceof NextResponse) {
            return contexte;
        }

        const erreurRole = validerRole(contexte, ['ADMIN', 'RESPONSABLE', 'TRESORIER']);
        if (erreurRole) {
            return erreurRole;
        }

        const { id, enregistrementId } = await context.params;
        const cahierId = parseInt(id, 10);
        const enregId = parseInt(enregistrementId, 10);
        if (isNaN(cahierId) || isNaN(enregId)) {
            return NextResponse.json({ erreur: 'ID invalide' }, { status: 400 });
        }

        // Vérifie que l'enregistrement existe et appartient bien au cahier
        const enreg = await paudiumService.getEnregistrementById(enregId);
        if (!enreg || (enreg as any).cahierId !== cahierId) {
            return NextResponse.json({ erreur: 'Enregistrement introuvable' }, { status: 404 });
        }

        const supprime = await paudiumService.deleteEnregistrement(enregId, contexte.userId);

        return NextResponse.json(supprime, { status: 200 });
    } catch (error) {
        if (error instanceof Error && error.message.includes('introuvable')) {
            return NextResponse.json({ erreur: error.message }, { status: 404 });
        }

        console.error('Erreur DELETE /api/paudium/[id]/enregistrements/[enregistrementId]:', error);
        await logger.log(
            'ERROR',
            `Erreur DELETE /api/paudium/[id]/enregistrements/[enregistrementId]: ${error}`
        );

        return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
    }
}

/**
 * PUT /api/paudium/[id]/enregistrements/[enregistrementId]
 * Autorisé pour: ADMIN, RESPONSABLE, TRESORIER
 */
export async function PUT(
    request: NextRequest,
    context: RouteContext
): Promise<NextResponse> {
    try {
        const contexte = await validerAuthentification(request);
        if (contexte instanceof NextResponse) {
            return contexte;
        }

        const erreurRole = validerRole(contexte, ['ADMIN', 'RESPONSABLE', 'TRESORIER']);
        if (erreurRole) {
            return erreurRole;
        }

        const { id, enregistrementId } = await context.params;
        const cahierId = parseInt(id, 10);
        const enregId = parseInt(enregistrementId, 10);
        if (isNaN(cahierId) || isNaN(enregId)) {
            return NextResponse.json({ erreur: 'ID invalide' }, { status: 400 });
        }

        const body: unknown = await request.json();
        const validation = updateEnregistrementSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ erreur: validation.error.flatten() }, { status: 400 });
        }

        // Vérifie que l'enregistrement existe et appartient bien au cahier
        const enreg = await paudiumService.getEnregistrementById(enregId);
        if (!enreg || (enreg as any).cahierId !== cahierId) {
            return NextResponse.json({ erreur: 'Enregistrement introuvable' }, { status: 404 });
        }

        const updated = await paudiumService.updateEnregistrement(enregId, validation.data, contexte.userId);

        return NextResponse.json(updated, { status: 200 });
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('introuvable') || error.message.includes('positif') || error.message.includes('vide')) {
                return NextResponse.json({ erreur: error.message }, { status: 400 });
            }
        }

        console.error('Erreur PUT /api/paudium/[id]/enregistrements/[enregistrementId]:', error);
        await logger.log(
            'ERROR',
            `Erreur PUT /api/paudium/[id]/enregistrements/[enregistrementId]: ${error}`
        );

        return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
    }
}
