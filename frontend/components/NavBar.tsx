"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

const navLinks = [
  { href: "/automations", label: "Automations" },
  { href: "/run-history", label: "Run History" },
  { href: "/admin", label: "Admin" },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function NavBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const initials = session?.user?.name
    ? getInitials(session.user.name)
    : "?";

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

        {/* Avatar + sign-out */}
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="w-9 h-9 rounded-full bg-purple-primary flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <span className="text-white text-xs font-semibold">{initials}</span>
          </button>

          {open && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOpen(false)}
              />
              <div className="absolute right-0 top-11 z-50 bg-white border border-border rounded-xl shadow-lg p-1 min-w-48">
                {session?.user?.email && (
                  <div className="px-3 py-2 text-xs text-body border-b border-border mb-1 truncate">
                    {session.user.email}
                  </div>
                )}
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full text-left px-3 py-2 text-sm text-heading hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
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
        stroke="#6B3CA6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="24" cy="14" r="2" fill="#F59E0B" />
    </svg>
  );
}
