/**
 * Per-room player identity kept in localStorage so a refresh or reconnect
 * (room code + same browser) resumes the same seat. Reconnect by name is the
 * documented fallback: the token is matched first, then the display name.
 */

export interface StoredIdentity {
  playerId: string;
  token: string;
  name: string;
}

const key = (roomCode: string) => `lov:identity:${roomCode.toUpperCase()}`;

export function saveIdentity(roomCode: string, identity: StoredIdentity): void {
  try {
    localStorage.setItem(key(roomCode), JSON.stringify(identity));
  } catch {
    // Private browsing without storage: reconnect-by-name still works.
  }
}

export function loadIdentity(roomCode: string): StoredIdentity | null {
  try {
    const raw = localStorage.getItem(key(roomCode));
    return raw ? (JSON.parse(raw) as StoredIdentity) : null;
  } catch {
    return null;
  }
}

export function clearIdentity(roomCode: string): void {
  try {
    localStorage.removeItem(key(roomCode));
  } catch {
    // ignore
  }
}
