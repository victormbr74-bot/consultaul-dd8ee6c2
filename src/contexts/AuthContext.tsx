import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  profile: { name: string; user_code: string | null } | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_LOADING_TIMEOUT_MS = 8000;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<{ name: string; user_code: string | null } | null>(null);

  const fetchUserData = async (userId: string) => {
    const [rolesResult, profileResult] = await Promise.allSettled([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("name, user_code").eq("id", userId).maybeSingle(),
    ]);

    let isAdmin = false;
    let profile: { name: string; user_code: string | null } | null = null;

    if (rolesResult.status === "fulfilled") {
      if (rolesResult.value.error) {
        console.error("Failed to fetch user roles", rolesResult.value.error);
      } else {
        isAdmin = rolesResult.value.data?.some((r) => r.role === "admin") ?? false;
      }
    } else {
      console.error("Failed to fetch user roles", rolesResult.reason);
    }

    if (profileResult.status === "fulfilled") {
      if (profileResult.value.error) {
        console.error("Failed to fetch user profile", profileResult.value.error);
      } else {
        profile = profileResult.value.data ?? null;
      }
    } else {
      console.error("Failed to fetch user profile", profileResult.reason);
    }


    return { isAdmin, profile };
  };

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (active) {
        setLoading(false);
      }
    }, AUTH_LOADING_TIMEOUT_MS);

    const applySession = async (nextSession: Session | null) => {
      if (!active) return;

      try {
        setSession(nextSession);
        const nextUser = nextSession?.user ?? null;
        setUser(nextUser);
        // Never block the UI waiting for profile/roles network round trips.
        setLoading(false);

        if (nextUser) {
          const userData = await fetchUserData(nextUser.id);
          if (!active) return;
          setIsAdmin(userData.isAdmin);
          setProfile(userData.profile);
        } else {
          setIsAdmin(false);
          setProfile(null);
        }
      } catch (error) {
        console.error("Failed to apply auth session", error);
        if (!active) return;
        setIsAdmin(false);
        setProfile(null);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        void applySession(currentSession);
      })
      .catch((error) => {
        console.error("Failed to get auth session", error);
        if (active) {
          setUser(null);
          setSession(null);
          setIsAdmin(false);
          setProfile(null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name }, emailRedirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, profile, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
