# automation-pages

QA-only static pages for testing browser / password-manager / Appium
autofill, login, TOTP (MFA), and passkey (WebAuthn) flows. There is **no
backend** — all "authentication" is either a static fixture defined in
[`app/lib/users.ts`](app/lib/users.ts), or, for passkeys, real browser-native
WebAuthn ceremonies bookkept in `localStorage` (see
[`app/lib/passkeys.ts`](app/lib/passkeys.ts)).

## Routes

| Route     | Purpose                                                             |
| --------- | -------------------------------------------------------------------- |
| `/login`  | Username/password sign-in form, plus a "Login with Passkey" button. Autofill hooks: `usernamefield`, `passwordfield`, `passkeyloginbutton`. |
| `/mfa`    | TOTP verification step (only for `@totp` users). Hook: `totpfield`.  |
| `/home`   | Success page shown after a valid login, plus a Passkeys section with a "Setup Passkey" button (`setuppasskeybutton`) and confirmation of the last passkey operation. |
| `/users`  | Directory of every static test user, its password, (for `@totp` users) its TOTP secret + live current code, and a passkey-compatibility column. |

## Passkeys (WebAuthn)

Passkey setup and sign-in use the browser's real `navigator.credentials`
API — the device/OS prompt (Touch ID, Windows Hello, Android biometric, a
security key, or a password-manager extension) is genuine, not simulated.
Because there's no backend:

- **Setup** (`/home` → "Setup Passkey") runs a real registration ceremony.
  The public key is read from the response only to confirm a real key pair
  came back — it is **not persisted**. Only a small bookkeeping record
  (credential id, algorithm, timestamp) is stored in `localStorage`, purely
  so the UI can show "Passkey added" on that device/browser later.
- **Sign-in** (`/login` → "Login with Passkey") is usernameless: no
  username needs to be typed. The browser shows its own discoverable-
  credential picker, and the signed-in username is recovered from the
  assertion's `userHandle`.
- Passkey bookkeeping is **per browser/device only** — there is no shared
  store, so "Passkey added" won't show on a different browser/device even
  if the underlying passkey itself was synced there by a platform manager
  (iCloud Keychain, Google Password Manager, etc.). The sign-in ceremony
  itself can still succeed on that other device; only this app's local
  confirmation badge doesn't carry over.
- **Requires a secure context (HTTPS or localhost).** GitHub Pages is
  always HTTPS, so it works there out of the box. Plain S3 static-website
  hosting is HTTP-only by default — passkey buttons will be hidden
  (feature-detected) unless the bucket is served over HTTPS, e.g. via
  CloudFront + an ACM certificate.

## Test users

See `/users` (once running) or [`app/lib/users.ts`](app/lib/users.ts) for the
full, current list. In short: 15 static users in 3 groups of 5, all sharing
the password `QaAuto#2024!`:

- `testuser1@autofill` … `testuser5@autofill` — no TOTP
- `testuser1@landandcatch` … `testuser5@landandcatch` — no TOTP
- `testuser1@totp` … `testuser5@totp` — requires TOTP, each with its own secret

Every input field exposes matching `id`, `name`, `aria-label`, and
`data-testid` attributes (`usernamefield`, `passwordfield`, `totpfield`), so
elements can be located via CSS/XPath (`#usernamefield`,
`//*[@id="usernamefield"]`) or Appium's accessibility-id / `data-testid`
strategies.

## Prerequisites

- Node.js 20+
- npm

## Running locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) (redirects to `/login`).

Other useful scripts:

```bash
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
```

## Building

This project uses Next.js static export (`output: 'export'` in
[`next.config.js`](next.config.js)), so the same build produces a
plain static site — only the `NEXT_PUBLIC_BASE_PATH` env var changes
depending on where you host it. The build always writes to `out/`.

### Build for AWS S3 (root domain / bucket root)

S3 static website hosting serves files from the bucket root, so leave
`NEXT_PUBLIC_BASE_PATH` unset (empty base path):

```bash
npm run build
```

Then sync `out/` to your bucket:

```bash
aws s3 sync out/ s3://<your-bucket-name>/ --delete
```

Bucket setup notes:

- Enable **Static website hosting** on the bucket.
- Set **Index document** to `index.html`.
- Set **Error document** to `404.html` (or `404/index.html`).
- If fronting the bucket with CloudFront + a custom domain, no further
  config changes are needed here (base path stays empty).

### Build for GitHub Pages (project site)

This is hosted on a GitHub Enterprise instance, so Pages URLs look like:

```
https://pages.github.cyberng.com/<your-org-or-user>/<repo-name>
```

(org/user and repo name in the path, rather than a `github.io` subdomain.)
`NEXT_PUBLIC_BASE_PATH` must be set to that same path before building:

```bash
NEXT_PUBLIC_BASE_PATH=/<your-org-or-user>/<repo-name> npm run build
```

Then either:

- **Automatic** — push to `master`; [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
  builds with `NEXT_PUBLIC_BASE_PATH` set to the org/user + repo path and
  deploys via GitHub Actions (`actions/deploy-pages`). Update that env var in
  the workflow if the org/user or repo name changes.
- **Manual (`gh-pages` branch)** — build locally with the correct base
  path above, then publish the contents of `out/` to the `gh-pages`
  branch, e.g. using a separate worktree:

  ```bash
  git worktree add .gh-pages-worktree gh-pages
  rsync -a --delete --exclude='.git' out/ .gh-pages-worktree/
  cd .gh-pages-worktree
  git add -A
  git commit -m "deploy: update static site"
  git push origin gh-pages
  cd ..
  git worktree remove .gh-pages-worktree
  ```

## Notes

- `out/` and `.next/` are git-ignored on regular branches — they are build
  artifacts only. The `gh-pages` branch is the exception: there, `out/`'s
  contents live at the branch root and *are* the tracked site.
- No credentials, secrets, or backend calls are involved beyond the static
  fixtures in `app/lib/users.ts` and the browser-native passkey ceremonies
  in `app/lib/passkeys.ts` (bookkept in `localStorage` only) — this repo is
  QA/automation tooling only.
