import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";

const roboto = Roboto({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
});

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
    <html lang="en" className={`h-full antialiased ${roboto.variable}`}>
      <body className="min-h-full flex flex-col bg-page">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
