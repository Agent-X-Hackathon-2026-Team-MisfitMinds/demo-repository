// ProofCard JSON (TRD §3.7). Rendered to Markdown by the engine and to React in the Hub.
import { z } from "zod";
import { BisectStatus, ConfidenceLevel, GateKind, HypothesisStatus, TestOutcome } from "./enums.ts";

export const BisectResult = z.object({
  status: BisectStatus,
  goodSha: z.string().nullable(),
  firstBadSha: z.string().nullable(),
  steps: z.number().int().min(0),
  skipped: z.number().int().min(0),
  commit: z
    .object({
      message: z.string(),
      author: z.string(),
      date: z.string(),
      files: z.array(z.string()),
    })
    .nullable(),
  range: z.string().nullable().optional(),
});
export type BisectResult = z.infer<typeof BisectResult>;

export const ProofCard = z.object({
  repro: z.object({
    testId: z.string(),
    beforeMessage: z.string(),
    beforeOutcome: TestOutcome,
    afterOutcome: TestOutcome,
  }),
  suite: z.object({
    baselinePassed: z.number().int().min(0),
    baselineFailed: z.number().int().min(0),
    finalPassed: z.number().int().min(0),
    finalFailed: z.number().int().min(0),
    newlyFailing: z.number().int().min(0),
  }),
  bisect: BisectResult,
  blastRadius: z
    .object({ callers: z.number().int(), impactedTests: z.number().int(), impactedPassed: z.number().int() })
    .nullable(),
  hypotheses: z.array(
    z.object({ ordinal: z.number().int().min(1), summary: z.string(), status: HypothesisStatus, reason: z.string().nullable() }),
  ),
  attempts: z.object({ total: z.number().int().min(0), reverted: z.number().int().min(0) }),
  confidence: z.object({ score: z.number().int().min(0).max(100), level: ConfidenceLevel, reasons: z.array(z.string()) }),
  sandbox: z.object({ image: z.string(), networkLockedAt: z.string(), egressProbe: z.literal("blocked") }),
  model: z.object({ preset: z.string(), name: z.string(), calls: z.number().int().min(0), costUsd: z.number().min(0) }),
  gates: z.array(z.object({ gate: GateKind, passed: z.boolean() })),
});
export type ProofCard = z.infer<typeof ProofCard>;
