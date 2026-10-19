import { expect, it } from "vitest";
import * as storage from "./storage";
import { emptyState, saveBroker } from "./domain";

const saved = saveBroker(emptyState, {
  id: "b",
  name: "Broker",
  currency: "HTG",
  initialBalance: 500,
});
it("loads a validated stored state", () => {
  expect(storage.loadState({ getItem: () => JSON.stringify(saved) })).toEqual(
    saved,
  );
});
it.each([
  "",
  "{broken",
  "null",
  '{"version":2}',
  '{"version":1,"brokers":[],"entries":[{}],"goals":[]}',
])(
  "rejects damaged storage without replacing its original contents: %s",
  (original) => {
    const data = new Map([[storage.STORAGE_KEY, original]]);
    expect(() =>
      storage.loadState({ getItem: (key) => data.get(key) ?? null }),
    ).toThrow(/stored|state|JSON/i);
    expect(data.get(storage.STORAGE_KEY)).toBe(original);
  },
);
it("propagates storage access failures", () => {
  expect(() =>
    storage.loadState({
      getItem() {
        throw new Error("Access denied");
      },
    }),
  ).toThrow(/Access denied/);
});

it("persists a validated state that round-trips through storage", () => {
  const data = new Map<string, string>();
  storage.persistState(
    {
      setItem: (key, value) => {
        data.set(key, value);
      },
    },
    saved,
  );
  expect(
    storage.loadState({ getItem: (key) => data.get(key) ?? null }),
  ).toEqual(saved);
});

it("rejects invalid state before overwriting existing storage", () => {
  let original = "keep me";
  expect(() =>
    storage.persistState(
      {
        setItem: (_key, value) => {
          original = value;
        },
      },
      {
        ...saved,
        brokers: [{ ...saved.brokers[0], initialBalance: Infinity }],
      },
    ),
  ).toThrow();
  expect(original).toBe("keep me");
});
it("surfaces quota failures to the caller", () => {
  expect(() =>
    storage.persistState(
      {
        setItem() {
          throw new Error("Quota exceeded");
        },
      },
      saved,
    ),
  ).toThrow(/Quota/);
});

it("loads missing storage as an independent empty state under the versioned key", () => {
  let key = "";
  const loaded = storage.loadState({
    getItem(k) {
      key = k;
      return null;
    },
  });
  expect(key).toBe("bix.state.v1");
  expect(storage.STORAGE_KEY).toBe(key);
  expect(loaded).toEqual(emptyState);
  expect(loaded).not.toBe(emptyState);
});
