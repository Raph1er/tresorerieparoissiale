/**
 * Route API pour récupérer les statistiques d'un cahier.
 * GET: statistiques agrégées (nombre, total, moyenne, min, max).
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import { paudiumService } from '@/modules/paudium/paudium.service';
import logger from '@/lib/logger';

interface RouteContext {
	params: Promise<{ id: string }>;
}

/**
 * GET /api/paudium/[id]/statistiques
 * Autorisé pour: ADMIN, RESPONSABLE, TRESORIER, AUDITEUR
 */
export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
	try {
		const contexte = await validerAuthentification(request);
		if (contexte instanceof NextResponse) {
			return contexte;
		}

		const erreurRole = validerRole(contexte, [
			'ADMIN',
			'RESPONSABLE',
			'TRESORIER',
			'AUDITEUR',
		]);
		if (erreurRole) {
			return erreurRole;
		}

		const { id } = await context.params;
		const cahierId = parseInt(id, 10);
		if (isNaN(cahierId)) {
			return NextResponse.json({ erreur: 'ID de cahier invalide' }, { status: 400 });
		}

		const statistiques = await paudiumService.getStatistiquesCahier(cahierId);

		return NextResponse.json(statistiques, { status: 200 });
	} catch (error) {
		if (error instanceof Error && error.message.includes('introuvable')) {
			return NextResponse.json({ erreur: error.message }, { status: 404 });
		}

		console.error('Erreur GET /api/paudium/[id]/statistiques:', error);
		await logger.log('ERROR', `Erreur GET /api/paudium/[id]/statistiques: ${error}`);

		return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
	}
}