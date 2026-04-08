"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[global error]", error);
  }, [error]);

  return (
    <main
      className="min-h-dvh flex items-center justify-center px-5 py-16"
      style={{
        backgroundColor: "#05050c",
        color: "#f4f0ff",
        backgroundImage:
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(168,85,247,0.28) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 20% 40%, rgba(91,33,182,0.22) 0%, transparent 60%)",
      }}
    >
      <div
        className="max-w-md w-full text-center rounded-3xl p-10"
        style={{
          background: "rgba(15,12,30,0.7)",
          border: "1px solid rgba(168,85,247,0.3)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
        }}
      >
        <div
          className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
          style={{
            background: "rgba(255,69,58,0.15)",
            border: "1px solid rgba(255,69,58,0.4)",
            boxShadow: "0 0 32px rgba(255,69,58,0.3)",
          }}
        >
          <AlertTriangle size={28} style={{ color: "#ff453a" }} />
        </div>
        <h1 className="text-2xl font-black tracking-tight mb-2">Something sheared a bolt</h1>
        <p className="text-sm mb-7" style={{ color: "rgba(220,210,250,0.65)" }}>
          An unexpected error occurred. We&apos;ve logged it. Try again or head back to the garage.
        </p>
        {error.digest && (
          <p
            className="text-[10px] mb-6 px-3 py-2 rounded-lg mx-auto inline-block"
            style={{
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.1em",
              background: "rgba(5,5,12,0.6)",
              border: "1px solid rgba(168,85,247,0.2)",
              color: "rgba(200,180,240,0.5)",
            }}
          >
            ref: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl font-bold text-sm"
            style={{
              background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
              color: "#fff",
              border: "1px solid rgba(168,85,247,0.55)",
              boxShadow: "0 6px 24px rgba(168,85,247,0.4)",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} />
            Try again
          </button>
          <Link
            href="/garage"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl font-bold text-sm"
            style={{
              background: "rgba(15,12,30,0.6)",
              border: "1px solid rgba(168,85,247,0.25)",
              color: "#e9d5ff",
            }}
          >
            <Home size={14} />
            Garage
          </Link>
        </div>
      </div>
    </main>
  );
}
