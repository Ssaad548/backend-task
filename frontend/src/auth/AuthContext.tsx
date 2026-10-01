import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, apiErrorMessage, TOKEN_KEY, USER_KEY } from "../api";
import type { AuthUser } from "../types";
import { AuthContext } from "./auth-context";

function readUser() {
  const saved = sessionStorage.getItem(USER_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as AuthUser;
  } catch {
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readUser);
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener("leadflow:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("leadflow:unauthorized", handleUnauthorized);
  }, []);

  const login = async (
    email: string,
    password: string,
    expectedRole?: AuthUser["role"],
  ) => {
    try {
      const response = await api.post<{ access_token: string; user: AuthUser }>(
        "/auth/login",
        { email, password },
      );
      if (expectedRole && response.data.user.role !== expectedRole) {
        throw new Error(
          `This account is an ${response.data.user.role.toLowerCase()} account. Select ${response.data.user.role.toLowerCase()} to continue.`,
        );
      }
      sessionStorage.setItem(TOKEN_KEY, response.data.access_token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
      setToken(response.data.access_token);
      setUser(response.data.user);
    } catch (error) {
      throw new Error(apiErrorMessage(error, "Unable to sign in."), {
        cause: error,
      });
    }
  };

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading: false, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
