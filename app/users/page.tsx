'use client'

/**
 * /users
 *
 * QA-only directory page. Lists every static test user, its password,
 * and — for the @totp group — its base32 TOTP secret plus the currently
 * valid 6-digit code (live, refreshes every second).
 *
 * All three groups also support passkey login (see /login and /home) — a
 * real, usernameless WebAuthn flow (app/lib/passkeys.ts). The "Passkey"
 * column below is a static capability flag, not a live per-browser
 * registration check — passkey bookkeeping is localStorage-only and
 * device-specific, so it belongs on /login and /home instead.
 *
 * Source of truth: app/lib/users.ts
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AUTOFILL_USERS,
  LANDANDCATCH_USERS,
  TOTP_USERS,
  PASSWORD,
  type UserRecord,
} from '../lib/users'
import { getCurrentTotp, getTotpSecondsRemaining } from '../lib/totp'

function GroupTable({
  title,
  description,
  users,
  showSecret,
}: {
  title: string
  description: string
  users: UserRecord[]
  showSecret: boolean
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!showSecret) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [showSecret])

  const secondsLeft = getTotpSecondsRemaining(now)

  return (
    <section className="mb-10">
      <h2 className="mb-1 text-lg font-semibold tracking-tight text-gray-900">
        {title}
      </h2>
      <p className="mb-4 text-sm text-gray-500">{description}</p>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table
          className="w-full min-w-[640px] text-left text-sm"
          data-testid={`users-table-${title.toLowerCase()}`}
        >
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wider text-gray-400">
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">Password</th>
              {showSecret && (
                <>
                  <th className="px-4 py-3 font-medium">TOTP Secret</th>
                  <th className="px-4 py-3 font-medium">
                    Current Code{' '}
                    <span className="font-normal text-gray-400">
                      ({secondsLeft}s)
                    </span>
                  </th>
                </>
              )}
              <th className="px-4 py-3 font-medium">Passkey</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr
                key={u.username}
                className="border-b border-gray-50 last:border-0"
                data-testid="user-row"
                data-username={u.username}
              >
                <td className="px-4 py-3 font-mono text-gray-800">
                  {u.username}
                </td>
                <td className="px-4 py-3 font-mono text-gray-800">
                  {u.password}
                </td>
                {showSecret && (
                  <>
                    <td className="px-4 py-3 font-mono text-gray-800">
                      {u.totpSecret}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold tracking-widest text-indigo-600">
                      {u.totpSecret ? getCurrentTotp(u.totpSecret, now) : ''}
                    </td>
                  </>
                )}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    ✓ Compatible
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function UsersPage() {
  return (
    <main className="min-h-screen px-4 py-16">
      <div className="mx-auto w-full max-w-4xl">

        {/* QA badge */}
        <div className="mb-8 text-center">
          <span className="inline-block rounded-full border border-gray-200 bg-white px-3 py-1 font-mono text-xs tracking-widest text-gray-400 uppercase">
            QA · Test User Directory
          </span>
        </div>

        <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight text-gray-900">
          Static Test Users
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-gray-500">
          15 static users across 3 groups. All share the password{' '}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700">
            {PASSWORD}
          </code>
          . No backend, no persistence — for browser and Appium automation
          only. Sign in at{' '}
          <Link href="/login" className="text-indigo-600 underline">
            /login
          </Link>
          .
        </p>

        <GroupTable
          title="Autofill"
          description="Plain username/password login — no TOTP step."
          users={AUTOFILL_USERS}
          showSecret={false}
        />

        <GroupTable
          title="LandAndCatch"
          description="Same shape as Autofill (username/password, no TOTP) — a second domain suffix for testing autofill matching across origins."
          users={LANDANDCATCH_USERS}
          showSecret={false}
        />

        <GroupTable
          title="TOTP"
          description="Username/password plus a required TOTP step at /mfa. Each user has its own unique secret."
          users={TOTP_USERS}
          showSecret={true}
        />

        <p className="mx-auto mb-2 max-w-2xl text-center text-sm text-gray-500">
          Every user above is also passkey-compatible. Passkeys are set up
          per-device from <span className="font-mono">/home</span> after a
          normal login, and sign-in from <span className="font-mono">/login</span>{' '}
          is usernameless — no row lookup required.
        </p>

        <p className="text-center font-mono text-xs text-gray-400">
          Static fixture data · No backend · QA use only
        </p>
      </div>
    </main>
  )
}
