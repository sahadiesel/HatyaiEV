"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isAppAdmin } from "@/lib/access-control";
import type { AppRoleDefinition } from "@/lib/menu-access";
import {
  canAccessMenu,
  canEditMenu,
  emptyMenuAccess,
  fullMenuAccessEdit,
  menuAccessForRole,
  type MenuAccessLevel,
  type MenuId,
} from "@/lib/menu-access";
import { getAppRole } from "@/lib/roles-firestore";
import { useAuth } from "./AuthProvider";

type MenuAccessContextValue = {
  loading: boolean;
  isAdmin: boolean;
  access: Record<MenuId, MenuAccessLevel>;
  roleName: string | null;
  canView: (menuId: MenuId) => boolean;
  canEdit: (menuId: MenuId) => boolean;
};

const defaultAccess = emptyMenuAccess();

const MenuAccessContext = createContext<MenuAccessContextValue>({
  loading: true,
  isAdmin: false,
  access: defaultAccess,
  roleName: null,
  canView: () => false,
  canEdit: () => false,
});

export function MenuAccessProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const admin = isAppAdmin(profile);
  const [role, setRole] = useState<AppRoleDefinition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (admin) {
      setRole(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      if (!profile?.approved) {
        if (!cancelled) {
          setRole(null);
          setLoading(false);
        }
        return;
      }
      if (!profile.appRoleId) {
        if (!cancelled) {
          setRole(null);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const loaded = await getAppRole(profile.appRoleId);
      if (!cancelled) {
        setRole(loaded);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [admin, profile?.approved, profile?.appRoleId]);

  const access = useMemo(() => {
    if (admin) return fullMenuAccessEdit();
    if (!profile?.approved) return defaultAccess;
    return menuAccessForRole(role);
  }, [admin, profile, role]);

  const canView = useCallback(
    (menuId: MenuId) => admin || canAccessMenu(access, menuId),
    [admin, access],
  );

  const canEdit = useCallback(
    (menuId: MenuId) => admin || canEditMenu(access, menuId),
    [admin, access],
  );

  const roleName = admin ? "ผู้ดูแลระบบ" : role?.name ?? (profile?.appRoleId ? "บทบาทไม่พบ" : null);

  const value = useMemo(
    () => ({ loading: admin ? false : loading, isAdmin: admin, access, roleName, canView, canEdit }),
    [admin, loading, access, roleName, canView, canEdit],
  );

  return <MenuAccessContext.Provider value={value}>{children}</MenuAccessContext.Provider>;
}

export function useMenuAccess() {
  return useContext(MenuAccessContext);
}
