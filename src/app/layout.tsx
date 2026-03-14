import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LayoutHeader } from "@/components/LayoutHeader";
import { VoiceProviderWrapper } from "@/components/VoiceProviderWrapper";
// #region agent log
import { DebugLogOverlay } from "@/components/DebugLogOverlay";
// #endregion
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
  title: "Casa de los Schwarzes",
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
            <LayoutHeader />
            {children}
          </div>
          {/* #region agent log */}
          <DebugLogOverlay />
          {/* #endregion */}
        </VoiceProviderWrapper>
      </body>
    </html>
  );
}
