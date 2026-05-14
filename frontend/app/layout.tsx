import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

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
        <NavBar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
