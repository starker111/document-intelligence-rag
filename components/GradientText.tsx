import type { ReactNode } from "react";

export function GradientText({ children }: { children: ReactNode }) {
  return <span className="gradient-text">{children}</span>;
}
