import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "./theme.css";
import "./glass-buttons.css";

const themeBoot = `(()=>{try{const k="bluespherix-theme";const s=localStorage.getItem(k);const t=s==="light"||s==="dark"?s:(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");const r=document.documentElement;r.dataset.theme=t;r.style.colorScheme=t;const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="light"?"#edf4f3":"#070a0f")}catch{document.documentElement.dataset.theme="dark"}})()`;

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
    <html lang="it" suppressHydrationWarning>
      <body><Script id="bluespherix-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeBoot }} />{children}</body>
    </html>
  );
}
