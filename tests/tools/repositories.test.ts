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
      html_url: "https://github.com/octocat/Hello-World",
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
