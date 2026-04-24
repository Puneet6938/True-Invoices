import { createContext, useContext, useEffect, useState } from "react";
import { apiRequest } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    token: localStorage.getItem("true_invoices_token"),
    user: null,
    firm: null,
    loading: true,
  });

  useEffect(() => {
    async function loadMe() {
      if (!localStorage.getItem("true_invoices_token")) {
        setAuth((current) => ({ ...current, loading: false }));
        return;
      }

      try {
        const data = await apiRequest("/auth/me");
        setAuth({
          token: localStorage.getItem("true_invoices_token"),
          user: data.user,
          firm: data.firm,
          loading: false,
        });
      } catch (error) {
        localStorage.removeItem("true_invoices_token");
        setAuth({
          token: null,
          user: null,
          firm: null,
          loading: false,
        });
      }
    }

    loadMe();
  }, []);

  function saveSession(data) {
    localStorage.setItem("true_invoices_token", data.token);
    setAuth({
      token: data.token,
      user: data.user,
      firm: data.firm,
      loading: false,
    });
  }

  function logout() {
    localStorage.removeItem("true_invoices_token");
    setAuth({
      token: null,
      user: null,
      firm: null,
      loading: false,
    });
  }

  return <AuthContext.Provider value={{ auth, saveSession, logout, setAuth }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
