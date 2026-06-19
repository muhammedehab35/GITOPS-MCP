import { z } from "zod";
import type { GitHubRestConnector } from "../modules/connector/github-rest.js";
import type { ToolDefinition } from "./repositories.js";

const POLL_INTERVAL_MS = 10_000;
const MAX_WAIT_MS = 5 * 60 * 1000;

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
