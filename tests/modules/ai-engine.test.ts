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
              diagnosticReport: "The build failed due to an npm peer dependency conflict.",
            }),
          },
        ],
      }),
    },
  })),
}));

// Mock env
vi.mock("../../src/config/env.js", () => ({
  env: { ANTHROPIC_API_KEY: "sk-ant-test", POLLING_INTERVAL_MS: 30000, LOG_LEVEL: "info", GITHUB_TOKEN: "ghp_test" },
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
    const mockInstance = (Anthropic as ReturnType<typeof vi.fn>).mock.results[0]?.value as {
      messages: { create: ReturnType<typeof vi.fn> };
    };
    mockInstance.messages.create.mockResolvedValueOnce({
      content: [{ type: "text", text: "I cannot analyze this right now." }],
    });

    const logAnalysis: LogAnalysisResult = { totalSteps: 0, failedSteps: [], errorSummary: [], hasErrors: false };
    const result = await engine.analyzeFailure("CI", "repo", logAnalysis, "");
    expect(result.probableCause).toBeTruthy();
    expect(result.suggestedFixes.length).toBeGreaterThan(0);
  });
});
