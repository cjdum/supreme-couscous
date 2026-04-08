import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";

export default function NotFound() {
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
        }}
      >
        <div
          className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(123,79,212,0.3) 0%, rgba(168,85,247,0.2) 100%)",
            border: "1px solid rgba(168,85,247,0.5)",
            boxShadow: "0 0 32px rgba(168,85,247,0.4)",
          }}
        >
          <Compass size={28} style={{ color: "#e9d5ff" }} />
        </div>
        <p
          className="text-5xl font-black mb-2"
          style={{
            background: "linear-gradient(135deg, #c4b5fd 0%, #a855f7 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          404
        </p>
        <h1 className="text-xl font-black tracking-tight mb-2">Took a wrong turn</h1>
        <p className="text-sm mb-7" style={{ color: "rgba(220,210,250,0.65)" }}>
          This page doesn&apos;t exist — but your build is still safe in the vault.
        </p>
        <Link
          href="/garage"
          className="inline-flex items-center gap-2 h-11 px-6 rounded-xl font-bold text-sm"
          style={{
            background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
            color: "#fff",
            boxShadow: "0 6px 24px rgba(168,85,247,0.4)",
          }}
        >
          Back to garage
          <ArrowRight size={14} />
        </Link>
      </div>
    </main>
  );
}
