"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const params = useSearchParams();
  const error = params.get("error");
  const callbackUrl = params.get("callbackUrl") || "/";

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex">
        {/* Left — branding */}
        <div className="hidden lg:flex w-[55%] bg-purple-primary flex-col justify-center px-16 relative overflow-hidden">
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-purple-medium opacity-30 blur-3xl" />
          <div className="absolute -bottom-16 left-16 w-64 h-64 rounded-full bg-purple-medium opacity-20 blur-2xl" />
          <div className="relative z-10">
            <OrcanosMark />
            <h1 className="text-4xl font-bold text-white mt-6 mb-4">
              Orcanos Automation Portal
            </h1>
            <p className="text-white/70 text-lg leading-relaxed">
              Run internal API automations safely, from one place.
            </p>
          </div>
        </div>

        {/* Right — sign-in card */}
        <div className="flex-1 flex items-center justify-center px-8 bg-page">
          <div className="w-full max-w-[400px]">
            <div className="bg-white rounded-xl border border-border p-8 shadow-sm">
              <h2 className="text-xl font-bold text-heading mb-1">Sign in</h2>
              <p className="text-body text-sm mb-6">
                Use your Orcanos Google account to continue.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error === "AccessDenied"
                    ? "Access denied. Only @orcanos.com accounts are allowed."
                    : "Something went wrong. Please try again."}
                </div>
              )}

              <button
                onClick={() => signIn("google", { callbackUrl })}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-border rounded-full text-sm font-medium text-heading hover:bg-gray-50 transition-colors"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              <div className="mt-4 p-3 rounded-lg bg-gray-50 text-center text-xs text-body">
                SSO enforced. Only authorized Orcanos users can access.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient line */}
      <div className="h-1 bg-gradient-to-r from-orange-400 via-yellow-300 to-orange-400" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function OrcanosMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 28 28" fill="none">
      <path
        d="M14 4C8.477 4 4 8.477 4 14s4.477 10 10 10 10-4.477 10-10"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="24" cy="14" r="2" fill="#F59E0B" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.84-1.57 2.4v2h2.54c1.49-1.37 2.26-3.4 2.26-5.4 0-.37-.03-.74-.1-1z" />
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.54-2c-.72.48-1.63.76-2.76.76-2.12 0-3.91-1.43-4.55-3.36H1.8v2.07C3.13 15.19 5.87 17 8.98 17z" />
      <path fill="#FBBC05" d="M4.43 10.46A5.1 5.1 0 0 1 4.16 9c0-.51.09-1 .27-1.46V5.47H1.8A8.96 8.96 0 0 0 .98 9c0 1.45.35 2.82.82 4.07l2.63-2.61z" />
      <path fill="#EA4335" d="M8.98 3.58c1.19 0 2.26.41 3.1 1.21l2.32-2.32C12.95 1.19 11.13.4 8.98.4 5.87.4 3.13 2.21 1.8 4.93l2.63 2.07c.64-1.93 2.43-3.42 4.55-3.42z" />
    </svg>
  );
}
