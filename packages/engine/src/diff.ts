// Unified diff parsing (git diff output). Pure; used by gates, checkpoints and the Proof Card.

export interface DiffFile {
  path: string; // new path ("b/"), or old path for deletions
  oldPath: string | null;
  status: "added" | "modified" | "deleted" | "renamed";
  binary: boolean;
  added: { line: number; text: string }[];
  removed: { line: number; text: string }[];
}

const stripPrefix = (p: string): string | null => {
  if (p === "/dev/null") return null;
  return p.replace(/^"|"$/g, "").replace(/^[ab]\//, "");
};

export function parseUnifiedDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  let cur: DiffFile | null = null;
  let oldLine = 0;
  let newLine = 0;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("diff --git ")) {
      const m = /^diff --git a\/(.+?) b\/(.+)$/.exec(raw);
      cur = { path: m?.[2] ?? "", oldPath: m?.[1] ?? null, status: "modified", binary: false, added: [], removed: [] };
      files.push(cur);
      continue;
    }
    if (!cur) continue;
    if (raw.startsWith("new file mode")) cur.status = "added";
    else if (raw.startsWith("deleted file mode")) cur.status = "deleted";
    else if (raw.startsWith("rename from ")) { cur.oldPath = raw.slice(12); cur.status = "renamed"; }
    else if (raw.startsWith("rename to ")) cur.path = raw.slice(10);
    else if (raw.startsWith("Binary files ")) cur.binary = true;
    else if (raw.startsWith("--- ")) { const p = stripPrefix(raw.slice(4).trim()); if (p === null) cur.status = "added"; else cur.oldPath = p; }
    else if (raw.startsWith("+++ ")) { const p = stripPrefix(raw.slice(4).trim()); if (p === null) { cur.status = "deleted"; cur.path = cur.oldPath ?? cur.path; } else cur.path = p; }
    else if (raw.startsWith("@@")) {
      const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      oldLine = Number(m?.[1] ?? 0); newLine = Number(m?.[2] ?? 0);
    } else if (raw.startsWith("+")) cur.added.push({ line: newLine++, text: raw.slice(1) });
    else if (raw.startsWith("-")) cur.removed.push({ line: oldLine++, text: raw.slice(1) });
    else if (raw.startsWith(" ")) { oldLine++; newLine++; }
  }
  for (const f of files) if (f.status === "added") f.oldPath = null;
  return files;
}

/** Every path a diff touches (both sides of renames). */
export const touchedPaths = (files: DiffFile[]): string[] =>
  [...new Set(files.flatMap((f) => [f.path, ...(f.oldPath && f.oldPath !== f.path ? [f.oldPath] : [])]))];

export function diffStats(files: DiffFile[], exclude: readonly string[] = []) {
  const counted = files.filter((f) => !exclude.includes(f.path));
  return {
    files: counted.length,
    added: counted.reduce((n, f) => n + f.added.length, 0),
    removed: counted.reduce((n, f) => n + f.removed.length, 0),
  };
}
