import { createClient } from "@libsql/client";

export const turso = createClient({
  url: import.meta.env.VITE_TURSO_DATABASE_URL || "libsql://itboss-muhammademon72.aws-ap-south-1.turso.io",
  authToken: import.meta.env.VITE_TURSO_AUTH_TOKEN || "",
});
