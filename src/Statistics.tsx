import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  BarChart2,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Flame,
  Target,
} from "lucide-react";
import { performance, type Entry, type Broker } from "./domain";
import { money } from "./ui";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

type Mode = "month" | "year";
type Scope = "active" | "all";

export function Statistics({
  entries,
  brokers,
  activeBrokerId,
}: {
  entries: Entry[];
  brokers: Broker[];
  activeBrokerId: string;
}) {
  const now = new Date();
  const [mode, setMode] = useState<Mode>("month");
  const [yr, setYr] = useState(now.getFullYear());
  const [mo, setMo] = useState(now.getMonth());
  const [scope, setScope] = useState<Scope>("active");

  const activeBroker = brokers.find((b) => b.id === activeBrokerId) ?? brokers[0];
  const currency = activeBroker?.currency ?? "USD";

  const scopedEntries = useMemo(
    () => (scope === "all" ? entries : entries.filter((e) => e.brokerId === activeBrokerId)),
    [entries, scope, activeBrokerId],
  );

  // Daily P&L map
  const dailyPnl = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of scopedEntries) {
      const p = performance(e.opening, e.closing, e.cashFlow);
      map[e.date] = (map[e.date] ?? 0) + p.pnl;
    }
    return map;
  }, [scopedEntries]);

  // Period-filtered entries
  const periodEntries = useMemo(() => {
    return scopedEntries.filter((e) => {
      const [y, m] = e.date.split("-").map(Number);
      return mode === "year" ? y === yr : y === yr && m - 1 === mo;
    });
  }, [scopedEntries, mode, yr, mo]);

  const pnlList = periodEntries.map((e) =>
    performance(e.opening, e.closing, e.cashFlow).pnl,
  );
  const totalPnl = pnlList.reduce((s, v) => s + v, 0);
  const wins = pnlList.filter((v) => v > 0).length;
  const losses = pnlList.filter((v) => v < 0).length;
  const winRate = pnlList.length ? (wins / pnlList.length) * 100 : 0;
  const bestDay = pnlList.length ? Math.max(...pnlList) : null;
  const worstDay = pnlList.length ? Math.min(...pnlList) : null;
  const avgDay = pnlList.length ? totalPnl / pnlList.length : null;

  // Streak
  const sortedDayKeys = Object.keys(dailyPnl).sort();
  let streak = 0;
  let streakType: "win" | "loss" | null = null;
  for (let i = sortedDayKeys.length - 1; i >= 0; i--) {
    const val = dailyPnl[sortedDayKeys[i]];
    const t: "win" | "loss" = val >= 0 ? "win" : "loss";
    if (streakType === null) { streakType = t; streak = 1; }
    else if (t === streakType) streak++;
    else break;
  }

  // Calendar (month mode)
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const firstDayOfWeek = new Date(yr, mo, 1).getDay();
  const maxDayAbs = Math.max(1, ...Object.values(dailyPnl).map(Math.abs));

  // Monthly aggregates for year bars
  const monthlyData = useMemo(() =>
    Array.from({ length: 12 }, (_, m) => {
      const ents = scopedEntries.filter((e) => {
        const [y, em] = e.date.split("-").map(Number);
        return y === yr && em - 1 === m;
      });
      const pnl = ents.reduce(
        (s, e) => s + performance(e.opening, e.closing, e.cashFlow).pnl,
        0,
      );
      const w = ents.filter((e) => performance(e.opening, e.closing, e.cashFlow).pnl > 0).length;
      return { month: m, pnl, days: ents.length, wins: w };
    }),
    [scopedEntries, yr],
  );
  const maxMonthAbs = Math.max(1, ...monthlyData.map((m) => Math.abs(m.pnl)));

  // Previous period comparison
  const prevPeriodEntries = useMemo(() => {
    return scopedEntries.filter((e) => {
      const [y, m] = e.date.split("-").map(Number);
      if (mode === "year") return y === yr - 1;
      const pm = mo === 0 ? 11 : mo - 1;
      const py = mo === 0 ? yr - 1 : yr;
      return y === py && m - 1 === pm;
    });
  }, [scopedEntries, mode, yr, mo]);
  const prevTotalPnl = prevPeriodEntries.reduce(
    (s, e) => s + performance(e.opening, e.closing, e.cashFlow).pnl,
    0,
  );
  const pnlDelta = pnlList.length || prevPeriodEntries.length
    ? totalPnl - prevTotalPnl
    : null;

  function prevPeriod() {
    if (mode === "month") {
      if (mo === 0) { setYr((y) => y - 1); setMo(11); }
      else setMo((m) => m - 1);
    } else setYr((y) => y - 1);
  }
  function nextPeriod() {
    if (mode === "month") {
      if (mo === 11) { setYr((y) => y + 1); setMo(0); }
      else setMo((m) => m + 1);
    } else setYr((y) => y + 1);
  }

  function cellBg(pnl: number) {
    const intensity = Math.min(Math.abs(pnl) / maxDayAbs, 1);
    if (pnl > 0) return `rgba(105,223,177,${0.12 + intensity * 0.72})`;
    return `rgba(255,155,155,${0.12 + intensity * 0.72})`;
  }

  return (
    <div className="stats-page">
      {/* Top controls */}
      <div className="stats-controls">
        <div className="mode-tabs">
          <button
            className={`mode-tab${mode === "month" ? " active" : ""}`}
            onClick={() => setMode("month")}
          >
            <CalendarDays size={13} /> Monthly
          </button>
          <button
            className={`mode-tab${mode === "year" ? " active" : ""}`}
            onClick={() => setMode("year")}
          >
            <BarChart2 size={13} /> Yearly
          </button>
        </div>

        <div className="period-nav">
          <button className="icon-button" onClick={prevPeriod} aria-label="Previous period">
            <ChevronLeft size={16} />
          </button>
          <span className="period-label">
            {mode === "month" ? `${MONTHS[mo]} ${yr}` : String(yr)}
          </span>
          <button className="icon-button" onClick={nextPeriod} aria-label="Next period">
            <ChevronRight size={16} />
          </button>
        </div>

        {brokers.length > 1 && (
          <div className="scope-tabs">
            <button
              className={`mode-tab${scope === "active" ? " active" : ""}`}
              onClick={() => setScope("active")}
            >
              {activeBroker?.name ?? "Active"}
            </button>
            <button
              className={`mode-tab${scope === "all" ? " active" : ""}`}
              onClick={() => setScope("all")}
            >
              All brokers
            </button>
          </div>
        )}
      </div>

      {/* KPI row */}
      <div className="stats-kpis">
        <div className="kpi-card kpi-featured">
          <div className={`kpi-icon ${totalPnl >= 0 ? "kpi-pos" : "kpi-neg"}`}>
            {totalPnl >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
          </div>
          <span className="kpi-label">Net P&L</span>
          <strong className={`kpi-val ${totalPnl > 0 ? "positive" : totalPnl < 0 ? "negative" : ""}`}>
            {money(totalPnl, currency)}
          </strong>
          {pnlDelta !== null && (
            <small className={`kpi-delta ${pnlDelta >= 0 ? "positive" : "negative"}`}>
              {pnlDelta >= 0 ? "▲" : "▼"} {money(Math.abs(pnlDelta), currency)} vs prior
            </small>
          )}
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-accent">
            <Activity size={15} />
          </div>
          <span className="kpi-label">Win rate</span>
          <strong className="kpi-val">
            {pnlList.length ? winRate.toFixed(0) + "%" : "—"}
          </strong>
          <small className="kpi-sub">{wins}W · {losses}L · {pnlList.length} days</small>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-pos">
            <Target size={15} />
          </div>
          <span className="kpi-label">Best day</span>
          <strong className={`kpi-val ${bestDay != null && bestDay > 0 ? "positive" : ""}`}>
            {bestDay != null ? money(bestDay, currency) : "—"}
          </strong>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-neg">
            <TrendingDown size={15} />
          </div>
          <span className="kpi-label">Worst day</span>
          <strong className={`kpi-val ${worstDay != null && worstDay < 0 ? "negative" : ""}`}>
            {worstDay != null ? money(worstDay, currency) : "—"}
          </strong>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon kpi-violet">
            <Zap size={15} />
          </div>
          <span className="kpi-label">Daily avg</span>
          <strong className={`kpi-val ${avgDay != null && avgDay > 0 ? "positive" : avgDay != null && avgDay < 0 ? "negative" : ""}`}>
            {avgDay != null ? money(avgDay, currency) : "—"}
          </strong>
        </div>

        {streak > 1 && (
          <div className={`kpi-card kpi-streak ${streakType === "win" ? "kpi-streak-win" : "kpi-streak-loss"}`}>
            <div className={`kpi-icon ${streakType === "win" ? "kpi-pos" : "kpi-neg"}`}>
              <Flame size={15} />
            </div>
            <span className="kpi-label">Streak</span>
            <strong className={`kpi-val ${streakType === "win" ? "positive" : "negative"}`}>
              {streak} {streakType === "win" ? "wins" : "losses"}
            </strong>
          </div>
        )}
      </div>

      {/* Monthly calendar */}
      {mode === "month" && (
        <div className="panel cal-panel">
          <div className="section-heading">
            <div>
              <h2>Daily P&L calendar</h2>
              <p>
                {MONTHS[mo]} {yr} · {pnlList.length} trading{" "}
                {pnlList.length === 1 ? "day" : "days"} · hover for details
              </p>
            </div>
            <div className="cal-legend">
              <span className="cal-legend-item">
                <span className="cal-dot cal-dot-none" /> No trade
              </span>
              <span className="cal-legend-item">
                <span className="cal-dot cal-dot-win" /> Profit
              </span>
              <span className="cal-legend-item">
                <span className="cal-dot cal-dot-loss" /> Loss
              </span>
            </div>
          </div>

          <div className="cal-grid">
            {DAYS_SHORT.map((d) => (
              <div key={d} className="cal-hdr">{d}</div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`blank-${i}`} className="cal-blank" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const pnl = dailyPnl[date];
              const hasTrade = pnl !== undefined;
              return (
                <div
                  key={date}
                  className={`cal-day${hasTrade ? (pnl >= 0 ? " cal-day-win" : " cal-day-loss") : ""}`}
                  style={hasTrade ? { background: cellBg(pnl) } : undefined}
                  title={hasTrade ? `${date}: ${money(pnl, currency)}` : date}
                >
                  <span className="cal-num">{day}</span>
                  {hasTrade && (
                    <span className={`cal-pnl ${pnl >= 0 ? "positive" : "negative"}`}>
                      {pnl > 0 ? "+" : ""}
                      {pnl.toFixed(0)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Year bars */}
      {mode === "year" && (
        <div className="panel year-panel">
          <div className="section-heading">
            <div>
              <h2>Monthly P&L — {yr}</h2>
              <p>Click a bar to open that month's calendar</p>
            </div>
          </div>
          <div className="month-bars">
            {monthlyData.map((m) => {
              const h = m.days > 0 ? Math.max((Math.abs(m.pnl) / maxMonthAbs) * 100, 5) : 0;
              const isPos = m.pnl >= 0;
              return (
                <button
                  key={m.month}
                  className="mbar-wrap"
                  onClick={() => { setMode("month"); setMo(m.month); }}
                  title={`${MONTHS[m.month]}: ${m.days > 0 ? money(m.pnl, currency) : "no data"}`}
                  aria-label={`${MONTHS[m.month]} ${yr}`}
                >
                  <span className={`mbar-val ${m.pnl > 0 ? "positive" : m.pnl < 0 ? "negative" : ""}`}>
                    {m.days > 0 ? (m.pnl > 0 ? "+" : "") + m.pnl.toFixed(0) : ""}
                  </span>
                  <div className="mbar-track">
                    <div
                      className={`mbar-fill ${isPos ? "mbar-pos" : "mbar-neg"}`}
                      style={{ height: `${h}%` }}
                    />
                  </div>
                  <span className="mbar-lbl">{MONTHS[m.month].slice(0, 3)}</span>
                  {m.days > 0 && (
                    <span className="mbar-days">{m.days}d</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Yearly summary table */}
          {monthlyData.some((m) => m.days > 0) && (
            <div className="year-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Trading days</th>
                    <th>Win rate</th>
                    <th>Net P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData
                    .filter((m) => m.days > 0)
                    .map((m) => (
                      <tr
                        key={m.month}
                        style={{ cursor: "pointer" }}
                        onClick={() => { setMode("month"); setMo(m.month); }}
                      >
                        <td>
                          <strong>{MONTHS[m.month]}</strong>
                        </td>
                        <td>{m.days}</td>
                        <td>{m.days ? ((m.wins / m.days) * 100).toFixed(0) + "%" : "—"}</td>
                        <td className={m.pnl > 0 ? "positive" : m.pnl < 0 ? "negative" : ""}>
                          {money(m.pnl, currency)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
