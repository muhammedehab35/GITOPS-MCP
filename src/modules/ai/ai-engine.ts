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
