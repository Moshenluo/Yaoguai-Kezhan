import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const notoSans = Noto_Sans_SC({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

const notoSerif = Noto_Serif_SC({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "妖怪客栈 · 山海经放置经营守店",
  description:
    "国风放置经营 × 夜间轻度塔防。白天挂机经营客栈，夜晚布阵守店，控血捉妖收服山海经妖怪伙伴。灵感源自《山海经》。",
  keywords: ["妖怪客栈", "山海经", "放置经营", "塔防", "捉妖", "国风游戏", "休闲游戏"],
  authors: [{ name: "妖怪客栈工作室" }],
  icons: {
    icon: "/images/logo.png",
  },
  openGraph: {
    title: "妖怪客栈 · 山海经放置经营守店",
    description: "白天挂机赚钱，夜晚守店捉妖！收服你的山海经妖怪伙伴。",
    siteName: "妖怪客栈",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#8B2E24",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${notoSans.variable} ${notoSerif.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
