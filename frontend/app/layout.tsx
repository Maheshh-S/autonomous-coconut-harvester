import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Autonomous Coconut Harvesting",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (

    <html lang="en">

      <body>

        {/* NAVBAR */}

        <div
          style={{
            padding: 10,
            background: "#111",
            color: "white",
            display: "flex",
            gap: 20,
          }}
        >

          <Link href="/">
            Home
          </Link>

          <Link href="/dashboard">
            Dashboard
          </Link>

          <Link href="/trees">
            Trees
          </Link>

          <Link href="/map">
  Farm
</Link>

<Link href="/survey">
  Survey
</Link>

<Link href="/robot">Robot</Link>

        </div>


        {/* PAGE */}

        <div>

          {children}

        </div>

      </body>

    </html>

  );

}