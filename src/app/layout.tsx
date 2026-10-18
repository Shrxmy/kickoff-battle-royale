import type { Metadata, Viewport } from "next";
import { Inter, Poppins, Raleway } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--nf-inter" });
const raleway = Raleway({ subsets: ["latin"], display: "swap", variable: "--nf-raleway" });
const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--nf-poppins",
});

export const metadata: Metadata = {
  title: "CSS Battle Royale",
  description: "Computer Science Society kickoff: answer fast, keep your energy, be the last CSAR standing.",
  icons: { icon: "/logo-blue.webp" },
};

export const viewport: Viewport = {
  themeColor: "#134687",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${raleway.variable} ${poppins.variable}`}>
      <body className="font-inter min-h-dvh antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
