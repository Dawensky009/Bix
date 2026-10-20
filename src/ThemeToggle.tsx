import { useLayoutEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      return localStorage.getItem("bix.theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const [notice, setNotice] = useState("");
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#080f19" : "#f3f6fb");
  }, [theme]);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("bix.theme", next);
      setNotice("");
    } catch {
      setNotice(
        "Theme changed for this visit; browser storage is unavailable.",
      );
    }
  }
  return (
    <>
      <button
        className="icon-button theme-toggle"
        onClick={toggle}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      {notice && (
        <span role="status" className="theme-notice">
          {notice}
        </span>
      )}
    </>
  );
}
