/**
 * Route API pour le module Rapports.
 * GET: retourne un rapport global filtre.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import logger from '@/lib/logger';
import { rapportService } from '@/modules/rapports/rapport.service';
import { validerRapportQuery } from '@/validations/rapport.schema';
import nodemailer from 'nodemailer';


interface EnvoyerRapportEmailBody {
    // Nom du fichier PDF (ex: rapport-transactions-2026-03-01-au-2026-03-27.pdf)
    fileName?: unknown;
    // PDF encode en base64 (sans ou avec prefixe data:application/pdf;base64,)
    pdfBase64?: unknown;
}

/**
 * Nettoie le nom de fichier pour eviter les caracteres dangereux.
 * On n'autorise que lettres/chiffres/._-
 */
function nettoyerNomFichier(value: string): string {
    const sanitized = value.replace(/[^a-zA-Z0-9._-]/g, '_');

    // On force l'extension .pdf si absente
    if (!sanitized.toLowerCase().endsWith('.pdf')) {
        return `${sanitized}.pdf`;
    }

    return sanitized;
}

/**
 * Convertit une chaine base64 de PDF en Buffer binaire pour nodemailer.
 * Retourne null si la chaine est invalide.
 */
function decoderBase64Pdf(input: string): Buffer | null {
    try {
        // Supprime un eventuel prefixe "data:application/pdf;base64,"
        const cleaned = input.replace(/^data:application\/pdf;base64,/, '').trim();

        const buffer = Buffer.from(cleaned, 'base64');
        if (buffer.length === 0) {
            return null;
        }

        return buffer;
    } catch {
        return null;
    }
}

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

/**
 * POST /api/rapports
 * Envoie le rapport PDF (recu en base64) par email a l'utilisateur connecte.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        // 1) Verifier que l'utilisateur est authentifie
        const contexte = await validerAuthentification(request);
        if (contexte instanceof NextResponse) {
            return contexte;
        }

        // 2) Verifier le role (meme politique que GET)
        const erreurRole = validerRole(contexte, [
            'ADMIN',
            'RESPONSABLE',
            'TRESORIER',
            'AUDITEUR',
        ]);
        if (erreurRole) {
            return erreurRole;
        }

        // 3) Lire et valider le body JSON
        const body = (await request.json()) as EnvoyerRapportEmailBody;

        if (typeof body.fileName !== 'string' || body.fileName.trim().length < 3) {
            return NextResponse.json(
                { erreur: 'Le champ "fileName" est requis et invalide' },
                { status: 400 }
            );
        }

        if (typeof body.pdfBase64 !== 'string' || body.pdfBase64.trim().length === 0) {
            return NextResponse.json(
                { erreur: 'Le champ "pdfBase64" est requis' },
                { status: 400 }
            );
        }

        // 4) Decoder le PDF base64
        const pdfBuffer = decoderBase64Pdf(body.pdfBase64);
        if (!pdfBuffer) {
            return NextResponse.json({ erreur: 'Le PDF est invalide' }, { status: 400 });
        }

        // Limite de securite: 10 Mo max
        if (pdfBuffer.byteLength > 10 * 1024 * 1024) {
            return NextResponse.json(
                { erreur: 'Le PDF depasse la taille maximale de 10 Mo' },
                { status: 413 }
            );
        }

        // 5) Lire la config SMTP depuis les variables d'environnement
        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = process.env.SMTP_PORT;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        const mailFrom = process.env.MAIL_FROM;

        if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !mailFrom) {
            return NextResponse.json(
                { erreur: 'Configuration SMTP incomplete cote serveur' },
                { status: 500 }
            );
        }

        const port = Number.parseInt(smtpPort, 10);
        if (Number.isNaN(port)) {
            return NextResponse.json(
                { erreur: 'SMTP_PORT est invalide' },
                { status: 500 }
            );
        }

        // 6) Construire le transporteur email
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port,
            secure: port === 465, // true pour SSL direct (465), false pour STARTTLS (587)
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        // 7) Envoyer le mail avec piece jointe PDF
        const nomFichier = nettoyerNomFichier(body.fileName);

        await transporter.sendMail({
            from: mailFrom,
            to: contexte.email, // envoi vers l'utilisateur connecte
            subject: 'Rapport PDF de votre plateforme de trésorerie paroissiale',
            text:
                'Bonjour,\n\n' +
                'Veuillez trouver en piece jointe le rapport PDF généré depuis votre espace.\n\n' +
                'Cordialement.',

				    replyTo: "raphaelkouessan1er@gmail.com", // ✅ AJOUT ICI
            attachments: [
                {
                    filename: nomFichier,
                    content: pdfBuffer,
                    contentType: 'application/pdf',
                },
            ],
        });

        return NextResponse.json(
            {
                message: 'Rapport envoyé par email avec succès',
                destinataire: contexte.email,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Erreur POST /api/rapports:', error);
        await logger.log('ERROR', `Erreur POST /api/rapports: ${error}`);

        return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
    }
}
