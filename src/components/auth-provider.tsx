"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { api } from "@/lib/api";

export interface InvestorProfile {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string;
  role: "admin" | "partner" | "principal" | "associate" | "analyst" | "ops" | "viewer";
  firm_name?: string;
  title?: string;
  avatar_url?: string;
  bio?: string;
  is_active: boolean;
}

interface MockUser {
  id: string;
  email: string;
  user_metadata: {
    full_name: string;
    role: string;
  };
}

interface MockSession {
  access_token: string;
  user: MockUser;
}

interface AuthContextType {
  user: User | MockUser | null;
  session: Session | MockSession | null;
  profile: InvestorProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<InvestorProfile>) => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = getSupabase();

  const [session, setSession] = React.useState<Session | MockSession | null>(null);
  const [user, setUser] = React.useState<User | MockUser | null>(null);
  const [profile, setProfile] = React.useState<InvestorProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const isMockMode = !supabase;

  // Fetch public investor profile once authenticated
  const fetchProfile = React.useCallback(async () => {
    try {
      const data = await api.get<InvestorProfile>("/api/v1/investors/me");
      setProfile(data);
    } catch (err) {
      console.error("Failed to load investor profile:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to load investor profile: " + message);
    }
  }, []);

  // Sync token to api helper utility and localStorage
  const syncSession = React.useCallback((sess: Session | MockSession | null) => {
    if (sess) {
      localStorage.setItem("vc_brain_token", sess.access_token);
      setSession(sess);
      setUser(sess.user);
    } else {
      localStorage.removeItem("vc_brain_token");
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  }, []);

  // Initialize Auth
  React.useEffect(() => {
    async function initialize() {
      setIsLoading(true);
      if (isMockMode) {
        // Load mock session from localStorage if exists
        const savedMock = localStorage.getItem("vc_brain_mock_session");
        if (savedMock) {
          try {
            const parsed = JSON.parse(savedMock);
            syncSession(parsed);
            // Fetch profile from backend
            await fetchProfile();
          } catch (e) {
            console.error("Failed to parse mock session:", e);
            localStorage.removeItem("vc_brain_mock_session");
          }
        }
      } else {
        // Real Supabase Auth initialization
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          syncSession(currentSession);
          await fetchProfile();
        }

        // Subscribe to auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, newSession) => {
            if (newSession) {
              syncSession(newSession);
              await fetchProfile();
            } else {
              syncSession(null);
            }
          }
        );

        return () => {
          subscription.unsubscribe();
        };
      }
      setIsLoading(false);
    }

    initialize();
  }, [isMockMode, supabase, fetchProfile, syncSession]);

  // Route Protection & Redirect logic
  React.useEffect(() => {
    if (isLoading) return;

    const isAuthRoute = pathname === "/login" || pathname === "/signup";
    const hasSession = !!session;

    if (!hasSession && !isAuthRoute) {
      router.push("/login");
    } else if (hasSession && isAuthRoute) {
      router.push("/");
    }
  }, [session, isLoading, pathname, router]);

  // SignIn Action
  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      if (isMockMode) {
        // Mock Login
        const role = email.toLowerCase().includes("admin") ? "admin" : "analyst";
        const fullName = email.toLowerCase().includes("admin") ? "Admin User" : "Investor User";
        const token = role === "admin" ? "mock-admin-token" : `mock-investor-token-${email.split("@")[0]}`;
        
        const mockSess: MockSession = {
          access_token: token,
          user: {
            id: role === "admin" ? "mock-admin-id" : `mock-investor-id-${email.split("@")[0]}`,
            email: email,
            user_metadata: { full_name: fullName, role: role }
          }
        };
        
        localStorage.setItem("vc_brain_mock_session", JSON.stringify(mockSess));
        syncSession(mockSess);
        await fetchProfile();
        toast.success("Successfully logged in (Offline Mock Mode)");
      } else {
        // Real Supabase Sign In
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        toast.success("Successfully signed in");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid credentials";
      toast.error(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // SignUp Action
  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    setIsLoading(true);
    try {
      if (isMockMode) {
        // Mock SignUp
        const token = role === "admin" ? "mock-admin-token" : `mock-investor-token-${email.split("@")[0]}`;
        const mockSess: MockSession = {
          access_token: token,
          user: {
            id: role === "admin" ? "mock-admin-id" : `mock-investor-id-${email.split("@")[0]}`,
            email: email,
            user_metadata: { full_name: fullName, role: role }
          }
        };
        
        localStorage.setItem("vc_brain_mock_session", JSON.stringify(mockSess));
        syncSession(mockSess);
        await fetchProfile();
        toast.success("Successfully signed up (Offline Mock Mode)");
      } else {
        // Real Supabase SignUp
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: role
            }
          }
        });
        if (error) throw error;
        toast.success("Account created successfully! Please log in.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      toast.error(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // SignOut Action
  const signOut = async () => {
    setIsLoading(true);
    try {
      if (isMockMode) {
        localStorage.removeItem("vc_brain_mock_session");
      } else {
        await supabase.auth.signOut();
      }
      syncSession(null);
      toast.success("Logged out successfully");
      router.push("/login");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Logout failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Update profile
  const updateProfile = async (data: Partial<InvestorProfile>) => {
    try {
      const updated = await api.put<InvestorProfile>("/api/v1/investors/me", data);
      setProfile(updated);
      toast.success("Profile updated successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Profile update failed";
      toast.error(message);
      throw err;
    }
  };

  const isAdmin = profile?.role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isAdmin,
        signIn,
        signUp,
        signOut,
        updateProfile
      }}
    >
      {isLoading ? (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-muted-foreground">VC Brain: Securing session...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
