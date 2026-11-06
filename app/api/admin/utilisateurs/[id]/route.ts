import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import { MODULE_PERMISSIONS } from '@/lib/module-permissions';
import { supabaseServer } from '@/lib/supabase';
import logger from '@/lib/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const contexteAuth = await validerAuthentification(request);
  if (contexteAuth instanceof NextResponse) {
    return contexteAuth;
  }

  const erreurRole = validerRole(contexteAuth, ['ADMIN']);
  if (erreurRole) {
    return erreurRole;
  }

  const { id: idParam } = await context.params;
  const utilisateurId = Number(idParam);
  if (!Number.isSafeInteger(utilisateurId) || utilisateurId <= 0) {
    return NextResponse.json({ erreur: 'Identifiant utilisateur invalide' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erreur: 'Corps JSON invalide' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ erreur: 'Données invalides' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const keys = Object.keys(payload);
  const hasStatus = Object.prototype.hasOwnProperty.call(payload, 'actif');
  const hasPermissions = Object.prototype.hasOwnProperty.call(payload, 'permissions');
  const hasRole = Object.prototype.hasOwnProperty.call(payload, 'role');
  if (
    keys.some((key) => key !== 'actif' && key !== 'permissions' && key !== 'role')
    || (!hasStatus && !hasPermissions && !hasRole)
    || (hasStatus && typeof payload.actif !== 'boolean')
    || (hasRole && (
      typeof payload.role !== 'string'
      || !['ADMIN', 'TRESORIER', 'RESPONSABLE', 'AUDITEUR', 'SECRETAIRE'].some((role) => role === payload.role)
    ))
  ) {
    return NextResponse.json({ erreur: 'Données de modification invalides' }, { status: 400 });
  }

  let moduleKeys: string[] | null = null;
  if (hasPermissions) {
    if (
      !Array.isArray(payload.permissions)
      || payload.permissions.length > MODULE_PERMISSIONS.length
      || payload.permissions.some((key) => typeof key !== 'string')
    ) {
      return NextResponse.json({ erreur: 'Liste de permissions invalide' }, { status: 400 });
    }

    if (
      hasRole
      && payload.role !== 'ADMIN'
      && (!hasPermissions || !Array.isArray(payload.permissions))
    ) {
      return NextResponse.json(
        { erreur: 'Choisissez les modules à accorder lors de l’attribution d’un rôle' },
        { status: 400 }
      );
    }

    moduleKeys = payload.permissions as string[];
    const allowedKeys = new Set(MODULE_PERMISSIONS.map((module) => module.key));
    if (
      new Set(moduleKeys).size !== moduleKeys.length
      || moduleKeys.some((key) => !allowedKeys.has(key))
    ) {
      return NextResponse.json({ erreur: 'Une ou plusieurs permissions sont inconnues' }, { status: 400 });
    }

    if (hasRole && payload.role === 'ADMIN') {
      if (moduleKeys.length > 0) {
        return NextResponse.json(
          { erreur: 'Un administrateur dispose automatiquement de tous les modules' },
          { status: 400 }
        );
      }
      moduleKeys = null;
    }
  }

  if (utilisateurId === contexteAuth.userId) {
    return NextResponse.json(
      { erreur: 'Vous ne pouvez pas modifier votre propre compte depuis cette page' },
      { status: 400 }
    );
  }

  const { error } = await supabaseServer.rpc('rpc_admin_update_access', {
    p_actor_id: contexteAuth.userId,
    p_target_id: utilisateurId,
    p_actif: hasStatus ? payload.actif as boolean : null,
    p_role: hasRole ? payload.role as string : null,
    p_module_keys: moduleKeys,
    p_allowed_module_keys: MODULE_PERMISSIONS.map((module) => module.key),
  });

  if (error) {
    const message = error.message ?? '';
    if (message.includes('USER_NOT_FOUND')) {
      return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 });
    }
    if (message.includes('LAST_ACTIVE_ADMIN')) {
      return NextResponse.json(
        { erreur: 'Le dernier administrateur actif ne peut pas être désactivé' },
        { status: 409 }
      );
    }
    if (message.includes('ADMIN_PERMISSIONS_IMMUTABLE')) {
      return NextResponse.json(
        { erreur: 'Les permissions d’un administrateur sont intégrales et ne peuvent pas être modifiées' },
        { status: 400 }
      );
    }
    if (message.includes('SELF_MODIFICATION_FORBIDDEN')) {
      return NextResponse.json({ erreur: 'Vous ne pouvez pas modifier votre propre compte' }, { status: 400 });
    }

    console.error('Erreur PATCH /api/admin/utilisateurs/[id]:', error);
    return NextResponse.json({ erreur: 'La modification du compte a échoué' }, { status: 500 });
  }

  const description = [
    hasStatus ? `statut ${payload.actif ? 'activé' : 'désactivé'}` : null,
    hasRole ? `rôle ${payload.role}` : null,
    hasPermissions ? `permissions: ${moduleKeys?.join(', ') || 'aucune'}` : null,
  ].filter(Boolean).join('; ');
  await logger.log(
    hasStatus && !payload.actif
      ? 'USER_DISABLED'
      : hasStatus && payload.actif
        ? 'USER_ENABLED'
        : hasRole
          ? 'USER_ROLE_UPDATED'
          : 'USER_PERMISSIONS_UPDATED',
    `Gestion d'accès de l'utilisateur ${utilisateurId}: ${description}`,
    contexteAuth.userId,
    logger.extraireAdresseIP(request)
  );

  return NextResponse.json({ message: 'Accès utilisateur mis à jour' }, { status: 200 });
}
