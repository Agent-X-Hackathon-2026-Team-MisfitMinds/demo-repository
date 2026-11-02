// Markdown safety for model and issue text going into GitHub (TRD §5.5).

/** Escape Markdown/HTML control characters; strip HTML comments and @-mentions. */
export function escapeMarkdown(s: string): string {
  return s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[\\`*_{}[\]()#+!|<>~]/g, (c) => `\\${c}`)
    .replace(/(^|[^\w])@(?=[A-Za-z0-9-])/g, "$1@​") // break mentions
    .replace(/\r?\n/g, " ")
    .trim();
}

export const inlineCode = (s: string): string => {
  const clean = s.replace(/[\r\n]/g, " ");
  const ticks = clean.includes("`") ? "``" : "`";
  return `${ticks}${clean}${ticks}`;
};

export const truncate = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1))}…`);
