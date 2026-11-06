import { MODULE_PERMISSIONS } from '@/lib/module-permissions';
import type { ContexteAuth } from './auth.middleware';

function extraireCleModule(permission: string): string {
  return permission.split(':', 1)[0];
}

export function verifierPermission(
  contexte: ContexteAuth,
  permission: string
): boolean {
  return contexte.role === 'ADMIN'
    || contexte.modulePermissions.includes(extraireCleModule(permission));
}

export function verifierUneParmesPermissions(
  contexte: ContexteAuth,
  permissions: string[]
): boolean {
  return permissions.some((permission) => verifierPermission(contexte, permission));
}

export function obtenirPermissionsUtilisateur(
  contexte: ContexteAuth
): string[] {
  return contexte.role === 'ADMIN'
    ? MODULE_PERMISSIONS.map((module) => module.key)
    : contexte.modulePermissions;
}
