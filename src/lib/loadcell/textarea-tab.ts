import type { KeyboardEvent } from "react";

export function insertTextareaTab(
  e: KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  onChange: (value: string) => void,
) {
  if (e.key !== "Tab") return false;

  e.preventDefault();
  const el = e.currentTarget;
  const start = el.selectionStart;
  const end = el.selectionEnd;

  if (e.shiftKey) {
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    if (value.startsWith("\t", lineStart)) {
      const next = value.slice(0, lineStart) + value.slice(lineStart + 1);
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = Math.max(lineStart, start - 1);
      });
    }
    return true;
  }

  const next = `${value.slice(0, start)}\t${value.slice(end)}`;
  onChange(next);
  requestAnimationFrame(() => {
    el.selectionStart = el.selectionEnd = start + 1;
  });
  return true;
}

export function codeTextareaTabProps(value: string, onChange: (value: string) => void) {
  return {
    spellCheck: false as const,
    onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => {
      insertTextareaTab(e, value, onChange);
    },
  };
}
