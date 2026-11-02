// Language, framework, image and command detection (TRD §4, D-19). Pure: takes a file reader.
import type { FixieConfig, TestFramework, TestPhase } from "@fixie/shared";

export interface RepoFiles {
  exists(path: string): boolean;
  read(path: string): string | null;
}

export interface ProjectPlan {
  language: "python" | "node";
  framework: TestFramework;
  image: string;
  install: string;
  /** Shell command for a phase; `targets` are repo-relative test files (empty = whole suite). */
  test: (phase: TestPhase, targets?: string[]) => { cmd: string; env: Record<string, string>; junitPath: string };
  lint: { tool: string; cmd: string } | null;
  typecheck: { tool: string; cmd: string } | null;
  testDir: string;
  sources: Record<string, "detected" | "config" | "default">;
}

export class DetectError extends Error {}

const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const JUNIT_DIR = "/tmp/fx";
const junitFile = (phase: TestPhase) => `${JUNIT_DIR}/junit-${phase}.xml`;

function pyImage(f: RepoFiles): { image: string; src: "detected" | "default" } {
  const pv = f.read(".python-version")?.trim().split("\n")[0]?.trim();
  const m = pv ? /^(?:python-?)?(3\.\d{1,2})/.exec(pv) : null;
  if (m) return { image: `python:${m[1]}-bookworm`, src: "detected" };
  const req = /requires-python\s*=\s*["']([^"']+)["']/.exec(f.read("pyproject.toml") ?? "")?.[1];
  const exact = req ? /==\s*(3\.\d{1,2})/.exec(req) : null;
  if (exact) return { image: `python:${exact[1]}-bookworm`, src: "detected" };
  const below = req ? /<\s*(3)\.(\d{1,2})/.exec(req) : null;
  if (below && Number(below[2]) <= 12) return { image: `python:3.${Number(below[2]) - 1}-bookworm`, src: "detected" };
  return { image: "python:3.12-bookworm", src: "default" };
}

function nodeImage(f: RepoFiles, pkg: Record<string, unknown>): { image: string; src: "detected" | "default" } {
  const nvm = f.read(".nvmrc")?.trim() ?? f.read(".node-version")?.trim();
  const m = nvm ? /^v?(\d{2})/.exec(nvm) : null;
  if (m) return { image: `node:${m[1]}-bookworm`, src: "detected" };
  const eng = ((pkg.engines as Record<string, string> | undefined)?.node ?? "").trim();
  const e = /^(?:\^|~|>=)?\s*v?(\d{2})(?:\.x|\.\d+)?/.exec(eng);
  if (e && Number(e[1]) >= 18) return { image: `node:${e[1]}-bookworm`, src: "detected" };
  return { image: "node:22-bookworm", src: "default" };
}

