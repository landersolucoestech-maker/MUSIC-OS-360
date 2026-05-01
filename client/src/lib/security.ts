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

  check(identifier: string): boolean {
    const now = Date.now();
    const entry = this.attempts.get(identifier);

    if (!entry) {
      this.attempts.set(identifier, {
        attempts: 1,
        lastAttempt: now,
        blockedUntil: null,
      });
      return true;
    }

    // Check if blocked
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return false;
    }

    // Reset if window expired
    if (now - entry.lastAttempt > this.windowMs) {
      this.attempts.set(identifier, {
        attempts: 1,
        lastAttempt: now,
        blockedUntil: null,
      });
      return true;
    }

    // Increment attempts
    entry.attempts += 1;
    entry.lastAttempt = now;

    // Block if exceeded
    if (entry.attempts > this.maxAttempts) {
      entry.blockedUntil = now + this.blockDurationMs;
      return false;
    }

    return true;
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
