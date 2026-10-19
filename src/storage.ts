import { emptyState, parseState, type State } from "./domain";

export function persistState(
  storage: Pick<Storage, "setItem">,
  state: State,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(parseState(state)));
}

export const STORAGE_KEY = "bix.state.v1";
export function loadState(storage: Pick<Storage, "getItem">): State {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return parseState(emptyState);
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new Error(
      "Stored BIX data is not valid JSON. Original data has not been changed.",
    );
  }
  try {
    return parseState(input);
  } catch (error) {
    throw new Error(
      `Invalid stored BIX state: ${error instanceof Error ? error.message : String(error)} Original data has not been changed.`,
    );
  }
}
