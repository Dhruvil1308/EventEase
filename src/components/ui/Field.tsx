import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

const control =
  "peer w-full rounded-xl border bg-ink-900/70 px-4 text-[0.95rem] text-white placeholder:text-zinc-500 outline-none transition-[border-color,box-shadow,background] duration-300 focus:bg-ink-850 focus:shadow-[0_0_0_4px_rgba(124,92,255,0.18)]";

function borderFor(error?: string) {
  return error
    ? "border-danger/60 focus:border-danger"
    : "border-white/10 hover:border-white/20 focus:border-violet-soft";
}

type FieldShellProps = {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  optional?: boolean;
};

export function FieldShell({ id, label, hint, error, optional, children }: FieldShellProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="flex items-center justify-between text-sm font-medium text-zinc-200">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-zinc-500">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-sm text-danger">
          <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-4a1 1 0 00-1 1v3a1 1 0 102 0V7a1 1 0 00-1-1zm0 8a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-zinc-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
};

export function InputField({ id, label, hint, error, optional, className = "", ...rest }: InputFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <input
        id={id}
        name={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${control} h-12 ${borderFor(error)} ${className}`}
        {...rest}
      />
    </FieldShell>
  );
}

type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
};

export function TextareaField({ id, label, hint, error, optional, className = "", ...rest }: TextareaFieldProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={id}
        name={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${control} min-h-28 resize-y py-3 ${borderFor(error)} ${className}`}
        {...rest}
      />
    </FieldShell>
  );
}
