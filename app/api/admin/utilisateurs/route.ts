import { NextRequest, NextResponse } from 'next/server';
import { validerAuthentification, validerRole } from '@/middleware/auth.middleware';
import { MODULE_PERMISSIONS } from '@/lib/module-permissions';
import { supabaseServer } from '@/lib/supabase';
import { hasherMotDePasse } from '@/lib/auth';
import logger from '@/lib/logger';

const ROLES_AUTORISES = ['ADMIN', 'TRESORIER', 'RESPONSABLE', 'AUDITEUR', 'SECRETAIRE'] as const;

function estRoleAutorise(role: unknown): role is (typeof ROLES_AUTORISES)[number] {
  return typeof role === 'string'
    && ROLES_AUTORISES.some((roleAutorise) => roleAutorise === role);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const contexte = await validerAuthentification(request);
  if (contexte instanceof NextResponse) {
    return contexte;
  }

  const erreurRole = validerRole(contexte, ['ADMIN']);
  if (erreurRole) {
    return erreurRole;
  }

  const { data: utilisateurs, error: erreurUtilisateurs } = await supabaseServer
    .from('utilisateurs')
    .select('id, nom, email, role, actif, cree_le')
    .order('nom', { ascending: true });

  if (erreurUtilisateurs) {
    console.error('Erreur GET /api/admin/utilisateurs:', erreurUtilisateurs);
    return NextResponse.json({ erreur: 'Impossible de charger les utilisateurs' }, { status: 500 });
  }

  const utilisateurIds = (utilisateurs ?? []).map((utilisateur) => utilisateur.id);
  const { data: permissions, error: erreurPermissions } = utilisateurIds.length
    ? await supabaseServer
      .from('permissions_modules')
      .select('utilisateur_id, module_key')
      .in('utilisateur_id', utilisateurIds)
    : { data: [], error: null };

  if (erreurPermissions) {
    console.error('Erreur permissions administrateur:', erreurPermissions);
    return NextResponse.json({ erreur: 'Impossible de charger les permissions' }, { status: 500 });
  }

  const permissionsParUtilisateur = new Map<number, string[]>();
  for (const permission of permissions ?? []) {
    const keys = permissionsParUtilisateur.get(permission.utilisateur_id) ?? [];
    keys.push(permission.module_key);
    permissionsParUtilisateur.set(permission.utilisateur_id, keys);
  }

  return NextResponse.json(
    {
      utilisateurs: (utilisateurs ?? []).map((utilisateur) => ({
        id: utilisateur.id,
        nom: utilisateur.nom,
        email: utilisateur.email,
        role: utilisateur.role,
        actif: utilisateur.actif,
        creeLe: utilisateur.cree_le,
        permissions: permissionsParUtilisateur.get(utilisateur.id) ?? [],
      })),
      modules: MODULE_PERMISSIONS,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contexte = await validerAuthentification(request);
  if (contexte instanceof NextResponse) {
    return contexte;
  }

  const erreurRole = validerRole(contexte, ['ADMIN']);
  if (erreurRole) {
    return erreurRole;
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

  const data = body as Record<string, unknown>;
  const allowedFields = new Set(['nom', 'email', 'role', 'motDePasse', 'permissions']);
  if (Object.keys(data).some((key) => !allowedFields.has(key))) {
    return NextResponse.json({ erreur: 'Données de création invalides' }, { status: 400 });
  }

  const nom = typeof data.nom === 'string' ? data.nom.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const role = data.role;
  const motDePasse = data.motDePasse;
  const permissions = data.permissions;

  if (nom.length < 2 || nom.length > 120) {
    return NextResponse.json({ erreur: 'Le nom doit contenir entre 2 et 120 caractères' }, { status: 400 });
  }
  if (email.length > 191 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ erreur: 'Adresse email invalide' }, { status: 400 });
  }
  if (!estRoleAutorise(role)) {
    return NextResponse.json({ erreur: 'Rôle invalide' }, { status: 400 });
  }
  if (
    typeof motDePasse !== 'string'
    || motDePasse.length < 8
    || Buffer.byteLength(motDePasse, 'utf8') > 72
  ) {
    return NextResponse.json(
      { erreur: 'Le mot de passe provisoire doit contenir au moins 8 caractères et au plus 72 octets' },
      { status: 400 }
    );
  }

  let moduleKeys: string[] | null = null;
  if (role !== 'ADMIN') {
    if (
      !Array.isArray(permissions)
      || permissions.length > MODULE_PERMISSIONS.length
      || permissions.some((key) => typeof key !== 'string')
    ) {
      return NextResponse.json({ erreur: 'La liste des permissions est invalide' }, { status: 400 });
    }

    moduleKeys = permissions as string[];
    const allowedKeys = new Set(MODULE_PERMISSIONS.map((module) => module.key));
    if (
      new Set(moduleKeys).size !== moduleKeys.length
      || moduleKeys.some((key) => !allowedKeys.has(key))
    ) {
      return NextResponse.json({ erreur: 'Une ou plusieurs permissions sont inconnues' }, { status: 400 });
    }
  } else if (permissions !== undefined && (!Array.isArray(permissions) || permissions.length !== 0)) {
    return NextResponse.json(
      { erreur: 'Un administrateur dispose automatiquement de tous les modules' },
      { status: 400 }
    );
  }

  const motDePasseHashe = await hasherMotDePasse(motDePasse);
  const { data: nouvelUtilisateurId, error } = await supabaseServer.rpc('rpc_admin_create_user', {
    p_actor_id: contexte.userId,
    p_nom: nom,
    p_email: email,
    p_password_hash: motDePasseHashe,
    p_role: role,
    p_module_keys: moduleKeys,
    p_allowed_module_keys: MODULE_PERMISSIONS.map((module) => module.key),
  });

  if (error) {
    if (error.message.includes('USER_EMAIL_EXISTS')) {
      return NextResponse.json({ erreur: 'Cette adresse email est déjà utilisée' }, { status: 409 });
    }
    if (error.message.includes('ADMIN_REQUIRED')) {
      return NextResponse.json({ erreur: 'Accès administrateur requis' }, { status: 403 });
    }
    if (
      error.code === 'PGRST202'
      || error.message.includes('rpc_admin_create_user')
    ) {
      console.error('RPC rpc_admin_create_user absent ou obsolète dans Supabase:', error);
      return NextResponse.json(
        { erreur: 'La base Supabase n’est pas à jour. Réexécutez le script supabase/admin_permissions.sql puis réessayez.' },
        { status: 503 }
      );
    }
    if (
      error.message.includes('INVALID_USER_DATA')
      || error.message.includes('INVALID_ROLE')
      || error.message.includes('INVALID_MODULE_PERMISSION')
      || error.message.includes('MODULE_PERMISSIONS_REQUIRED')
      || error.message.includes('ADMIN_PERMISSIONS_IMMUTABLE')
    ) {
      return NextResponse.json({ erreur: 'Les informations ou permissions du compte sont invalides' }, { status: 400 });
    }

    console.error('Erreur POST /api/admin/utilisateurs:', error);
    return NextResponse.json({ erreur: 'La création du compte a échoué' }, { status: 500 });
  }

  await logger.log(
    'USER_CREATED',
    `Compte créé: ${email} (rôle: ${role}, permissions: ${moduleKeys?.join(', ') || (role === 'ADMIN' ? 'tous les modules' : 'aucune')})`,
    contexte.userId,
    logger.extraireAdresseIP(request)
  );

  return NextResponse.json(
    { id: nouvelUtilisateurId, message: 'Compte créé. Communiquez le mot de passe provisoire à l’utilisateur de manière sécurisée.' },
    { status: 201 }
  );
}
