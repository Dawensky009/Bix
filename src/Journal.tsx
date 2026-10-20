import { useState, type FormEvent } from "react";
import { Pencil, Trash2, BookOpen } from "lucide-react";
import { localDate, performance, type Broker, type Entry } from "./domain";
import { Modal, money, pct } from "./ui";
export function EntryForm({
  broker,
  entry,
  opening,
  onSave,
  close,
}: {
  broker: Broker;
  entry: Entry | null;
  opening: number;
  onSave: (entry: Entry) => void;
  close: () => void;
}) {
  const [error, setError] = useState("");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      onSave({
        id: entry?.id ?? crypto.randomUUID(),
        brokerId: broker.id,
        date: String(f.get("date")),
        opening: Number(f.get("opening")),
        closing: Number(f.get("closing")),
        cashFlow: Number(f.get("cashFlow")),
        note: String(f.get("note")),
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  return (
    <Modal title={entry ? "Edit daily entry" : "New daily entry"} close={close}>
      <p>
        {broker.name} · {broker.currency}. One entry per trading day.
      </p>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <form onSubmit={submit}>
        <label>
          Entry date
          <input
            autoFocus
            name="date"
            type="date"
            required
            max={localDate()}
            defaultValue={entry?.date ?? localDate()}
          />
        </label>
        <div className="form-grid">
          <label>
            Opening balance
            <input
              name="opening"
              type="number"
              min="0"
              max="1000000000000"
              step="0.01"
              required
              defaultValue={entry?.opening ?? opening}
            />
          </label>
          <label>
            Closing balance
            <input
              name="closing"
              type="number"
              min="0"
              max="1000000000000"
              step="0.01"
              required
              defaultValue={entry?.closing ?? ""}
            />
          </label>
        </div>
        <label>
          Net deposits / withdrawals
          <input
            name="cashFlow"
            type="number"
            min="-1000000000000"
            max="1000000000000"
            step="0.01"
            required
            defaultValue={entry?.cashFlow ?? 0}
          />
        </label>
        <small className="muted">
          Positive for deposits, negative for withdrawals. Excluded from P&L.
        </small>
        <label>
          Trading notes
          <textarea
            name="note"
            maxLength={500}
            placeholder="What did you learn today?"
            defaultValue={entry?.note ?? ""}
          />
        </label>
        <button type="submit" className="primary">
          Save entry
        </button>
      </form>
    </Modal>
  );
}
export function Journal({
  entries,
  currency,
  onEdit,
  onDelete,
  compact = false,
}: {
  entries: Entry[];
  currency: string;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
  compact?: boolean;
}) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="panel journal">
      <div className="section-heading">
        <div>
          <h2>{compact ? "Recent activity" : "Daily journal"}</h2>
          <p>
            {entries.length} recorded trading{" "}
            {entries.length === 1 ? "day" : "days"}
          </p>
        </div>
        <BookOpen size={19} />
      </div>
      {!entries.length ? (
        <div className="small-empty">
          No entries yet. Log a trading day to start your journal.
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date / notes</th>
                <th>Opening</th>
                <th>Closing</th>
                <th>Cash flow</th>
                <th>Net P&L</th>
                <th>Return</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(compact ? sorted.slice(0, 5) : sorted).map((e) => {
                const p = performance(e.opening, e.closing, e.cashFlow);
                return (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.date}</strong>
                      {e.note && (
                        <small className="entry-note" title={e.note}>
                          {e.note}
                        </small>
                      )}
                    </td>
                    <td>{money(e.opening, currency)}</td>
                    <td>{money(e.closing, currency)}</td>
                    <td>{money(e.cashFlow, currency)}</td>
                    <td className={p.pnl < 0 ? "negative" : "positive"}>
                      {money(p.pnl, currency)}
                    </td>
                    <td>
                      <span
                        className={`return-pill ${p.pnl < 0 ? "negative" : "positive"}`}
                      >
                        {pct(p.percent)}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          aria-label={`Edit entry ${e.date}`}
                          onClick={() => onEdit(e)}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Delete entry ${e.date}`}
                          onClick={() => onDelete(e)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
export function BalanceChart({
  entries,
  initialBalance,
  currency,
}: {
  entries: Entry[];
  initialBalance: number;
  currency: string;
}) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const values = [initialBalance, ...sorted.map((e) => e.closing)];
  const min = Math.min(...values),
    max = Math.max(...values);
  const range = max - min || Math.max(max * 0.1, 1);
  const points = values
    .map(
      (v, i) =>
        `${40 + (i * 660) / Math.max(values.length - 1, 1)},${170 - ((v - min) * 130) / range}`,
    )
    .join(" ");
  return (
    <section className="panel chart-panel">
      <div className="section-heading">
        <div>
          <h2>Balance over time</h2>
          <p>Account equity · includes deposits and withdrawals</p>
        </div>
        <span className="tag">All time</span>
      </div>
      {entries.length ? (
        <>
          <svg
            className="balance-chart"
            viewBox="0 0 740 210"
            role="img"
            aria-label={`Balance from ${money(initialBalance, currency)} to ${money(values.at(-1)!, currency)}`}
          >
            <defs>
              <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity=".22" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[40, 105, 170].map((y) => (
              <line
                key={y}
                x1="40"
                y1={y}
                x2="700"
                y2={y}
                stroke="var(--border)"
                strokeDasharray="4 5"
              />
            ))}
            <polygon
              points={`40,180 ${points} 700,180`}
              fill="url(#chart-fill)"
            />
            <polyline
              points={points}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <text x="40" y="204">
              Start
            </text>
            <text x="700" y="204" textAnchor="end">
              {sorted.at(-1)?.date}
            </text>
            <text x="40" y="20">
              {money(max, currency)}
            </text>
          </svg>
        </>
      ) : (
        <div className="chart-placeholder">
          <span>Your story is still unwritten.</span>
          <p>Your balance chart appears after your first entry.</p>
        </div>
      )}
    </section>
  );
}
