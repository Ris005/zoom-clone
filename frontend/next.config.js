/**
 * Next.js config.
 *
 * `NEXT_PUBLIC_API_URL` is the only thing the SPA needs to know about the
 * backend; it is read in lib/api.ts. Kept here as documentation of the contract.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};
module.exports = nextConfig;
