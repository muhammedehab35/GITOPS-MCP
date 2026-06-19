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
