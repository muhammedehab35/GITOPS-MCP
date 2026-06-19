import { z } from "zod";
import type { GitHubRestConnector } from "../modules/connector/github-rest.js";
import type { ToolDefinition } from "./repositories.js";

export function buildDeploymentTools(connector: GitHubRestConnector): ToolDefinition[] {
  return [
    {
      name: "github_get_deployments",
      description:
        "List deployments for a repository, optionally filtered by environment. Returns deployment ID, environment, status, ref, and creator.",
      parameters: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        environment: z.string().optional().describe("Filter by environment name (e.g. 'production', 'staging')"),
      }),
      execute: async (args) => {
        const { owner, repo, environment } = args as { owner: string; repo: string; environment?: string };
        const deployments = await connector.listDeployments(owner, repo, environment);

        const result = await Promise.all(
          deployments.slice(0, 20).map(async (d) => {
            const statuses = await connector.getDeploymentStatuses(owner, repo, d.id);
            const latestStatus = statuses[0];
            return {
              id: d.id,
              environment: d.environment,
              ref: d.ref,
              sha: d.sha.slice(0, 7),
              status: latestStatus?.state ?? "unknown",
              description: latestStatus?.description ?? "",
              createdAt: d.created_at,
              creator: d.creator?.login ?? "unknown",
            };
          })
        );

        return JSON.stringify(result, null, 2);
      },
    },
    {
      name: "github_rollback_deployment",
      description:
        "Roll back to a previous deployment by creating a new deployment pointing to a specific ref and marking the current deployment as inactive.",
      parameters: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        environment: z.string().describe("Environment to roll back (e.g. 'production')"),
        ref: z.string().describe("The git ref (commit SHA, branch, or tag) to deploy"),
        currentDeploymentId: z.number().optional().describe("ID of the current deployment to mark as inactive"),
      }),
      execute: async (args) => {
        const { owner, repo, environment, ref, currentDeploymentId } = args as {
          owner: string; repo: string; environment: string; ref: string; currentDeploymentId?: number;
        };

        if (currentDeploymentId !== undefined) {
          await connector.createDeploymentStatus(owner, repo, currentDeploymentId, "inactive");
        }

        const newDeployment = await connector.createDeployment(owner, repo, ref, environment);
        if (newDeployment && "id" in newDeployment) {
          await connector.createDeploymentStatus(owner, repo, newDeployment.id, "pending");
        }

        return JSON.stringify(
          {
            success: true,
            message: `Rollback initiated: deploying ${ref.slice(0, 7)} to ${environment}`,
            newDeploymentId: newDeployment && "id" in newDeployment ? newDeployment.id : null,
            environment,
            ref,
          },
          null,
          2
        );
      },
    },
  ];
}