function pythonPlan(f: RepoFiles): ProjectPlan {
  const pyproject = f.read("pyproject.toml") ?? "";
  const setupCfg = f.read("setup.cfg") ?? "";
  const { image, src } = pyImage(f);
  const venv = "python -m venv /deps/venv && . /deps/venv/bin/activate && python -m pip install -q --upgrade pip";
  let install: string;
  if (f.exists("uv.lock")) install = `${venv} && pip install -q uv && UV_PROJECT_ENVIRONMENT=/deps/venv uv sync --frozen --all-extras`;
  else if (f.exists("poetry.lock")) install = `${venv} && pip install -q poetry && poetry config virtualenvs.create false && poetry install --no-interaction --all-extras`;
  else {
    const reqs = ["requirements.txt", "requirements-dev.txt", "requirements-test.txt", "requirements_dev.txt", "dev-requirements.txt", "test-requirements.txt"].filter((r) => f.exists(r));
    const parts = reqs.map((r) => `pip install -q -r ${r}`);
    if (f.exists("pyproject.toml") || f.exists("setup.py")) parts.push(`(pip install -q -e '.[test]' || pip install -q -e '.[dev]' || pip install -q -e .)`);
    if (!parts.length) parts.push("true");
    install = `${venv} && ${parts.join(" && ")}`;
  }
  install += " && (python -c 'import pytest' 2>/dev/null || pip install -q pytest) && (python -c 'import coverage' 2>/dev/null || pip install -q coverage)";

  const hasRuff = /\[tool\.ruff/.test(pyproject) || f.exists("ruff.toml") || f.exists(".ruff.toml");
  const hasFlake8 = f.exists(".flake8") || /\[flake8\]/.test(setupCfg) || /\[flake8\]/.test(f.read("tox.ini") ?? "");
  const hasMypy = /\[tool\.mypy/.test(pyproject) || f.exists("mypy.ini") || f.exists(".mypy.ini") || /\[mypy\]/.test(setupCfg);
  const hasPyright = /\[tool\.pyright/.test(pyproject) || f.exists("pyrightconfig.json");
  const testDir = f.exists("tests") ? "tests" : f.exists("test") ? "test" : ".";
  return {
    language: "python",
    framework: "pytest",
    image,
    install,
    test: (phase, targets = []) => ({
      cmd: `mkdir -p ${JUNIT_DIR} && python -m pytest -q -p no:cacheprovider --junitxml=${junitFile(phase)} ${targets.map(q).join(" ")}`.trim(),
      env: {},
      junitPath: junitFile(phase),
    }),
    lint: hasRuff
      ? { tool: "ruff", cmd: "(command -v ruff >/dev/null || pip install -q ruff) && ruff check --output-format=json --exit-zero ." }
      : hasFlake8 ? { tool: "flake8", cmd: "(command -v flake8 >/dev/null || pip install -q flake8) && flake8 --exit-zero --format='%(path)s:%(row)d:%(col)d: %(code)s %(text)s' ." } : null,
    typecheck: hasMypy
      ? { tool: "mypy", cmd: "(command -v mypy >/dev/null || pip install -q mypy) && mypy --no-error-summary --show-absolute-path . || true" }
      : hasPyright ? { tool: "pyright", cmd: "(command -v pyright >/dev/null || pip install -q pyright) && pyright --outputjson || true" } : null,
    testDir,
    sources: { language: "detected", image: src, install: "detected", test: "detected" },
  };
}

function nodePlan(f: RepoFiles): ProjectPlan {
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(f.read("package.json") ?? "{}") as Record<string, unknown>;
  } catch {
    throw new DetectError("package.json is not valid JSON");
  }
  const deps = { ...(pkg.dependencies as object), ...(pkg.devDependencies as object) } as Record<string, string>;
  const framework: TestFramework | null = "vitest" in deps ? "vitest" : "jest" in deps ? "jest" : null;
  if (!framework) throw new DetectError("No supported test framework found (Vitest or Jest) in package.json");
  const { image, src } = nodeImage(f, pkg);
  const corepack = "mkdir -p /deps/node/bin && corepack enable --install-directory /deps/node/bin";
  let install: string;
  if (f.exists("pnpm-lock.yaml")) install = `${corepack} && pnpm install --frozen-lockfile`;
  else if (f.exists("yarn.lock")) install = f.exists(".yarnrc.yml") ? `${corepack} && yarn install --immutable` : `${corepack} && yarn install --frozen-lockfile`;
  else if (f.exists("package-lock.json") || f.exists("npm-shrinkwrap.json")) install = "npm ci --no-audit --no-fund";
  else install = "npm install --no-audit --no-fund";
  if (framework === "jest" && !("jest-junit" in deps)) install += " && npm install --prefix /deps/jestjunit --no-audit --no-fund jest-junit@16.0.0";

  const bin = (b: string) => `./node_modules/.bin/${b}`;
  const hasEslint = "eslint" in deps;
  const hasTsc = "typescript" in deps && f.exists("tsconfig.json");
  const testDir = ["tests", "test", "src/__tests__", "__tests__"].find((d) => f.exists(d)) ?? "src";
  const jestReporter = "jest-junit" in deps ? "jest-junit" : "/deps/jestjunit/node_modules/jest-junit";
  return {
    language: "node",
    framework,
    image,
    install,
    test: (phase, targets = []): { cmd: string; env: Record<string, string>; junitPath: string } =>
      framework === "vitest"
        ? {
            cmd: `mkdir -p ${JUNIT_DIR} && ${bin("vitest")} run --reporter=default --reporter=junit --outputFile.junit=${junitFile(phase)} ${targets.map(q).join(" ")}`.trim(),
            env: {},
            junitPath: junitFile(phase),
          }
        : {
            cmd: `mkdir -p ${JUNIT_DIR} && ${bin("jest")} --ci --reporters=default --reporters=${jestReporter} ${targets.map(q).join(" ")}`.trim(),
            env: { JEST_JUNIT_OUTPUT_DIR: JUNIT_DIR, JEST_JUNIT_OUTPUT_NAME: `junit-${phase}.xml` },
            junitPath: junitFile(phase),
          },
    lint: hasEslint ? { tool: "eslint", cmd: `${bin("eslint")} -f json . || true` } : null,
    typecheck: hasTsc ? { tool: "tsc", cmd: `${bin("tsc")} --noEmit --pretty false -p tsconfig.json || true` } : null,
    testDir,
    sources: { language: "detected", image: src, install: "detected", test: "detected" },
  };
}

/** Detect, then apply `.fixie.yml` project overrides. */
export function planProject(f: RepoFiles, cfg: FixieConfig): ProjectPlan {
  const p = cfg.project;
  const isPy = ["pyproject.toml", "setup.py", "setup.cfg", "requirements.txt", "pytest.ini", "tox.ini"].some((x) => f.exists(x));
  const isNode = f.exists("package.json");
  const lang = p.language !== "auto" ? p.language : isNode && !isPy ? "node" : isPy ? "python" : isNode ? "node" : null;
  if (!lang) throw new DetectError("Couldn't detect a Python or JavaScript/TypeScript project");
  const plan = lang === "python" ? pythonPlan(f) : nodePlan(f);
  if (p.language !== "auto") plan.sources.language = "config";
  if (p.image !== "auto") { plan.image = p.image; plan.sources.image = "config"; }
  if (p.install !== "auto") { plan.install = p.install; plan.sources.install = "config"; }
  if (p.test !== "auto") {
    const custom = p.test;
    const base = plan.test;
    plan.test = (phase, targets = []) => {
      const b = base(phase, targets);
      return { ...b, cmd: `mkdir -p ${JUNIT_DIR} && ${custom.replaceAll("{junit}", b.junitPath)} ${targets.map(q).join(" ")}`.trim() };
    };
    plan.sources.test = "config";
  }
  if (p.lint === "off") plan.lint = null;
  else if (p.lint !== "auto") plan.lint = { tool: "custom", cmd: p.lint };
  if (p.typecheck === "off") plan.typecheck = null;
  else if (p.typecheck !== "auto") plan.typecheck = { tool: "custom", cmd: p.typecheck };
  return plan;
}

/** Manifest and lockfile names used for dependency-stable bisect (TRD §3.4). */
export const DEPENDENCY_FILES = [
  "requirements.txt", "requirements-dev.txt", "requirements-test.txt", "pyproject.toml", "poetry.lock", "uv.lock",
  "Pipfile.lock", "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
] as const;
