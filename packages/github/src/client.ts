// Allow-listed GitHub client (TRD §5.3, SEC-07). Every request passes `assertAllowed`; anything else throws.
// There is deliberately no code path for merge, approve, ready-for-review, or writing refs outside fixie/*.
import { CANONICAL_LABELS, FIX_BRANCH_PREFIX, GATE_KINDS, type GateKind } from "@fixie/shared";

export class ForbiddenGitHubCall extends Error {
  constructor(readonly method: string, readonly path: string, reason: string) {
    super(`Forbidden GitHub call ${method} ${path}: ${reason}`);
    this.name = "ForbiddenGitHubCall";
  }
}

export class UngatedPullRequest extends Error {
  constructor(readonly failing: GateKind[]) {
    super(`Refusing to open a pull request: gates not passed: ${failing.join(", ") || "(none evaluated)"}`);
    this.name = "UngatedPullRequest";
  }
}

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
export interface GitHubResponse<T = unknown> { status: number; data: T }
/** Transport is injected (fetch in prod, a fake in tests). It must not add routes of its own. */
export type Transport = (method: HttpMethod, path: string, body?: unknown) => Promise<GitHubResponse>;

type Scope = "action" | "hub";
interface Rule {
  method: HttpMethod;
  re: RegExp;
  scope: Scope[];
  check?: (m: RegExpExecArray, body: Record<string, unknown> | undefined) => string | null;
}

const R = "/repos/[^/]+/[^/]+";
const canonical = (name: string) => CANONICAL_LABELS.includes(name);

const RULES: Rule[] = [
  { method: "GET", re: new RegExp(`^${R}$`), scope: ["action", "hub"] },
  // Issues
  { method: "GET", re: new RegExp(`^${R}/issues/\\d+$`), scope: ["action", "hub"] },
  { method: "GET", re: new RegExp(`^${R}/issues/\\d+/comments(?:\\?.*)?$`), scope: ["action"] },
  { method: "POST", re: new RegExp(`^${R}/issues/\\d+/comments$`), scope: ["action"] },
  { method: "PATCH", re: new RegExp(`^${R}/issues/comments/\\d+$`), scope: ["action"] }, // ownership checked by the client
  { method: "GET", re: new RegExp(`^${R}/issues/comments/\\d+(?:/reactions(?:\\?.*)?)?$`), scope: ["action"] },
  {
    method: "POST", re: new RegExp(`^${R}/issues/\\d+/labels$`), scope: ["action"],
    check: (_m, b) => {
      const labels = (b?.labels as unknown[]) ?? [];
      return Array.isArray(labels) && labels.every((l) => typeof l === "string" && canonical(l)) ? null : "non-canonical label";
    },
  },
  {
    method: "DELETE", re: new RegExp(`^${R}/issues/\\d+/labels/([^/?]+)$`), scope: ["action"],
    check: (m) => (canonical(decodeURIComponent(m[1] ?? "")) ? null : "non-canonical label"),
  },
  {
    method: "POST", re: new RegExp(`^${R}/labels$`), scope: ["action"],
    check: (_m, b) => (canonical(String(b?.name ?? "")) ? null : "non-canonical label"),
  },
  // Access and rules
  { method: "GET", re: new RegExp(`^${R}/collaborators/[^/]+/permission$`), scope: ["action", "hub"] },
  { method: "GET", re: new RegExp(`^${R}/rules/branches/[^?]+$`), scope: ["action", "hub"] },
  { method: "GET", re: new RegExp(`^${R}/actions/permissions/workflow$`), scope: ["hub"] },
  // Git data
  { method: "GET", re: new RegExp(`^${R}/git/ref/heads/.+$`), scope: ["action"] },
  { method: "POST", re: new RegExp(`^${R}/git/(?:blobs|trees|commits)$`), scope: ["action"] },
  {
    method: "POST", re: new RegExp(`^${R}/git/refs$`), scope: ["action"],
    check: (_m, b) => (String(b?.ref ?? "").startsWith(`refs/heads/${FIX_BRANCH_PREFIX}`) ? null : "ref outside refs/heads/fixie/*"),
  },
  {
    method: "PATCH", re: new RegExp(`^${R}/git/refs/heads/(.+)$`), scope: ["action"],
    check: (m, b) =>
      !(m[1] ?? "").startsWith(FIX_BRANCH_PREFIX) ? "ref outside refs/heads/fixie/*" : b?.force ? "force push not allowed" : null,
  },
  // Pull requests
  {
    method: "POST", re: new RegExp(`^${R}/pulls$`), scope: ["action"],
    check: (_m, b) =>
      b?.draft !== true ? "pull requests must be drafts" : !String(b?.head ?? "").startsWith(FIX_BRANCH_PREFIX) ? "head outside fixie/*" : null,
  },
  {
    method: "PATCH", re: new RegExp(`^${R}/pulls/\\d+$`), scope: ["action"],
    check: (_m, b) => {
      const keys = Object.keys(b ?? {});
      return keys.length === 1 && keys[0] === "body" ? null : "only the PR body may be updated";
    },
  },
  { method: "GET", re: new RegExp(`^${R}/pulls/\\d+$`), scope: ["action", "hub"] },
  // Actions (Hub App only)
  { method: "POST", re: new RegExp(`^${R}/actions/workflows/fixie\\.yml/dispatches$`), scope: ["hub"] },
  { method: "POST", re: new RegExp(`^${R}/actions/runs/\\d+/cancel$`), scope: ["hub"] },
  { method: "GET", re: new RegExp(`^${R}/actions/runs/\\d+$`), scope: ["hub"] },
  { method: "GET", re: new RegExp(`^${R}/contents/[^?]+(?:\\?ref=[^&]+)?$`), scope: ["hub"] },
];

