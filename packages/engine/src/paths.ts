// Path policy shared by the SEARCH/REPLACE applier and the blocked_paths gate.
import picomatch from "picomatch";

const TEST_FILE_GLOBS = [
  "**/test_*.py", "**/*_test.py", "**/tests/**", "**/test/**", "**/conftest.py",
  "**/*.test.*", "**/*.spec.*", "**/__tests__/**",
];
const isTestMatcher = picomatch(TEST_FILE_GLOBS, { dot: true });
export const isTestFile = (path: string): boolean => isTestMatcher(path);

export function matchesAny(path: string, globs: readonly string[]): boolean {
  return globs.length > 0 && picomatch(globs as string[], { dot: true })(path);
}

/** Repo-relative, normalised, no traversal, no absolute paths, no NUL. */
export function isSafeRelativePath(p: string): boolean {
  if (!p || p.includes("\0") || p.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(p) || p.includes("\\")) return false;
  return p.split("/").every((seg) => seg !== ".." && seg !== "." && seg !== "" && seg.toLowerCase() !== ".git");
}
