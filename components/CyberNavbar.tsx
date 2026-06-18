"use client";

import { useEffect, useState } from "react";
import { Command, Menu, X } from "lucide-react";

const links = [
  ["Home", "home"],
  ["Upload", "upload"],
  ["Embeddings", "embeddings"],
  ["Ask", "ask"],
  ["Results", "results"],
  ["Sources", "sources"],
  ["Logs", "logs"],
] as const;

export function CyberNavbar({ ready }: { ready: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("home");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    const sections = links
      .map(([, id]) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-25% 0px -62% 0px", threshold: [0, 0.15, 0.4] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <header className={`cyber-nav ${scrolled ? "is-scrolled" : ""} ${open ? "menu-open" : ""}`}>
      <div className="nav-inner page-width">
        <a className="nav-brand" href="#home" aria-label="Kepler home" onClick={closeMenu}>
          <span className="nav-logo"><Command size={18} /></span>
          <span>KEPLER</span>
        </a>
        <nav
          className="nav-links"
          aria-label="Primary navigation"
          style={open ? { opacity: 1, transform: "translateY(0)" } : undefined}
        >
          {links.map(([label, id]) => (
            <a
              key={id}
              href={`#${id}`}
              className={active === id ? "is-active" : ""}
              aria-current={active === id ? "location" : undefined}
              onClick={closeMenu}
            >
              {label}
            </a>
          ))}
        </nav>
        <a className="nav-cta" href="#upload" onClick={closeMenu}>
          <span className={`nav-status ${ready ? "is-ready" : ""}`} />
          {ready ? "Start indexing" : "Setup required"}
        </a>
        <button
          type="button"
          className="nav-menu-button"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </header>
  );
}
