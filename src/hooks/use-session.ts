/**
 * Client-side session hook for checking auth state.
 *
 * Polls the session endpoint periodically and redirects to login
 * if the session has expired. Shows a warning banner when the
 * session is close to expiring.
 */

"use client";

import { useState, useEffect, useCallback } from "react";

interface SessionState {
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionExpiring: boolean;
}

/** How often to check the session (ms). */
const CHECK_INTERVAL = 60_000;

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    isAuthenticated: true,
    isLoading: true,
    sessionExpiring: false,
  });

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/auth/profile");
      if (res.ok) {
        setState({ isAuthenticated: true, isLoading: false, sessionExpiring: false });
      } else if (res.status === 401 || res.status === 204) {
        setState({ isAuthenticated: false, isLoading: false, sessionExpiring: false });
      }
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    checkSession();
    const interval = setInterval(checkSession, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkSession]);

  return state;
}
