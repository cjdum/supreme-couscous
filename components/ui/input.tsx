"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider"
          >
            {label}
            {props.required && (
              <span className="text-[var(--color-danger)] ml-1" aria-label="required">
                *
              </span>
            )}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-10 w-full rounded-[10px] bg-[var(--color-bg-elevated)] border px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent",
            error
              ? "border-[var(--color-danger)]"
              : "border-[var(--color-border)] hover:border-[var(--color-border-bright)]",
            className
          )}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          aria-invalid={error ? "true" : undefined}
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-xs text-[var(--color-danger)] flex items-center gap-1"
            role="alert"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-[var(--color-text-muted)]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-[10px] bg-[var(--color-bg-elevated)] border px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent",
            error
              ? "border-[var(--color-danger)]"
              : "border-[var(--color-border)] hover:border-[var(--color-border-bright)]",
            className
          )}
          aria-invalid={error ? "true" : undefined}
          {...props}
        />
        {error && (
          <p className="text-xs text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "h-10 w-full rounded-[10px] bg-[var(--color-bg-elevated)] border px-3 text-sm text-[var(--color-text-primary)] cursor-pointer",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent",
            error
              ? "border-[var(--color-danger)]"
              : "border-[var(--color-border)] hover:border-[var(--color-border-bright)]",
            className
          )}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#18181b]">
              {o.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-xs text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export { Input, Textarea, Select };
