import "./styles.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Heersare News", description: "AI multi-agent news analysis" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
