"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isAppAdmin } from "@/lib/access-control";
import type { UserProfile } from "@/lib/auth-utils";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { getUserProfile } from "@/lib/users-firestore";

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const PROFILE_TIMEOUT_MS = 8000;

async function fetchProfileSafe(uid: string): Promise<UserProfile | null> {
  try {
    return await Promise.race([
      getUserProfile(uid),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), PROFILE_TIMEOUT_MS);
      }),
    ]);
  } catch (e) {
    console.error("[AuthProvider] getUserProfile failed", e);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    const p = await fetchProfileSafe(user.uid);
    setProfile(p);
  }, [user]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    // กันค้างตลอดถ้า auth callback ไม่มา
    const safety = setTimeout(() => {
      setLoading((prev) => {
        if (prev) console.warn("[AuthProvider] auth loading timed out");
        return false;
      });
    }, 12000);

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setUser(firebaseUser);
        if (firebaseUser) {
          const p = await fetchProfileSafe(firebaseUser.uid);
          setProfile(p);
        } else {
          setProfile(null);
        }
      } catch (e) {
        console.error("[AuthProvider] onAuthStateChanged error", e);
        setProfile(null);
      } finally {
        clearTimeout(safety);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safety);
      unsub();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      isAdmin: isAppAdmin(profile),
      loading,
      refreshProfile,
    }),
    [user, profile, loading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
