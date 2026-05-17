import type { Metadata } from "next";
import "./globals.css";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";

export const metadata: Metadata = {
  title: "Orcanos Automation Portal",
  description: "Run internal API automations safely, from one place.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-page">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
