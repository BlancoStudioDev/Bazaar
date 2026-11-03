"use client";

import { createAuthClient } from "better-auth/react";

import { BASE_PATH } from "@/lib/base-path";

export const authClient = createAuthClient({
  // Origine corrente + basePath dell'app: coerente con `basePath` del server (auth.ts).
  baseURL: typeof window === "undefined" ? undefined : window.location.origin,
  basePath: `${BASE_PATH}/api/auth`,
});
