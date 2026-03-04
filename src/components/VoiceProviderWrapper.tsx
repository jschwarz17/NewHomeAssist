"use client";

import { VoiceProvider } from "@/context/VoiceProvider";

export function VoiceProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const envUrl = process.env.NEXT_PUBLIC_ASSISTANT_API_URL;
  const apiBaseUrl = envUrl
    ? `${envUrl.replace(/\/+$/, "")}/api`
    : "/api";

  return (
    <VoiceProvider
      picovoiceAccessKey={process.env.NEXT_PUBLIC_PICOVOICE_API_KEY}
      apiBaseUrl={apiBaseUrl}
    >
      {children}
    </VoiceProvider>
  );
}
