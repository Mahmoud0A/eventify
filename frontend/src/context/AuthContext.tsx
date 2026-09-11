"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Role, User } from "@/types";
import { authApi, getAccessToken, setAccessToken, SignupPayload, LoginPayload } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  role: Role | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function decodeJwtPayload(token: string): { sub: string; role: Role; exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const applyAuth = useCallback((accessToken: string, userInfo?: Partial<User>) => {
    const payload = decodeJwtPayload(accessToken);
    if (!payload) return;

    setAccessToken(accessToken);
    setTokenState(accessToken);

    const storedEmail = typeof window !== "undefined" ? localStorage.getItem("eventify_email") || "" : "";
    const storedName = typeof window !== "undefined" ? localStorage.getItem("eventify_name") || "" : "";

    const email = userInfo?.email || storedEmail;
    const name = userInfo?.name || storedName;

    const fullUser: User = {
      id: payload.sub,
      role: payload.role,
      email,
      name,
    };

    setUser(fullUser);
    if (typeof window !== "undefined") {
      if (email) localStorage.setItem("eventify_email", email);
      if (name) localStorage.setItem("eventify_name", name);
    }
  }, []);

  const clearAuth = useCallback(() => {
    setAccessToken(null);
    setTokenState(null);
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("eventify_token");
      localStorage.removeItem("eventify_email");
      localStorage.removeItem("eventify_name");
    }
  }, []);

  // Run only once on mount
  useEffect(() => {
    let active = true;

    async function initAuth() {
      try {
        const existingToken = getAccessToken();
        if (existingToken) {
          const payload = decodeJwtPayload(existingToken);
          if (payload && payload.exp && payload.exp * 1000 > Date.now() + 30000) {
            if (active) applyAuth(existingToken);
            return;
          }
        }

        // Try silent refresh if no active token
        const res = await authApi.refresh();
        if (active && res.accessToken) {
          applyAuth(res.accessToken);
        } else if (active) {
          clearAuth();
        }
      } catch {
        if (active) clearAuth();
      } finally {
        if (active) setIsLoading(false);
      }
    }

    initAuth();

    return () => {
      active = false;
    };
  }, [applyAuth, clearAuth]);

  const login = async (payload: LoginPayload) => {
    const res = await authApi.login(payload);
    applyAuth(res.accessToken, { email: payload.email });
  };

  const signup = async (payload: SignupPayload) => {
    const res = await authApi.signup(payload);
    applyAuth(res.accessToken, {
      email: payload.email,
      name: payload.name,
      role: payload.role || "ATTENDEE",
    });
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      clearAuth();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
