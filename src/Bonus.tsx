import { useState } from "react";
import {
  bonusSummary,
  localDate,
  performance,
  type Broker,
  type Entry,
  type Transaction,
} from "./domain";
import { money } from "./ui";

export function BonusOverview({
  broker,
  entries,
  transactions,
}: {
  broker: Broker;
  entries: Entry[];
  transactions: Transaction[];
}) {
  const b = bonusSummary(broker, entries, transactions);
  const fmt = (n: number) => money(n, broker.currency);
  const pnl = entries.reduce(
    (s, e) => s + performance(e.opening, e.closing, e.cashFlow).pnl,
    0,
  );
  return (
    <section className="account-overview" aria-label="Account and bonus">
      <div className="balance-ledger">
        <div className="balance-free">
          <h2>
            {b.status === "active" &&
            b.principal > 0 &&
            b.profitSource === "estimated"
              ? "Estimated free balance"
              : "Free balance"}
          </h2>
          <strong data-testid="free-balance">{fmt(b.free)}</strong>
          <p>
            Excludes active bonus principal and bonus profit.
            <br />
            Not a withdrawal guarantee; broker rules still apply.
          </p>
        </div>
        <dl className="balance-breakdown">
          <div>
            <dt>Total balance</dt>
            <dd data-testid="total-balance">{fmt(b.total)}</dd>
          </div>
          <div>
            <dt>Active bonus principal</dt>
            <dd>{fmt(b.status === "active" ? b.principal : 0)}</dd>
          </div>
          <div>
            <dt>
              {b.profitSource === "estimated"
                ? "Estimated bonus profit"
                : "Broker-reported bonus profit"}
              {b.status !== "active" ? " (historical)" : ""}
            </dt>
            <dd>{fmt(b.profit)}</dd>
          </div>
          <div>
            <dt>Recorded trading P&L</dt>
            <dd className={pnl < 0 ? "negative" : pnl > 0 ? "positive" : ""}>
              {fmt(pnl)}
            </dd>
          </div>
        </dl>
      </div>
      <div className="bonus-track" data-testid="bonus-progress">
        <div className="section-heading">
          <h2>Bonus progress</h2>
          <span className="tag">
            {b.principal === 0
              ? "No bonus"
              : b.status === "released"
                ? "Released"
                : b.status === "cancelled"
                  ? "Cancelled"
                  : "Active"}
          </span>
        </div>
        {b.principal > 0 ? (
          <>
            <div className="turnover-reading">
              <strong>{fmt(b.netTurnover)}</strong>
              <span> / {fmt(b.required)}</span>
            </div>
            <p>Cumulative net turnover · copied from broker</p>
            <progress
              aria-label="Bonus turnover progress"
              max="100"
              value={b.percent}
            />
            <div className="turnover-footer">
              <span>{b.percent.toFixed(1)}% recorded</span>
              <span>
                {fmt(Math.max(0, b.required - b.netTurnover))} remaining
              </span>
            </div>
            <p className="bonus-guidance">
              {b.status !== "active"
                ? `Broker confirmed ${b.status}. Historical figures are retained.`
                : b.percent >= 100
                  ? "Broker confirmation required. Reaching the turnover goal does not release your bonus."
                  : "Bonus profit is estimated by default. Override it with the broker’s cumulative reading in your next entry."}
            </p>
          </>
        ) : (
          <p>
            No bonus is attached to this account. Your total balance is also
            your free balance.
          </p>
        )}
      </div>
    </section>
  );
}

export function BrokerFields({ broker }: { broker?: Broker }) {
  const [currency, setCurrency] = useState(broker?.currency ?? "USD");
  const [deposit, setDeposit] = useState(
    broker?.ownDeposit ?? broker?.initialBalance ?? 0,
  );
  const [percent, setPercent] = useState(broker?.bonusPercent ?? 0);
  return (
    <>
      <label>
        Currency
        <select
          name="currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Broker["currency"])}
        >
          <option>USD</option>
          <option>EUR</option>
          <option>HTG</option>
        </select>
      </label>
      <div className="form-grid">
        <label>
          Your deposit
          <input
            name="ownDeposit"
            type="number"
            min="0"
            max="1000000000000"
            step="0.01"
            required
            value={deposit}
            onChange={(e) => setDeposit(Number(e.target.value))}
          />
        </label>
        <label>
          Bonus percentage
          <input
            name="bonusPercent"
            type="number"
            min="0"
            step="0.01"
            required
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
          />
        </label>
      </div>
      <label>
        Required turnover
        <input
          name="turnoverRequired"
          type="number"
          min={percent > 0 ? "0.01" : "0"}
          step="0.01"
          required={percent > 0}
          defaultValue={broker?.turnoverRequired ?? 0}
        />
      </label>
      <div className="initial-total">
        <span>Calculated initial total</span>
        <output aria-label="Calculated initial total">
          {money(deposit * (1 + percent / 100), currency)}
        </output>
      </div>
      <details open={broker?.currentBalance !== undefined}>
        <summary>Already trading on this account?</summary>
        <p>
          Use the current broker snapshot as your starting point. Earlier gains
          are not invented or added to your journal P&L.
        </p>
        <label>
          Current broker balance
          <input
            name="currentBalance"
            type="number"
            min="0"
            step="0.01"
            defaultValue={broker?.currentBalance ?? ""}
          />
        </label>
        <label>
          Initial cumulative net turnover
          <input
            name="initialNetTurnover"
            type="number"
            min="0"
            step="0.01"
            defaultValue={broker?.initialNetTurnover ?? 0}
          />
        </label>
        <label>
          Snapshot date
          <input
            name="baselineDate"
            type="date"
            max={localDate()}
            defaultValue={broker?.baselineDate ?? ""}
            aria-describedby="snapshot-help"
          />
        </label>
        <p id="snapshot-help">
          End of day: this balance and these readings include all activity
          through the snapshot date. New entries and transactions must be later.
          Older imported history is retained in backups but excluded from
          calculations. A date is required for a new or changed balance
          snapshot. Legacy undated snapshots keep all-history calculations until
          you add a date.
        </p>
        <label>
          Initial broker bonus profit
          <input
            name="initialBonusProfit"
            type="number"
            step="0.01"
            defaultValue={broker?.initialBonusProfit ?? 0}
          />
        </label>
      </details>
    </>
  );
}
