import { useState, type FormEvent } from "react";
import { LogOut, KeyRound, X } from "lucide-react";
import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";

export function ProfileMenu({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const email = session.user.email ?? "";

  function close() {
    setOpen(false);
    setChangingPw(false);
    setPw("");
    setPw2("");
    setMsg(null);
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (pw !== pw2) { setMsg({ text: "Passwords don't match.", ok: false }); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) { setMsg({ text: error.message, ok: false }); return; }
    setMsg({ text: "Password updated!", ok: true });
    setTimeout(close, 1500);
  }

  return (
    <div className="pm-wrap">
      <button
        className="pm-trigger"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label="Account"
        aria-expanded={open}
      >
        <span className="pm-avatar">{email[0]?.toUpperCase() ?? "U"}</span>
      </button>

      {open && (
        <>
          <div className="pm-backdrop" onClick={close} />
          <div className="pm-dropdown" role="dialog" aria-label="Account menu">
            <div className="pm-head">
              <div>
                <strong className="pm-label">Account</strong>
                <span className="pm-email">{email}</span>
              </div>
              <button className="icon-button" onClick={close} aria-label="Close">
                <X size={14} />
              </button>
            </div>

            {!changingPw ? (
              <div className="pm-actions">
                <button
                  className="pm-item"
                  onClick={() => { setChangingPw(true); setMsg(null); }}
                >
                  <KeyRound size={15} />
                  Change password
                </button>
                <button
                  className="pm-item pm-item-danger"
                  onClick={() => supabase.auth.signOut()}
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            ) : (
              <form onSubmit={changePassword} className="pm-pw-form">
                {msg && (
                  <div className={`pm-msg ${msg.ok ? "positive" : "negative"}`}>
                    {msg.text}
                  </div>
                )}
                <input
                  type="password"
                  placeholder="New password"
                  required
                  minLength={6}
                  autoFocus
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                />
                <div className="pm-pw-btns">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => { setChangingPw(false); setMsg(null); }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="primary" disabled={loading}>
                    {loading ? "Saving…" : "Update"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
