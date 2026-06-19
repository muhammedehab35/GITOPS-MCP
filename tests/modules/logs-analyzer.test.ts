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
