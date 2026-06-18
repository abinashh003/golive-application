import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";
import socket from "../services/socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const cachedUser = localStorage.getItem("user");

    if (token && cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
      } catch {
        // ignore bad cache
      }
    }
    setLoading(false);
  }, []);

  function login(token, userData) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    if (socket.connected) {
      socket.emit("authenticate", token);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
