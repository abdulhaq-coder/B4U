import { createHash } from 'crypto';

/** Token ka nonce claim raw nonce ya uske sha256(hex) me se ek hona chahiye. */
export function assertNonce(claim: unknown, expected?: string): void {
  if (!expected) return;
  const hashed = createHash('sha256').update(expected).digest('hex');
  if (typeof claim !== 'string' || (claim !== expected && claim !== hashed)) {
    throw new Error('nonce mismatch');
  }
}
