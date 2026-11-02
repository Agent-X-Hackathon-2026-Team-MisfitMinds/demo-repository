import { describe, expect, it, vi } from "vitest";
import { GATE_KINDS } from "@fixie/shared";
import {
  assertAllGatesPassed, assertAllowed, classifyProtection, FixieGitHub, ForbiddenGitHubCall, UngatedPullRequest, type Transport,
} from "../src/index.ts";

const R = "/repos/Agent-X-Hackathon-2026-Team-MisfitMinds/fixie-demo-python";
const forbidden = (fn: () => unknown) => expect(fn).toThrow(ForbiddenGitHubCall);

describe("allow-list (SEC-07)", () => {
  it("merge, approve, ready-for-review, GraphQL are impossible", () => {
    forbidden(() => assertAllowed("action", "PUT", `${R}/pulls/3/merge`));
    forbidden(() => assertAllowed("action", "POST", `${R}/pulls/3/reviews`, { event: "APPROVE" }));
    forbidden(() => assertAllowed("action", "PUT", `${R}/pulls/3/reviews/1/events`));
    forbidden(() => assertAllowed("action", "POST", "/graphql", { query: "mutation { markPullRequestReadyForReview }" }));
    forbidden(() => assertAllowed("action", "PATCH", `${R}/pulls/3`, { draft: false }));
    forbidden(() => assertAllowed("action", "PATCH", `${R}/pulls/3`, { body: "x", state: "closed" }));
    forbidden(() => assertAllowed("hub", "PUT", `${R}/pulls/3/merge`));
  });
  it("ref writes only under fixie/*, fast-forward only", () => {
    forbidden(() => assertAllowed("action", "POST", `${R}/git/refs`, { ref: "refs/heads/main", sha: "a" }));
    forbidden(() => assertAllowed("action", "PATCH", `${R}/git/refs/heads/main`, { sha: "a" }));
    forbidden(() => assertAllowed("action", "PATCH", `${R}/git/refs/heads/fixie/issue-1`, { sha: "a", force: true }));
    forbidden(() => assertAllowed("action", "POST", `${R}/git/refs`, { ref: "refs/tags/fixie/x", sha: "a" }));
    expect(() => assertAllowed("action", "POST", `${R}/git/refs`, { ref: "refs/heads/fixie/issue-1", sha: "a" })).not.toThrow();
    expect(() => assertAllowed("action", "PATCH", `${R}/git/refs/heads/fixie/issue-1`, { sha: "a", force: false })).not.toThrow();
  });
  it("PRs must be drafts from fixie/*", () => {
    forbidden(() => assertAllowed("action", "POST", `${R}/pulls`, { head: "fixie/issue-1", base: "main" }));
    forbidden(() => assertAllowed("action", "POST", `${R}/pulls`, { head: "feature", base: "main", draft: true }));
    expect(() => assertAllowed("action", "POST", `${R}/pulls`, { head: "fixie/issue-1", base: "main", draft: true })).not.toThrow();
  });
  it("labels: canonical only", () => {
    forbidden(() => assertAllowed("action", "POST", `${R}/issues/1/labels`, { labels: ["fixie:pr-ready", "approved"] }));
    forbidden(() => assertAllowed("action", "DELETE", `${R}/issues/1/labels/bug`));
    expect(() => assertAllowed("action", "DELETE", `${R}/issues/1/labels/fixie%3Aworking`)).not.toThrow();
  });
  it("scopes: dispatch is Hub-only; contents writes never", () => {
    forbidden(() => assertAllowed("action", "POST", `${R}/actions/workflows/fixie.yml/dispatches`));
    expect(() => assertAllowed("hub", "POST", `${R}/actions/workflows/fixie.yml/dispatches`)).not.toThrow();
    forbidden(() => assertAllowed("hub", "PUT", `${R}/contents/src/a.py`));
    forbidden(() => assertAllowed("hub", "POST", `${R}/actions/workflows/ci.yml/dispatches`));
  });
});

describe("FixieGitHub", () => {
  it("forces draft on PR creation and blocks before transport on forbidden calls", async () => {
    const t = vi.fn<Transport>(async () => ({ status: 201, data: { id: 1, number: 2, html_url: "u", head: { sha: "s" } } }));
    const gh = new FixieGitHub(t, "Agent-X-Hackathon-2026-Team-MisfitMinds", "fixie-demo-python", "github-actions[bot]");
    await gh.createDraftPullRequest({ title: "Fix #1: x", head: "fixie/issue-1", base: "main", body: "b" });
    expect(t.mock.calls[0]?.[2]).toMatchObject({ draft: true });
    await expect(gh.request("PUT", `${R}/pulls/2/merge`)).rejects.toThrow(ForbiddenGitHubCall);
    expect(t).toHaveBeenCalledTimes(1);
  });
  it("refuses to edit someone else's comment", async () => {
    const t: Transport = async () => ({ status: 200, data: { user: { login: "octocat" } } });
    const gh = new FixieGitHub(t, "Agent-X-Hackathon-2026-Team-MisfitMinds", "fixie-demo-python", "github-actions[bot]");
    await expect(gh.updateOwnComment(5, "x")).rejects.toThrow(ForbiddenGitHubCall);
  });
});

describe("assertAllGatesPassed", () => {
  const all = GATE_KINDS.map((gate) => ({ gate, passed: true }));
  it("passes only with all nine", () => {
    expect(() => assertAllGatesPassed(all)).not.toThrow();
    expect(() => assertAllGatesPassed(all.slice(1))).toThrow(UngatedPullRequest);
    expect(() => assertAllGatesPassed(all.map((g, i) => ({ ...g, passed: i !== 8 })))).toThrow(/secret_scan/);
    expect(() => assertAllGatesPassed([])).toThrow(UngatedPullRequest);
  });
});

describe("classifyProtection", () => {
  const pr = (n: number, last: boolean) => ({ type: "pull_request", ruleset_id: 9, parameters: { required_approving_review_count: n, require_last_push_approval: last } });
  it("ok / weak / missing / bypass", () => {
    expect(classifyProtection([pr(1, true)]).status).toBe("ok");
    expect(classifyProtection([pr(2, false)]).status).toBe("weak");
    expect(classifyProtection([{ type: "deletion" }]).status).toBe("missing");
    expect(classifyProtection([]).status).toBe("missing");
    expect(classifyProtection([pr(1, true)], true).status).toBe("bypass");
  });
});
