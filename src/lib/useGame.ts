"use client";

/**
 * React hook that subscribes to a game row over Supabase Realtime (with a
 * polling fallback) and exposes a `send` function that routes every state
 * change through the validated engine + CAS write.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Command, GameState } from "@/engine/types";
import {
  fetchGameByRoomCode,
  mutateGame,
  type GameRow,
} from "./gameApi";
import { supabase } from "./supabaseClient";

export interface UseGameResult {
  row: GameRow | null;
  state: GameState | null;
  loading: boolean;
  notFound: boolean;
  /** Last command error (shown as a toast); cleared on the next command */
  error: string | null;
  clearError: () => void;
  send: (actorId: string, command: Command) => Promise<boolean>;
}

const POLL_MS = 5000;

export function useGame(roomCode: string): UseGameResult {
  const [row, setRow] = useState<GameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rowRef = useRef<GameRow | null>(null);

  const adopt = useCallback((next: GameRow | null) => {
    if (!next) return;
    // Ignore stale updates (realtime + poll + local write can race).
    if (rowRef.current && next.version <= rowRef.current.version) return;
    rowRef.current = next;
    setRow(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<ReturnType<typeof supabase>["channel"]> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    async function init() {
      try {
        const initial = await fetchGameByRoomCode(roomCode);
        if (cancelled) return;
        if (!initial) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        adopt(initial);
        setLoading(false);

        channel = supabase()
          .channel(`game:${initial.id}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${initial.id}` },
            (payload) => adopt(payload.new as GameRow),
          )
          .subscribe();

        // Poll as a safety net for missed realtime messages.
        poll = setInterval(async () => {
          try {
            const fresh = await fetchGameByRoomCode(roomCode);
            if (!cancelled) adopt(fresh);
          } catch {
            // transient network issue; next poll will retry
          }
        }, POLL_MS);
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
      if (channel) supabase().removeChannel(channel);
      if (poll) clearInterval(poll);
    };
  }, [roomCode, adopt]);

  const send = useCallback(
    async (actorId: string, command: Command): Promise<boolean> => {
      const current = rowRef.current;
      if (!current) return false;
      setError(null);
      const result = await mutateGame(current, actorId, command);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return false;
      }
      adopt(result.row!);
      return true;
    },
    [adopt],
  );

  return {
    row,
    state: row?.state ?? null,
    loading,
    notFound,
    error,
    clearError: () => setError(null),
    send,
  };
}
