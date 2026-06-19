import { describe, it, expect, vi } from "vitest";
import { buildWorkflowTools } from "../../src/tools/workflows.js";

const mockRun = {
  id: 42,
  name: "CI Pipeline",
  status: "completed",
  conclusion: "failure",
  head_branch: "main",
  head_sha: "abc1234567",
  created_at: "2024-01-15T10:00:00Z",
  updated_at: "2024-01-15T10:05:00Z",
  html_url: "https://github.com/owner/repo/actions/runs/42",
  run_number: 10,
};

const mockConnector = {
  listWorkflows: vi.fn().mockResolvedValue([
    { id: 1, name: "CI Pipeline", state: "active", path: ".github/workflows/ci.yml", html_url: "https://github.com/owner/repo/actions/workflows/1" },
  ]),
  listWorkflowRuns: vi.fn().mockResolvedValue([mockRun]),
  getWorkflowRun: vi.fn().mockResolvedValue({ ...mockRun }),
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
