/**
 * Supabase persistence for game state. All writes go through the engine's
 * `applyCommand` and the `apply_game_update` CAS RPC (optimistic locking on
 * `version`): on version conflict we refetch and re-validate the command.
 */

import { applyCommand } from "@/engine/engine";
import { createGame } from "@/engine/setup";
import type { Command, GameState, LogEvent } from "@/engine/types";
import type { PlayerColor } from "@/data/playerColors";
import { supabase } from "./supabaseClient";

export interface GameRow {
  id: string;
  room_code: string;
  status: string;
  state: GameState;
  version: number;
}

export interface GameEventRow {
  id: number;
  game_id: string;
  turn_number: number | null;
  event_type: string;
  message: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export async function createGameRoom(host: {
  name: string;
  color: PlayerColor;
}): Promise<{ row: GameRow; playerId: string; token: string }> {
  const playerId = generateId();
  const token = generateId();
  // Retry on the (unlikely) room-code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = generateRoomCode();
    const state = createGame(roomCode, { id: playerId, token, name: host.name, color: host.color });
    const { data, error } = await supabase()
      .from("games")
      .insert({ room_code: roomCode, status: "lobby", state })
      .select()
      .single();
    if (!error) return { row: data as GameRow, playerId, token };
    if (!error.message.includes("duplicate")) throw new Error(error.message);
  }
  throw new Error("Couldn't create a room. Please try again.");
}

export async function fetchGameByRoomCode(roomCode: string): Promise<GameRow | null> {
  const { data, error } = await supabase()
    .from("games")
    .select()
    .eq("room_code", roomCode.toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GameRow) ?? null;
}

export async function fetchGameById(id: string): Promise<GameRow | null> {
  const { data, error } = await supabase().from("games").select().eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GameRow) ?? null;
}

export async function fetchEvents(gameId: string, afterId = 0): Promise<GameEventRow[]> {
  const { data, error } = await supabase()
    .from("game_events")
    .select()
    .eq("game_id", gameId)
    .gt("id", afterId)
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as GameEventRow[];
}

export interface MutateResult {
  ok: boolean;
  error?: string;
  row?: GameRow;
}

/**
 * Run a command through the engine against the latest known row and persist
 * via compare-and-swap. Retries on version conflicts (another client wrote
 * first) by refetching and re-validating.
 */
export async function mutateGame(
  row: GameRow,
  actorId: string,
  command: Command,
): Promise<MutateResult> {
  let current = row;
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = applyCommand(current.state, actorId, command);
    if (!result.ok) return { ok: false, error: result.error };

    const { data, error } = await supabase().rpc("apply_game_update", {
      p_game_id: current.id,
      p_expected_version: current.version,
      p_new_state: result.state,
      p_status: result.state.phase,
      p_events: serializeEvents(result.events),
    });
    if (error) return { ok: false, error: error.message };

    const outcome = Array.isArray(data) ? data[0] : data;
    if (outcome?.ok) {
      return {
        ok: true,
        row: {
          ...current,
          state: result.state,
          status: result.state.phase,
          version: outcome.new_version,
        },
      };
    }
    // Version conflict: refetch and try the command against the fresh state.
    const fresh = await fetchGameById(current.id);
    if (!fresh) return { ok: false, error: "Game not found." };
    current = fresh;
  }
  return { ok: false, error: "The game is busy — please try again." };
}

function serializeEvents(events: LogEvent[]) {
  return events.map((e) => ({
    turn: e.turn,
    type: e.type,
    message: e.message,
    data: e.data ?? null,
  }));
}