export function assertAllowed(scope: Scope, method: HttpMethod, path: string, body?: unknown): void {
  if (/graphql/i.test(path)) throw new ForbiddenGitHubCall(method, path, "GraphQL is not allowed");
  for (const rule of RULES) {
    if (rule.method !== method) continue;
    const m = rule.re.exec(path);
    if (!m) continue;
    if (!rule.scope.includes(scope)) throw new ForbiddenGitHubCall(method, path, `not allowed for ${scope}`);
    const why = rule.check?.(m, body as Record<string, unknown> | undefined);
    if (why) throw new ForbiddenGitHubCall(method, path, why);
    return;
  }
  throw new ForbiddenGitHubCall(method, path, "route not on the allow-list");
}

/** Called by the PR opener with the gate results of the winning attempt (TRD §3.6). */
export function assertAllGatesPassed(results: readonly { gate: GateKind; passed: boolean }[]): void {
  const failing = GATE_KINDS.filter((g) => !results.some((r) => r.gate === g && r.passed));
  if (failing.length || results.some((r) => !r.passed)) throw new UngatedPullRequest(failing);
}

const enc = encodeURIComponent;

export class FixieGitHub {
  constructor(
    private readonly transport: Transport,
    readonly owner: string,
    readonly repo: string,
    /** Login of the identity this client acts as, e.g. "github-actions[bot]". */
    readonly selfLogin: string,
    private readonly scope: Scope = "action",
  ) {}

  private get base() { return `/repos/${enc(this.owner)}/${enc(this.repo)}`; }

  async request<T = unknown>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    assertAllowed(this.scope, method, path, body);
    const res = await this.transport(method, path, body);
    if (res.status >= 400) throw new Error(`GitHub ${method} ${path} → ${res.status}`);
    return res.data as T;
  }

  getRepo() { return this.request<{ default_branch: string; id: number; private: boolean }>("GET", this.base); }
  getIssue(n: number) { return this.request<{ number: number; title: string; body: string | null; state: string; user: { login: string }; labels: { name: string }[]; pull_request?: unknown }>("GET", `${this.base}/issues/${n}`); }
  listComments(n: number, page = 1) { return this.request<{ id: number; body: string; user: { login: string; type: string } }[]>("GET", `${this.base}/issues/${n}/comments?per_page=100&page=${page}`); }
  createComment(n: number, body: string) { return this.request<{ id: number; html_url: string }>("POST", `${this.base}/issues/${n}/comments`, { body }); }

  async updateOwnComment(id: number, body: string) {
    const c = await this.request<{ user: { login: string } }>("GET", `${this.base}/issues/comments/${id}`);
    if (c.user.login !== this.selfLogin) throw new ForbiddenGitHubCall("PATCH", `issues/comments/${id}`, "not our comment");
    return this.request("PATCH", `${this.base}/issues/comments/${id}`, { body });
  }

  addLabels(n: number, labels: string[]) { return this.request("POST", `${this.base}/issues/${n}/labels`, { labels }); }
  removeLabel(n: number, label: string) { return this.request("DELETE", `${this.base}/issues/${n}/labels/${enc(label)}`); }
  createLabel(name: string, color: string, description: string) { return this.request("POST", `${this.base}/labels`, { name, color, description }); }

  getPermission(login: string) { return this.request<{ permission: string }>("GET", `${this.base}/collaborators/${enc(login)}/permission`); }
  getBranchRules(branch: string) { return this.request<BranchRule[]>("GET", `${this.base}/rules/branches/${enc(branch)}`); }

  getBranchSha(branch: string) { return this.request<{ object: { sha: string } }>("GET", `${this.base}/git/ref/heads/${enc(branch)}`); }
  createBlob(contentBase64: string) { return this.request<{ sha: string }>("POST", `${this.base}/git/blobs`, { content: contentBase64, encoding: "base64" }); }
  createTree(baseTree: string, tree: { path: string; mode: "100644" | "100755"; type: "blob"; sha: string | null }[]) {
    return this.request<{ sha: string }>("POST", `${this.base}/git/trees`, { base_tree: baseTree, tree });
  }
  createCommit(message: string, tree: string, parents: string[]) { return this.request<{ sha: string }>("POST", `${this.base}/git/commits`, { message, tree, parents }); }
  createFixRef(ref: string, sha: string) { return this.request("POST", `${this.base}/git/refs`, { ref, sha }); }
  fastForwardFixRef(branch: string, sha: string) { return this.request("PATCH", `${this.base}/git/refs/heads/${branch}`, { sha, force: false }); }

  createDraftPullRequest(p: { title: string; head: string; base: string; body: string }) {
    return this.request<{ id: number; number: number; html_url: string; head: { sha: string } }>("POST", `${this.base}/pulls`, { ...p, draft: true, maintainer_can_modify: false });
  }

  async updateOwnPullRequestBody(n: number, body: string) {
    const pr = await this.request<{ user: { login: string }; head: { ref: string } }>("GET", `${this.base}/pulls/${n}`);
    if (pr.user.login !== this.selfLogin || !pr.head.ref.startsWith(FIX_BRANCH_PREFIX))
      throw new ForbiddenGitHubCall("PATCH", `pulls/${n}`, "not our pull request");
    return this.request("PATCH", `${this.base}/pulls/${n}`, { body });
  }
}

export interface BranchRule {
  type: string;
  ruleset_id?: number;
  ruleset_source?: string;
  parameters?: { required_approving_review_count?: number; require_last_push_approval?: boolean; [k: string]: unknown };
}
