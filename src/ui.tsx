import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
export const pct = (n: number | null) =>
  n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
export function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    el.querySelector<HTMLElement>(
      "form input, form select, form textarea",
    )?.focus();
    return () => el.close();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={close} aria-label={title}>
      <button
        className="modal-close icon-button"
        aria-label="Close dialog"
        onClick={close}
      >
        <X size={18} />
      </button>
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
