import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Role = 'admin' | 'reader';

interface RoleContextValue {
  role: Role;
  email: string | null;
  loading: boolean;
}

const RoleContext = createContext<RoleContextValue>({
  role: 'reader',
  email: null,
  loading: true,
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('reader');
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function resolve() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setEmail(data.email);
          setRole(data.can_control ? 'admin' : 'reader');
        } else {
          // Fallback if backend is missing or unauthenticated
          if (import.meta.env.DEV) {
            setRole('admin');
            setEmail(null);
          } else {
            setRole('reader');
            setEmail(null);
          }
        }
      } catch {
        // On network error (e.g. backend down)
        if (import.meta.env.DEV) {
          setRole('admin');
          setEmail(null);
        } else {
          setRole('reader');
          setEmail(null);
        }
      } finally {
        setLoading(false);
      }
    }

    resolve();
  }, []);

  return (
    <RoleContext.Provider value={{ role, email, loading }}>
      {children}
    </RoleContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRole(): RoleContextValue {
  return useContext(RoleContext);
}
