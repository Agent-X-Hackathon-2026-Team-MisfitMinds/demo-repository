// Secret scanning and redaction (SEC-10, gate secret_scan). Rule ids are reported; secret values never are.

export interface SecretRule {
  id: string;
  re: RegExp;
}

/** gitleaks-compatible subset + GitHub token formats. Keep regexes linear (no nested quantifiers). */
export const SECRET_RULES: readonly SecretRule[] = [
  { id: "github-pat", re: /\bghp_[A-Za-z0-9]{36}\b/g },
  { id: "github-fine-grained-pat", re: /\bgithub_pat_[A-Za-z0-9_]{82}\b/g },
  { id: "github-oauth", re: /\bgho_[A-Za-z0-9]{36}\b/g },
  { id: "github-app-token", re: /\b(?:ghu|ghs)_[A-Za-z0-9]{36}\b/g },
  { id: "github-refresh-token", re: /\bghr_[A-Za-z0-9]{36}\b/g },
  { id: "aws-access-key-id", re: /\b(?:AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b/g },
  { id: "private-key", re: /-----BEGIN[ A-Z0-9_-]{0,100}PRIVATE KEY(?: BLOCK)?-----/g },
  { id: "slack-token", re: /\bxox[baprs]-[0-9A-Za-z-]{10,250}\b/g },
  { id: "stripe-secret-key", re: /\b(?:sk|rk)_(?:live|test)_[0-9A-Za-z]{10,99}\b/g },
  { id: "openai-api-key", re: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,200}\b/g },
  { id: "anthropic-api-key", re: /\bsk-ant-[A-Za-z0-9_-]{20,200}\b/g },
  { id: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: "groq-api-key", re: /\bgsk_[A-Za-z0-9]{20,100}\b/g },
  { id: "supabase-secret-key", re: /\bsb_secret_[A-Za-z0-9_-]{20,200}\b/g },
  { id: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class Redactor {
  private readonly runtime: string[];
  constructor(runtimeSecrets: readonly (string | undefined | null)[] = []) {
    // Ignore trivially short values: redacting "1" would destroy every log line.
    this.runtime = [...new Set(runtimeSecrets.filter((s): s is string => !!s && s.length >= 8))].sort(
      (a, b) => b.length - a.length,
    );
  }

  /** Rule ids that match `text` (runtime values report as `runtime-secret`). */
  scan(text: string): string[] {
    const hits = new Set<string>();
    for (const v of this.runtime) if (text.includes(v)) hits.add("runtime-secret");
    for (const r of SECRET_RULES) {
      r.re.lastIndex = 0;
      if (r.re.test(text)) hits.add(r.id);
    }
    return [...hits].sort();
  }

  redact(text: string): { text: string; count: number } {
    let count = 0;
    let out = text;
    for (const v of this.runtime) {
      out = out.replace(new RegExp(escapeRe(v), "g"), () => (count++, "***"));
    }
    for (const r of SECRET_RULES) {
      out = out.replace(new RegExp(r.re.source, r.re.flags), () => (count++, "***"));
    }
    return { text: out, count };
  }
}
