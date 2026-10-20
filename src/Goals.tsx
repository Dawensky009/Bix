import { useState, type FormEvent } from "react";
import { Target, Plus } from "lucide-react";
import {
  localDate,
  goalProgress,
  type Goal,
  type Broker,
  type Entry,
} from "./domain";
import { Modal, money } from "./ui";
function suggestedEnd(start: string, period: Goal["period"]): string {
  const date = new Date(`${start}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return "";
  if (period === "weekly") date.setUTCDate(date.getUTCDate() + 6);
  else {
    const day = date.getUTCDate();
    date.setUTCMonth(date.getUTCMonth() + 2, 0);
    date.setUTCDate(Math.min(day, date.getUTCDate()));
  }
  return date.getUTCFullYear() > 9999 ? "" : date.toISOString().slice(0, 10);
}
export function Goals({
  broker,
  goals,
  entries,
  onSave,
  onDelete,
  compact = false,
}: {
  broker: Broker;
  goals: Goal[];
  entries: Entry[];
  onSave: (goal: Goal) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const [period, setPeriod] = useState<Goal["period"]>("monthly");
  const [error, setError] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [customEnd, setCustomEnd] = useState(false);
  const today = localDate();
  const relevant = [...goals].sort((a, b) => b.start.localeCompare(a.start));
  const visible = compact
    ? relevant
        .filter(
          (g) => g.start <= today && goalProgress(g, entries).end >= today,
        )
        .slice(0, 2)
    : relevant;
  function open(g: Goal | "new") {
    setError("");
    setPeriod(g === "new" ? "monthly" : g.period);
    setStart(g === "new" ? today : g.start);
    setEnd(
      g === "new" ? suggestedEnd(today, "monthly") : goalProgress(g, []).end,
    );
    setCustomEnd(g !== "new");
    setEditing(g);
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      onSave({
        id: editing === "new" ? crypto.randomUUID() : (editing as Goal).id,
        brokerId: broker.id,
        period,
        start: String(f.get("start")),
        end: String(f.get("end")),
        target: Number(f.get("target")),
      });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  return (
    <section className="panel goals-panel">
      <div className="section-heading">
        <div>
          <h2>{compact ? "A goal to work toward" : "Performance goals"}</h2>
          <p>Progress, not pressure.</p>
        </div>
        <Target size={20} />
      </div>
      {visible.length ? (
        visible.map((goal) => {
          const progress = goalProgress(goal, entries);
          return (
            <article
              className="goal-item"
              data-testid="goal-progress"
              key={goal.id}
            >
              <div className="goal-top">
                <span className="tag">
                  {goal.period === "monthly" ? "Monthly" : "Weekly"} goal
                </span>
                <strong>{progress.percent.toFixed(1)}%</strong>
              </div>
              <h3>
                {money(progress.earned, broker.currency)}{" "}
                <small>/ {money(goal.target, broker.currency)}</small>
              </h3>
              <progress
                max={100}
                value={Math.max(0, Math.min(100, progress.percent))}
                aria-label={`${goal.period} goal progress`}
              />
              <p>
                {goal.start} → {progress.end}
              </p>
              <div className="goal-actions">
                <button className="text-button" onClick={() => open(goal)}>
                  Edit goal
                </button>
                {!compact && (
                  <button
                    className="text-button negative"
                    onClick={() => onDelete(goal.id)}
                  >
                    Delete goal
                  </button>
                )}
              </div>
            </article>
          );
        })
      ) : (
        <div className="small-empty">
          {compact
            ? "No active goal. Set a realistic target to give your progress direction."
            : "Set a weekly or monthly profit target for this account."}
        </div>
      )}
      <button className="secondary" onClick={() => open("new")}>
        <Plus size={15} /> Set goal
      </button>
      {editing && (
        <Modal
          title={
            editing === "new"
              ? "Set a performance goal"
              : "Edit performance goal"
          }
          close={() => setEditing(null)}
        >
          <p>
            Target net trading profit in {broker.currency}. Existing goals for
            the same period are replaced.
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={submit}>
            <label>
              Goal period
              <select
                autoFocus
                value={period}
                onChange={(e) => {
                  const next = e.target.value as Goal["period"];
                  setPeriod(next);
                  if (!customEnd) setEnd(suggestedEnd(start, next));
                }}
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <label>
              Start date
              <input
                name="start"
                type="date"
                required
                max="9999-12-31"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  if (!customEnd) setEnd(suggestedEnd(e.target.value, period));
                }}
              />
            </label>
            <label>
              End date
              <input
                name="end"
                type="date"
                required
                max="9999-12-31"
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value);
                  setCustomEnd(true);
                }}
              />
            </label>
            <small className="muted">
              Start and end dates are inclusive. Choose any date range.
            </small>
            <label>
              Profit target
              <input
                name="target"
                type="number"
                step="0.01"
                min="0.01"
                max="1000000000000"
                required
                defaultValue={editing === "new" ? "" : editing.target}
              />
            </label>
            <button className="primary" type="submit">
              Save goal
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
