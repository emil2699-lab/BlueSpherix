import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlueSpherix — Trading Intelligence",
  description: "A clear, modern cockpit for trading performance and risk.",
  applicationName: "BlueSpherix",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BlueSpherix",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#070a0f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
