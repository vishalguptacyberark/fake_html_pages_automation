/**
 * Pure-JS TOTP (RFC 6238) implementation.
 *
 * No external library, no crypto.subtle, no browser API — works on HTTP
 * and HTTPS, GitHub Pages, plain S3, and localhost.
 *
 * Used by /mfa (verification) and /users (secret + live-code display).
 */

// ─── Pure-JS base32 decode ────────────────────────────────────────────────────
export function base32Decode(input: string): number[] {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const str = input.toUpperCase().replace(/=+$/, '')
  const bytes: number[] = []
  let buffer = 0
  let bitsLeft = 0

  for (const char of str) {
    const val = alphabet.indexOf(char)
    if (val === -1) continue
    buffer = (buffer << 5) | val
    bitsLeft += 5
    if (bitsLeft >= 8) {
      bitsLeft -= 8
      bytes.push((buffer >> bitsLeft) & 0xff)
    }
  }
  return bytes
}

// ─── Pure-JS SHA1 ─────────────────────────────────────────────────────────────
function sha1(msgBytes: number[]): number[] {
  // Pre-processing: add padding
  const msgLen = msgBytes.length
  const bitLen = msgLen * 8

  msgBytes = [...msgBytes, 0x80]
  while (msgBytes.length % 64 !== 56) msgBytes.push(0x00)

  // Append original length as 64-bit big-endian
  for (let i = 7; i >= 0; i--) {
    msgBytes.push((bitLen / Math.pow(2, i * 8)) & 0xff)
  }

  // Initial hash values
  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0

  // Helper: 32-bit left rotate
  const rotl = (n: number, s: number) => ((n << s) | (n >>> (32 - s))) >>> 0

  // Process each 512-bit (64-byte) chunk
  for (let i = 0; i < msgBytes.length; i += 64) {
    const w: number[] = []

    for (let j = 0; j < 16; j++) {
      w[j] =
        ((msgBytes[i + j * 4] & 0xff) << 24) |
        ((msgBytes[i + j * 4 + 1] & 0xff) << 16) |
        ((msgBytes[i + j * 4 + 2] & 0xff) << 8) |
        (msgBytes[i + j * 4 + 3] & 0xff)
    }
    for (let j = 16; j < 80; j++) {
      w[j] = rotl(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1)
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4

    for (let j = 0; j < 80; j++) {
      let f = 0, k = 0
      if (j < 20)       { f = (b & c) | (~b & d);          k = 0x5a827999 }
      else if (j < 40)  { f = b ^ c ^ d;                   k = 0x6ed9eba1 }
      else if (j < 60)  { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc }
      else              { f = b ^ c ^ d;                   k = 0xca62c1d6 }

      const temp = (rotl(a, 5) + f + e + k + w[j]) >>> 0
      e = d; d = c; c = rotl(b, 30); b = a; a = temp
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
  }

  // Produce the 20-byte digest
  const result: number[] = []
  for (const h of [h0, h1, h2, h3, h4]) {
    result.push((h >>> 24) & 0xff, (h >>> 16) & 0xff, (h >>> 8) & 0xff, h & 0xff)
  }
  return result
}

// ─── Pure-JS HMAC-SHA1 ────────────────────────────────────────────────────────
function hmacSha1(keyBytes: number[], msgBytes: number[]): number[] {
  const BLOCK = 64
  let key = keyBytes.length > BLOCK ? sha1(keyBytes) : [...keyBytes]
  while (key.length < BLOCK) key.push(0x00)

  const ipad = key.map(b => b ^ 0x36)
  const opad = key.map(b => b ^ 0x5c)

  return sha1([...opad, ...sha1([...ipad, ...msgBytes])])
}

// ─── TOTP counter → 6-digit code ─────────────────────────────────────────────
function computeTotpForCounter(secretBytes: number[], counter: number): string {
  // Encode counter as 8-byte big-endian
  const counterBytes: number[] = new Array(8).fill(0)
  let c = counter
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = c & 0xff
    c = Math.floor(c / 256)
  }

  const hmac = hmacSha1(secretBytes, counterBytes)

  // Dynamic truncation
  const offset = hmac[19] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  return (code % 1_000_000).toString().padStart(6, '0')
}

/** Returns the currently-valid 6-digit TOTP code for a base32 secret. */
export function getCurrentTotp(secret: string, atMs: number = Date.now()): string {
  const secretBytes = base32Decode(secret)
  const counter = Math.floor(atMs / 1000 / 30)
  return computeTotpForCounter(secretBytes, counter)
}

/** Seconds remaining until the current TOTP window rolls over. */
export function getTotpSecondsRemaining(atMs: number = Date.now()): number {
  return 30 - (Math.floor(atMs / 1000) % 30)
}

/** Verifies an entered code against the current ±1 window (90s tolerance). */
export function verifyTotp(secret: string, entered: string): boolean {
  const secretBytes = base32Decode(secret)
  const counter = Math.floor(Date.now() / 1000 / 30)
  for (const drift of [-1, 0, 1]) {
    if (computeTotpForCounter(secretBytes, counter + drift) === entered) return true
  }
  return false
}
