"use client";

import { useMemo, useState } from "react";
import { X, ArrowLeftRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { TradingCard } from "./trading-card";
import { ERA_COLORS, safeEra } from "@/lib/pixel-card";
import type { MintedCard } from "@/lib/pixel-card";

interface CompareCardsModalProps {
  cards: MintedCard[];
  carLabels: Record<string, string>;
  onClose: () => void;
}

export function CompareCardsModal({ cards, carLabels, onClose }: CompareCardsModalProps) {
  // Default selection: first two distinct cards
  const [leftId, setLeftId]   = useState<string | null>(cards[0]?.id ?? null);
  const [rightId, setRightId] = useState<string | null>(cards[1]?.id ?? null);

  const left  = useMemo(() => cards.find((c) => c.id === leftId)  ?? null, [cards, leftId]);
  const right = useMemo(() => cards.find((c) => c.id === rightId) ?? null, [cards, rightId]);

  const cardLabel = (c: MintedCard) => {
    const snap = c.car_snapshot;
    return `${snap.year} ${snap.make} ${snap.model} · ${c.nickname}${c.card_number ? ` · #${String(c.card_number).padStart(4, "0")}` : ""}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9990,
        background: "rgba(3,3,10,0.95)",
        backdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "20px",
        overflowY: "auto",
        animation: "cmpFade 220ms ease-out",
      }}
    >
      <style>{`
        @keyframes cmpFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cmpUp   { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
        style={{
          position: "fixed", top: 18, right: 18,
          width: 40, height: 40, borderRadius: 12,
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", zIndex: 9991,
        }}
      >
        <X size={16} />
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 1100,
          padding: "50px 24px 24px",
          animation: "cmpUp 320ms cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
              boxShadow: "0 0 22px rgba(168,85,247,0.45)",
            }}
          >
            <ArrowLeftRight size={18} color="#fff" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-white">Compare cards</h2>
            <p className="text-xs" style={{ color: "var(--mv-panel-text-muted)" }}>
              Pick any two cards to see how they stack up
            </p>
          </div>
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto,1fr] gap-6 items-start">
          {/* LEFT */}
          <CardSlot
            selectedId={leftId}
            cards={cards}
            carLabels={carLabels}
            onSelect={setLeftId}
            side="left"
          />

          {/* Divider / vs */}
          <div className="flex items-center justify-center lg:h-[500px]">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #7b4fd4 0%, #a855f7 100%)",
                boxShadow: "0 0 26px rgba(168,85,247,0.5)",
                border: "2px solid rgba(255,255,255,0.22)",
              }}
            >
              <span className="text-xs font-black text-white tracking-wider" style={{ fontFamily: "ui-monospace, monospace" }}>
                VS
              </span>
            </div>
          </div>

          {/* RIGHT */}
          <CardSlot
            selectedId={rightId}
            cards={cards}
            carLabels={carLabels}
            onSelect={setRightId}
            side="right"
          />
        </div>

        {/* Diff table */}
        {left && right && left.id !== right.id && (
          <div
            className="mt-8 rounded-2xl p-5"
            style={{
              background: "var(--mv-panel-bg-solid)",
              border: "1px solid var(--mv-panel-border)",
              backdropFilter: "blur(8px)",
            }}
          >
            <p
              className="text-[10px] font-black mb-4 text-center"
              style={{
                fontFamily: "ui-monospace, monospace",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--mv-panel-text-muted)",
              }}
            >
              Head-to-head
            </p>
            <div className="grid grid-cols-2 gap-px" style={{ background: "rgba(168,85,247,0.15)" }}>
              {buildRows(left, right).map((row) => (
                <DiffRow key={row.label} {...row} />
              ))}
            </div>

            {/* Card labels footer */}
            <div className="mt-4 flex items-center justify-between gap-4 text-[10px]" style={{ color: "var(--mv-panel-text-muted)", fontFamily: "ui-monospace, monospace", letterSpacing: "0.08em" }}>
              <span className="truncate">← {cardLabel(left)}</span>
              <span className="truncate text-right">{cardLabel(right)} →</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface Row {
  label: string;
  left: string;
  right: string;
  /** -1 = left better, 1 = right better, 0 = tie, null = not comparable */
  winner: -1 | 0 | 1 | null;
}

function buildRows(a: MintedCard, b: MintedCard): Row[] {
  const snapA = a.car_snapshot;
  const snapB = b.car_snapshot;

  const rows: Row[] = [];

  const numRow = (label: string, va: number | null | undefined, vb: number | null | undefined, higherIsBetter: boolean, format: (n: number) => string) => {
    const aVal = va ?? null;
    const bVal = vb ?? null;
    let winner: -1 | 0 | 1 | null = null;
    if (aVal != null && bVal != null) {
      if (aVal === bVal) winner = 0;
      else if (higherIsBetter) winner = aVal > bVal ? -1 : 1;
      else winner = aVal < bVal ? -1 : 1;
    }
    rows.push({
      label,
      left: aVal != null ? format(aVal) : "—",
      right: bVal != null ? format(bVal) : "—",
      winner,
    });
  };

  numRow("Horsepower", a.hp, b.hp, true, (n) => `${n} hp`);
  numRow("Torque", snapA.torque, snapB.torque, true, (n) => `${n} lb-ft`);
  numRow("0-60", snapA.zero_to_sixty, snapB.zero_to_sixty, false, (n) => `${n.toFixed(1)}s`);
  numRow("Mods", a.mod_count, b.mod_count, true, (n) => `${n}`);
  numRow("Invested", snapA.total_invested, snapB.total_invested, true, (n) => `$${n >= 1000 ? (n / 1000).toFixed(1) + "k" : n}`);
  numRow("Build score", snapA.build_score, snapB.build_score, true, (n) => `${n}`);

  rows.push({
    label: "Era",
    left: safeEra(a.era),
    right: safeEra(b.era),
    winner: null,
  });

  return rows;
}

function DiffRow({ label, left, right, winner }: Row) {
  const leftWin  = winner === -1;
  const rightWin = winner === 1;

  const Arrow = ({ dir }: { dir: "up" | "down" | "same" }) => {
    if (dir === "up")   return <TrendingUp size={11} />;
    if (dir === "down") return <TrendingDown size={11} />;
    return <Minus size={11} />;
  };

  return (
    <>
      <div
        className="p-3"
        style={{
          background: leftWin ? "rgba(168,85,247,0.12)" : "var(--mv-panel-bg)",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--mv-panel-text-muted)" }}>
          {label}
        </p>
        <p
          className="text-base font-black flex items-center gap-1.5"
          style={{ color: leftWin ? "#c084fc" : "#fff" }}
        >
          {left}
          {leftWin && <Arrow dir="up" />}
        </p>
      </div>
      <div
        className="p-3 text-right"
        style={{
          background: rightWin ? "rgba(168,85,247,0.12)" : "var(--mv-panel-bg)",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--mv-panel-text-muted)" }}>
          {label}
        </p>
        <p
          className="text-base font-black flex items-center gap-1.5 justify-end"
          style={{ color: rightWin ? "#c084fc" : "#fff" }}
        >
          {rightWin && <Arrow dir="up" />}
          {right}
        </p>
      </div>
    </>
  );
}

interface CardSlotProps {
  selectedId: string | null;
  cards: MintedCard[];
  carLabels: Record<string, string>;
  onSelect: (id: string) => void;
  side: "left" | "right";
}

function CardSlot({ selectedId, cards, carLabels, onSelect }: CardSlotProps) {
  const card = cards.find((c) => c.id === selectedId);
  const label = card
    ? (card.car_id && carLabels[card.car_id]) || `${card.car_snapshot.year} ${card.car_snapshot.make} ${card.car_snapshot.model}`
    : "";

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Selector dropdown */}
      <select
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          background: "var(--mv-panel-bg-solid)",
          border: "1px solid var(--mv-panel-border-bright)",
          borderRadius: 10,
          color: "var(--mv-accent-text)",
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          padding: "8px 14px",
          cursor: "pointer",
          width: "100%",
          maxWidth: 320,
        }}
      >
        {cards.map((c) => {
          const lbl = (c.car_id && carLabels[c.car_id]) || `${c.car_snapshot.year} ${c.car_snapshot.make} ${c.car_snapshot.model}`;
          return (
            <option key={c.id} value={c.id} style={{ background: "#13072b", color: "var(--mv-accent-text)" }}>
              {lbl} · {c.nickname}{c.card_number ? ` · #${String(c.card_number).padStart(4, "0")}` : ""}
            </option>
          );
        })}
      </select>

      {/* Card */}
      {card && (
        <TradingCard
          cardUrl={card.pixel_card_url}
          nickname={card.nickname}
          generatedAt={card.minted_at}
          hp={card.hp}
          modCount={card.mod_count}
          buildScore={card.car_snapshot.build_score}
          vinVerified={card.car_snapshot.vin_verified}
          cardNumber={card.card_number}
          era={card.era}
          flavorText={card.flavor_text}
          occasion={card.occasion}
          mods={card.car_snapshot.mods ?? []}
          torque={card.car_snapshot.torque ?? null}
          zeroToSixty={card.car_snapshot.zero_to_sixty ?? null}
          totalInvested={card.car_snapshot.total_invested ?? null}
          carLabel={label}
          scale={0.85}
          idle
          interactive
        />
      )}
    </div>
  );
}
