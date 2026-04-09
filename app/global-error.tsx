"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#09090b",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            padding: "48px 28px",
            borderRadius: 20,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "rgba(255,69,58,0.12)",
              border: "1px solid rgba(255,69,58,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <svg
              width={24}
              height={24}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ff453a"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: 8,
            }}
          >
            Something went wrong
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
            The app hit an unexpected error. Try refreshing.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 10,
                fontFamily: "ui-monospace, monospace",
                color: "rgba(255,255,255,0.25)",
                marginBottom: 20,
              }}
            >
              ref: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 24px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
              border: "none",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.02em",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
