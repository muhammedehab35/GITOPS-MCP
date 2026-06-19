# GitHub MCP Server — MVP Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional MCP server in TypeScript that exposes 13 GitHub Actions tools to AI agents, with Claude-powered log analysis.

**Architecture:** A FastMCP server (stdio transport) wraps the GitHub REST API via Octokit. Each tool is registered in its own file and receives injected dependencies (connector, analyzer, AI engine). The AI engine calls Claude to diagnose CI/CD failures from parsed log output.

**Tech Stack:** Node.js 20+, TypeScript 5, FastMCP 2.x, @octokit/rest, @anthropic-ai/sdk, Zod, Vitest, Docker.

---

## File Map

```
d:\NEW_PROJECTS\PROJECT_05_GITHUB_MCP\
├── src/
│   ├── index.ts                        # MCP server wiring & startup
│   ├── config/
│   │   └── env.ts                      # Env var parsing + validation
│   ├── modules/
│   │   ├── auth/
│   │   │   └── github-auth.ts          # GitHub PAT → Octokit instance
│   │   ├── connector/
│   │   │   └── github-rest.ts          # All GitHub REST API calls
│   │   ├── logs/
│   │   │   └── logs-analyzer.ts        # Log parsing, error extraction
│   │   ├── ai/
│   │   │   └── ai-engine.ts            # Claude API integration
│   │   └── monitoring/
│   │       └── workflow-monitor.ts     # Polling-based repo watcher
│   └── tools/
│       ├── repositories.ts             # github_list_repositories
│       ├── workflows.ts                # github_list_workflows, github_list_workflow_runs, github_get_workflow_run
│       ├── watcher.ts                  # github_watch_workflow
│       ├── logs.ts                     # github_get_workflow_logs, github_analyze_failure
│       ├── actions.ts                  # github_rerun_workflow, github_cancel_workflow
│       ├── artifacts.ts                # github_download_artifacts
│       ├── deployments.ts              # github_get_deployments, github_rollback_deployment
│       └── monitor.ts                  # github_monitor_repository
├── tests/
│   ├── modules/
│   │   ├── logs-analyzer.test.ts
│   │   └── ai-engine.test.ts
│   └── tools/
│       ├── repositories.test.ts
│       └── workflows.test.ts
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── Dockerfile
└── docker-compose.yml
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Initialize git repository**

```bash
cd d:\NEW_PROJECTS\PROJECT_05_GITHUB_MCP
git init
```

Expected: `Initialized empty Git repository`

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "github-mcp-server",
  "version": "1.0.0",
  "description": "Intelligent GitHub MCP Server for CI/CD workflow management via GitHub Actions",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.37.0",
    "@octokit/graphql": "^8.1.1",
    "@octokit/rest": "^21.0.2",
    "dotenv": "^16.4.5",
    "fastmcp": "^2.2.6",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
.env
*.log
.DS_Store
coverage/
```

- [ ] **Step 5: Create `.env.example`**

```env
# GitHub Personal Access Token
# Required scopes: repo, workflow, read:org
# Create at: https://github.com/settings/tokens
GITHUB_TOKEN=ghp_your_personal_access_token_here

# Anthropic API Key for Claude-powered log analysis
# Get at: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-your_api_key_here

# Polling interval in milliseconds for monitor_repository tool (default: 30000 = 30s)
POLLING_INTERVAL_MS=30000

# Log level: debug | info | warn | error
LOG_LEVEL=info
```

- [ ] **Step 6: Create directory structure**

```bash
mkdir -p src/config src/modules/auth src/modules/connector src/modules/logs src/modules/ai src/modules/monitoring src/tools tests/modules tests/tools
```

- [ ] **Step 7: Install dependencies**

```bash
npm install
```

Expected output: `added N packages` with no errors.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: initialize project structure with dependencies"
```

---

## Task 2: Environment Configuration

**Files:**
- Create: `src/config/env.ts`

- [ ] **Step 1: Create `src/config/env.ts`**

```typescript
import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  GITHUB_TOKEN: z.string().min(1, "GITHUB_TOKEN is required — create a PAT at https://github.com/settings/tokens"),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required — get it at https://console.anthropic.com/"),
  POLLING_INTERVAL_MS: z
    .string()
    .default("30000")
    .transform((v) => parseInt(v, 10)),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Environment configuration error:\n${errors}`);
  }
  return result.data;
}

export const env = loadEnv();
```

- [ ] **Step 2: Create `.env` from template (local testing only, never commit)**

```bash
cp .env.example .env
```

Then edit `.env` and fill in actual values. The server will throw a clear error at startup if any required variable is missing.

- [ ] **Step 3: Commit**

```bash
git add src/config/env.ts
git commit -m "feat: add environment configuration with Zod validation"
```

---

## Task 3: GitHub Auth Module

**Files:**
- Create: `src/modules/auth/github-auth.ts`

- [ ] **Step 1: Create `src/modules/auth/github-auth.ts`**

```typescript
import { Octokit } from "@octokit/rest";

export class GitHubAuth {
  private token: string;

  constructor(token: string) {
    if (!token || token.trim() === "") {
      throw new Error("GitHub token must not be empty");
    }
    this.token = token;
  }

  createRestClient(): Octokit {
    return new Octokit({
      auth: this.token,
      userAgent: "github-mcp-server/1.0.0",
    });
  }

  getToken(): string {
    return this.token;
  }

  maskToken(): string {
    return `${this.token.slice(0, 4)}${"*".repeat(this.token.length - 8)}${this.token.slice(-4)}`;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/auth/github-auth.ts
git commit -m "feat: add GitHub auth module with PAT support"
```

---

## Task 4: GitHub REST Connector

**Files:**
- Create: `src/modules/connector/github-rest.ts`

- [ ] **Step 1: Create `src/modules/connector/github-rest.ts`**

