import type { NextConfig } from "next";

/** Sicherheits-Response-Header für alle Routen (funktionsneutral). */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // X-Powered-By-Header weglassen (kleiner, unauffälliger)
  // Garantiert per-Komponenten/Icon-Tree-Shaking dieser Barrel-Pakete →
  // kleinerer Client-Bundle, kein Verhaltens-/Optik-Effekt.
  experimental: {
    optimizePackageImports: ["lucide-react", "radix-ui", "recharts", "date-fns"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
