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
