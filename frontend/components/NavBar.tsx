"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/automations", label: "Automations" },
  { href: "/run-history", label: "Run History" },
  { href: "/admin", label: "Admin" },
];

export default function NavBar() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="bg-white border-b border-border h-15 flex items-center px-8 shrink-0">
      <div className="flex items-center gap-8 w-full max-w-7xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <OrcanosMark />
          <span className="font-semibold text-heading text-sm tracking-wide">Orcanos</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1 flex-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive(href)
                  ? "bg-purple-primary text-white"
                  : "text-heading hover:text-purple-medium"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* User avatar */}
        <div className="w-9 h-9 rounded-full bg-purple-primary flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-semibold">JD</span>
        </div>
      </div>
    </header>
  );
}

function OrcanosMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path
        d="M14 4C8.477 4 4 8.477 4 14s4.477 10 10 10 10-4.477 10-10"
        stroke="#5B21B6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="24" cy="14" r="2" fill="#F59E0B" />
    </svg>
  );
}
