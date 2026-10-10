import type { Metadata, Viewport } from "next";
import { Ma_Shan_Zheng, Noto_Sans_SC, Noto_Serif_SC, ZCOOL_XiaoWei, Zhi_Mang_Xing } from "next/font/google";
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

// 古风展示字体：小薇（古典排版标题）+ 马善政（楷书书法）
const xiaowei = ZCOOL_XiaoWei({
  variable: "--font-display-cn",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const mashanzheng = Ma_Shan_Zheng({
  variable: "--font-brush",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

// 行楷：志莽行书（飘逸的书法标题体）
const zhimangxing = Zhi_Mang_Xing({
  variable: "--font-script",
  weight: "400",
  subsets: ["latin"],
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
        className={`${notoSans.variable} ${notoSerif.variable} ${xiaowei.variable} ${mashanzheng.variable} ${zhimangxing.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
