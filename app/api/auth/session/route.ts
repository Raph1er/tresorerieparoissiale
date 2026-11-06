import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification } from '@/middleware/auth.middleware';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const contexte = await validerAuthentification(request);
  if (contexte instanceof NextResponse) {
    return contexte;
  }

  return NextResponse.json(
    {
      user: {
        id: contexte.userId,
        nom: contexte.nom,
        email: contexte.email,
        role: contexte.role,
        modulePermissions: contexte.modulePermissions,
      },
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
