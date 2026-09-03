"use client";

import { useId, useRef } from "react";
import { Input, Text } from "@cloudflare/kumo";

const OTP_LENGTH = 6;

function toDigits(value: string): string[] {
  const digits = value.replace(/\D/g, "").slice(0, OTP_LENGTH).split("");
  return Array.from({ length: OTP_LENGTH }, (_, index) => digits[index] ?? "");
}

export function OtpCodeField({
  id,
  label,
  value,
  onValueChange,
  onValueComplete,
  error,
  autoFocus,
  digitAriaLabel,
}: {
  id?: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onValueComplete?: (value: string) => void;
  error?: boolean;
  autoFocus?: boolean;
  digitAriaLabel: (current: number, total: number) => string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const labelId = `${fieldId}-label`;
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = toDigits(value);

  function focusIndex(index: number) {
    const nextIndex = Math.max(0, Math.min(OTP_LENGTH - 1, index));
    const node = inputRefs.current[nextIndex];
    node?.focus();
    node?.select();
  }

  function emit(nextDigits: string[]) {
    const next = nextDigits.join("");
    onValueChange(next);
    if (next.length === OTP_LENGTH) {
      onValueComplete?.(next);
    }
  }

  function applyChars(startIndex: number, chars: string) {
    if (!chars) return;
    const next = [...digits];
    const sliced = chars.slice(0, OTP_LENGTH - startIndex).split("");
    sliced.forEach((char, offset) => {
      next[startIndex + offset] = char;
    });
    emit(next);
    focusIndex(startIndex + sliced.length);
  }

  return (
    <div className="grid gap-1.5" role="group" aria-labelledby={labelId}>
      <Text id={labelId} as="label">
        {label}
      </Text>
      <div className="grid grid-cols-6 gap-2">
        {digits.map((digit, index) => (
          <Input
            key={`${fieldId}-${index}`}
            id={`${fieldId}-${index}`}
            size="base"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            passwordManagerIgnore
            autoFocus={autoFocus && index === 0}
            aria-label={digitAriaLabel(index + 1, OTP_LENGTH)}
            value={digit}
            maxLength={index === 0 ? OTP_LENGTH : 1}
            variant={error ? "error" : "default"}
            className="min-w-0 px-0 text-center"
            onChange={(event) => {
              const cleaned = event.target.value.replace(/\D/g, "");
              if (!cleaned) {
                const next = [...digits];
                next[index] = "";
                emit(next);
                return;
              }
              applyChars(index, cleaned);
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace") {
                event.preventDefault();
                if (digits[index]) {
                  const next = [...digits];
                  next[index] = "";
                  emit(next);
                  return;
                }
                if (index > 0) {
                  const next = [...digits];
                  next[index - 1] = "";
                  emit(next);
                  focusIndex(index - 1);
                }
                return;
              }
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                focusIndex(index - 1);
                return;
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                focusIndex(index + 1);
              }
            }}
            onPaste={(event) => {
              event.preventDefault();
              applyChars(index, event.clipboardData.getData("text").replace(/\D/g, ""));
            }}
            onFocus={(event) => event.currentTarget.select()}
            ref={(node) => {
              inputRefs.current[index] = node;
            }}
          />
        ))}
      </div>
    </div>
  );
}
