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
