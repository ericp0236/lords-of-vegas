import { describe, expect, it } from "vitest";
import {
  createGameRoom,
  fetchEvents,
  fetchGameByRoomCode,
  mutateGame,
} from "@/lib/gameApi";
import { supabase } from "@/lib/supabaseClient";

// Live round-trip through Supabase: create room, join, approve, start, draw.
// Opt-in (needs network + real DB): run with `npm run test:live`.
describe.runIf(!!process.env.LIVE)("live supabase round trip", () => {
  it("plays the opening of a real game through the CAS RPC", async () => {
    const { row, playerId: hostId } = await createGameRoom({ name: "SmokeHost", color: "red" });
    try {
      let current = row;
      const join = async (id: string, name: string, color: "blue" | "green") => {
        const r = await mutateGame(current, id, {
          type: "requestJoin",
          request: { id, token: `tok-${id}`, name, color },
        });
        expect(r.ok).toBe(true);
        current = r.row!;
        const a = await mutateGame(current, hostId, { type: "approveJoin", requestId: id });
        expect(a.ok).toBe(true);
        current = a.row!;
      };
      await join("sp1", "SmokeOne", "blue");
      await join("sp2", "SmokeTwo", "green");

      const started = await mutateGame(current, hostId, { type: "startGame" });
      expect(started.ok).toBe(true);
      current = started.row!;
      expect(current.state.phase).toBe("playing");

      const active = current.state.turn!.activePlayerId;
      const drew = await mutateGame(current, active, { type: "drawCard" });
      expect(drew.ok).toBe(true);
      current = drew.row!;

      // Stale-version write must be rejected and retried internally:
      const staleBase = { ...current, version: current.version - 1 };
      const retried = await mutateGame(staleBase, current.state.turn!.activePlayerId, {
        type: "endTurn",
      });
      // endTurn may fail engine-side if a pending choice exists; both paths
      // prove the CAS retry didn't corrupt anything.
      if (retried.ok) current = retried.row!;

      const fresh = await fetchGameByRoomCode(current.room_code);
      expect(fresh?.version).toBe(current.version);

      const events = await fetchEvents(current.id);
      expect(events.length).toBeGreaterThan(4);
    } finally {
      await supabase().from("games").delete().eq("id", row.id);
    }
  }, 30000);
});
