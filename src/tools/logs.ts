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
        let combinedAnalysis = {
          totalSteps: 0,
          failedSteps: [] as { stepName: string; status: "success" | "failure" | "unknown"; errorMessages: string[]; rawLines: string[] }[],
          errorSummary: [] as string[],
          hasErrors: false,
        };

        for (const job of failedJobs.slice(0, 3)) {
          try {
            const raw = await connector.getJobLogs(owner, repo, job.id);
            const parsed = analyzer.parseWorkflowLogs(raw);
            const context = analyzer.extractErrorContext(raw, 5);
            combinedRawLog += `\n--- Job: ${job.name} ---\n${context}`;
            combinedAnalysis = {
              totalSteps: combinedAnalysis.totalSteps + parsed.totalSteps,
              failedSteps: [...combinedAnalysis.failedSteps, ...parsed.failedSteps],
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
