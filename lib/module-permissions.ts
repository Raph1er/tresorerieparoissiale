import SidebarContent, { type ChildItem, type MenuItem } from "@/components/layout/SidebarItems";

export interface ModulePermission {
  key: string;
  name: string;
  path: string;
}

export function obtenirClePermissionMenu(item: ChildItem): string | null {
  if (item.permissionKey) {
    return item.permissionKey;
  }
  if (item.id && item.url?.startsWith("/dashboard/") && item.id !== "profile" && item.id !== "administration") {
    return item.id;
  }
  return null;
}

function collectModules(items: MenuItem[]): ModulePermission[] {
  const modules: ModulePermission[] = [];

  function visit(item: ChildItem): void {
    const key = obtenirClePermissionMenu(item);
    if (key && item.name && item.url) {
      modules.push({
        key,
        name: item.name,
        path: item.url,
      });
    }

    item.children?.forEach(visit);
  }

  items.forEach((section) => section.children?.forEach(visit));
  return modules;
}

export const MODULE_PERMISSIONS = collectModules(SidebarContent);

export function obtenirModuleParCle(key: string): ModulePermission | undefined {
  return MODULE_PERMISSIONS.find((module) => module.key === key);
}

export function obtenirPermissionModulePourRoute(pathname: string): string | null {
  if (pathname.startsWith("/api/")) {
    const apiResource = pathname.split("/")[2];
    return MODULE_PERMISSIONS.find((module) => module.key === apiResource)?.key ?? null;
  }

  const matchedModule = MODULE_PERMISSIONS
    .filter((entry) => pathname === entry.path || (
      entry.key !== "dashboard" && pathname.startsWith(`${entry.path}/`)
    ))
    .sort((left, right) => right.path.length - left.path.length)[0];

  return matchedModule?.key ?? null;
}
