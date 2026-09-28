/** @type {import('next').NextConfig} */

// When deploying to GitHub Pages as a project site the repo is served under
// /<repo-name>/.  Set NEXT_PUBLIC_BASE_PATH in CI (or locally) to match.
// For a root domain / custom domain leave it empty or unset.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

const nextConfig = {
  reactStrictMode: true,

  // ── GitHub Pages compatibility ────────────────────────────────────────────
  // Emit a fully-static site into the `out/` directory instead of a
  // Node.js server bundle.  GitHub Pages only serves static files.
  output: 'export',

  // Produce index.html files for each route so every URL works without a
  // server-side rewrite (e.g. /login → /login/index.html).
  trailingSlash: true,

  // Sub-path for project pages (https://<user>.github.io/<repo>/).
  // Empty string = root domain / custom domain.
  basePath,
  assetPrefix: basePath,
}

module.exports = nextConfig