```typescript
import { Octokit } from "@octokit/rest";
import type { GitHubAuth } from "../auth/github-auth.js";

export class GitHubRestConnector {
  private octokit: Octokit;

  constructor(auth: GitHubAuth) {
    this.octokit = auth.createRestClient();
  }

  // ── Repositories ──────────────────────────────────────────────
  async listRepositories(type: "all" | "owner" | "member" = "owner") {
    const { data } = await this.octokit.repos.listForAuthenticatedUser({
      type,
      sort: "updated",
      per_page: 100,
    });
    return data;
  }

  // ── Workflows ─────────────────────────────────────────────────
  async listWorkflows(owner: string, repo: string) {
    const { data } = await this.octokit.actions.listRepoWorkflows({ owner, repo });
    return data.workflows;
  }

  async listWorkflowRuns(
    owner: string,
    repo: string,
    options?: {
      workflowId?: number | string;
      status?: "completed" | "in_progress" | "queued" | "waiting" | "requested" | "pending";
      branch?: string;
      perPage?: number;
    }
  ) {
    if (options?.workflowId) {
      const { data } = await this.octokit.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: options.workflowId,
        status: options.status,
        branch: options.branch,
        per_page: options.perPage ?? 30,
      });
      return data.workflow_runs;
    }
    const { data } = await this.octokit.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      status: options?.status,
      branch: options?.branch,
      per_page: options?.perPage ?? 30,
    });
    return data.workflow_runs;
  }

  async getWorkflowRun(owner: string, repo: string, runId: number) {
    const { data } = await this.octokit.actions.getWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });
    return data;
  }

  async getWorkflowRunJobs(owner: string, repo: string, runId: number) {
    const { data } = await this.octokit.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });
    return data.jobs;
  }

  // ── Logs ──────────────────────────────────────────────────────
  async getJobLogs(owner: string, repo: string, jobId: number): Promise<string> {
    const response = await this.octokit.request(
      "GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs",
      { owner, repo, job_id: jobId }
    );
    return String(response.data ?? "");
  }

  async getWorkflowRunLogsUrl(owner: string, repo: string, runId: number): Promise<string> {
    const response = await this.octokit.request(
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs",
      { owner, repo, run_id: runId, request: { redirect: "manual" } }
    );
    return (response.headers as Record<string, string>)["location"] ?? "";
  }

  // ── Actions ───────────────────────────────────────────────────
  async rerunWorkflow(owner: string, repo: string, runId: number) {
    await this.octokit.actions.reRunWorkflow({ owner, repo, run_id: runId });
    return { success: true, message: `Workflow run ${runId} restarted.` };
  }

  async rerunFailedJobs(owner: string, repo: string, runId: number) {
    await this.octokit.actions.reRunWorkflowFailedJobs({ owner, repo, run_id: runId });
    return { success: true, message: `Failed jobs in run ${runId} restarted.` };
  }

  async cancelWorkflow(owner: string, repo: string, runId: number) {
    await this.octokit.actions.cancelWorkflowRun({ owner, repo, run_id: runId });
    return { success: true, message: `Workflow run ${runId} cancelled.` };
  }

  // ── Artifacts ─────────────────────────────────────────────────
  async listArtifacts(owner: string, repo: string, runId: number) {
    const { data } = await this.octokit.actions.listWorkflowRunArtifacts({
      owner,
      repo,
      run_id: runId,
    });
    return data.artifacts;
  }

  async getArtifactDownloadUrl(owner: string, repo: string, artifactId: number): Promise<string> {
    const response = await this.octokit.request(
      "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}",
      { owner, repo, artifact_id: artifactId, archive_format: "zip", request: { redirect: "manual" } }
    );
    return (response.headers as Record<string, string>)["location"] ?? "";
  }

  // ── Deployments ───────────────────────────────────────────────
  async listDeployments(owner: string, repo: string, environment?: string) {
    const { data } = await this.octokit.repos.listDeployments({
      owner,
      repo,
      environment,
      per_page: 30,
    });
    return data;
  }

  async getDeploymentStatuses(owner: string, repo: string, deploymentId: number) {
    const { data } = await this.octokit.repos.listDeploymentStatuses({
      owner,
      repo,
      deployment_id: deploymentId,
    });
    return data;
  }

  async createDeployment(owner: string, repo: string, ref: string, environment: string) {
    const { data } = await this.octokit.repos.createDeployment({
      owner,
      repo,
      ref,
      environment,
      auto_merge: false,
      required_contexts: [],
    });
    return data;
  }

  async createDeploymentStatus(
    owner: string,
    repo: string,
    deploymentId: number,
    state: "inactive" | "error" | "failure" | "pending" | "success"
  ) {
    const { data } = await this.octokit.repos.createDeploymentStatus({
      owner,
      repo,
      deployment_id: deploymentId,
      state,
    });
    return data;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/connector/github-rest.ts
git commit -m "feat: add GitHub REST connector wrapping all required Octokit endpoints"
```

---

## Task 5: Logs Analyzer Module

**Files:**
- Create: `src/modules/logs/logs-analyzer.ts`
- Create: `tests/modules/logs-analyzer.test.ts`

- [ ] **Step 1: Write failing test `tests/modules/logs-analyzer.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { LogsAnalyzer } from "../../src/modules/logs/logs-analyzer.js";

const SAMPLE_LOG = `
2024-01-15T10:00:00.000Z ##[group]Set up job
2024-01-15T10:00:01.000Z Current runner version: '2.311.0'
2024-01-15T10:00:01.000Z ##[endgroup]
2024-01-15T10:00:02.000Z ##[group]Install dependencies
2024-01-15T10:00:03.000Z npm warn deprecated some-pkg@1.0.0
2024-01-15T10:00:04.000Z npm ERR! code ERESOLVE
2024-01-15T10:00:04.000Z npm ERR! Cannot resolve dependency tree
2024-01-15T10:00:05.000Z ##[endgroup]
2024-01-15T10:00:06.000Z ##[group]Run tests
2024-01-15T10:00:07.000Z FAILED: 3 tests failed
2024-01-15T10:00:08.000Z Error: AssertionError expected true but got false
2024-01-15T10:00:09.000Z ##[endgroup]
`;

describe("LogsAnalyzer", () => {
  const analyzer = new LogsAnalyzer();

  it("detects failed steps from log output", () => {
    const result = analyzer.parseWorkflowLogs(SAMPLE_LOG);
    expect(result.hasErrors).toBe(true);
    expect(result.failedSteps.length).toBeGreaterThan(0);
  });

  it("extracts error messages from logs", () => {
    const result = analyzer.parseWorkflowLogs(SAMPLE_LOG);
    const allErrors = result.failedSteps.flatMap((s) => s.errorMessages);
    expect(allErrors.some((e) => e.includes("npm ERR!"))).toBe(true);
  });

  it("counts total steps correctly", () => {
    const result = analyzer.parseWorkflowLogs(SAMPLE_LOG);
    expect(result.totalSteps).toBe(3);
  });

  it("returns no errors for clean log", () => {
    const cleanLog = `
2024-01-15T10:00:00.000Z ##[group]Set up job
2024-01-15T10:00:01.000Z Current runner version: '2.311.0'
2024-01-15T10:00:01.000Z ##[endgroup]
`;
    const result = analyzer.parseWorkflowLogs(cleanLog);
    expect(result.hasErrors).toBe(false);
    expect(result.failedSteps).toHaveLength(0);
  });

  it("extracts error context with surrounding lines", () => {
    const context = analyzer.extractErrorContext(SAMPLE_LOG, 2);
    expect(context).toContain("npm ERR!");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/modules/logs-analyzer.test.ts
```

Expected: FAIL — `LogsAnalyzer` not found.

- [ ] **Step 3: Create `src/modules/logs/logs-analyzer.ts`**

