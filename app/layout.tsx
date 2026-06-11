import type { Metadata } from "next";
import { ClerkProvider, SignedIn, UserButton } from "@clerk/nextjs";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Pesa Tracker — split shared expenses",
  description: "Log shared expenses with friends and instantly see who owes whom.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${grotesk.variable} ${mono.variable}`}>
        <body>
          <header className="topbar">
            <Link href="/" className="brand">
              Pesa<span>Tracker</span>
            </Link>
            <nav className="topnav">
              <SignedIn>
                <Link href="/dashboard">My groups</Link>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </nav>
          </header>
          <main className="main">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
