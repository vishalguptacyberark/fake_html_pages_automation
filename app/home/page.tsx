'use client'

/**
 * /home
 *
 * QA-only success page shown after a successful login (password, TOTP, or
 * passkey). Has NO backend connection — session state is sessionStorage
 * only, and passkey setup results are never persisted anywhere (see
 * app/lib/passkeys.ts): the details returned by the device callback are
 * shown directly in this page's state for the current view only.
 *
 * Reload-back-to-login mechanism:
 *   1. The login page writes sessionStorage key "autofill_ok" before navigating here.
 *   2. On mount this page verifies the key; if missing it immediately redirects
 *      back to /login.
 *   3. A "pagehide" listener clears the key so any hard page reload removes it
 *      before the page re-initialises, causing step 2 to trigger on reload.
 *
 * This means:
 *   - Client-side nav from login → home works (key survives soft nav).
 *   - Hard reload on home → pagehide fires → key gone → redirects to login.
 *   - Direct URL visit to /home → no key → redirects to login.
 *
 * Passkeys section:
 *   - If the login page just performed a passkey sign-in, sessionStorage's
 *     "passkey_summary" holds the real assertion data (credential id,
 *     decoded username, verification flag) — displayed here as proof the
 *     ceremony happened, then cleared like the rest of the session state.
 *   - A "Setup Passkey" button runs a real navigator.credentials.create()
 *     ceremony. Nothing is persisted — not the public key, not even
 *     bookkeeping metadata. The credential id, algorithm, and timestamp
 *     returned by the device callback are shown directly on this page via
 *     component state, and are gone as soon as the page is left/reloaded.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  algLabel,
  isPasskeySupported,
  registerPasskey,
  shortCredentialId,
  type PasskeySetupSummary,
  type PasskeySignInSummary,
} from '../lib/passkeys'

export default function HomePage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [username, setUsername] = useState('testuser')
  const [loginMethod, setLoginMethod] = useState<string | null>(null)
  const [signInSummary, setSignInSummary] = useState<PasskeySignInSummary | null>(null)

  const [passkeySupported, setPasskeySupported] = useState(false)
  const [setupRecord, setSetupRecord] = useState<PasskeySetupSummary | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  useEffect(() => {
    // Guard: only allow entry when the login page set the flag
    const authed = sessionStorage.getItem('autofill_ok') === '1'
    if (!authed) {
      router.replace('/login')
      return
    }

    const resolvedUsername = sessionStorage.getItem('autofill_user') ?? 'testuser'
    setUsername(resolvedUsername)
    setLoginMethod(sessionStorage.getItem('login_method'))

    const passkeySummaryRaw = sessionStorage.getItem('passkey_summary')
    if (passkeySummaryRaw) {
      try {
        setSignInSummary(JSON.parse(passkeySummaryRaw) as PasskeySignInSummary)
      } catch {
        setSignInSummary(null)
      }
    }

    setPasskeySupported(isPasskeySupported())

    setReady(true)

    // Clear the flag when the page is hidden (covers both reload and tab-close).
    // On a hard reload the browser fires pagehide before the new page load
    // starts, so the flag is gone by the time this component runs again.
    // Note: there is no stored passkey record to clean up — nothing is
    // ever persisted, so a reload simply loses the on-screen details.
    function handlePageHide() {
      sessionStorage.removeItem('autofill_ok')
      sessionStorage.removeItem('autofill_user')
      sessionStorage.removeItem('login_method')
      sessionStorage.removeItem('passkey_summary')
    }

    window.addEventListener('pagehide', handlePageHide)
    return () => {
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [router])

  async function handleSetupPasskey() {
    setSetupError(null)
    setSetupLoading(true)
    try {
      const summary = await registerPasskey(username)
      setSetupRecord(summary)
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Passkey setup failed.')
    } finally {
      setSetupLoading(false)
    }
  }

  // Show nothing while the redirect check resolves to avoid a flash
  if (!ready) return null

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm text-center">

        {/* QA badge */}
        <div className="mb-8">
          <span className="inline-block rounded-full border border-gray-200 bg-white px-3 py-1 font-mono text-xs tracking-widest text-gray-400 uppercase">
            QA · Autofill Test
          </span>
        </div>

        {/* Success card */}
        <div className="mb-8 rounded-2xl border border-green-200 bg-white px-8 py-10 shadow-sm">

          {/* Checkmark */}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 text-green-600"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>

          <h1 className="mb-2 text-2xl font-semibold tracking-tight text-gray-900">
            Login Succeeded
          </h1>
          <p className="mb-8 text-sm leading-relaxed text-gray-500">
            Credentials were accepted. Autofill is working correctly.
          </p>

          {/* Credential summary */}
          <div className="mb-8 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-left">
            <p className="mb-1.5 font-mono text-xs text-gray-400 uppercase tracking-wider">
              Verified as
            </p>
            <p className="font-mono text-sm font-medium text-gray-800">
              {username}
            </p>
            {loginMethod && (
              <p className="mt-1 font-mono text-xs text-gray-400">
                via {loginMethod}
              </p>
            )}
          </div>

          {/* Back to login */}
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.98]"
          >
            Back to Login
          </button>
        </div>

        {/* Passkeys section */}
        <div
          className="mb-6 rounded-2xl border border-gray-200 bg-white px-8 py-8 text-left shadow-sm"
          data-testid="passkeys-section"
        >
          <h2 className="mb-1 text-lg font-semibold tracking-tight text-gray-900">
            Passkeys
          </h2>
          <p className="mb-5 text-sm text-gray-500">
            Real WebAuthn ceremonies — no backend, bookkeeping is local to this device.
          </p>

          {!passkeySupported && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-700">
              Passkeys aren&apos;t supported in this browser/context (requires HTTPS or localhost).
            </p>
          )}

          {passkeySupported && (
            <>
              {/* Sign-in confirmation, only present if we arrived here via passkey login */}
              {signInSummary && (
                <div className="mb-5 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3">
                  <p className="mb-1.5 font-mono text-xs uppercase tracking-wider text-indigo-400">
                    Signed in via passkey
                  </p>
                  <dl className="space-y-1 text-sm text-indigo-900">
                    <div className="flex justify-between gap-3">
                      <dt className="text-indigo-500">Credential</dt>
                      <dd className="font-mono">{shortCredentialId(signInSummary.credentialId)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-indigo-500">User handle decoded to</dt>
                      <dd className="font-mono">{signInSummary.username}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-indigo-500">Device verified</dt>
                      <dd className="font-mono">{signInSummary.userVerified ? 'yes' : 'no'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-indigo-500">At</dt>
                      <dd className="font-mono">{new Date(signInSummary.verifiedAt).toLocaleString()}</dd>
                    </div>
                  </dl>
                </div>
              )}

              {/* Setup confirmation / action */}
              {setupRecord ? (
                <div className="mb-4 rounded-lg border border-green-100 bg-green-50 px-4 py-3">
                  <p className="mb-1.5 font-mono text-xs uppercase tracking-wider text-green-600">
                    Passkey added on this device
                  </p>
                  <dl className="space-y-1 text-sm text-green-900">
                    <div className="flex justify-between gap-3">
                      <dt className="text-green-600">Credential</dt>
                      <dd className="font-mono">{shortCredentialId(setupRecord.credentialId)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-green-600">Algorithm</dt>
                      <dd className="font-mono">{algLabel(setupRecord.alg)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-green-600">Added</dt>
                      <dd className="font-mono">{new Date(setupRecord.createdAt).toLocaleString()}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="mb-4 text-sm text-gray-500">
                  No passkey set up for <span className="font-mono">{username}</span> on this device yet.
                </p>
              )}

              {setupError && (
                <p
                  role="alert"
                  className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600"
                >
                  {setupError}
                </p>
              )}

              <button
                type="button"
                id="setuppasskeybutton"
                name="setuppasskeybutton"
                aria-label="setuppasskeybutton"
                data-testid="setuppasskeybutton"
                onClick={handleSetupPasskey}
                disabled={setupLoading}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {setupLoading
                  ? 'Waiting for device…'
                  : setupRecord
                    ? 'Replace passkey on this device'
                    : 'Setup Passkey'}
              </button>
            </>
          )}
        </div>

        {/* Footer note */}
        <p className="mt-6 font-mono text-xs text-gray-400">
          Reload this page to return to the login screen.
        </p>
      </div>
    </main>
  )
}
