import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { AppHeaderTitle } from "@/components/AppHeaderTitle";
import { Nav } from "@/components/Nav";
import { VoiceProviderWrapper } from "@/components/VoiceProviderWrapper";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Home Assist",
  description: "Home assistant brain – control and automate your home",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-zinc-950 text-zinc-100`}
      >
        <VoiceProviderWrapper>
          <div className="min-h-screen flex flex-col">
            <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
              <AppHeaderTitle />
              <Nav />
            </header>
            {children}
          </div>
        </VoiceProviderWrapper>
      </body>
    </html>
  );
}
