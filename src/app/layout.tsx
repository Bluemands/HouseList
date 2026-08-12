import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The House List",
  description: "A shared renovation wishlist and budget tracker.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/*
          THESIS: A budget tradeoff you can read at a glance, not a spreadsheet
          you have to total yourself — refuses the generic "todo app" card grid.
          OWN-WORLD: Deep-navy drafting-table canvas (ruled grid) as the app
          chrome; items live on paper-toned cards pinned to it, each carrying a
          coloured priority tab (red/amber/blue) always paired with a text
          label. Geist Sans for UI, Geist Mono for every price/tag/room — data
          reads as data. The budget bar is a dimension line, not a progress
          ring.
          STORY: Two people scanning what's left to buy against what's left to
          spend, deciding in seconds what stays "must have" and what waits.
          FORM: User-pinned direction (architectural blueprint), supplied in
          the brief as the explicit starting point — not rolled; invention was
          spent on execution (dimension-line budget bar, paper title-block
          cards) rather than on choosing the world.
          FIRST VIEWPORT: Budget bar pinned under the header, must-have total
          and remaining/overspend legible without scrolling; card list begins
          immediately below.
          FINISH: unreviewed and undocumented is unfinished; this build ends
          with the finish review, the verdict, and DESIGN.md.
        */}
        {children}
      </body>
    </html>
  );
}
