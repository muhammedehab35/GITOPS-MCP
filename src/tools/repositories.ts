import { z } from "zod";
import type { GitHubRestConnector } from "../modules/connector/github-rest.js";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodTypeAny;
  execute: (args: Record<string, unknown>, context: unknown) => Promise<string>;
}

export function buildRepositoryTools(connector: GitHubRestConnector): ToolDefinition[] {
  return [
    {
      name: "github_list_repositories",
      description: "List GitHub repositories accessible with the current token. Returns name, description, language, stars, visibility, and last update time.",
      parameters: z.object({
        type: z
          .enum(["all", "owner", "member"])
          .default("owner")
          .describe("Filter repositories: 'owner' = repos you own, 'member' = repos you're a member of, 'all' = both"),
      }),
      execute: async (args) => {
        const { type } = args as { type: "all" | "owner" | "member" };
        const repos = await connector.listRepositories(type);
        const summary = repos.map((r) => ({
          name: r.full_name,
          description: r.description ?? "",
          private: r.private,
          language: r.language ?? "Unknown",
          stars: r.stargazers_count,
          updatedAt: r.updated_at,
          defaultBranch: r.default_branch,
          url: r.html_url,
        }));
        return JSON.stringify(summary, null, 2);
      },
    },
  ];
}
