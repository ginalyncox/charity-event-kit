/** @type {import('next').NextConfig} */
const nextConfig = {
  // PGlite is only used for local development (no DATABASE_URL set).
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;
