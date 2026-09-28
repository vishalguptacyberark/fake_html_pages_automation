'use client'

/**
 * /login
 *
 * QA-only page for testing browser / password-manager / Appium autofill.
 * Has NO connection to any backend or authentication system.
 *
 * Static user directory (see app/lib/users.ts) — 15 users, 3 groups of 5:
 *   testuser1@autofill      … testuser5@autofill      (no TOTP)
 *   testuser1@landandcatch  … testuser5@landandcatch   (no TOTP)
 *   testuser1@totp          … testuser5@totp           (TOTP required)
 *
 * All users share the password: QaAuto#2024! (see app/lib/users.ts PASSWORD)
 * Full list with passwords + TOTP secrets: /users
 *
 * On success the page sets a sessionStorage flag and performs a client-side
 * navigation to /home (or /mfa for @totp users). The home page clears that
 * flag on pagehide so any hard reload redirects back here.
 *
 * A "Login with Passkey" button is also offered — a real, usernameless
 * WebAuthn ceremony (see app/lib/passkeys.ts). No username needs to be
 * typed: the signed-in account is recovered from the assertion's
 * `userHandle`. Requires a secure context (HTTPS/localhost); the button is
 * hidden automatically when unsupported.
 *
 * Automation hooks:
 *   Username field — id/name/aria-label/data-testid = "usernamefield"
 *   Password field — id/name/aria-label/data-testid = "passwordfield"
 *   Both are reachable via CSS/XPath (#usernamefield, //*[@id="usernamefield"])
 *   and via Appium's "accessibility id" strategy (aria-label / data-testid).
 *   Passkey button — id/name/aria-label/data-testid = "passkeyloginbutton"
 */

import { useEffect, useState, useRef, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { findUser, requiresTotp } from '../lib/users'
import { isPasskeySupported, signInWithPasskey } from '../lib/passkeys'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const [passkeySupported, setPasskeySupported] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [passkeyError, setPasskeyError] = useState<string | null>(null)

  useEffect(() => {
    setPasskeySupported(isPasskeySupported())
  }, [])

  async function handlePasskeySignIn() {
    setPasskeyError(null)
    setPasskeyLoading(true)

    try {
      const summary = await signInWithPasskey()
      sessionStorage.setItem('autofill_user', summary.username)
      sessionStorage.setItem('autofill_ok', '1')
      sessionStorage.setItem('login_method', 'passkey')
      sessionStorage.setItem('passkey_summary', JSON.stringify(summary))
      sessionStorage.removeItem('mfa_pending')
      router.push('/home')
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : 'Passkey sign-in failed.')
      setPasskeyLoading(false)
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const username = usernameRef.current?.value.trim() ?? ''
    const password = passwordRef.current?.value ?? ''

    // Deliberate brief delay so the button press feels tactile
    setTimeout(() => {
      const user = findUser(username)
      if (user && user.password === password) {
        sessionStorage.setItem('autofill_user', user.username)
        sessionStorage.removeItem('passkey_summary')
        if (requiresTotp(user.username)) {
          sessionStorage.setItem('login_method', 'totp')
          sessionStorage.setItem('mfa_pending', '1')
          router.push('/mfa')
        } else {
          sessionStorage.setItem('login_method', 'password')
          sessionStorage.setItem('autofill_ok', '1')
          router.push('/home')
        }
      } else {
        setError('Invalid username or password.')
        setLoading(false)
      }
    }, 300)
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">

        {/* QA badge */}
        <div className="mb-8 text-center">
          <span className="inline-block rounded-full border border-gray-200 bg-white px-3 py-1 font-mono text-xs tracking-widest text-gray-400 uppercase">
            QA · Autofill Test
          </span>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-8 shadow-sm">

          <h1 className="mb-1 text-xl font-semibold tracking-tight text-gray-900">
            Sign in
          </h1>
          <p className="mb-6 text-sm text-gray-500">
            Use any static test user (see{' '}
            <Link href="/users" className="text-indigo-600 underline">
              /users
            </Link>
            ) to verify autofill.
          </p>

          {/*
            The form element carries autoComplete="on" and a named action so
            browsers and password managers correctly identify this as a login
            form and offer to fill / save credentials.
          */}
          <form
            onSubmit={handleSubmit}
            autoComplete="on"
            method="post"
            action="#"
            noValidate
          >
            {/* Username */}
            <div className="mb-4">
              <label
                htmlFor="usernamefield"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Username
              </label>
              <input
                ref={usernameRef}
                id="usernamefield"
                name="usernamefield"
                aria-label="usernamefield"
                data-testid="usernamefield"
                type="text"
                autoComplete="username"
                required
                placeholder="usernamefield"
                className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Password */}
            <div className="mb-6">
              <label
                htmlFor="passwordfield"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                ref={passwordRef}
                id="passwordfield"
                name="passwordfield"
                aria-label="passwordfield"
                data-testid="passwordfield"
                type="password"
                autoComplete="current-password"
                required
                placeholder="passwordfield"
                className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Error message */}
            {error && (
              <p
                role="alert"
                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600"
              >
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Passkey sign-in — usernameless, only shown when supported */}
          {passkeySupported && (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-100" />
                <span className="text-xs uppercase tracking-wider text-gray-400">or</span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>

              {passkeyError && (
                <p
                  role="alert"
                  className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600"
                >
                  {passkeyError}
                </p>
              )}

              <button
                type="button"
                id="passkeyloginbutton"
                name="passkeyloginbutton"
                aria-label="passkeyloginbutton"
                data-testid="passkeyloginbutton"
                onClick={handlePasskeySignIn}
                disabled={passkeyLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 3 4.58V17a2 2 0 1 0 4 0v-2.42A5 5 0 0 0 17 10V7a5 5 0 0 0-5-5z" />
                  <path d="M9 17v3M15 17v3" />
                </svg>
                {passkeyLoading ? 'Waiting for device…' : 'Login with Passkey'}
              </button>
            </>
          )}
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center font-mono text-xs text-gray-400">
          Static creds only · No backend · QA use only
        </p>
      </div>
    </main>
  )
}
