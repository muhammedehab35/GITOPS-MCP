import { z } from "zod";
import type { GitHubRestConnector } from "../modules/connector/github-rest.js";
import type { ToolDefinition } from "./repositories.js";

export function buildArtifactTools(connector: GitHubRestConnector): ToolDefinition[] {
  return [
    {
      name: "github_download_artifacts",
      description:
        "List and get download URLs for artifacts produced by a workflow run. Returns artifact names, sizes, and pre-signed download URLs.",
      parameters: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        runId: z.number().describe("Workflow run ID"),
        artifactId: z.number().optional().describe("Specific artifact ID to get download URL for. Omit to list all artifacts."),
      }),
      execute: async (args) => {
        const { owner, repo, runId, artifactId } = args as {
          owner: string; repo: string; runId: number; artifactId?: number;
        };

        const artifacts = await connector.listArtifacts(owner, repo, runId);

        if (artifactId !== undefined) {
          const target = artifacts.find((a) => a.id === artifactId);
          if (!target) {
            return JSON.stringify({ error: `Artifact ${artifactId} not found in run ${runId}` });
          }
          const downloadUrl = await connector.getArtifactDownloadUrl(owner, repo, artifactId);
          return JSON.stringify({ id: target.id, name: target.name, sizeInBytes: target.size_in_bytes, downloadUrl }, null, 2);
        }

        const result = artifacts.map((a) => ({
          id: a.id,
          name: a.name,
          sizeInBytes: a.size_in_bytes,
          createdAt: a.created_at,
          expiresAt: a.expires_at,
        }));

        return JSON.stringify(
          {
            count: result.length,
            artifacts: result,
            note: "Use artifactId parameter to get a download URL for a specific artifact",
          },
          null,
          2
        );
      },
    },
  ];
}
