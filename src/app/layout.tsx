import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Sensum Staff OS",
  description: "Attendance, quality and KPI for Sensum Coffee.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
