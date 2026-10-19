import { useState, useRef, type FormEvent } from "react";
import {
  Plus,
  LayoutDashboard,
  BookOpen,
  Target,
  TrendingUp,
  Wallet,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import {
  emptyState,
  saveBroker,
  saveEntry,
  deleteEntry,
  deleteBroker,
  saveGoal,
  performance,
  type Entry,
  type Broker,
  type State,
} from "./domain";
import { EntryForm, Journal, BalanceChart } from "./Journal";
import { Goals } from "./Goals";
import { Forecast } from "./Forecast";
import { loadState, persistState, STORAGE_KEY } from "./storage";
import { Modal } from "./ui";
import { Backup } from "./Backup";

type View = "Overview" | "Daily journal" | "Goals" | "Forecast";
const money = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
const uid = () => crypto.randomUUID();
function initial() {
  try {
    return { state: loadState(localStorage), error: "" };
  } catch (e) {
    return { state: emptyState, error: String(e) };
  }
}
export default function App() {
  const [boot, setBoot] = useState(initial);
  const rawSnapshot = useRef<string | null | undefined>(undefined);
  if (rawSnapshot.current === undefined) {
    try {
      rawSnapshot.current = localStorage.getItem(STORAGE_KEY);
    } catch {
      rawSnapshot.current = null;
    }
  }
  const [state, setState] = useState<State>(boot.state);
  const [error, setError] = useState(boot.error);
  const [view, setView] = useState<View>("Overview");
  const [activeId, setActiveId] = useState(state.brokers[0]?.id ?? "");
  const [brokerModal, setBrokerModal] = useState<Broker | "new" | null>(null);
  const broker =
    state.brokers.find((b) => b.id === activeId) ?? state.brokers[0];
  const currency = broker?.currency ?? "USD";
  const [entryModal, setEntryModal] = useState<Entry | "new" | null>(null);
  const entries = state.entries
    .filter((e) => e.brokerId === broker?.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const balance = entries.at(-1)?.closing ?? broker?.initialBalance ?? 0;
  const pnl = entries.reduce(
    (sum, e) => sum + performance(e.opening, e.closing, e.cashFlow).pnl,
    0,
  );
  const wins = entries.filter(
    (e) => performance(e.opening, e.closing, e.cashFlow).pnl > 0,
  ).length;
  const removeEntry = (entry: Entry) => {
    if (
      window.confirm(
        `Delete the entry for ${entry.date}? This cannot be undone.`,
      )
    )
      attempt(() => commit(deleteEntry(state, entry.id)));
  };

  function commit(next: State, recovering = false) {
    if (boot.error && !recovering)
      throw new Error(
        "Stored data could not be read. Export the raw backup, then import a valid backup to recover.",
      );
    if (localStorage.getItem(STORAGE_KEY) !== rawSnapshot.current)
      throw new Error(
        "Data changed in another tab. Reload before saving to avoid overwriting it.",
      );
    persistState(localStorage, next);
    rawSnapshot.current = localStorage.getItem(STORAGE_KEY);
    setState(next);
    setError("");
    if (recovering) setBoot({ state: next, error: "" });
  }
  function attempt(action: () => void) {
    try {
      action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  function onBroker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    attempt(() => {
      const b: Broker = {
        id: brokerModal === "new" ? uid() : (brokerModal as Broker).id,
        name: String(data.get("name")),
        currency: String(data.get("currency")) as Broker["currency"],
        initialBalance: Number(data.get("initialBalance")),
      };
      commit(saveBroker(state, b));
      setActiveId(b.id);
      setBrokerModal(null);
    });
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          aria-label="BIX home"
          onClick={() => setView("Overview")}
        >
          <span className="brand-mark">b.</span>BIX
          <span className="brand-dot">●</span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {(
            [
              { label: "Overview", icon: LayoutDashboard },
              { label: "Daily journal", icon: BookOpen },
              { label: "Goals", icon: Target },
              { label: "Forecast", icon: TrendingUp },
            ] as const
          ).map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={view === label ? "nav-item active" : "nav-item"}
              onClick={() => setView(label)}
            >
              <Icon size={19} />
              {label}
              {view === label && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={22} />
            <strong>Just you. Your data.</strong>
            <p>
              Stored on this device.
              <br />
              No broker credentials needed.
            </p>
          </div>
          <div className="profile">
            <span className="avatar">B</span>
            <div>
              <strong>Personal workspace</strong>
              <small>Local-first edition</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>
            <strong>{view}</strong>
          </div>
          <div className="account-picker">
            <Wallet size={17} />
            <select
              aria-label="Active broker"
              value={broker?.id ?? ""}
              onChange={(e) => setActiveId(e.target.value)}
            >
              {!state.brokers.length && <option value="">No broker yet</option>}
              {state.brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.currency}
                </option>
              ))}
            </select>
            <button
              className="icon-button"
              aria-label="Add broker"
              title="Add broker"
              onClick={() => setBrokerModal("new")}
            >
              <Plus size={18} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <h1>{view === "Overview" ? "Your edge starts here." : view}</h1>
              <p>A clear picture of your trading. One day at a time.</p>
            </div>
            <button
              className="primary"
              disabled={!broker}
              onClick={() => setEntryModal("new")}
            >
              <Plus size={17} /> New entry
            </button>
          </div>
          {error && !brokerModal && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <section className="metrics">
            <article className="metric">
              <span>
                Account balance <Wallet size={17} />
              </span>
              <h2>{money(balance, currency)}</h2>
              <small>
                {entries.length ? "Latest closing balance" : "Starting capital"}
              </small>
            </article>
            <article className="metric">
              <span>
                Net profit & loss <ArrowUpRight size={17} />
              </span>
              <h2 className={pnl < 0 ? "negative" : "positive"}>
                {money(pnl, currency)}
              </h2>
              <small>All time · excluding cash flows</small>
            </article>
            <article className="metric">
              <span>
                Winning days <TrendingUp size={17} />
              </span>
              <h2>
                {entries.length
                  ? ((wins / entries.length) * 100).toFixed(0)
                  : "—"}
                <em> %</em>
              </h2>
              <small>Your consistency, measured</small>
            </article>
            <article className="metric">
              <span>
                Trading days <BookOpen size={17} />
              </span>
              <h2>{entries.length}</h2>
              <small>Make every day a learning day</small>
            </article>
          </section>
          {!broker && (
            <section className="panel empty">
              <span className="empty-icon">
                <TrendingUp size={30} />
              </span>
              <h2>
                {broker
                  ? "Your next chapter starts with a trade."
                  : "Welcome to your trading workspace."}
              </h2>
              <p>
                {broker
                  ? "Log your opening and closing balances to start tracking your progress."
                  : "Add your first broker account. Your journal, goals and insights will grow from there."}
              </p>
              {!broker && (
                <button
                  className="primary"
                  onClick={() => setBrokerModal("new")}
                >
                  <Plus size={16} /> Create your first account
                </button>
              )}
            </section>
          )}
          {broker && (
            <>
              {view === "Overview" && (
                <div className="overview-grid">
                  <BalanceChart
                    entries={entries}
                    initialBalance={broker.initialBalance}
                    currency={currency}
                  />
                  <Goals
                    broker={broker}
                    goals={state.goals.filter((g) => g.brokerId === broker.id)}
                    entries={entries}
                    onSave={(goal) => commit(saveGoal(state, goal))}
                    onDelete={() => {}}
                    compact
                  />
                </div>
              )}
              {(view === "Overview" || view === "Daily journal") && (
                <Journal
                  entries={entries}
                  currency={currency}
                  onEdit={setEntryModal}
                  onDelete={removeEntry}
                  compact={view === "Overview"}
                />
              )}
              {view === "Forecast" && (
                <Forecast
                  key={broker.id}
                  broker={broker}
                  entries={entries}
                  goals={state.goals.filter((g) => g.brokerId === broker.id)}
                />
              )}
              {view === "Goals" && (
                <Goals
                  key={broker.id}
                  broker={broker}
                  goals={state.goals.filter((g) => g.brokerId === broker.id)}
                  entries={entries}
                  onSave={(goal) => commit(saveGoal(state, goal))}
                  onDelete={(id) => {
                    if (window.confirm("Delete this goal?"))
                      attempt(() =>
                        commit({
                          ...state,
                          goals: state.goals.filter((g) => g.id !== id),
                        }),
                      );
                  }}
                />
              )}
            </>
          )}
          {broker && (
            <button
              className="text-button"
              onClick={() => setBrokerModal(broker)}
            >
              Manage broker
            </button>
          )}
          <Backup
            state={state}
            recovery={!!boot.error}
            onImport={(next) => {
              commit(next, true);
              setActiveId(next.brokers[0]?.id ?? "");
            }}
          />
          <footer>
            <span>
              <span className="status-dot" /> Private by design. Saved on this
              device.
            </span>
            <span>BIX / A little more clarity.</span>
          </footer>
        </main>
      </div>
      {entryModal && broker && (
        <EntryForm
          broker={broker}
          entry={entryModal === "new" ? null : entryModal}
          opening={balance}
          onSave={(entry) => commit(saveEntry(state, entry))}
          close={() => setEntryModal(null)}
        />
      )}
      {brokerModal && (
        <Modal
          title={brokerModal === "new" ? "Add a broker" : "Manage broker"}
          close={() => setBrokerModal(null)}
        >
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <p>A label for your account, not a broker connection.</p>
          <form onSubmit={onBroker}>
            <label>
              Broker name
              <input
                autoFocus
                name="name"
                required
                maxLength={60}
                defaultValue={brokerModal === "new" ? "" : brokerModal.name}
                placeholder="e.g. My trading account"
              />
            </label>
            <div className="form-grid">
              <label>
                Currency
                <select
                  name="currency"
                  defaultValue={
                    brokerModal === "new" ? "USD" : brokerModal.currency
                  }
                >
                  <option>USD</option>
                  <option>EUR</option>
                  <option>HTG</option>
                </select>
              </label>
              <label>
                Initial balance
                <input
                  name="initialBalance"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1000000000000"
                  required
                  defaultValue={
                    brokerModal === "new" ? "" : brokerModal.initialBalance
                  }
                />
              </label>
            </div>
            <button className="primary" type="submit">
              Save broker
            </button>
            {brokerModal !== "new" && (
              <button
                type="button"
                className="secondary negative"
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete this broker and ALL of its entries and goals? This cannot be undone.",
                    )
                  )
                    attempt(() => {
                      commit(deleteBroker(state, brokerModal.id));
                      setBrokerModal(null);
                    });
                }}
              >
                Delete broker
              </button>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
