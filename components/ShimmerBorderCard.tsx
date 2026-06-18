import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function ShimmerBorderCard({ children, className = "", ...props }: Props) {
  return (
    <div className={`shimmer-card ${className}`} {...props}>
      <span className="shimmer-track" aria-hidden="true" />
      <div className="shimmer-content">{children}</div>
    </div>
  );
}
