/**
 * Pure-browser WebAuthn ("passkey") registration + sign-in.
 *
 * No backend, no external service, no persistence of any kind —
 * every ceremony below is a *real* call into the browser's WebAuthn
 * implementation (Touch ID / Face ID / Windows Hello / a security key / a
 * password-manager extension), the browser/OS just handles it natively.
 *
 * Design (see /login and /home for usage):
 *   - Setup ("registration") calls navigator.credentials.create(). The
 *     resulting public key is read (to confirm a real key pair came back)
 *     but is deliberately NOT persisted anywhere — this app never verifies
 *     a signature against it, and no bookkeeping record is stored either.
 *     The returned summary (credential id, algorithm, timestamp) is simply
 *     handed back to the caller, which displays it directly in the UI for
 *     the current page view only.
 *   - Sign-in is usernameless: navigator.credentials.get() is called with
 *     no `allowCredentials` restriction, so the browser/OS shows its own
 *     discoverable-credential picker across whatever passkeys exist for
 *     this origin. The signed-in username is recovered from the
 *     assertion's `userHandle` (the same bytes set as `user.id` at
 *     registration time) — no typed username is needed for this path.
 *   - Because nothing is persisted locally or server-side, this page never
 *     "remembers" a previously set-up passkey across reloads — only the
 *     details received directly from the current device/browser callback
 *     are ever shown, and only for the lifetime of that page view.
 *
 * Requires a secure context (HTTPS or localhost). Works on GitHub Pages
 * (always HTTPS). On S3, only works if the bucket is served over HTTPS
 * (e.g. via CloudFront) — plain S3 static-website-hosting endpoints are
 * HTTP-only and WebAuthn will be unavailable there.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PasskeyRecord {
  /** base64url-encoded credential.rawId */
  credentialId: string
  /** COSE algorithm identifier (-7 = ES256, -257 = RS256), or null if the
   *  browser didn't expose getPublicKeyAlgorithm(). */
  alg: number | null
  createdAt: number
}

export interface PasskeySetupSummary extends PasskeyRecord {
  username: string
}

export interface PasskeySignInSummary {
  username: string
  credentialId: string
  verifiedAt: number
  /** Whether the authenticator asserted the user-verification (biometric /
   *  PIN) flag, decoded from authenticatorData byte 32, bit 0x04. */
  userVerified: boolean
}

// ─── Feature detection ────────────────────────────────────────────────────────

/** True only in a secure context with the WebAuthn API present. */
export function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext === true &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.credentials?.create === 'function' &&
    typeof navigator.credentials?.get === 'function'
  )
}

// ─── base64url helpers ────────────────────────────────────────────────────────

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Short, display-friendly fragment of a base64url credential id. */
export function shortCredentialId(id: string): string {
  if (id.length <= 12) return id
  return `${id.slice(0, 8)}…${id.slice(-4)}`
}

/** Human-readable label for a COSE algorithm identifier. */
export function algLabel(alg: number | null): string {
  switch (alg) {
    case -7:
      return 'ES256'
    case -257:
      return 'RS256'
    default:
      return alg === null ? 'unknown' : `alg ${alg}`
  }
}

// ─── Error mapping ────────────────────────────────────────────────────────────

/**
 * Maps a thrown WebAuthn error to a friendly message using the
 * standardized DOMException `.name` (not `.message`, which varies by
 * browser) so behavior is consistent across Safari/Chrome/Firefox/mobile.
 */
export function mapWebAuthnError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
        return 'Passkey step was cancelled or timed out.'
      case 'InvalidStateError':
        return 'A passkey for this account may already exist on this authenticator.'
      case 'NotSupportedError':
        return 'This device or browser does not support the requested passkey options.'
      case 'SecurityError':
        return 'Passkeys require a secure (HTTPS) context and a valid domain.'
      case 'AbortError':
        return 'Passkey request was aborted.'
      case 'ConstraintError':
        return 'No authenticator on this device could satisfy the request.'
      default:
        return `Passkey operation failed (${err.name}).`
    }
  }
  return err instanceof Error ? err.message : 'Passkey operation failed.'
}

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Runs a real navigator.credentials.create() ceremony for `username`.
 * Deliberately does not persist the public key, or anything else — the
 * returned summary is meant to be shown directly in the UI by the caller
 * for this page view only, never written to storage.
 */
export async function registerPasskey(username: string): Promise<PasskeySetupSummary> {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported in this browser/context.')
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = new TextEncoder().encode(username)

  let credential: PublicKeyCredential
  try {
    credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'QA Automation', id: window.location.hostname },
        user: { id: userId, name: username, displayName: username },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'required',
        },
        attestation: 'none',
        timeout: 60000,
      },
    })) as PublicKeyCredential
  } catch (err) {
    throw new Error(mapWebAuthnError(err))
  }

  const response = credential.response as AuthenticatorAttestationResponse
  // Real response from the device, read to confirm a genuine key pair came
  // back — the key material itself is intentionally discarded below.
  const alg =
    typeof response.getPublicKeyAlgorithm === 'function' ? response.getPublicKeyAlgorithm() : null

  const record: PasskeyRecord = {
    credentialId: toBase64Url(credential.rawId),
    alg,
    createdAt: Date.now(),
  }

  return { username, ...record }
}

// ─── Sign-in (usernameless) ────────────────────────────────────────────────────

function decodeUserVerifiedFlag(authenticatorData: ArrayBuffer): boolean {
  const flags = new Uint8Array(authenticatorData)[32] ?? 0
  return (flags & 0x04) !== 0
}

/**
 * Runs a real navigator.credentials.get() ceremony with no
 * `allowCredentials` restriction, letting the browser/OS present its own
 * discoverable-credential picker. Recovers the username from the
 * assertion's `userHandle` rather than requiring one to be typed first.
 */
export async function signInWithPasskey(): Promise<PasskeySignInSummary> {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported in this browser/context.')
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32))

  let assertion: PublicKeyCredential
  try {
    assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        userVerification: 'required',
        timeout: 60000,
      },
    })) as PublicKeyCredential
  } catch (err) {
    throw new Error(mapWebAuthnError(err))
  }

  const response = assertion.response as AuthenticatorAssertionResponse
  if (!response.userHandle) {
    throw new Error('This passkey did not return a user handle, so the account could not be identified.')
  }

  const username = new TextDecoder().decode(response.userHandle)

  return {
    username,
    credentialId: toBase64Url(assertion.rawId),
    verifiedAt: Date.now(),
    userVerified: decodeUserVerifiedFlag(response.authenticatorData),
  }
}
