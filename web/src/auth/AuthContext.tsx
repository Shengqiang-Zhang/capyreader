import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearCredentials,
  loadCredentials,
  saveCredentials,
  type MinifluxCredentials,
} from "@/auth/token-store";

interface AuthContextValue {
  credentials: MinifluxCredentials | null;
  signIn: (credentials: MinifluxCredentials) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<MinifluxCredentials | null>(
    () => loadCredentials(),
  );

  const signIn = useCallback((next: MinifluxCredentials) => {
    saveCredentials(next);
    setCredentials(next);
  }, []);

  const signOut = useCallback(() => {
    clearCredentials();
    setCredentials(null);
  }, []);

  const value = useMemo(
    () => ({ credentials, signIn, signOut }),
    [credentials, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
