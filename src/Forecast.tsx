import { useState } from "react";
import { TrendingUp, Info } from "lucide-react";
import {
  forecast,
  goalProgress,
  localDate,
  type Entry,
  type Broker,
  type Goal,
} from "./domain";
import { money, pct } from "./ui";
export function Forecast({
  broker,
  entries,
  goals,
}: {
  broker: Broker;
  entries: Entry[];
  goals: Goal[];
}) {
  const [sessions, setSessions] = useState("20");
  const [targetRate, setTargetRate] = useState("1");
  const balance =
    [...entries].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.closing ??
    broker.initialBalance;
  let projection: ReturnType<typeof forecast> | null = null;
  let error = "";
  try {
    projection = forecast(entries, broker.initialBalance, Number(sessions));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const rate = Number(targetRate);
  const scenario = balance * (1 + rate / 100) ** Number(sessions);
  const validScenario =
    targetRate !== "" &&
    Number.isFinite(rate) &&
    rate >= -100 &&
    rate <= 100 &&
    Number.isFinite(scenario) &&
    !error;
  const active = goals.filter(
    (g) =>
      g.start <= localDate() && goalProgress(g, entries).end >= localDate(),
  );
  return (
    <section className="panel forecast-panel">
      <div className="section-heading">
        <div>
          <h2>Explore what comes next</h2>
          <p>Two scenarios. No guarantees.</p>
        </div>
        <TrendingUp size={21} />
      </div>
      <div className="forecast-controls">
        <label>
          Future trading sessions
          <input
            type="number"
            min="1"
            max="365"
            step="1"
            value={sessions}
            onChange={(e) => setSessions(e.target.value)}
          />
        </label>
        <label>
          Hypothetical return per session (%)
          <input
            type="number"
            min="-100"
            max="100"
            step="0.1"
            value={targetRate}
            onChange={(e) => setTargetRate(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <div className="forecast-results">
        <article>
          <span>History-based balance</span>
          <h2 data-testid="projected-balance">
            {projection?.rate != null
              ? money(projection.balance, broker.currency)
              : "—"}
          </h2>
          <p>
            {projection?.rate != null
              ? `${pct(projection.rate * 100)} geometric mean per recorded session.`
              : "Record at least two days with usable returns to calculate a projection."}
          </p>
        </article>
        <article>
          <span>Your hypothetical scenario</span>
          <h2>{validScenario ? money(scenario, broker.currency) : "—"}</h2>
          <p>
            Starting at {money(balance, broker.currency)}. Assumes a constant
            return and no future cash flows.
          </p>
        </article>
      </div>
      {active.length > 0 && (
        <div className="goal-comparison">
          <h3>Your active targets</h3>
          {active.map((g) => {
            const p = goalProgress(g, entries);
            return (
              <p key={g.id}>
                {g.period === "weekly" ? "Weekly" : "Monthly"} ·{" "}
                {money(Math.max(0, g.target - p.earned), broker.currency)} net
                profit remaining by {p.end}.
              </p>
            );
          })}
        </div>
      )}
      <div className="forecast-note">
        <Info size={20} />
        <div>
          <strong>Not a prediction or a promise.</strong>
          <p>
            History-based projections compound past daily returns, excluding
            cash flows. Zero-opening days and returns below −100% are excluded.
            Session counts are not calendar dates. Hypothetical scenarios do not
            model volatility, future fees or changing risk. Past performance
            does not predict future results. Not financial advice.
          </p>
        </div>
      </div>
    </section>
  );
}
