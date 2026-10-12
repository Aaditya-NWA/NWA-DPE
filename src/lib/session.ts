import { AUTH, STORAGE_KEYS } from '../constants/system';

// Mock session: a seam for real authentication, not a security control.
export interface MockSession {
  email: string;
  signedInAt: number;
}

export type SignInField = 'email' | 'password';

export class SignInError extends Error {
  readonly field: SignInField;

  constructor(message: string, field: SignInField) {
    super(message);
    this.name = 'SignInError';
    this.field = field;
  }
}

export function readSession(): MockSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.session);
    return raw ? (JSON.parse(raw) as MockSession) : null;
  } catch {
    return null;
  }
}

export function signOut(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.session);
  } catch { /* nothing stored, nothing stale */ }
}

export function signIn(email: string, password: string): Promise<MockSession> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const trimmed = email.trim();
      if (!AUTH.emailPattern.test(trimmed)) {
        reject(new SignInError('Enter a valid email address.', 'email'));
        return;
      }
      if (password.length < AUTH.minPasswordLength) {
        reject(new SignInError(`Password must be at least ${AUTH.minPasswordLength} characters.`, 'password'));
        return;
      }
      const session: MockSession = { email: trimmed, signedInAt: Date.now() };
      try {
        sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
      } catch {
        console.warn('[session] sessionStorage unavailable — sign-in will not survive a reload.');
      }
      resolve(session);
    }, AUTH.fakeLatencyMs);
  });
}

export function sessionInitials(email: string): string {
  const name = email.split('@')[0] ?? '';
  const parts = name.split(/[._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase() || 'NW';
}
