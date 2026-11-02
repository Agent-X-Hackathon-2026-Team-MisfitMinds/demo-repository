// Spike S1 + canary (SEC-18) against a real Docker daemon. Runs only with FIXIE_DOCKER_IT=1 (CI job `sandbox-it`).
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { DockerProvider, type Sandbox } from "../src/index.ts";

const enabled = process.env.FIXIE_DOCKER_IT === "1";

describe.skipIf(!enabled)("DockerProvider (real docker)", () => {
  let sb: Sandbox | undefined;
  afterAll(async () => { await sb?.destroy("completed"); });

  it("installs with network, then the network is gone and nothing secret is visible", async () => {
    const root = mkdtempSync(join(tmpdir(), "fx-it-"));
    const work = join(root, "work");
    mkdirSync(work);
    writeFileSync(join(work, "requirements.txt"), "six==1.16.0\n");
    const provider = new DockerProvider({ tempRoot: root, redact: (t) => ({ text: t, count: 0 }) });
    const started = Date.now();
    sb = await provider.create({ runId: `it${Date.now()}`, image: "python:3.12-bookworm", cpus: 1, memoryMb: 2048, pids: 512, workdir: work });

    const install = await sb.exec("python -m venv /deps/venv && . /deps/venv/bin/activate && pip install -q -r requirements.txt", { timeoutMs: 180_000 });
    expect(install.exitCode, install.output).toBe(0);

    const lock = await sb.lockNetwork();
    expect(lock.probe).toBe("blocked");

    const canary = await sb.exec([
      "set -u",
      "env | grep -Ei 'token|secret|key|password' && exit 11",
      "test -e /var/run/docker.sock && exit 12",
      "test -e /work/.git && exit 13",
      "test -e $HOME/.git-credentials && exit 14",
      "touch /etc/fixie-write 2>/dev/null && exit 15",
      "id -u | grep -qx 1001 || exit 16",
      "python -c 'import six' || exit 17",
      "exit 0",
    ].join("\n"), { timeoutMs: 30_000 });
    expect(canary.exitCode, canary.output).toBe(0);

    const t = await sb.exec("sleep 30", { timeoutMs: 2_000 });
    expect(t.timedOut).toBe(true);
    expect(Date.now() - started).toBeLessThan(240_000);
  }, 300_000);
});