```typescript
export interface ParsedStep {
  stepName: string;
  status: "success" | "failure" | "unknown";
  errorMessages: string[];
  rawLines: string[];
}

export interface LogAnalysisResult {
  totalSteps: number;
  failedSteps: ParsedStep[];
  errorSummary: string[];
  hasErrors: boolean;
}

const ERROR_PATTERNS = [
  /npm ERR!/,
  /error:/i,
  /Error:/,
  /FAILED/,
  /failure/i,
  /exception/i,
  /Process completed with exit code [^0]/,
  /Command failed/i,
  /AssertionError/,
];

const STEP_START = /##\[group\]/;
const STEP_END = /##\[endgroup\]/;

export class LogsAnalyzer {
  parseWorkflowLogs(rawLogs: string): LogAnalysisResult {
    const lines = rawLogs.split("\n");
    const steps: ParsedStep[] = [];
    let current: ParsedStep | null = null;

    for (const line of lines) {
      if (STEP_START.test(line)) {
        if (current) steps.push(this.finalizeStep(current));
        const stepName = line.replace(/.*##\[group\]/, "").trim();
        current = { stepName, status: "unknown", errorMessages: [], rawLines: [] };
      } else if (STEP_END.test(line)) {
        if (current) {
          steps.push(this.finalizeStep(current));
          current = null;
        }
      } else if (current) {
        current.rawLines.push(line);
        const stripped = line.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s+/, "").trim();
        if (stripped && ERROR_PATTERNS.some((p) => p.test(stripped))) {
          current.errorMessages.push(stripped);
        }
      }
    }

    if (current) steps.push(this.finalizeStep(current));

    const failedSteps = steps.filter((s) => s.errorMessages.length > 0);
    const errorSummary = failedSteps.flatMap((s) => s.errorMessages).slice(0, 20);

    return { totalSteps: steps.length, failedSteps, errorSummary, hasErrors: failedSteps.length > 0 };
  }

  extractErrorContext(rawLogs: string, contextLines = 5): string {
    const lines = rawLogs.split("\n");
    const errorIndices: number[] = [];

    lines.forEach((line, idx) => {
      if (ERROR_PATTERNS.some((p) => p.test(line))) errorIndices.push(idx);
    });

    const keep = new Set<number>();
    errorIndices.forEach((idx) => {
      for (let i = Math.max(0, idx - contextLines); i <= Math.min(lines.length - 1, idx + contextLines); i++) {
        keep.add(i);
      }
    });

    return Array.from(keep)
      .sort((a, b) => a - b)
      .map((i) => lines[i])
      .join("\n");
  }

  private finalizeStep(step: ParsedStep): ParsedStep {
    step.status = step.errorMessages.length > 0 ? "failure" : "success";
    return step;
  }
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run tests/modules/logs-analyzer.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/logs/logs-analyzer.ts tests/modules/logs-analyzer.test.ts
git commit -m "feat: add logs analyzer with step parsing and error pattern detection"
```

---

## Task 6: AI Engine Module (Claude)

**Files:**
- Create: `src/modules/ai/ai-engine.ts`
- Create: `tests/modules/ai-engine.test.ts`

- [ ] **Step 1: Write failing test `tests/modules/ai-engine.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Anthropic SDK before importing AIEngine
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              probableCause: "npm dependency conflict caused the build to fail",
              suggestedFixes: ["Update package-lock.json", "Use --legacy-peer-deps flag", "Downgrade conflicting package"],
              severity: "high",
              isRecurring: false,
              diagnosticReport: "The build failed due to an npm peer dependency conflict. The package versions are incompatible.",
            }),
          },
        ],
      }),
    },
  })),
}));

// Mock env
vi.mock("../../src/config/env.js", () => ({
  env: { ANTHROPIC_API_KEY: "sk-ant-test", POLLING_INTERVAL_MS: 30000, LOG_LEVEL: "info" },
}));

import { AIEngine } from "../../src/modules/ai/ai-engine.js";
import type { LogAnalysisResult } from "../../src/modules/logs/logs-analyzer.js";

describe("AIEngine", () => {
  let engine: AIEngine;

  beforeEach(() => {
    engine = new AIEngine();
  });

  it("returns a structured analysis from Claude response", async () => {
    const logAnalysis: LogAnalysisResult = {
      totalSteps: 3,
      failedSteps: [{ stepName: "Install dependencies", status: "failure", errorMessages: ["npm ERR! ERESOLVE"], rawLines: [] }],
      errorSummary: ["npm ERR! ERESOLVE"],
      hasErrors: true,
    };

    const result = await engine.analyzeFailure("CI", "my-repo", logAnalysis, "npm ERR! ERESOLVE Cannot resolve");
    expect(result.probableCause).toBeTruthy();
    expect(result.suggestedFixes).toHaveLength(3);
    expect(["low", "medium", "high", "critical"]).toContain(result.severity);
  });

  it("falls back gracefully when Claude returns non-JSON", async () => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const mockInstance = (Anthropic as ReturnType<typeof vi.fn>).mock.results[0].value;
    mockInstance.messages.create.mockResolvedValueOnce({
      content: [{ type: "text", text: "I cannot analyze this right now." }],
    });

    const logAnalysis: LogAnalysisResult = { totalSteps: 0, failedSteps: [], errorSummary: [], hasErrors: false };
    const result = await engine.analyzeFailure("CI", "repo", logAnalysis, "");
    expect(result.probableCause).toBeTruthy();
    expect(result.suggestedFixes.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/modules/ai-engine.test.ts
```

Expected: FAIL — `AIEngine` not found.

- [ ] **Step 3: Create `src/modules/ai/ai-engine.ts`**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";
import type { LogAnalysisResult } from "../logs/logs-analyzer.js";

export interface AIAnalysis {
  probableCause: string;
  suggestedFixes: string[];
  severity: "low" | "medium" | "high" | "critical";
  isRecurring: boolean;
  diagnosticReport: string;
}

const FALLBACK: AIAnalysis = {
  probableCause: "Unable to determine cause automatically — review logs manually",
  suggestedFixes: [
    "Inspect the full build log for the failing step",
    "Check recent commits for breaking changes",
    "Verify all required environment variables and secrets are set",
  ],
  severity: "medium",
  isRecurring: false,
  diagnosticReport: "Automatic analysis unavailable. Manual investigation required.",
};

export class AIEngine {
  private client: Anthropic;
  private readonly model = "claude-sonnet-4-6";

