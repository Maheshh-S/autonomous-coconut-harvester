"use client";

import Link from "next/link";
import { Plant, ArrowLeft } from "@phosphor-icons/react";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "calc(100vh - 56px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      <div
        data-reveal
        className="in"
        style={{
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 1px 3px rgba(28, 38, 27, 0.05)",
          padding: "48px 36px",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 22px",
            display: "grid",
            placeItems: "center",
            borderRadius: 999,
            background: "var(--color-accent-weak)",
            color: "var(--color-accent)",
          }}
          aria-hidden="true"
        >
          <Plant size={30} weight="regular" />
        </div>

        <div className="kicker" style={{ marginBottom: 10 }}>
          Error 404
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(26px, 4vw, 34px)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            margin: "0 0 12px",
          }}
        >
          This path isn&rsquo;t on the farm
        </h1>
        <p
          style={{
            color: "var(--color-text-dim)",
            fontSize: 15,
            lineHeight: 1.6,
            margin: "0 auto 28px",
            maxWidth: "38ch",
          }}
        >
          The page you were looking for doesn&rsquo;t exist or may have been moved.
          Head back to the control centre to continue.
        </p>

        <Link href="/" className="btn btn-primary" style={{ minHeight: 44 }}>
          <ArrowLeft size={18} weight="bold" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
