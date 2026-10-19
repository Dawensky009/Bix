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
                onChange={(e) => setPeriod(e.target.value as Goal["period"])}
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <label>
              Start date
              <input
                key={period}
                name="start"
                type="date"
                required
                defaultValue={
                  editing === "new"
                    ? period === "monthly"
                      ? today.slice(0, 8) + "01"
                      : today
                    : editing.start
                }
              />
            </label>
            <small className="muted">
              {period === "monthly"
                ? "Use the first day of the calendar month."
                : "Covers seven calendar days, including the start date."}
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
