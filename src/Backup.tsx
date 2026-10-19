import { useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { localDate, parseState, type State } from "./domain";
import { STORAGE_KEY } from "./storage";
export function Backup({
  state,
  recovery,
  onImport,
}: {
  state: State;
  recovery: boolean;
  onImport: (state: State) => void;
}) {
  const [error, setError] = useState("");
  function download() {
    try {
      const contents = recovery
        ? (localStorage.getItem(STORAGE_KEY) ?? "")
        : JSON.stringify(state, null, 2);
      const url = URL.createObjectURL(
        new Blob([contents], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `bix-${recovery ? "raw-" : ""}backup-${localDate()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(String(e));
    }
  }
  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      if (file.size > 5_000_000)
        throw new Error("Backup is too large. Maximum size: 5 MB.");
      const next = parseState(JSON.parse(await file.text()));
      if (
        !window.confirm(
          "Replace all local accounts, entries and goals with this backup? Export your current data first.",
        )
      )
        return;
      onImport(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  return (
    <section className="backup-tools" aria-label="Data backup">
      <div>
        <button className="text-button" onClick={download}>
          <Download size={14} />{" "}
          {recovery ? "Export raw backup" : "Export backup"}
        </button>
        <label className="text-button upload-label">
          <Upload size={14} /> Import backup
          <input
            className="sr-only"
            type="file"
            accept=".json,application/json"
            onChange={upload}
          />
        </label>
      </div>
      <span>
        Back up regularly. Clearing browser data removes your journal.
      </span>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
