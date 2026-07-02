import React, { createContext, useContext, useEffect, useState } from "react";
import { api, formatApiErrorDetail, TOKEN_KEY } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = anon, object = user
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setUser(false);
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => { localStorage.removeItem(TOKEN_KEY); setUser(false); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data);
    return data;
  };

  const register = async (name, email, password) => {
    const { data } = await api.post("/auth/register", { name, email, password });
    if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {}
    localStorage.removeItem(TOKEN_KEY);
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, formatApiErrorDetail }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
