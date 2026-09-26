// Common leaked passwords list (subset for client-side check)
const LEAKED_PASSWORDS = [
  "123456",
  "password",
  "12345678",
  "qwerty",
  "123456789",
  "12345",
  "1234",
  "111111",
  "1234567",
  "dragon",
  "123123",
  "baseball",
  "abc123",
  "football",
  "monkey",
  "letmein",
  "shadow",
  "master",
  "666666",
  "qwertyuiop",
  "123321",
  "mustang",
  "1234567890",
  "michael",
  "654321",
  "superman",
  "1qaz2wsx",
  "7777777",
  "121212",
  "000000",
  "qazwsx",
  "123qwe",
  "killer",
  "trustno1",
  "jordan",
  "jennifer",
  "zxcvbnm",
  "asdfgh",
  "hunter",
  "buster",
  "soccer",
  "harley",
  "batman",
  "andrew",
  "tigger",
  "sunshine",
  "iloveyou",
  "2000",
  "charlie",
  "robert",
  "thomas",
  "hockey",
  "ranger",
  "daniel",
  "starwars",
  "klaster",
  "112233",
  "george",
  "computer",
  "michelle",
  "jessica",
  "pepper",
  "1111",
  "zxcvbn",
  "555555",
  "11111111",
  "131313",
  "freedom",
  "777777",
  "pass",
  "maggie",
  "159753",
  "aaaaaa",
  "ginger",
  "princess",
  "joshua",
  "cheese",
  "amanda",
  "summer",
  "love",
  "ashley",
  "nicole",
  "chelsea",
  "biteme",
  "matthew",
  "access",
  "yankees",
  "987654321",
  "dallas",
  "austin",
  "thunder",
  "taylor",
  "matrix",
  "senha",
  "senha123",
  "admin",
  "admin123",
  "password123",
];

export function isLeakedPassword(password: string): boolean {
  return LEAKED_PASSWORDS.includes(password.toLowerCase());
}

// Rate limiter for authentication attempts
interface RateLimitEntry {
  attempts: number;
  lastAttempt: number;
  blockedUntil: number | null;
}

class AuthRateLimiter {
  private attempts: Map<string, RateLimitEntry> = new Map();
  private maxAttempts = 5;
  private windowMs = 15 * 60 * 1000; // 15 minutes
  private blockDurationMs = 30 * 60 * 1000; // 30 minutes

  /**
   * Part 77 — READ-ONLY: tells whether `identifier` is blocked right now,
   * without ever incrementing anything. `check()` (below) remains for
   * compatibility but incremented on every call even when no real
   * login attempt had happened — using `isBlocked` + `recordFailure`
   * separately avoids counting a network/server error as an attempt.
   */
  isBlocked(identifier: string): boolean {
    const entry = this.attempts.get(identifier);
    if (!entry?.blockedUntil) return false;
    return Date.now() < entry.blockedUntil;
  }

  /**
   * Records a GENUINELY failed attempt (wrong credentials
   * confirmed by Supabase) — never call it for a network error, 5xx, or a
   * frontend crash, otherwise an infrastructure problem could block
   * a legitimate user for 30 minutes without any wrong-password attempt.
   */
  recordFailure(identifier: string): void {
    const now = Date.now();
    const entry = this.attempts.get(identifier);

    if (!entry || now - entry.lastAttempt > this.windowMs) {
      this.attempts.set(identifier, { attempts: 1, lastAttempt: now, blockedUntil: null });
      return;
    }

    entry.attempts += 1;
    entry.lastAttempt = now;
    if (entry.attempts > this.maxAttempts) {
      entry.blockedUntil = now + this.blockDurationMs;
    }
  }

  /** @deprecated use isBlocked() before the attempt and recordFailure() only after a confirmed credential failure. */
  check(identifier: string): boolean {
    if (this.isBlocked(identifier)) return false;
    this.recordFailure.call(this, identifier);
    return !this.isBlocked(identifier);
  }

  getRemainingAttempts(identifier: string): number {
    const entry = this.attempts.get(identifier);
    if (!entry) return this.maxAttempts;
    return Math.max(0, this.maxAttempts - entry.attempts);
  }

  getTimeUntilReset(identifier: string): number {
    const entry = this.attempts.get(identifier);
    if (!entry || !entry.blockedUntil) return 0;
    return Math.max(0, entry.blockedUntil - Date.now());
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
}

export const authRateLimiter = new AuthRateLimiter();
