"use client";

import { VoiceProvider } from "@/context/VoiceProvider";

export function VoiceProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <VoiceProvider
      picovoiceAccessKey={process.env.NEXT_PUBLIC_PICOVOICE_API_KEY}
      apiBaseUrl={process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "/api"}
    >
      {children}
    </VoiceProvider>
  );
}
