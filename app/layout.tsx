import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "LiveStyler｜AI 直播间装修师",
  description:
    "一句话，打造你的品牌直播间。可编辑图层、自然语言修改与品牌素材导出。",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
