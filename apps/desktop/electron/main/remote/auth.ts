/**
 * Token + pairing-code primitives for the remote-control bridge.
 *
 * - Bearer tokens are 32 random bytes (base64url). Only their SHA-256 hash is
 *   persisted (see persisted-store `PairedDevice.tokenHash`); the plaintext is
 *   returned to the phone exactly once at pairing time.
 * - Pairing codes are short, single-use, and expire after {@link PAIRING_TTL_MS}.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const PAIRING_TTL_MS = 5 * 60 * 1000

export function generateBearerToken(): string {
  return randomBytes(32).toString('base64url')
}

export function generateDeviceId(): string {
  return randomBytes(8).toString('hex')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Constant-time compare of two hex hashes of equal length. */
export function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  } catch {
    return false
  }
}

/** A pending, single-use pairing code with an expiry. */
type PendingCode = { code: string; expiresAt: number }

let pending: PendingCode | null = null

/** Human-friendly-ish code (8 hex chars) shown only inside the QR payload. */
export function issuePairingCode(nowMs: number): string {
  const code = randomBytes(4).toString('hex')
  pending = { code, expiresAt: nowMs + PAIRING_TTL_MS }
  return code
}

export function clearPairingCode(): void {
  pending = null
}

/** Validate + burn a pairing code. Returns true only for the live, unexpired code. */
export function consumePairingCode(code: string, nowMs: number): boolean {
  if (!pending) return false
  if (pending.expiresAt < nowMs) {
    pending = null
    return false
  }
  if (pending.code !== code) return false
  pending = null
  return true
}
