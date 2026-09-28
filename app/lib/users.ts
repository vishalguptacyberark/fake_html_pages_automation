/**
 * Static QA test-user directory shared by /login, /mfa, and /users.
 *
 * Three groups of 5 static users each (15 total):
 *
 *   1. @autofill      — plain username/password, NO TOTP step.
 *                       testuser1@autofill … testuser5@autofill
 *   2. @landandcatch  — identical shape to @autofill (username/password,
 *                       NO TOTP), just a different domain suffix so
 *                       autofill / password-manager "landing & catching"
 *                       behavior can be tested against a second origin
 *                       pattern without colliding with the @autofill set.
 *                       testuser1@landandcatch … testuser5@landandcatch
 *   3. @totp          — username/password PLUS a TOTP step. Each of the
 *                       5 users has its own unique base32 secret so
 *                       multiple MFA sessions can be exercised in parallel.
 *                       testuser1@totp … testuser5@totp
 *
 * All users share the same static password. This file has NO connection to
 * any backend or authentication system — it is a fixture for QA automation
 * (browser + Appium/mobile) only.
 */

export type UserGroup = 'autofill' | 'landandcatch' | 'totp'

export interface UserRecord {
  username: string
  password: string
  group: UserGroup
  /** Base32 TOTP secret. Only present for the `totp` group. */
  totpSecret?: string
}

export const PASSWORD = 'QaAuto#2024!'

const USER_COUNT = 5

// One unique base32 secret per @totp user (RFC 6238 / Google Authenticator
// compatible — algorithm SHA1, 6 digits, 30s period).
export const TOTP_SECRETS: string[] = [
  'CC7FJ2Q57MKWRLS6', // testuser1@totp
  'OJR4KQOGHRQV6IEI', // testuser2@totp
  'WJBZLI6WHNNIFR3K', // testuser3@totp
  'A3QR7S7MF2OV66NV', // testuser4@totp
  'D4C7TMROBUAR5DY3', // testuser5@totp
]

export const AUTOFILL_USERS: UserRecord[] = Array.from(
  { length: USER_COUNT },
  (_, i) => ({
    username: `testuser${i + 1}@autofill`,
    password: PASSWORD,
    group: 'autofill' as const,
  })
)

export const LANDANDCATCH_USERS: UserRecord[] = Array.from(
  { length: USER_COUNT },
  (_, i) => ({
    username: `testuser${i + 1}@landandcatch`,
    password: PASSWORD,
    group: 'landandcatch' as const,
  })
)

export const TOTP_USERS: UserRecord[] = Array.from(
  { length: USER_COUNT },
  (_, i) => ({
    username: `testuser${i + 1}@totp`,
    password: PASSWORD,
    group: 'totp' as const,
    totpSecret: TOTP_SECRETS[i],
  })
)

export const ALL_USERS: UserRecord[] = [
  ...AUTOFILL_USERS,
  ...LANDANDCATCH_USERS,
  ...TOTP_USERS,
]

export function findUser(username: string): UserRecord | undefined {
  const needle = username.trim().toLowerCase()
  return ALL_USERS.find(u => u.username.toLowerCase() === needle)
}

export function requiresTotp(username: string): boolean {
  return findUser(username)?.group === 'totp'
}