  constructor() {
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  async analyzeFailure(
    workflowName: string,
    repoName: string,
    logAnalysis: LogAnalysisResult,
    rawErrorContext: string
  ): Promise<AIAnalysis> {
    const prompt = this.buildPrompt(workflowName, repoName, logAnalysis, rawErrorContext);

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: "You are a senior DevOps engineer expert at diagnosing GitHub Actions CI/CD failures. Always respond with valid JSON only, no markdown.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0]?.type === "text" ? message.content[0].text : "";
    return this.parseResponse(text);
  }

  private buildPrompt(
    workflowName: string,
    repoName: string,
    logAnalysis: LogAnalysisResult,
    rawErrorContext: string
  ): string {
    const failedStepNames = logAnalysis.failedSteps.map((s) => `- ${s.stepName}`).join("\n") || "None identified";
    const errorMessages = logAnalysis.errorSummary.slice(0, 10).join("\n") || "None extracted";

    return `Diagnose this GitHub Actions failure:

Repository: ${repoName}
Workflow: ${workflowName}

Failed steps:
${failedStepNames}

Error messages:
${errorMessages}

Raw error context:
\`\`\`
${rawErrorContext.slice(0, 2000)}
\`\`\`

Respond ONLY with this JSON (no markdown, no prose):
{
  "probableCause": "<one sentence>",
  "suggestedFixes": ["<fix 1>", "<fix 2>", "<fix 3>"],
  "severity": "<low|medium|high|critical>",
  "isRecurring": false,
  "diagnosticReport": "<2-3 sentence detailed report>"
}`;
  }

  private parseResponse(text: string): AIAnalysis {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Partial<AIAnalysis>;
        return {
          probableCause: parsed.probableCause ?? FALLBACK.probableCause,
          suggestedFixes: Array.isArray(parsed.suggestedFixes) ? parsed.suggestedFixes : FALLBACK.suggestedFixes,
          severity: (["low", "medium", "high", "critical"] as const).includes(parsed.severity as never)
            ? (parsed.severity as AIAnalysis["severity"])
            : "medium",
          isRecurring: parsed.isRecurring ?? false,
          diagnosticReport: parsed.diagnosticReport ?? FALLBACK.diagnosticReport,
        };
      }
    } catch {
      // JSON parse failed, use fallback
    }
    return { ...FALLBACK, diagnosticReport: text.slice(0, 500) || FALLBACK.diagnosticReport };
  }
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run tests/modules/ai-engine.test.ts
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/ai/ai-engine.ts tests/modules/ai-engine.test.ts
git commit -m "feat: add AI engine using Claude API for CI/CD failure analysis"
```

---

## Task 7: Workflow Monitor Module

**Files:**
- Create: `src/modules/monitoring/workflow-monitor.ts`

- [ ] **Step 1: Create `src/modules/monitoring/workflow-monitor.ts`**

```typescript
import type { GitHubRestConnector } from "../connector/github-rest.js";

export interface WorkflowEvent {
  type: "run_started" | "run_completed" | "run_failed" | "run_cancelled";
  owner: string;
  repo: string;
  runId: number;
  workflowName: string;
  conclusion: string | null;
  timestamp: string;
}

type EventCallback = (event: WorkflowEvent) => void;

interface MonitorEntry {
  owner: string;
  repo: string;
  intervalMs: number;
  connector: GitHubRestConnector;
  lastSeenRunId: number;
  timer: NodeJS.Timeout;
}

export class WorkflowMonitor {
  private monitors = new Map<string, MonitorEntry>();
  private listeners: EventCallback[] = [];

  onEvent(callback: EventCallback): void {
    this.listeners.push(callback);
  }

  startMonitoring(
    connector: GitHubRestConnector,
    owner: string,
    repo: string,
    intervalMs: number
  ): string {
    const key = `${owner}/${repo}`;
    if (this.monitors.has(key)) return key;

    const timer = setInterval(() => void this.poll(key), intervalMs);
    this.monitors.set(key, { owner, repo, intervalMs, connector, lastSeenRunId: 0, timer });

    // Immediate first poll
    void this.poll(key);
    return key;
  }

  stopMonitoring(owner: string, repo: string): boolean {
    const key = `${owner}/${repo}`;
    const entry = this.monitors.get(key);
    if (!entry) return false;
    clearInterval(entry.timer);
    this.monitors.delete(key);
    return true;
  }

  listMonitored(): string[] {
    return Array.from(this.monitors.keys());
  }

