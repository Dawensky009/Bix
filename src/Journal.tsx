import { useState, type FormEvent } from "react";
import { Pencil, Trash2, BookOpen, ArrowDownLeft, ArrowUpRight as ArrowUpRightIcon } from "lucide-react";
import { localDate, performance, type Broker, type Entry, type Transaction } from "./domain";
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
type JournalRow =
  | { kind: "entry"; date: string; entry: Entry }
  | { kind: "tx"; date: string; tx: Transaction };

export function Journal({
  entries,
  transactions = [],
  currency,
  onEdit,
  onDelete,
  onEditTx,
  onDeleteTx,
  compact = false,
}: {
  entries: Entry[];
  transactions?: Transaction[];
  currency: string;
  onEdit: (entry: Entry) => void;
  onDelete: (entry: Entry) => void;
  onEditTx?: (tx: Transaction) => void;
  onDeleteTx?: (tx: Transaction) => void;
  compact?: boolean;
}) {
  // Merge entries and transactions into a single timeline, newest first
  const rows: JournalRow[] = [
    ...entries.map((e) => ({ kind: "entry" as const, date: e.date, entry: e })),
    ...transactions.map((t) => ({ kind: "tx" as const, date: t.date, tx: t })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const visible = compact ? rows.slice(0, 6) : rows;
  const totalEntries = entries.length;
  const totalTxs = transactions.length;

  return (
    <section className="panel journal">
      <div className="section-heading">
        <div>
          <h2>{compact ? "Recent activity" : "Daily journal"}</h2>
          <p>
            {totalEntries} trading {totalEntries === 1 ? "day" : "days"}
            {totalTxs > 0
              ? ` · ${totalTxs} ${totalTxs === 1 ? "transaction" : "transactions"}`
              : ""}
          </p>
        </div>
        <BookOpen size={19} />
      </div>

      {!rows.length ? (
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
              {visible.map((row) => {
                if (row.kind === "tx") {
                  const { tx } = row;
                  const isDeposit = tx.amount >= 0;
                  return (
                    <tr key={tx.id} className="tx-row">
                      <td>
                        <div className="tx-row-date">
                          <span
                            className={`tx-badge ${isDeposit ? "tx-deposit" : "tx-withdrawal"}`}
                          >
                            {isDeposit ? (
                              <ArrowUpRightIcon size={11} />
                            ) : (
                              <ArrowDownLeft size={11} />
                            )}
                            {isDeposit ? "Deposit" : "Withdrawal"}
                          </span>
                          <strong>{tx.date}</strong>
                        </div>
                        {tx.note && (
                          <small className="entry-note" title={tx.note}>
                            {tx.note}
                          </small>
                        )}
                      </td>
                      <td className="tx-empty">—</td>
                      <td className="tx-empty">—</td>
                      <td className="tx-empty">—</td>
                      <td
                        className={isDeposit ? "positive" : "negative"}
                        style={{ fontWeight: 600 }}
                      >
                        {isDeposit ? "+" : ""}
                        {money(tx.amount, currency)}
                      </td>
                      <td className="tx-empty">—</td>
                      <td>
                        <div className="row-actions">
                          {onEditTx && (
                            <button
                              className="icon-button"
                              aria-label={`Edit transaction ${tx.date}`}
                              onClick={() => onEditTx(tx)}
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {onDeleteTx && (
                            <button
                              className="icon-button"
                              aria-label={`Delete transaction ${tx.date}`}
                              onClick={() => onDeleteTx(tx)}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }

                const { entry: e } = row;
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
                    <td>
                      {e.cashFlow !== 0 ? money(e.cashFlow, currency) : "—"}
                    </td>
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
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = (rawMax - rawMin) * 0.08 || rawMax * 0.05 || 1;
  const min = rawMin - pad;
  const max = rawMax + pad;
  const range = max - min;

  // Chart area: x 56→700, y 12→172
  const X0 = 56, X1 = 700, Y0 = 12, Y1 = 172;
  const W = X1 - X0;
  const H = Y1 - Y0;

  function cx(i: number) {
    return X0 + (i * W) / Math.max(values.length - 1, 1);
  }
  function cy(v: number) {
    return Y0 + H - ((v - min) * H) / range;
  }

  const points = values.map((v, i) => `${cx(i)},${cy(v)}`).join(" ");
  const lastX = cx(values.length - 1);
  const lastY = cy(values[values.length - 1]);
  const lastVal = values[values.length - 1];
  const change = lastVal - initialBalance;
  const changePct = initialBalance !== 0 ? (change / initialBalance) * 100 : 0;

  // Y-axis ticks
  const yTicks = [rawMax, (rawMax + rawMin) / 2, rawMin];

  // X-axis: first and last date
  const firstDate = sorted[0]?.date ?? "";
  const lastDate = sorted.at(-1)?.date ?? "";

  // High watermark
  const hwIdx = values.indexOf(rawMax);
  const hwX = cx(hwIdx);
  const hwY = cy(rawMax);

  return (
    <section className="panel chart-panel">
      <div className="section-heading">
        <div>
          <h2>Balance over time</h2>
          <p>Account equity · {sorted.length} {sorted.length === 1 ? "entry" : "entries"}</p>
        </div>
        <div className="chart-header-right">
          <span
            className={`chart-change-badge ${change >= 0 ? "positive" : "negative"}`}
          >
            {change >= 0 ? "▲" : "▼"} {changePct >= 0 ? "+" : ""}
            {changePct.toFixed(1)}%
          </span>
          <span className="tag">All time</span>
        </div>
      </div>
      {entries.length ? (
        <svg
          className="balance-chart"
          viewBox="0 0 740 210"
          role="img"
          aria-label={`Balance from ${money(initialBalance, currency)} to ${money(lastVal, currency)}`}
        >
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity=".3" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="pulse-ring" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity=".5" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Y-axis grid lines + labels */}
          {yTicks.map((v, i) => {
            const y = cy(v);
            return (
              <g key={i}>
                <line
                  x1={X0}
                  y1={y}
                  x2={X1}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="3 6"
                  strokeWidth="1"
                />
                <text
                  x={X0 - 6}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--muted)"
                >
                  {money(v, currency).replace(/\.00$/, "")}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <polygon
            points={`${X0},${Y1} ${points} ${X1},${Y1}`}
            fill="url(#chart-fill)"
          />

          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* High watermark marker (if not the last point) */}
          {hwIdx !== values.length - 1 && hwIdx !== 0 && (
            <g>
              <line
                x1={hwX}
                y1={hwY - 6}
                x2={hwX}
                y2={hwY + 12}
                stroke="var(--positive)"
                strokeWidth="1"
                strokeDasharray="2 3"
                opacity=".6"
              />
              <text
                x={hwX + 4}
                y={hwY - 2}
                fontSize="9"
                fill="var(--positive)"
                opacity=".8"
              >
                HWM
              </text>
            </g>
          )}

          {/* Dots on first and last */}
          <circle cx={X0} cy={cy(initialBalance)} r="3" fill="var(--muted)" />
          <circle
            cx={lastX}
            cy={lastY}
            r="5"
            fill="var(--accent)"
            stroke="var(--surface)"
            strokeWidth="2"
          />
          {/* Pulse ring on last point */}
          <circle
            cx={lastX}
            cy={lastY}
            r="10"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1"
            opacity=".35"
          />

          {/* X-axis labels */}
          {firstDate && (
            <text x={X0} y="198" fontSize="10" fill="var(--muted)">
              {firstDate}
            </text>
          )}
          {lastDate && lastDate !== firstDate && (
            <text x={X1} y="198" textAnchor="end" fontSize="10" fill="var(--muted)">
              {lastDate}
            </text>
          )}
        </svg>
      ) : (
        <div className="chart-placeholder">
          <span>Your story is still unwritten.</span>
          <p>Your balance chart appears after your first entry.</p>
        </div>
      )}
    </section>
  );
}
