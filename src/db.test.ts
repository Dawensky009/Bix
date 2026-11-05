import { expect, it, vi } from "vitest";
import { emptyState } from "./domain";
const mock = vi.hoisted(() => ({
  rpc: vi.fn(async () => ({ error: null })),
  from: vi.fn(() => ({
    delete: () => ({ eq: async () => ({ error: null }) }),
  })),
}));
vi.mock("./supabase", () => ({ supabase: mock }));
import { dbImportAll } from "./db";
it("restores a backup with one atomic RPC rather than deleting records piecemeal", async () => {
  await dbImportAll("u", emptyState);
  expect(mock.rpc).toHaveBeenCalledWith("bix_replace_state", {
    payload: { brokers: [], entries: [], goals: [], transactions: [] },
  });
  expect(mock.from).not.toHaveBeenCalled();
});
