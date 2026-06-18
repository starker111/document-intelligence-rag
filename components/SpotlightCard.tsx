"use client";

import type { CSSProperties, HTMLAttributes, MouseEvent, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

type SpotlightStyle = CSSProperties & {
  "--mouse-x": string;
  "--mouse-y": string;
};

export function SpotlightCard({ children, className = "", onMouseMove, ...props }: Props) {
  function track(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
    onMouseMove?.(event);
  }

  const style: SpotlightStyle = {
    "--mouse-x": "50%",
    "--mouse-y": "50%",
  };

  return (
    <div className={`spotlight-card ${className}`} onMouseMove={track} style={style} {...props}>
      <span className="spotlight-layer" aria-hidden="true" />
      <div className="spotlight-content">{children}</div>
    </div>
  );
}