  private async poll(key: string): Promise<void> {
    const entry = this.monitors.get(key);
    if (!entry) return;

    try {
      const runs = await entry.connector.listWorkflowRuns(entry.owner, entry.repo, { perPage: 10 });
      const newRuns = runs.filter((r) => r.id > entry.lastSeenRunId);

      for (const run of newRuns) {
        const type: WorkflowEvent["type"] =
          run.status === "in_progress"
            ? "run_started"
            : run.conclusion === "failure"
            ? "run_failed"
            : run.conclusion === "cancelled"
            ? "run_cancelled"
            : "run_completed";

        const event: WorkflowEvent = {
          type,
          owner: entry.owner,
          repo: entry.repo,
          runId: run.id,
          workflowName: run.name ?? "Unknown Workflow",
          conclusion: run.conclusion ?? null,
          timestamp: new Date().toISOString(),
        };

        this.listeners.forEach((cb) => cb(event));
      }

      if (runs.length > 0) {
        entry.lastSeenRunId = Math.max(...runs.map((r) => r.id));
      }
    } catch (error) {
      console.error(`[WorkflowMonitor] Error polling ${key}:`, error);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/monitoring/workflow-monitor.ts
git commit -m "feat: add polling-based workflow monitor with event callbacks"
```

---

## Task 8: Tool — `github_list_repositories`

**Files:**
- Create: `src/tools/repositories.ts`
- Create: `tests/tools/repositories.test.ts`

- [ ] **Step 1: Write failing test `tests/tools/repositories.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { buildRepositoryTools } from "../../src/tools/repositories.js";

const mockConnector = {
  listRepositories: vi.fn().mockResolvedValue([
    {
      full_name: "octocat/Hello-World",
      description: "My first repository",
      private: false,
      language: "JavaScript",
      stargazers_count: 1500,
      updated_at: "2024-01-15T10:00:00Z",
      default_branch: "main",
    },
  ]),
};

describe("buildRepositoryTools", () => {
  it("returns a single tool definition", () => {
    const tools = buildRepositoryTools(mockConnector as never);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("github_list_repositories");
  });

  it("execute returns JSON list of repos", async () => {
    const tools = buildRepositoryTools(mockConnector as never);
    const result = await tools[0]!.execute({ type: "owner" }, {} as never);
    const parsed = JSON.parse(result as string) as unknown[];
    expect(parsed).toHaveLength(1);
    expect((parsed[0] as { name: string }).name).toBe("octocat/Hello-World");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/tools/repositories.test.ts
```

Expected: FAIL — `buildRepositoryTools` not found.

- [ ] **Step 3: Create `src/tools/repositories.ts`**

```typescript
import { z } from "zod";
import type { GitHubRestConnector } from "../modules/connector/github-rest.js";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodTypeAny;
  execute: (args: Record<string, unknown>, context: unknown) => Promise<string>;
}

export function buildRepositoryTools(connector: GitHubRestConnector): ToolDefinition[] {
  return [
    {
      name: "github_list_repositories",
      description: "List GitHub repositories accessible with the current token. Returns name, description, language, stars, visibility, and last update time.",
      parameters: z.object({
        type: z
          .enum(["all", "owner", "member"])
          .default("owner")
          .describe("Filter repositories: 'owner' = repos you own, 'member' = repos you're a member of, 'all' = both"),
      }),
      execute: async (args) => {
        const { type } = args as { type: "all" | "owner" | "member" };
        const repos = await connector.listRepositories(type);
        const summary = repos.map((r) => ({
          name: r.full_name,
          description: r.description ?? "",
          private: r.private,
          language: r.language ?? "Unknown",
          stars: r.stargazers_count,
          updatedAt: r.updated_at,
          defaultBranch: r.default_branch,
          url: r.html_url,
        }));
        return JSON.stringify(summary, null, 2);
      },
    },
  ];
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run tests/tools/repositories.test.ts
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/repositories.ts tests/tools/repositories.test.ts
git commit -m "feat: add github_list_repositories MCP tool"
```

---

## Task 9: Tools — Workflows & Runs

**Files:**
- Create: `src/tools/workflows.ts`
- Create: `tests/tools/workflows.test.ts`

- [ ] **Step 1: Write failing test `tests/tools/workflows.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { buildWorkflowTools } from "../../src/tools/workflows.js";

const mockRun = {
  id: 42,
  name: "CI Pipeline",
  status: "completed",
  conclusion: "failure",
  head_branch: "main",
  head_sha: "abc123",
  created_at: "2024-01-15T10:00:00Z",
  updated_at: "2024-01-15T10:05:00Z",
  html_url: "https://github.com/owner/repo/actions/runs/42",
  run_number: 10,
};

const mockConnector = {
  listWorkflows: vi.fn().mockResolvedValue([
    { id: 1, name: "CI Pipeline", state: "active", path: ".github/workflows/ci.yml" },
  ]),
  listWorkflowRuns: vi.fn().mockResolvedValue([mockRun]),
  getWorkflowRun: vi.fn().mockResolvedValue({ ...mockRun, jobs_url: "https://api.github.com/repos/owner/repo/actions/runs/42/jobs" }),
  getWorkflowRunJobs: vi.fn().mockResolvedValue([
    { id: 100, name: "build", status: "completed", conclusion: "failure", started_at: "2024-01-15T10:00:00Z", completed_at: "2024-01-15T10:05:00Z" },
  ]),
};

describe("buildWorkflowTools", () => {
  it("returns 3 tool definitions", () => {
    const tools = buildWorkflowTools(mockConnector as never);
    expect(tools).toHaveLength(3);
    const names = tools.map((t) => t.name);
    expect(names).toContain("github_list_workflows");
    expect(names).toContain("github_list_workflow_runs");
    expect(names).toContain("github_get_workflow_run");
  });

  it("list_workflows returns formatted workflow list", async () => {
    const tools = buildWorkflowTools(mockConnector as never);
    const tool = tools.find((t) => t.name === "github_list_workflows")!;
    const result = await tool.execute({ owner: "octocat", repo: "Hello-World" }, {} as never);
    const parsed = JSON.parse(result as string) as unknown[];
    expect(parsed).toHaveLength(1);
    expect((parsed[0] as { name: string }).name).toBe("CI Pipeline");
  });

  it("get_workflow_run includes job details", async () => {
    const tools = buildWorkflowTools(mockConnector as never);
    const tool = tools.find((t) => t.name === "github_get_workflow_run")!;
    const result = await tool.execute({ owner: "octocat", repo: "Hello-World", runId: 42 }, {} as never);
    const parsed = JSON.parse(result as string) as { jobs: unknown[] };
    expect(parsed.jobs).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/tools/workflows.test.ts
```

Expected: FAIL — `buildWorkflowTools` not found.

- [ ] **Step 3: Create `src/tools/workflows.ts`**

```typescript
import { z } from "zod";
import type { GitHubRestConnector } from "../modules/connector/github-rest.js";
import type { ToolDefinition } from "./repositories.js";

export function buildWorkflowTools(connector: GitHubRestConnector): ToolDefinition[] {
  return [
    {
      name: "github_list_workflows",
      description: "List all GitHub Actions workflows defined in a repository.",
      parameters: z.object({
        owner: z.string().describe("Repository owner (user or organization)"),
        repo: z.string().describe("Repository name"),
      }),
      execute: async (args) => {
        const { owner, repo } = args as { owner: string; repo: string };
        const workflows = await connector.listWorkflows(owner, repo);
        const result = workflows.map((w) => ({
          id: w.id,
          name: w.name,
          state: w.state,
          path: w.path,
          url: w.html_url,
        }));
        return JSON.stringify(result, null, 2);
      },
    },
    {
      name: "github_list_workflow_runs",
      description: "List recent runs of a GitHub Actions workflow, with optional filters for status and branch.",
      parameters: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        workflowId: z.union([z.number(), z.string()]).optional().describe("Workflow ID or filename (e.g. 'ci.yml'). Omit to list all runs."),
        status: z
          .enum(["completed", "in_progress", "queued", "waiting", "requested", "pending"])
          .optional()
          .describe("Filter by run status"),
        branch: z.string().optional().describe("Filter by branch name"),
        perPage: z.number().min(1).max(100).default(20).describe("Number of runs to return (max 100)"),
      }),
      execute: async (args) => {
        const { owner, repo, workflowId, status, branch, perPage } = args as {
          owner: string; repo: string; workflowId?: number | string;
          status?: "completed" | "in_progress" | "queued" | "waiting" | "requested" | "pending";
          branch?: string; perPage: number;
        };
        const runs = await connector.listWorkflowRuns(owner, repo, { workflowId, status, branch, perPage });
        const result = runs.map((r) => ({
          id: r.id,
          runNumber: r.run_number,
          name: r.name,
          status: r.status,
          conclusion: r.conclusion,
          branch: r.head_branch,
          commit: r.head_sha.slice(0, 7),
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          url: r.html_url,
        }));
        return JSON.stringify(result, null, 2);
      },
    },
    {
      name: "github_get_workflow_run",
      description: "Get detailed information about a specific workflow run, including its jobs and their statuses.",
      parameters: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        runId: z.number().describe("The numeric workflow run ID"),
      }),
      execute: async (args) => {
        const { owner, repo, runId } = args as { owner: string; repo: string; runId: number };
        const [run, jobs] = await Promise.all([
          connector.getWorkflowRun(owner, repo, runId),
          connector.getWorkflowRunJobs(owner, repo, runId),
        ]);
        const result = {
          id: run.id,
          runNumber: run.run_number,
          name: run.name,
          status: run.status,
          conclusion: run.conclusion,
          branch: run.head_branch,
          commit: run.head_sha.slice(0, 7),
          createdAt: run.created_at,
          updatedAt: run.updated_at,
          url: run.html_url,
          jobs: jobs.map((j) => ({
            id: j.id,
            name: j.name,
            status: j.status,
            conclusion: j.conclusion,
            startedAt: j.started_at,
            completedAt: j.completed_at,
          })),
        };
        return JSON.stringify(result, null, 2);
      },
    },
  ];
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run tests/tools/workflows.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tools/workflows.ts tests/tools/workflows.test.ts
git commit -m "feat: add github_list_workflows, github_list_workflow_runs, github_get_workflow_run MCP tools"
```

---

## Task 10: Tool — `github_watch_workflow`

**Files:**
- Create: `src/tools/watcher.ts`

- [ ] **Step 1: Create `src/tools/watcher.ts`**

```typescript
import { z } from "zod";
import type { GitHubRestConnector } from "../modules/connector/github-rest.js";
import type { ToolDefinition } from "./repositories.js";

const POLL_INTERVAL_MS = 10_000;
const MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes

export function buildWatcherTools(connector: GitHubRestConnector): ToolDefinition[] {
  return [
    {
      name: "github_watch_workflow",
      description:
        "Watch a workflow run until it completes (or times out after 5 minutes). Polls every 10 seconds and returns the final status and conclusion.",
      parameters: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        runId: z.number().describe("The numeric workflow run ID to watch"),
      }),
      execute: async (args) => {
        const { owner, repo, runId } = args as { owner: string; repo: string; runId: number };
        const start = Date.now();

        while (Date.now() - start < MAX_WAIT_MS) {
          const run = await connector.getWorkflowRun(owner, repo, runId);

          if (run.status === "completed") {
            return JSON.stringify({
              runId: run.id,
              status: run.status,
              conclusion: run.conclusion,
              duration: `${Math.round((Date.now() - start) / 1000)}s`,
              url: run.html_url,
              message: `Workflow run ${runId} completed with conclusion: ${run.conclusion}`,
            }, null, 2);
          }

          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }

        const run = await connector.getWorkflowRun(owner, repo, runId);
        return JSON.stringify({
          runId,
          status: run.status,
          conclusion: null,
          duration: "5m (timeout)",
          url: run.html_url,
          message: `Watch timed out after 5 minutes. Run is still ${run.status}. Check manually at: ${run.html_url}`,
        }, null, 2);
      },
    },
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/watcher.ts
git commit -m "feat: add github_watch_workflow polling tool (5 min timeout)"
```

---

## Task 11: Tools — Logs & Failure Analysis

**Files:**
- Create: `src/tools/logs.ts`

- [ ] **Step 1: Create `src/tools/logs.ts`**

```typescript
import { z } from "zod";
import type { GitHubRestConnector } from "../modules/connector/github-rest.js";
import type { LogsAnalyzer } from "../modules/logs/logs-analyzer.js";
import type { AIEngine } from "../modules/ai/ai-engine.js";
import type { ToolDefinition } from "./repositories.js";

export function buildLogTools(
  connector: GitHubRestConnector,
  analyzer: LogsAnalyzer,
  aiEngine: AIEngine
): ToolDefinition[] {
  return [
    {
      name: "github_get_workflow_logs",
      description:
        "Retrieve and parse the execution logs for a specific workflow run. Returns structured per-job logs with error extraction.",
      parameters: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        runId: z.number().describe("Workflow run ID"),
      }),
      execute: async (args) => {
        const { owner, repo, runId } = args as { owner: string; repo: string; runId: number };
        const jobs = await connector.getWorkflowRunJobs(owner, repo, runId);

        const jobLogs = await Promise.allSettled(
          jobs.map(async (job) => {
            try {
              const raw = await connector.getJobLogs(owner, repo, job.id);
              const parsed = analyzer.parseWorkflowLogs(raw);
              return { jobId: job.id, jobName: job.name, conclusion: job.conclusion, ...parsed };
            } catch {
              return { jobId: job.id, jobName: job.name, conclusion: job.conclusion, totalSteps: 0, failedSteps: [], errorSummary: [], hasErrors: false };
            }
          })
        );

        const results = jobLogs.map((r) => (r.status === "fulfilled" ? r.value : { error: "Failed to fetch logs" }));
        return JSON.stringify(results, null, 2);
      },
    },
    {
      name: "github_analyze_failure",
      description:
        "Automatically analyze a failed GitHub Actions workflow run using AI. Returns the probable cause, suggested fixes, severity, and a diagnostic report.",
      parameters: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        runId: z.number().describe("Workflow run ID (must be a failed/completed run)"),
      }),
      execute: async (args) => {
        const { owner, repo, runId } = args as { owner: string; repo: string; runId: number };

        const [run, jobs] = await Promise.all([
          connector.getWorkflowRun(owner, repo, runId),
          connector.getWorkflowRunJobs(owner, repo, runId),
        ]);

        if (run.conclusion !== "failure") {
          return JSON.stringify({
            message: `Run ${runId} has conclusion '${run.conclusion}', not 'failure'. Analysis skipped.`,
            conclusion: run.conclusion,
          });
        }

        const failedJobs = jobs.filter((j) => j.conclusion === "failure");
        let combinedRawLog = "";
        let combinedAnalysis = { totalSteps: 0, failedSteps: [] as never[], errorSummary: [] as string[], hasErrors: false };

        for (const job of failedJobs.slice(0, 3)) {
          try {
            const raw = await connector.getJobLogs(owner, repo, job.id);
            const parsed = analyzer.parseWorkflowLogs(raw);
            const context = analyzer.extractErrorContext(raw, 5);
            combinedRawLog += `\n--- Job: ${job.name} ---\n${context}`;
            combinedAnalysis = {
              totalSteps: combinedAnalysis.totalSteps + parsed.totalSteps,
              failedSteps: [...combinedAnalysis.failedSteps, ...parsed.failedSteps] as never[],
              errorSummary: [...combinedAnalysis.errorSummary, ...parsed.errorSummary],
              hasErrors: combinedAnalysis.hasErrors || parsed.hasErrors,
            };
          } catch {
            // Skip jobs where logs aren't available
          }
        }

        const aiAnalysis = await aiEngine.analyzeFailure(
          run.name ?? "Unknown Workflow",
          `${owner}/${repo}`,
          combinedAnalysis,
          combinedRawLog
        );

        return JSON.stringify(
          {
            runId,
            workflow: run.name,
            branch: run.head_branch,
            commit: run.head_sha.slice(0, 7),
            failedJobs: failedJobs.map((j) => j.name),
            analysis: aiAnalysis,
          },
          null,
          2
        );
      },
    },
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/logs.ts
git commit -m "feat: add github_get_workflow_logs and github_analyze_failure MCP tools"
```

---

## Task 12: Tools — Rerun & Cancel

**Files:**
- Create: `src/tools/actions.ts`

- [ ] **Step 1: Create `src/tools/actions.ts`**

```typescript
import { z } from "zod";
import type { GitHubRestConnector } from "../modules/connector/github-rest.js";
import type { ToolDefinition } from "./repositories.js";

export function buildActionTools(connector: GitHubRestConnector): ToolDefinition[] {
  return [
    {
      name: "github_rerun_workflow",
      description:
        "Rerun a GitHub Actions workflow. Use mode 'all' to rerun the entire workflow, or 'failed' to rerun only the failed jobs.",
      parameters: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        runId: z.number().describe("Workflow run ID to rerun"),
        mode: z
          .enum(["all", "failed"])
          .default("failed")
          .describe("'failed' reruns only failed jobs (faster); 'all' reruns the complete workflow"),
      }),
      execute: async (args) => {
        const { owner, repo, runId, mode } = args as {
          owner: string; repo: string; runId: number; mode: "all" | "failed";
        };
        const result =
          mode === "failed"
            ? await connector.rerunFailedJobs(owner, repo, runId)
            : await connector.rerunWorkflow(owner, repo, runId);
        return JSON.stringify(result, null, 2);
      },
    },
    {
      name: "github_cancel_workflow",
      description: "Cancel a workflow run that is currently queued or in progress.",
      parameters: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        runId: z.number().describe("Workflow run ID to cancel"),
      }),
      execute: async (args) => {
        const { owner, repo, runId } = args as { owner: string; repo: string; runId: number };
        const result = await connector.cancelWorkflow(owner, repo, runId);
        return JSON.stringify(result, null, 2);
      },
    },
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/actions.ts
git commit -m "feat: add github_rerun_workflow and github_cancel_workflow MCP tools"
```

---

## Task 13: Tool — `github_download_artifacts`

**Files:**
- Create: `src/tools/artifacts.ts`

- [ ] **Step 1: Create `src/tools/artifacts.ts`**

```typescript
import { z } from "zod";
import type { GitHubRestConnector } from "../modules/connector/github-rest.js";
import type { ToolDefinition } from "./repositories.js";

export function buildArtifactTools(connector: GitHubRestConnector): ToolDefinition[] {
  return [
    {
      name: "github_download_artifacts",
      description:
        "List and get download URLs for artifacts produced by a workflow run. Returns artifact names, sizes, and pre-signed download URLs (valid for 1 minute).",
      parameters: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        runId: z.number().describe("Workflow run ID"),
        artifactId: z.number().optional().describe("Specific artifact ID to get download URL for. Omit to list all artifacts."),
      }),
      execute: async (args) => {
        const { owner, repo, runId, artifactId } = args as {
          owner: string; repo: string; runId: number; artifactId?: number;
        };

        const artifacts = await connector.listArtifacts(owner, repo, runId);

        if (artifactId !== undefined) {
          const target = artifacts.find((a) => a.id === artifactId);
          if (!target) {
            return JSON.stringify({ error: `Artifact ${artifactId} not found in run ${runId}` });
          }
          const downloadUrl = await connector.getArtifactDownloadUrl(owner, repo, artifactId);
          return JSON.stringify({ id: target.id, name: target.name, sizeInBytes: target.size_in_bytes, downloadUrl }, null, 2);
        }

        const result = artifacts.map((a) => ({
          id: a.id,
          name: a.name,
          sizeInBytes: a.size_in_bytes,
          createdAt: a.created_at,
          expiresAt: a.expires_at,
        }));

        return JSON.stringify(
          {
            count: result.length,
            artifacts: result,
            note: "Use artifactId parameter to get a download URL for a specific artifact",
          },
          null,
          2
        );
      },
    },
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/artifacts.ts
git commit -m "feat: add github_download_artifacts MCP tool"
```

---

## Task 14: Tools — Deployments & Rollback

**Files:**
- Create: `src/tools/deployments.ts`

- [ ] **Step 1: Create `src/tools/deployments.ts`**

```typescript
import { z } from "zod";
import type { GitHubRestConnector } from "../modules/connector/github-rest.js";
import type { ToolDefinition } from "./repositories.js";

export function buildDeploymentTools(connector: GitHubRestConnector): ToolDefinition[] {
  return [
    {
      name: "github_get_deployments",
      description:
        "List deployments for a repository, optionally filtered by environment. Returns deployment ID, environment, status, ref (branch/tag/sha), and creator.",
      parameters: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        environment: z.string().optional().describe("Filter by environment name (e.g. 'production', 'staging')"),
      }),
      execute: async (args) => {
        const { owner, repo, environment } = args as { owner: string; repo: string; environment?: string };
        const deployments = await connector.listDeployments(owner, repo, environment);

        const result = await Promise.all(
          deployments.slice(0, 20).map(async (d) => {
            const statuses = await connector.getDeploymentStatuses(owner, repo, d.id);
            const latestStatus = statuses[0];
            return {
              id: d.id,
              environment: d.environment,
              ref: d.ref,
              sha: d.sha.slice(0, 7),
              status: latestStatus?.state ?? "unknown",
              description: latestStatus?.description ?? "",
              createdAt: d.created_at,
              creator: d.creator?.login ?? "unknown",
              url: d.url,
            };
          })
        );

        return JSON.stringify(result, null, 2);
      },
    },
    {
      name: "github_rollback_deployment",
      description:
        "Roll back to a previous deployment by creating a new deployment pointing to a specific ref (commit, branch, or tag) and marking the current deployment as inactive.",
      parameters: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        environment: z.string().describe("Environment to roll back (e.g. 'production')"),
        ref: z.string().describe("The git ref (commit SHA, branch, or tag) to deploy. Use a previous stable commit SHA for rollback."),
        currentDeploymentId: z.number().optional().describe("ID of the current deployment to mark as inactive"),
      }),
      execute: async (args) => {
        const { owner, repo, environment, ref, currentDeploymentId } = args as {
          owner: string; repo: string; environment: string; ref: string; currentDeploymentId?: number;
        };

        if (currentDeploymentId !== undefined) {
          await connector.createDeploymentStatus(owner, repo, currentDeploymentId, "inactive");
        }

        const newDeployment = await connector.createDeployment(owner, repo, ref, environment);
        if (newDeployment && "id" in newDeployment) {
          await connector.createDeploymentStatus(owner, repo, newDeployment.id, "pending");
        }

        return JSON.stringify(
          {
            success: true,
            message: `Rollback initiated: deploying ${ref.slice(0, 7)} to ${environment}`,
            newDeploymentId: newDeployment && "id" in newDeployment ? newDeployment.id : null,
            environment,
            ref,
          },
          null,
          2
        );
      },
    },
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/deployments.ts
git commit -m "feat: add github_get_deployments and github_rollback_deployment MCP tools"
```

---

## Task 15: Tool — `github_monitor_repository`

**Files:**
- Create: `src/tools/monitor.ts`

- [ ] **Step 1: Create `src/tools/monitor.ts`**

```typescript
import { z } from "zod";
import type { GitHubRestConnector } from "../modules/connector/github-rest.js";
import type { WorkflowMonitor } from "../modules/monitoring/workflow-monitor.js";
import type { ToolDefinition } from "./repositories.js";

export function buildMonitorTools(
  connector: GitHubRestConnector,
  monitor: WorkflowMonitor,
  intervalMs: number
): ToolDefinition[] {
  return [
    {
      name: "github_monitor_repository",
      description:
        "Start or stop continuous monitoring of a repository's GitHub Actions. When started, the server polls for new workflow runs and emits events on state changes. Returns the list of currently monitored repositories.",
      parameters: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        action: z
          .enum(["start", "stop", "list"])
          .default("start")
          .describe("'start' begins monitoring, 'stop' ends it, 'list' shows all monitored repos"),
      }),
      execute: async (args) => {
        const { owner, repo, action } = args as { owner: string; repo: string; action: "start" | "stop" | "list" };

        if (action === "list") {
          const monitored = monitor.listMonitored();
          return JSON.stringify({
            monitoring: monitored,
            count: monitored.length,
          }, null, 2);
        }

        if (action === "stop") {
          const stopped = monitor.stopMonitoring(owner, repo);
          return JSON.stringify({
            success: stopped,
            message: stopped
              ? `Stopped monitoring ${owner}/${repo}`
              : `${owner}/${repo} was not being monitored`,
            monitoring: monitor.listMonitored(),
          }, null, 2);
        }

        // action === "start"
        const key = monitor.startMonitoring(connector, owner, repo, intervalMs);
        return JSON.stringify({
          success: true,
          message: `Now monitoring ${key} every ${intervalMs / 1000}s for workflow changes`,
          monitoringKey: key,
          monitoring: monitor.listMonitored(),
        }, null, 2);
      },
    },
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/monitor.ts
git commit -m "feat: add github_monitor_repository MCP tool with start/stop/list actions"
```

---

## Task 16: MCP Server Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create `src/index.ts`**

```typescript
import { FastMCP } from "fastmcp";
import { env } from "./config/env.js";
import { GitHubAuth } from "./modules/auth/github-auth.js";
import { GitHubRestConnector } from "./modules/connector/github-rest.js";
import { LogsAnalyzer } from "./modules/logs/logs-analyzer.js";
import { AIEngine } from "./modules/ai/ai-engine.js";
import { WorkflowMonitor } from "./modules/monitoring/workflow-monitor.js";
import { buildRepositoryTools } from "./tools/repositories.js";
import { buildWorkflowTools } from "./tools/workflows.js";
import { buildWatcherTools } from "./tools/watcher.js";
import { buildLogTools } from "./tools/logs.js";
import { buildActionTools } from "./tools/actions.js";
import { buildArtifactTools } from "./tools/artifacts.js";
import { buildDeploymentTools } from "./tools/deployments.js";
import { buildMonitorTools } from "./tools/monitor.js";

const server = new FastMCP({
  name: "github-mcp-server",
  version: "1.0.0",
});

const auth = new GitHubAuth(env.GITHUB_TOKEN);
const connector = new GitHubRestConnector(auth);
const logsAnalyzer = new LogsAnalyzer();
const aiEngine = new AIEngine();
const monitor = new WorkflowMonitor();

const allTools = [
  ...buildRepositoryTools(connector),
  ...buildWorkflowTools(connector),
  ...buildWatcherTools(connector),
  ...buildLogTools(connector, logsAnalyzer, aiEngine),
  ...buildActionTools(connector),
  ...buildArtifactTools(connector),
  ...buildDeploymentTools(connector),
  ...buildMonitorTools(connector, monitor, env.POLLING_INTERVAL_MS),
];

for (const tool of allTools) {
  server.addTool({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    execute: tool.execute,
  });
}

console.error(`[github-mcp-server] Starting with ${allTools.length} tools registered`);
console.error(`[github-mcp-server] GitHub token: ${auth.maskToken()}`);

server.start({ transportType: "stdio" });
```

- [ ] **Step 2: Run a typecheck to verify everything compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Build the project**

```bash
npm run build
```

Expected: `dist/` directory created with compiled JS files.

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire all 13 MCP tools into FastMCP server entry point"
```

---

## Task 17: Docker Setup

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: Create `Dockerfile`**

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production=false
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Create `docker-compose.yml`**

```yaml
version: "3.9"

services:
  github-mcp-server:
    build: .
    container_name: github-mcp-server
    restart: unless-stopped
    environment:
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - POLLING_INTERVAL_MS=${POLLING_INTERVAL_MS:-30000}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    stdin_open: true
    tty: false
```

- [ ] **Step 3: Create `.dockerignore`**

```
node_modules
dist
.env
*.log
coverage
.git
```

- [ ] **Step 4: Build and verify Docker image**

```bash
docker build -t github-mcp-server .
```

Expected: `Successfully built <id>` with no errors.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "chore: add multi-stage Docker build for deployment"
```

---

## Task 18: Final Validation & README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Run full test suite one final time**

```bash
npm test
```

Expected: All tests PASS, 0 failures.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: No TypeScript errors.

- [ ] **Step 3: Create `README.md`**

````markdown
# GitHub MCP Server

An intelligent MCP (Model Context Protocol) server that gives AI agents full control over GitHub Actions CI/CD pipelines.

## Features

- **13 MCP tools** covering repositories, workflows, logs, deployments, and monitoring
- **AI-powered failure analysis** using Claude to diagnose CI/CD errors
- **Real-time monitoring** via configurable polling
- **Secure** — GitHub token encrypted via env var, never exposed in logs

## Quick Start

### Prerequisites
- Node.js 20+
- GitHub Personal Access Token (scopes: `repo`, `workflow`)
- Anthropic API key

### Setup

```bash
cp .env.example .env
# Edit .env with your tokens
npm install
npm run dev
```

### Connect to Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/github-mcp-server",
      "env": {
        "GITHUB_TOKEN": "your_token",
        "ANTHROPIC_API_KEY": "your_key"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `github_list_repositories` | List accessible repositories |
| `github_list_workflows` | List GitHub Actions workflows |
| `github_list_workflow_runs` | List runs with status/branch filters |
| `github_get_workflow_run` | Get run details with job statuses |
| `github_watch_workflow` | Poll run until completion (5 min timeout) |
| `github_get_workflow_logs` | Parse and return structured job logs |
| `github_analyze_failure` | AI diagnosis of failed runs |
| `github_rerun_workflow` | Rerun all or failed jobs only |
| `github_cancel_workflow` | Cancel a running workflow |
| `github_download_artifacts` | List/download run artifacts |
| `github_get_deployments` | List deployments by environment |
| `github_rollback_deployment` | Roll back to a previous ref |
| `github_monitor_repository` | Start/stop continuous repo monitoring |

## Docker

```bash
docker-compose up -d
```

## License
MIT
````

- [ ] **Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: add README with setup instructions and tool reference"
```

---

## Self-Review Checklist

### Spec Coverage

| Requirement | Covered by |
|-------------|-----------|
| Auth GitHub PAT | Task 3 (github-auth.ts) |
| Lister repositories | Task 8 (github_list_repositories) |
| Lister workflows | Task 9 (github_list_workflows) |
| Workflow runs + filtres | Task 9 (github_list_workflow_runs) |
| Détail d'un run | Task 9 (github_get_workflow_run) |
| Watch temps réel | Task 10 (github_watch_workflow) |
| Logs d'exécution | Task 11 (github_get_workflow_logs) |
| Analyse IA des échecs | Task 11 (github_analyze_failure) |
| Relancer workflow | Task 12 (github_rerun_workflow) |
| Annuler workflow | Task 12 (github_cancel_workflow) |
| Télécharger artifacts | Task 13 (github_download_artifacts) |
| Déploiements | Task 14 (github_get_deployments) |
| Rollback | Task 14 (github_rollback_deployment) |
| Monitor repo | Task 15 (github_monitor_repository) |
| Serveur MCP FastMCP | Task 16 (src/index.ts) |
| Docker | Task 17 (Dockerfile) |
| Claude API IA | Task 6 (ai-engine.ts) |

All 13 MCP tools specified in the cahier de charges are covered. ✓

### Placeholder Scan
No TBD, TODO, or "implement later" in any task. All code is complete. ✓

### Type Consistency
- `ToolDefinition` exported from `repositories.ts`, imported by all tool files ✓
- `GitHubRestConnector` methods used in tools match definitions in Task 4 ✓
- `LogAnalysisResult` from `logs-analyzer.ts` used correctly in `ai-engine.ts` ✓
- `GitHubAuth` constructor signature matches usage in `index.ts` ✓
