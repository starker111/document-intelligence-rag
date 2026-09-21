import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "./validators";

let client: SupabaseClient | undefined;
let clientCacheKey: string | undefined;

type SupabaseErrorLike =
  | {
      message?: string;
    }
  | null
  | undefined;

export function normalizeSupabaseUrl(rawUrl: string): string {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new AppError(
      "NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase project URL, for example https://your-project.supabase.co.",
      503,
    );
  }

  parsed.hash = "";
  parsed.search = "";
  parsed.pathname =
    parsed.pathname
      .replace(/\/rest\/v1\/?$/i, "")
      .replace(/\/auth\/v1\/?$/i, "")
      .replace(/\/storage\/v1\/?$/i, "")
      .replace(/\/functions\/v1\/?$/i, "") || "/";

  return parsed.toString().replace(/\/$/, "");
}

export function isSupabaseNetworkError(error: SupabaseErrorLike): boolean {
  const message = error?.message ?? "";

  return /fetch failed|failed to fetch|networkerror|econnrefused|enotfound|etimedout|econnreset/i.test(
    message,
  );
}

export function supabaseServiceError(
  action: string,
  error: SupabaseErrorLike,
): AppError {
  if (isSupabaseNetworkError(error)) {
    return new AppError(
      `${action}: Supabase could not be reached. Check that NEXT_PUBLIC_SUPABASE_URL is the project base URL, the Supabase project is active, and your network connection is available.`,
      503,
    );
  }

  return new AppError(`${action}: ${error?.message ?? "No response returned."}`, 502);
}

export function getSupabaseAdmin(): SupabaseClient {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!rawUrl || !serviceRoleKey) {
    throw new AppError(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      503,
    );
  }

  const url = normalizeSupabaseUrl(rawUrl);
  const cacheKey = `${url}:${serviceRoleKey}`;

  if (!client || clientCacheKey !== cacheKey) {
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    clientCacheKey = cacheKey;
  }

  return client;
}
