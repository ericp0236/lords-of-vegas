import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Publishable (client-safe) defaults; env vars override for other projects.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://hnmxkkvlwhofiqqppgdi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_8r8fs_tKkh9dbGxvy0ORCA_3Bf-06wQ";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return client;
}
