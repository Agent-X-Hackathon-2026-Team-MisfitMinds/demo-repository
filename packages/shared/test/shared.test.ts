import { describe, expect, it } from "vitest";
import {
  blockedGlobs, defaultFixieConfig, EventBatch, missingBugSpecFields, parseCommand, parseFixieConfig,
  readPrMarker, readStateMarker, renderPrMarker, renderStateMarker, reproTestPath, type BugSpec,
} from "../src/index.ts";

describe(".fixie.yml schema", () => {
  it("missing file → defaults", () => {
    const c = defaultFixieConfig();
    expect(c.model.name).toBe("github-models/openai/gpt-4.1-mini");
    expect(c.limits).toMatchObject({ max_fix_attempts: 6, max_changed_files: 10, max_changed_lines: 300, max_cost_usd: 0.5 });
    expect(c.bisect).toMatchObject({ enabled: true, max_steps: 12, max_minutes: 6 });
  });
  it("unknown key is an error with its path", () => {
    const r = parseFixieConfig({ version: 1, limits: { max_fix_attempts: 3, nope: 1 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toEqual({ path: "limits.nope", message: "unknown key: nope" });
  });
  it("out of range reports allowed range", () => {
    const r = parseFixieConfig({ version: 1, limits: { max_run_minutes: 90 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toEqual({ path: "limits.max_run_minutes", message: "must be between 10 and 40" });
  });
  it("blocked paths always include .github/**", () => {
    const r = parseFixieConfig({ version: 1, paths: { blocked: ["migrations/**", ".github/**"] } });
    expect(r.ok && blockedGlobs(r.config)).toEqual([".github/**", ".fixie.yml", ".fixie/**", "migrations/**"]);
  });
  it("model ref must be <preset>/<id>", () => {
    expect(parseFixieConfig({ version: 1, model: { name: "gpt4" } }).ok).toBe(false);
    expect(parseFixieConfig({ version: 1, model: { name: "ollama/qwen3-coder:30b" } }).ok).toBe(true);
  });
});

describe("bug spec readiness (D-22)", () => {
  const spec = (p: Partial<BugSpec>): BugSpec => ({
    title: "t", expected: null, actual: null, repro_steps: null, environment: null, version: null, last_good: null,
    stack_traces: [], suspected_files: [], error_messages: [], ...p,
  });
  it("actual + expected → ready", () => expect(missingBugSpecFields(spec({ actual: "a", expected: "e" }))).toEqual([]));
  it("stack trace counts as actual", () => expect(missingBugSpecFields(spec({ stack_traces: ["x"], repro_steps: "r" }))).toEqual([]));
  it("no actual → ask", () => expect(missingBugSpecFields(spec({ expected: "e" }))).toEqual(["actual"]));
  it("actual only → ask for steps/expected", () =>
    expect(missingBugSpecFields(spec({ actual: "a" }))).toEqual(["repro_steps", "expected"]));
});

describe("commands", () => {
  it("must start the comment", () => {
    expect(parseCommand("/fixie fix")).toEqual({ kind: "fix" });
    expect(parseCommand("please /fixie fix")).toBeNull();
    expect(parseCommand("/fixie revise use a set instead")).toEqual({ kind: "revise", feedback: "use a set instead" });
    expect(parseCommand("/fixie revise")).toBeNull();
    expect(parseCommand("/fixie fixit")).toBeNull();
  });
  it("repro paths", () => {
    expect(reproTestPath("python", 7, "tests/")).toBe("tests/test_fixie_issue_7.py");
    expect(reproTestPath("node", 7, "src/__tests__")).toBe("src/__tests__/fixie-issue-7.test.ts");
  });
});

describe("markers", () => {
  it("round-trip and last-one-wins; HTML comment cannot be broken out of", () => {
    const m = { v: 1 as const, runId: "r1", status: "awaiting_info" as const, step: "bug_spec" as const, askedAt: null,
      expiresAt: null, missing: ["a-->b"], hubRunUrl: null };
    const body = `hello\n${renderStateMarker({ ...m, runId: "old" })}\n${renderStateMarker(m)}`;
    expect(body).not.toContain("a-->b");
    expect(readStateMarker(body)).toEqual(m);
    expect(readPrMarker(renderPrMarker({ runId: "r", issue: 3 }))).toEqual({ runId: "r", issue: 3 });
    expect(readStateMarker("<!-- fixie:state {bad json} -->")).toBeNull();
  });
});

describe("events", () => {
  it("validates a batch", () => {
    const ok = EventBatch.safeParse({ events: [
      { seq: 1, ts: "2026-11-02T00:00:00Z", type: "step.started", data: { step: "baseline" } },
      { seq: 2, ts: "2026-11-02T00:00:01Z", type: "gate.evaluated", data: { gate: "diff_size", attempt: 1, passed: true, evidence: {} } },
    ] });
    expect(ok.success).toBe(true);
    const bad = EventBatch.safeParse({ events: [{ seq: 1, ts: "x", type: "pr.opened",
      data: { githubPrId: 1, number: 1, url: "u", headBranch: "main", headSha: "a".repeat(40) } }] });
    expect(bad.success).toBe(false);
  });
});

import { FIXIE_ACTION_REF, isFixieActionRef, RULESET_HELP_URL } from "../src/index.ts";
describe("repo constants (D-39)", () => {
  it("action ref and help link", () => {
    expect(FIXIE_ACTION_REF).toBe("Agent-X-Hackathon-2026-Team-MisfitMinds/demo-repository@v1");
    expect(RULESET_HELP_URL).toBe("https://github.com/Agent-X-Hackathon-2026-Team-MisfitMinds/demo-repository#ruleset");
    expect(isFixieActionRef("agent-x-hackathon-2026-team-misfitminds/demo-repository@0123abc")).toBe(true);
    expect(isFixieActionRef("Agent-X-Hackathon-2026-Team-MisfitMinds/demo-repository")).toBe(false);
    expect(isFixieActionRef("someone/demo-repository@v1")).toBe(false);
  });
});
