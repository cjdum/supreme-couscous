"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutocompleteProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
  /**
   * Called when the user explicitly picks an item from the dropdown.
   * If omitted, picking an item just sets the value.
   */
  onSelect?: (value: string) => void;
  maxLength?: number;
}

/**
 * Free-text input with a popover suggestion list.
 * - Filters `suggestions` by the current value
 * - Shows popover on focus + when the user types
 * - Keyboard nav: ArrowDown / ArrowUp / Enter / Escape
 * - Allows custom values (user can type anything, not just from the list)
 */
export function Autocomplete({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  required,
  error,
  hint,
  disabled,
  className,
  onSelect,
  maxLength,
}: AutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Close popover on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset highlight when the list changes
  useEffect(() => {
    setHighlighted(-1);
  }, [suggestions]);

  const handleSelect = useCallback(
    (suggestion: string) => {
      onChange(suggestion);
      if (onSelect) onSelect(suggestion);
      setOpen(false);
      setHighlighted(-1);
      inputRef.current?.blur();
    },
    [onChange, onSelect]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "ArrowDown") {
        setOpen(true);
        setHighlighted(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Enter") {
      if (highlighted >= 0 && highlighted < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[highlighted]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlighted(-1);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted < 0 || !listRef.current) return;
    const el = listRef.current.children[highlighted] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {label && (
        <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
          {label}
          {required && <span className="text-[var(--color-danger)] ml-1">*</span>}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlighted(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        maxLength={maxLength}
        aria-invalid={!!error}
        aria-autocomplete="list"
        aria-expanded={open}
        autoComplete="off"
        className="w-full"
      />
      {open && suggestions.length > 0 && !disabled && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-64 overflow-y-auto rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-[0_16px_48px_rgba(0,0,0,0.5)] animate-scale-in"
        >
          {suggestions.map((suggestion, i) => {
            const isHighlighted = i === highlighted;
            const isSelected = suggestion.toLowerCase() === value.toLowerCase();
            return (
              <li
                key={suggestion}
                role="option"
                aria-selected={isHighlighted}
                onMouseDown={(e) => {
                  // onMouseDown fires before input blur, so we can select cleanly
                  e.preventDefault();
                  handleSelect(suggestion);
                }}
                onMouseEnter={() => setHighlighted(i)}
                className={cn(
                  "flex items-center justify-between gap-2 px-4 py-2.5 cursor-pointer text-sm transition-colors",
                  isHighlighted
                    ? "bg-[var(--color-accent-muted)] text-white"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]"
                )}
              >
                <span className="truncate">{suggestion}</span>
                {isSelected && <Check size={13} className="text-[var(--color-accent-bright)] flex-shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="mt-1.5 text-xs text-[var(--color-danger)]">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-[10px] text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}
