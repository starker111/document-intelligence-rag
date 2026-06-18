import { Check, LoaderCircle } from "lucide-react";

interface Props {
  label: string;
  state: "inactive" | "active" | "completed" | "error";
}

export function StatusPill({ label, state }: Props) {
  return (
    <span className={`status-pill status-${state}`}>
      {state === "completed" ? (
        <Check size={10} />
      ) : state === "active" ? (
        <LoaderCircle size={10} className="spin" />
      ) : (
        <i />
      )}
      {label}
    </span>
  );
}
