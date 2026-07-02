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

/**
 * Decode the payload of a JWT without verification.
 * Cloudflare Access already verified it — we just need the email claim.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/** Read the CF_Authorization cookie value. */
function getCfEmail(): string | null {
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith('CF_Authorization='));
  if (!match) return null;
  const token = match.split('=')[1];
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.email !== 'string') return null;
  return payload.email;
}

interface RuntimeConfig {
  adminEmails: string[];
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('reader');
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function resolve() {
      try {
        // In development (no CF cookie), default to admin for convenience
        const cfEmail = getCfEmail();

        if (!cfEmail) {
          // No Cloudflare Access cookie — local dev or direct access
          setRole('admin');
          setEmail(null);
          return;
        }

        setEmail(cfEmail);

        // Fetch runtime config to get the admin email list
        const res = await fetch('/runtime-config.json');
        if (!res.ok) {
          // Config not found — default to reader for safety
          setRole('reader');
          return;
        }

        const config: RuntimeConfig = await res.json();
        const normalised = cfEmail.toLowerCase();
        const isAdmin = config.adminEmails.some(
          (e) => e.toLowerCase() === normalised,
        );
        setRole(isAdmin ? 'admin' : 'reader');
      } catch {
        // On any error, default to reader (safe default)
        setRole('reader');
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
