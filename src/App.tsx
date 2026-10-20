import { useState, useEffect, type FormEvent } from "react";
import {
  Plus,
  LayoutDashboard,
  BookOpen,
  Target,
  TrendingUp,
  Wallet,
  ShieldCheck,
  ArrowUpRight,
  BarChart2,
  Layers,
  ArrowDownUp,
} from "lucide-react";
import {
  emptyState,
  saveBroker,
  saveEntry,
  deleteEntry,
  deleteBroker,
  saveGoal,
  saveTransaction,
  deleteTransaction,
  accountBalance,
  performance,
  localDate,
  type Entry,
  type Broker,
  type Transaction,
  type State,
} from "./domain";
import { EntryForm, Journal, BalanceChart } from "./Journal";
import { Goals } from "./Goals";
import { Forecast } from "./Forecast";
import { Statistics } from "./Statistics";
import { Modal } from "./ui";
import { Backup } from "./Backup";
import { ThemeToggle } from "./ThemeToggle";
import { InstallApp } from "./InstallApp";
import { supabase } from "./supabase";
import { Auth } from "./Auth";
import { fetchState, executeWrite, dbImportAll, type DbWrite } from "./db";
import type { Session } from "@supabase/supabase-js";

type View = "Overview" | "Daily journal" | "Statistics" | "Goals" | "Forecast";

const money = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);

const uid = () => crypto.randomUUID();

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="auth-loading" />;
  if (!session) return <Auth />;

  return <AppShell session={session} />;
}

