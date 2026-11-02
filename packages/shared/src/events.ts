// Engine → Hub event contract (05 §9, TRD §10.4). One definition, used by engine, ingest API and Hub.
import { z } from "zod";
import {
  BisectStatus, CheckpointKind, CheckpointResult, ConfidenceLevel, EventLevel, GateKind, HypothesisStatus,
  IncidentKind, LlmPurpose, RunOutcome, RunStatus, RunStep, RunTier, StepStatus, TestFramework, TestOutcome, TestPhase,
} from "./enums.ts";
import { BugSpec } from "./bug-spec.ts";
import { ProofCard } from "./proof-card.ts";

export const EVENT_TYPE_RE = /^[a-z_]+\.[a-z_]+$/;

const base = {
  seq: z.number().int().min(1),
  ts: z.string(), // ISO-8601
  step: RunStep.optional(),
  level: EventLevel.optional(),
  message: z.string().max(2000).optional(),
};
const ev = <T extends string, D extends z.ZodType>(type: T, data: D) =>
  z.object({ ...base, type: z.literal(type), data });

export const SuspiciousRegion = z.object({
  path: z.string(),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
  score: z.number().min(0).max(1),
  sources: z.array(z.enum(["ochiai", "stack", "bisect", "search"])),
  snippet: z.string().optional(),
});
export type SuspiciousRegion = z.infer<typeof SuspiciousRegion>;

export const TestResultRow = z.object({
  testId: z.string(),
  outcome: TestOutcome,
  durationMs: z.number().int().optional(),
  failureMessage: z.string().optional(),
  isRepro: z.boolean().optional(),
});
export type TestResultRow = z.infer<typeof TestResultRow>;

export const FixieEvent = z.discriminatedUnion("type", [
  ev("run.status", z.object({
    status: RunStatus,
    outcome: RunOutcome.optional(),
    failureDetail: z.string().max(2000).optional(),
    tier: RunTier.optional(),
    headSha: z.string().regex(/^[0-9a-f]{40}$/).optional(),
    sandbox: z.object({
      image: z.string(), cpus: z.number(), memoryMb: z.number(),
      networkLockedAt: z.string().optional(), egressProbe: z.enum(["blocked", "reachable"]).optional(),
    }).optional(),
    model: z.object({ preset: z.string(), name: z.string() }).optional(),
    fixieVersion: z.string().optional(),
  })),
  ev("step.started", z.object({ step: RunStep, attempt: z.number().int().min(1).default(1) })),
  ev("step.finished", z.object({
    step: RunStep, attempt: z.number().int().min(1).default(1), status: StepStatus, summary: z.string().max(2000).optional(),
  })),
  ev("log.line", z.record(z.string(), z.unknown())),
  ev("bug_spec.ready", z.object({ spec: BugSpec })),
  ev("clarification.requested", z.object({
    commentId: z.number().int(), missingFields: z.array(z.string()).min(1), askedAt: z.string(), expiresAt: z.string(),
  })),
  ev("clarification.answered", z.object({ commentId: z.number().int(), answeredAt: z.string() })),
  ev("command.started", z.object({ commandSeq: z.number().int().min(1), step: RunStep, command: z.string().max(4000), cwd: z.string() })),
  ev("command.finished", z.object({
    commandSeq: z.number().int().min(1), exitCode: z.number().int().nullable(), timedOut: z.boolean(),
    durationMs: z.number().int(), outputBytes: z.number().int(), redactionCount: z.number().int(), logKey: z.string().optional(),
  })),
  ev("tests.reported", z.object({ phase: TestPhase, framework: TestFramework, results: z.array(TestResultRow) })),
  ev("gate.evaluated", z.object({ gate: GateKind, attempt: z.number().int().min(1), passed: z.boolean(), evidence: z.record(z.string(), z.unknown()) })),
  ev("llm.call", z.object({
    purpose: LlmPurpose, step: RunStep, preset: z.string(), model: z.string(), inputTokens: z.number().int().min(0),
    outputTokens: z.number().int().min(0), costUsd: z.number().min(0), latencyMs: z.number().int(), ok: z.boolean(), error: z.string().max(500).optional(),
  })),
  ev("bisect.finished", z.object({
    status: BisectStatus, goodSha: z.string().nullable().optional(), firstBadSha: z.string().nullable().optional(),
    steps: z.number().int(), skipped: z.number().int(), commit: z.record(z.string(), z.unknown()).nullable().optional(), range: z.string().nullable().optional(),
  })),
  ev("localize.finished", z.object({ suspicious: z.array(SuspiciousRegion) })),
  ev("blast_radius.ready", z.object({
    callers: z.number().int(), files: z.number().int(), impactedTests: z.number().int(), impactedPassed: z.number().int(), list: z.array(z.string()),
  })),
  ev("hypothesis.updated", z.object({
    ordinal: z.number().int().min(1), summary: z.string().max(500), rationale: z.string().max(2000).optional(),
    files: z.array(z.string()).optional(), status: HypothesisStatus, rejectionReason: z.string().max(500).optional(),
  })),
  ev("checkpoint.created", z.object({
    seq: z.number().int().min(0), kind: CheckpointKind, hypothesisOrdinal: z.number().int().optional(), attempt: z.number().int().optional(),
    result: CheckpointResult, failingTests: z.number().int(), newFailures: z.number().int(), errorCount: z.number().int(),
    errorSignature: z.string().max(64).optional(), filesChanged: z.number().int(), linesAdded: z.number().int(),
    linesRemoved: z.number().int(), reason: z.string().max(500).optional(),
  })),
  ev("diagnosis.ready", z.object({ markdown: z.string() })),
  ev("proof_card.ready", z.object({ proofCard: ProofCard, confidence: z.object({ score: z.number().int(), level: ConfidenceLevel }) })),
  ev("pr.opened", z.object({
    githubPrId: z.number().int(), number: z.number().int(), url: z.string(),
    headBranch: z.string().startsWith("fixie/"), headSha: z.string().regex(/^[0-9a-f]{40}$/),
  })),
  ev("pr.updated", z.object({ number: z.number().int(), headSha: z.string().regex(/^[0-9a-f]{40}$/), revision: z.number().int().min(1) })),
  ev("comment.posted", z.record(z.string(), z.unknown())),
  ev("incident.raised", z.object({ kind: IncidentKind, details: z.record(z.string(), z.unknown()) })),
]);
export type FixieEvent = z.infer<typeof FixieEvent>;
export type FixieEventType = FixieEvent["type"];
export type EventData<T extends FixieEventType> = Extract<FixieEvent, { type: T }>["data"];

/** Ingest batch: ≤ 200 events (TRD §10.4). */
export const EventBatch = z.object({ events: z.array(FixieEvent).min(1).max(200) });
