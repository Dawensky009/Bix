import { useState, useEffect, useRef, type FormEvent } from "react";
import {
  Plus,
  LayoutDashboard,
  BookOpen,
  Target,
  TrendingUp,
  Wallet,
  ShieldCheck,
  BarChart2,
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
  afterBaseline,
  reconciledEntries,
  localDate,
  type Entry,
  type Broker,
  type Transaction,
  type State,
} from "./domain";
import { EntryForm, Journal, BalanceChart } from "./Journal";
import { Goals } from "./Goals";
import { BonusOverview, BrokerFields } from "./Bonus";
import { InstallApp } from "./InstallApp";
import { Statistics } from "./Statistics";
import { Modal } from "./ui";
import { Backup } from "./Backup";
import { ThemeToggle } from "./ThemeToggle";
import { supabase } from "./supabase";
import { Auth } from "./Auth";
import { ProfileMenu } from "./ProfileMenu";
import { fetchState, executeWrite, dbImportAll, type DbWrite } from "./db";
import type { Session } from "@supabase/supabase-js";

type View = "Overview" | "Daily journal" | "Statistics" | "Goals";

const uid = () => crypto.randomUUID();

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
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
  const writing = useRef(false);
  const [saving, setSaving] = useState(false);

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
  const computedEntries = reconciledEntries(state);
  const entries = computedEntries
    .filter((e) => e.brokerId === broker?.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Balance includes any transactions logged after the last entry
  const balance = broker
    ? accountBalance(broker, state.entries, state.transactions)
    : 0;

  function removeEntry(entry: Entry) {
    if (
      window.confirm(
        `Delete the entry for ${entry.date}? This cannot be undone.`,
      )
    )
      void commit(deleteEntry(state, entry.id), {
        kind: "entry-del",
        id: entry.id,
      });
  }

  function removeTx(tx: Transaction) {
    if (window.confirm("Delete this transaction? This cannot be undone."))
      void commit(deleteTransaction(state, tx.id), {
        kind: "tx-del",
        id: tx.id,
      });
  }

  function onTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void attempt(async () => {
      const raw = Number(data.get("amount"));
      const tx: Transaction = {
        id: txModal === "new" ? uid() : (txModal as Transaction).id,
        brokerId: broker!.id,
        date: String(data.get("date")),
        amount: txType === "withdrawal" ? -Math.abs(raw) : Math.abs(raw),
        note: String(data.get("note")),
        bonusDeduction:
          txType === "withdrawal" ? Number(data.get("bonusDeduction")) : 0,
        postBalance: Number(data.get("postBalance")),
        bonusStatus: (data.get("bonusStatus") ||
          undefined) as Transaction["bonusStatus"],
        afterClose: data.get("timing") === "after",
        order: Number(data.get("order")),
      };
      const next = saveTransaction(state, tx);
      if (await commit(next, { kind: "tx", tx })) setTxModal(null);
    });
  }

  async function commit(_next: State, write: DbWrite): Promise<boolean> {
    if (writing.current) return false;
    writing.current = true;
    setSaving(true);
    setError("");
    try {
      await executeWrite(session.user.id, write);
      setState(await fetchState(session.user.id));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      writing.current = false;
      setSaving(false);
    }
  }

  async function attempt(action: () => void | Promise<void>) {
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function onBroker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void attempt(async () => {
      const b: Broker = {
        id: brokerModal === "new" ? uid() : (brokerModal as Broker).id,
        name: String(data.get("name")),
        currency: String(data.get("currency")) as Broker["currency"],
        initialBalance:
          brokerModal === "new" ? 0 : (brokerModal as Broker).initialBalance,
        ownDeposit: Number(data.get("ownDeposit")),
        bonusPercent: Number(data.get("bonusPercent")),
        turnoverRequired: Number(data.get("turnoverRequired")),
        initialNetTurnover: Number(data.get("initialNetTurnover")),
        initialBonusProfit: Number(data.get("initialBonusProfit")),
        currentBalance: data.get("currentBalance")
          ? Number(data.get("currentBalance"))
          : undefined,
        baselineDate: String(data.get("baselineDate") || "") || undefined,
      };
      const next = saveBroker(state, b);
      if (
        await commit(next, {
          kind: "broker",
          broker: next.brokers.find((saved) => saved.id === b.id)!,
        })
      ) {
        setActiveId(b.id);
        setBrokerModal(null);
      }
    });
  }

  const NAV_ITEMS = [
    { label: "Overview" as View, icon: LayoutDashboard },
    { label: "Daily journal" as View, icon: BookOpen },
    { label: "Statistics" as View, icon: BarChart2 },
    { label: "Goals" as View, icon: Target },
  ] as const;

  const PAGE_HEADINGS: Record<View, { title: string; sub: string }> = {
    Overview: {
      title: "Your edge starts here.",
      sub: "A clear picture of your trading.",
    },
    "Daily journal": {
      title: "Daily journal",
      sub: "Every trade recorded, every lesson kept.",
    },
    Statistics: {
      title: "Statistics",
      sub: "Patterns, progress, performance.",
    },
    Goals: { title: "Goals", sub: "Set targets, track progress." },
  };

  if (loading) return <div className="auth-loading" />;

  return (
    <div className="app-shell" aria-busy={saving}>
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
            <ThemeToggle />
            <InstallApp />
            <ProfileMenu session={session} />
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
          {saving && <p role="status">Saving to your account…</p>}
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
              {view !== "Statistics" && (
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
                  <BonusOverview
                    broker={broker}
                    entries={entries}
                    transactions={state.transactions}
                  />

                  <div className="overview-grid">
                    <BalanceChart
                      entries={entries}
                      initialBalance={
                        broker.currentBalance ?? broker.initialBalance
                      }
                      currency={currency}
                    />
                    <Goals
                      broker={broker}
                      goals={state.goals.filter(
                        (g) => g.brokerId === broker.id,
                      )}
                      entries={entries}
                      onSave={(goal) => {
                        const next = saveGoal(state, goal);
                        return commit(next, { kind: "goal", goal });
                      }}
                      onDelete={() => {}}
                      compact
                    />
                  </div>

                  <Journal
                    entries={entries}
                    transactions={state.transactions.filter(
                      (t) =>
                        t.brokerId === broker.id &&
                        afterBaseline(broker, t.date),
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
                    (t) =>
                      t.brokerId === broker.id && afterBaseline(broker, t.date),
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
                  entries={computedEntries}
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
                  onSave={(goal) => {
                    const next = saveGoal(state, goal);
                    return commit(next, { kind: "goal", goal });
                  }}
                  onDelete={(id) => {
                    if (window.confirm("Delete this goal?"))
                      void commit(
                        {
                          ...state,
                          goals: state.goals.filter((g) => g.id !== id),
                        },
                        { kind: "goal-del", id },
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
            onImport={async (next) => {
              if (writing.current)
                throw new Error("A save is already in progress. Try again.");
              writing.current = true;
              setSaving(true);
              try {
                await dbImportAll(session.user.id, next);
                const saved = await fetchState(session.user.id);
                setState(saved);
                setActiveId(saved.brokers[0]?.id ?? "");
              } finally {
                writing.current = false;
                setSaving(false);
              }
            }}
          />

          <footer>
            <span>
              <span className="status-dot" /> Private by design. Synced to your
              account.
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
          onSave={(entry) => {
            const next = saveEntry(state, entry);
            return commit(next, { kind: "entry", entry });
          }}
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
                className={
                  txType === "deposit" ? "tx-type-btn active" : "tx-type-btn"
                }
                onClick={() => setTxType("deposit")}
              >
                Deposit
              </button>
              <button
                type="button"
                className={
                  txType === "withdrawal" ? "tx-type-btn active" : "tx-type-btn"
                }
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
                  txModal === "new"
                    ? localDate()
                    : (txModal as Transaction).date
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
              Transaction timing
              <select
                name="timing"
                defaultValue={
                  txModal === "new" || txModal.afterClose ? "after" : "before"
                }
              >
                <option value="before">
                  Before this day’s journal closing
                </option>
                <option value="after">After this day’s journal closing</option>
              </select>
            </label>
            <small className="muted">
              Choose whether this transaction is already included in the
              same-day closing balance. Later closing snapshots remain
              authoritative.
            </small>
            <label>
              Chronological order
              <input
                name="order"
                type="number"
                min="0"
                max="1000000000000"
                step="1"
                required
                aria-describedby="transaction-order-help"
                defaultValue={
                  txModal === "new"
                    ? Math.max(
                        0,
                        ...state.transactions
                          .filter((t) => t.brokerId === broker.id)
                          .map((t) => t.order ?? 0),
                      ) + 1
                    : (txModal.order ?? 0)
                }
              />
            </label>
            <small id="transaction-order-help" className="muted">
              Lower numbers happened earlier. Use a unique number within the
              same broker, date and timing (before or after closing). When
              backfilling, choose a lower number than later transactions;
              insertion order does not determine chronology. Legacy transactions
              without an order use 0.
            </small>
            {txType === "withdrawal" && (
              <label>
                Exact bonus deduction
                <input
                  name="bonusDeduction"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={
                    txModal === "new" ? 0 : (txModal.bonusDeduction ?? 0)
                  }
                />
              </label>
            )}
            <label>
              Balance after transaction
              <input
                name="postBalance"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={
                  txModal === "new" ? "" : (txModal.postBalance ?? "")
                }
              />
            </label>
            <label>
              Broker bonus decision
              <select
                name="bonusStatus"
                defaultValue={
                  txModal === "new" ? "" : (txModal.bonusStatus ?? "")
                }
              >
                <option value="">No new confirmation</option>
                <option value="cancelled">Cancelled by broker</option>
                <option value="released">Released by broker</option>
              </select>
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
                    void commit(deleteTransaction(state, id), {
                      kind: "tx-del",
                      id,
                    });
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
            <BrokerFields
              broker={brokerModal === "new" ? undefined : brokerModal}
            />
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
                  ) {
                    const id = brokerModal.id;
                    setBrokerModal(null);
                    void commit(deleteBroker(state, id), {
                      kind: "broker-del",
                      id,
                    });
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