function AppShell({ session }: { session: Session }) {
  const [state, setState] = useState<State>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("Overview");
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    fetchState(session.user.id)
      .then((s) => {
        setState(s);
        setActiveId(s.brokers[0]?.id ?? "");
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, [session.user.id]);
  const [brokerModal, setBrokerModal] = useState<Broker | "new" | null>(null);
  const [txModal, setTxModal] = useState<Transaction | "new" | null>(null);
  const [txType, setTxType] = useState<"deposit" | "withdrawal">("withdrawal");

  const broker =
    state.brokers.find((b) => b.id === activeId) ?? state.brokers[0];
  const currency = broker?.currency ?? "USD";

  const [entryModal, setEntryModal] = useState<Entry | "new" | null>(null);
  const entries = state.entries
    .filter((e) => e.brokerId === broker?.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Balance includes any transactions logged after the last entry
  const balance = broker
    ? accountBalance(broker, state.entries, state.transactions)
    : 0;

  const pnl = entries.reduce(
    (sum, e) => sum + performance(e.opening, e.closing, e.cashFlow).pnl,
    0,
  );
  const wins = entries.filter(
    (e) => performance(e.opening, e.closing, e.cashFlow).pnl > 0,
  ).length;

  // Portfolio: all-broker aggregate
  const portfolioItems = state.brokers.map((b) => {
    const bEntries = state.entries
      .filter((e) => e.brokerId === b.id)
      .sort((a, z) => a.date.localeCompare(z.date));
    const lastBalance = bEntries.at(-1)?.closing ?? b.initialBalance;
    const bPnl = bEntries.reduce(
      (s, e) => s + performance(e.opening, e.closing, e.cashFlow).pnl,
      0,
    );
    const bWins = bEntries.filter(
      (e) => performance(e.opening, e.closing, e.cashFlow).pnl > 0,
    ).length;
    return {
      broker: b,
      lastBalance,
      pnl: bPnl,
      days: bEntries.length,
      wins: bWins,
    };
  });
  const totalPortfolio = portfolioItems.reduce((s, x) => s + x.lastBalance, 0);
  const totalPortfolioPnl = portfolioItems.reduce((s, x) => s + x.pnl, 0);

  function removeEntry(entry: Entry) {
    if (window.confirm(`Delete the entry for ${entry.date}? This cannot be undone.`))
      void commit(deleteEntry(state, entry.id), { kind: "entry-del", id: entry.id });
  }

  function removeTx(tx: Transaction) {
    if (window.confirm("Delete this transaction? This cannot be undone."))
      void commit(deleteTransaction(state, tx.id), { kind: "tx-del", id: tx.id });
  }

  function onTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    attempt(() => {
      const raw = Number(data.get("amount"));
      const tx: Transaction = {
        id: txModal === "new" ? uid() : (txModal as Transaction).id,
        brokerId: broker!.id,
        date: String(data.get("date")),
        amount: txType === "withdrawal" ? -Math.abs(raw) : Math.abs(raw),
        note: String(data.get("note")),
      };
      const next = saveTransaction(state, tx);
      setTxModal(null);
      void commit(next, { kind: "tx", tx });
    });
  }

  async function commit(next: State, write: DbWrite): Promise<void> {
    setState(next);
    setError("");
    try {
      await executeWrite(session.user.id, write);
    } catch (e) {
      setState(state); // revert on DB error
      setError(e instanceof Error ? e.message : String(e));
    }
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
      const next = saveBroker(state, b);
      setActiveId(b.id);
      setBrokerModal(null);
      void commit(next, { kind: "broker", broker: b });
    });
  }

  const NAV_ITEMS = [
    { label: "Overview" as View, icon: LayoutDashboard },
    { label: "Daily journal" as View, icon: BookOpen },
    { label: "Statistics" as View, icon: BarChart2 },
    { label: "Goals" as View, icon: Target },
    { label: "Forecast" as View, icon: TrendingUp },
  ] as const;

  const PAGE_HEADINGS: Record<View, { title: string; sub: string }> = {
    Overview: { title: "Your edge starts here.", sub: "A clear picture of your trading." },
    "Daily journal": { title: "Daily journal", sub: "Every trade recorded, every lesson kept." },
    Statistics: { title: "Statistics", sub: "Patterns, progress, performance." },
    Goals: { title: "Goals", sub: "Set targets, track progress." },
    Forecast: { title: "Forecast", sub: "Two scenarios. No guarantees." },
  };

  if (loading) return <div className="auth-loading" />;

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
          {NAV_ITEMS.map(({ label, icon: Icon }) => (
            <button
              key={label}
              aria-current={view === label ? "page" : undefined}
              className={view === label ? "nav-item active" : "nav-item"}
              onClick={() => setView(label)}
            >
              <Icon size={18} />
              {label}
              {view === label && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={20} />
            <strong>Your data. Cloud-secured.</strong>
            <p>
              Synced to your account.
              <br />
              No broker credentials needed.
            </p>
          </div>
          <div className="profile">
            <span className="avatar">
              {session.user.email?.[0]?.toUpperCase() ?? "U"}
            </span>
            <div>
              <strong className="profile-email">{session.user.email}</strong>
              <button
                className="text-button profile-signout"
                onClick={() => supabase.auth.signOut()}
              >
                Sign out
              </button>
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
          <div className="header-actions">
            <InstallApp />
            <ThemeToggle />
            <div className="account-picker">
              <Wallet size={16} />
              <select
                aria-label="Active broker"
                value={broker?.id ?? ""}
                onChange={(e) => setActiveId(e.target.value)}
              >
                {!state.brokers.length && (
                  <option value="">No broker yet</option>
                )}
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
                <Plus size={17} />
              </button>
            </div>
          </div>
        </header>

        <main>
          <div className="page-heading">
            <div>
              <h1>{PAGE_HEADINGS[view].title}</h1>
              <p>{PAGE_HEADINGS[view].sub}</p>
            </div>
            <div className="page-heading-actions">
              {broker && (
                <button
                  className="secondary"
                  onClick={() => {
                    setTxType("withdrawal");
                    setTxModal("new");
                  }}
                  title="Record a deposit or withdrawal"
                >
                  <ArrowDownUp size={15} /> Transaction
                </button>
              )}
              {view !== "Statistics" && view !== "Forecast" && (
                <button
                  className="primary"
                  disabled={!broker}
                  onClick={() => setEntryModal("new")}
                >
                  <Plus size={16} /> New entry
                </button>
              )}
            </div>
          </div>

          {error && !brokerModal && (
            <div role="alert" className="error">
              {error}
            </div>
          )}

          {!broker && (
            <section className="panel empty">
              <span className="empty-icon">
                <TrendingUp size={28} />
              </span>
              <h2>Welcome to your trading workspace.</h2>
              <p>
                Add your first broker account. Your journal, goals and insights
                will grow from there.
              </p>
              <button className="primary" onClick={() => setBrokerModal("new")}>
                <Plus size={15} /> Create your first account
              </button>
            </section>
          )}

          {broker && (
            <>
              {/* Overview — stat strip + portfolio + chart + journal */}
              {view === "Overview" && (
                <>
                  {/* Stat strip — replaces four equal cards */}
                  <section className="stat-strip">
                    <div className="ss-primary">
                      <span className="ss-label">
                        <Wallet size={12} /> Account balance
                      </span>
                      <div className="ss-balance">{money(balance, currency)}</div>
                      <small className="ss-hint">
                        {entries.length ? "Latest closing" : "Starting capital"}
                      </small>
                    </div>

                    <div className="ss-sep" />

                    <div className="ss-stat">
                      <span className="ss-label">
                        <ArrowUpRight size={12} /> Net P&L
                      </span>
                      <strong
                        className={`ss-num ${pnl > 0 ? "positive" : pnl < 0 ? "negative" : ""}`}
                      >
                        {pnl > 0 ? "+" : ""}
                        {money(pnl, currency)}
                      </strong>
                      {entries.length > 0 && broker && (
                        <small
                          className={`ss-delta ${pnl >= 0 ? "positive" : "negative"}`}
                        >
                          {pnl >= 0 ? "▲" : "▼"}{" "}
                          {Math.abs(
                            broker.initialBalance !== 0
                              ? (pnl / broker.initialBalance) * 100
                              : 0,
                          ).toFixed(1)}
                          %
                        </small>
                      )}
                    </div>

                    <div className="ss-sep" />

                    <div className="ss-stat">
                      <span className="ss-label">
                        <TrendingUp size={12} /> Win rate
                      </span>
                      <strong className="ss-num">
                        {entries.length
                          ? ((wins / entries.length) * 100).toFixed(0) + "%"
                          : "—"}
                      </strong>
                      {entries.length > 0 && (
                        <>
                          <div
                            className="wl-bar"
                            role="img"
                            aria-label={`${wins} wins, ${entries.length - wins} losses`}
                          >
                            <div
                              className="wl-w"
                              style={{
                                flex: wins || 0,
                              }}
                            />
                            <div
                              className="wl-l"
                              style={{ flex: entries.length - wins || 0 }}
                            />
                          </div>
                          <small className="ss-hint">
                            {wins}W · {entries.length - wins}L
                          </small>
                        </>
                      )}
                    </div>

                    <div className="ss-sep" />

                    <div className="ss-stat">
                      <span className="ss-label">
                        <BookOpen size={12} /> Trading days
                      </span>
                      <strong className="ss-num">{entries.length}</strong>
                      <small className="ss-hint">
                        {entries.length === 0
                          ? "Start your journey"
                          : "Days recorded"}
                      </small>
                    </div>
                  </section>

                  {/* Portfolio overview — only when there are multiple brokers */}
                  {state.brokers.length > 1 && (
                    <section className="panel portfolio-panel">
                      <div className="section-heading">
                        <div>
                          <h2>Portfolio overview</h2>
                          <p>Combined total across {state.brokers.length} broker accounts</p>
                        </div>
                        <Layers size={18} />
                      </div>
                      <div className="portfolio-totals">
                        <div className="ptotal-item">
                          <span className="ptotal-label">Total balance</span>
                          <strong className="ptotal-val">
                            {money(totalPortfolio, currency)}
                          </strong>
                        </div>
                        <div className="ptotal-divider" />
                        <div className="ptotal-item">
                          <span className="ptotal-label">Combined P&L</span>
                          <strong
                            className={`ptotal-val ${totalPortfolioPnl > 0 ? "positive" : totalPortfolioPnl < 0 ? "negative" : ""}`}
                          >
                            {money(totalPortfolioPnl, currency)}
                          </strong>
                        </div>
                        <div className="ptotal-divider" />
                        <div className="ptotal-item">
                          <span className="ptotal-label">Active accounts</span>
                          <strong className="ptotal-val">
                            {portfolioItems.filter((x) => x.days > 0).length}
                            <em> / {state.brokers.length}</em>
                          </strong>
                        </div>
                      </div>
                      <div className="broker-rows">
                        {portfolioItems.map((item) => {
                          const share =
                            totalPortfolio > 0
                              ? (item.lastBalance / totalPortfolio) * 100
                              : 0;
                          return (
                            <button
                              key={item.broker.id}
                              className={`broker-row${item.broker.id === activeId ? " active" : ""}`}
                              onClick={() => setActiveId(item.broker.id)}
                              aria-pressed={item.broker.id === activeId}
                            >
                              <div className="broker-row-left">
                                <span className="broker-avatar">
                                  {item.broker.name.slice(0, 1).toUpperCase()}
                                </span>
                                <div>
                                  <strong>{item.broker.name}</strong>
                                  <small>{item.broker.currency} · {item.days} days</small>
                                </div>
                              </div>
                              <div className="broker-row-right">
                                <span className="broker-balance">
                                  {money(item.lastBalance, item.broker.currency)}
                                </span>
                                <span
                                  className={`broker-pnl ${item.pnl > 0 ? "positive" : item.pnl < 0 ? "negative" : ""}`}
                                >
                                  {item.pnl > 0 ? "+" : ""}
                                  {money(item.pnl, item.broker.currency)}
                                </span>
                              </div>
                              <div
                                className="broker-share-bar"
                                style={{ width: `${share}%` }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  )}

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
                      onSave={(goal) => attempt(() => {
                        const next = saveGoal(state, goal);
                        void commit(next, { kind: "goal", goal });
                      })}
                      onDelete={() => {}}
                      compact
                    />
                  </div>

                  <Journal
                    entries={entries}
                    transactions={state.transactions.filter(
                      (t) => t.brokerId === broker.id,
                    )}
                    currency={currency}
                    onEdit={setEntryModal}
                    onDelete={removeEntry}
                    onEditTx={(tx) => {
                      setTxType(tx.amount >= 0 ? "deposit" : "withdrawal");
                      setTxModal(tx);
                    }}
                    onDeleteTx={removeTx}
                    compact
                  />
                </>
              )}

              {view === "Daily journal" && (
                <Journal
                  entries={entries}
                  transactions={state.transactions.filter(
                    (t) => t.brokerId === broker.id,
                  )}
                  currency={currency}
                  onEdit={setEntryModal}
                  onDelete={removeEntry}
                  onEditTx={(tx) => {
                    setTxType(tx.amount >= 0 ? "deposit" : "withdrawal");
                    setTxModal(tx);
                  }}
                  onDeleteTx={removeTx}
                  compact={false}
                />
              )}

              {view === "Statistics" && (
                <Statistics
                  key={broker.id}
                  entries={state.entries}
                  brokers={state.brokers}
                  activeBrokerId={activeId}
                />
              )}

              {view === "Goals" && (
                <Goals
                  key={broker.id}
                  broker={broker}
                  goals={state.goals.filter((g) => g.brokerId === broker.id)}
                  entries={entries}
                  onSave={(goal) => attempt(() => {
                    const next = saveGoal(state, goal);
                    void commit(next, { kind: "goal", goal });
                  })}
                  onDelete={(id) => {
                    if (window.confirm("Delete this goal?"))
                      void commit(
                        { ...state, goals: state.goals.filter((g) => g.id !== id) },
                        { kind: "goal-del", id },
                      );
                  }}
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
            onImport={(next) => {
              setState(next);
              setActiveId(next.brokers[0]?.id ?? "");
              dbImportAll(session.user.id, next).catch((e) =>
                setError(e instanceof Error ? e.message : String(e)),
              );
            }}
          />

          <footer>
            <span>
              <span className="status-dot" /> Private by design. Synced to your account.
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
          onSave={(entry) => attempt(() => {
            const next = saveEntry(state, entry);
            void commit(next, { kind: "entry", entry });
          })}
          close={() => setEntryModal(null)}
        />
      )}

      {txModal && broker && (
        <Modal
          title={
            txModal === "new"
              ? "Record a transaction"
              : txType === "deposit"
              ? "Edit deposit"
              : "Edit withdrawal"
          }
          close={() => setTxModal(null)}
        >
          <p>
            Deposits and withdrawals are excluded from trading P&L. The opening
            balance of your next entry will be adjusted automatically.
          </p>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <form onSubmit={onTransaction}>
            {/* Type toggle */}
            <div className="tx-type-toggle">
              <button
                type="button"
                className={txType === "deposit" ? "tx-type-btn active" : "tx-type-btn"}
                onClick={() => setTxType("deposit")}
              >
                Deposit
              </button>
              <button
                type="button"
                className={txType === "withdrawal" ? "tx-type-btn active" : "tx-type-btn"}
                onClick={() => setTxType("withdrawal")}
              >
                Withdrawal
              </button>
            </div>
            <label>
              Date
              <input
                autoFocus
                name="date"
                type="date"
                required
                max={localDate()}
                defaultValue={
                  txModal === "new" ? localDate() : (txModal as Transaction).date
                }
              />
            </label>
            <label>
              Amount ({broker.currency})
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                max="1000000000000"
                required
                defaultValue={
                  txModal === "new"
                    ? ""
                    : Math.abs((txModal as Transaction).amount)
                }
                placeholder="e.g. 500.00"
              />
            </label>
            <label>
              Note (optional)
              <textarea
                name="note"
                maxLength={500}
                placeholder="e.g. Monthly profit withdrawal"
                defaultValue={
                  txModal === "new" ? "" : (txModal as Transaction).note
                }
              />
            </label>
            <button className="primary" type="submit">
              Save transaction
            </button>
            {txModal !== "new" && (
              <button
                type="button"
                className="secondary negative"
                onClick={() => {
                  if (window.confirm("Delete this transaction?")) {
                    const id = (txModal as Transaction).id;
                    setTxModal(null);
                    void commit(deleteTransaction(state, id), { kind: "tx-del", id });
                  }
                }}
              >
                Delete transaction
              </button>
            )}
          </form>
        </Modal>
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
                  if (window.confirm("Delete this broker and ALL of its entries and goals? This cannot be undone.")) {
                    const id = brokerModal.id;
                    setBrokerModal(null);
                    void commit(deleteBroker(state, id), { kind: "broker-del", id });
                  }
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
