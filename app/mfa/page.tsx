'use client'

/**
 * /mfa
 *
 * QA-only TOTP / MFA verification page.
 * Shown after a successful password login for @totp users.
 *
 * Each @totp user (testuser1@totp … testuser5@totp) has its own unique
 * base32 secret — see app/lib/users.ts for the full list, or visit /users
 * to see all users, passwords and secrets in one table.
 *
 * TOTP config (use with Google Authenticator / Authy):
 *   Issuer       : QA Automation
 *   Algorithm    : SHA1
 *   Digits       : 6
 *   Period       : 30 seconds
 *
 *   otpauth URI pattern:
 *   otpauth://totp/QA%20Automation:<username>?secret=<SECRET>&issuer=QA%20Automation&algorithm=SHA1&digits=6&period=30
 *
 * Verification uses a self-contained pure-JS SHA1/HMAC implementation
 * (app/lib/totp.ts). No external library, no crypto.subtle, no browser
 * API — works on HTTP and HTTPS, GitHub Pages, plain S3, and localhost.
 *
 * Automation hooks:
 *   TOTP field — id/name/aria-label/data-testid = "totpfield"
 *   Reachable via CSS/XPath (#totpfield, //*[@id="totpfield"]) and via
 *   Appium's "accessibility id" strategy (aria-label / data-testid).
 */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { findUser } from '../lib/users'
import { verifyTotp } from '../lib/totp'

// ─── Page component ───────────────────────────────────────────────────────────
export default function MfaPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Guard: only allow entry when login page set the mfa_pending flag
    if (sessionStorage.getItem('mfa_pending') !== '1') {
      router.replace('/login')
      return
    }
    setUsername(sessionStorage.getItem('autofill_user') ?? '')
    setReady(true)
  }, [router])

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const entered = codeRef.current?.value.trim() ?? ''
    const user = findUser(username)

    // Slight delay so the button press feels tactile (mirrors login page)
    setTimeout(() => {
      if (user?.totpSecret && verifyTotp(user.totpSecret, entered)) {
        sessionStorage.removeItem('mfa_pending')
        sessionStorage.setItem('autofill_ok', '1')
        router.push('/home')
      } else {
        setError('TOTP is invalid. Try again.')
        setLoading(false)
        codeRef.current?.select()
      }
    }, 300)
  }

  if (!ready) return null

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">

        {/* QA badge */}
        <div className="mb-8 text-center">
          <span className="inline-block rounded-full border border-gray-200 bg-white px-3 py-1 font-mono text-xs tracking-widest text-gray-400 uppercase">
            QA · MFA Verification
          </span>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-8 shadow-sm">

          {/* Shield icon */}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 text-indigo-600"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>

          <h1 className="mb-1 text-center text-xl font-semibold tracking-tight text-gray-900">
            Two-Factor Authentication
          </h1>
          <p className="mb-1 text-center text-sm text-gray-500">
            Enter the 6-digit code from your authenticator app.
          </p>
          {username && (
            <p className="mb-6 text-center font-mono text-xs text-gray-400">
              {username}
            </p>
          )}

          <form onSubmit={handleSubmit} autoComplete="off" noValidate>
            {/* OTP input */}
            <div className="mb-6">
              <label
                htmlFor="totpfield"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                One-Time Code
              </label>
              <input
                ref={codeRef}
                id="totpfield"
                name="totpfield"
                aria-label="totpfield"
                data-testid="totpfield"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                autoComplete="one-time-code"
                required
                placeholder="totpfield"
                className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-3 text-center font-mono text-2xl tracking-[0.4em] text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
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
              {loading ? 'Verifying…' : 'Verify Code'}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center font-mono text-xs text-gray-400">
          Static TOTP · No backend · QA use only
        </p>
      </div>
    </main>
  )
}
