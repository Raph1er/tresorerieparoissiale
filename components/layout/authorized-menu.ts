import type { AuthUser } from "@/lib/client-auth";
import type { ChildItem, MenuItem } from "./SidebarItems";
import { obtenirClePermissionMenu } from "@/lib/module-permissions";

function filterItem(item: ChildItem, user: AuthUser): ChildItem | null {
  if (item.id === "administration" && user.role !== "ADMIN") {
    return null;
  }
  const permissionKey = obtenirClePermissionMenu(item);
  if (permissionKey && !user.modulePermissions?.includes(permissionKey)) {
    return null;
  }

  if (item.children) {
    const children = item.children
      .map((child) => filterItem(child, user))
      .filter((child): child is ChildItem => child !== null);
    return children.length > 0 ? { ...item, children } : null;
  }

  return item;
}

export function filtrerMenuParPermissions(
  menu: MenuItem[],
  user: AuthUser | null
): MenuItem[] {
  if (!user) {
    return [];
  }

  return menu
    .map((section) => ({
      ...section,
      children: section.children
        ?.map((item) => filterItem(item, user))
        .filter((item): item is ChildItem => item !== null),
    }))
    .filter((section) => Boolean(section.children?.length));
}
