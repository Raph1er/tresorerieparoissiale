/**
 * Route API pour le module Rapports.
 * GET: retourne un rapport global filtre.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import logger from '@/lib/logger';
import { rapportService } from '@/modules/rapports/rapport.service';
import { validerRapportQuery } from '@/validations/rapport.schema';

/**
 * GET /api/rapports
 * Autorise pour: ADMIN, RESPONSABLE, TRESORIER, AUDITEUR
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

		const { searchParams } = new URL(request.url);
		const validation = validerRapportQuery(searchParams);
		if (!validation.success) {
			return NextResponse.json({ erreur: validation.error }, { status: 400 });
		}

		const rapport = await rapportService.getRapportGlobal(validation.data);
		return NextResponse.json(rapport, { status: 200 });
	} catch (error) {
		console.error('Erreur GET /api/rapports:', error);
		await logger.log('ERROR', `Erreur GET /api/rapports: ${error}`);

		return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
	}
}
