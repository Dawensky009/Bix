import { useEffect, useState } from "react";
import { Download, Check } from "lucide-react";
import { Modal } from "./ui";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  );
  const [guide, setGuide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const before = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const done = () => {
      setInstalled(true);
      setPrompt(null);
      setGuide(false);
    };
    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  async function install() {
    if (!prompt) {
      setMessage("");
      setGuide(true);
      return;
    }
    setBusy(true);
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === "dismissed") {
        setMessage(
          "Installation was cancelled. You can still use BIX in your browser.",
        );
        setGuide(true);
      }
    } catch {
      setMessage(
        "The browser could not open its installer. Try its app menu instead.",
      );
      setGuide(true);
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  }
  if (installed)
    return (
      <span className="install-state">
        <Check size={16} />
        App installed
      </span>
    );
  return (
    <>
      <button
        className="secondary install-button"
        aria-label="Install BIX"
        title="Install BIX"
        onClick={install}
        disabled={busy}
      >
        <Download size={17} />
        <span>{busy ? "Opening installer…" : "Install app"}</span>
      </button>
      {guide && (
        <Modal title="Install BIX" close={() => setGuide(false)}>
          <div className="install-guide">
            {message && <p role="status">{message}</p>}
            <p>
              Keep your trading workspace a tap away. Installation depends on
              your browser and device.
            </p>
            <h3>Chrome or Edge · desktop and Android</h3>
            <ol>
              <li>Open BIX over HTTPS (or localhost during development).</li>
              <li>
                Choose Install app in the browser menu or address bar when
                available.
              </li>
            </ol>
            <h3>Safari · iPhone and iPad</h3>
            <p>
              Tap Share → Add to Home Screen → Add. Open the new BIX icon from
              your home screen.
            </p>
            <h3>Before you go offline</h3>
            <p>
              Visit once online and allow the app to finish caching. Your
              journal stays on this browser and device; export a backup before
              switching browsers. If installation is not offered, BIX still
              works as a website.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
