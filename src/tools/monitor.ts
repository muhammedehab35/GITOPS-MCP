import { z } from "zod";
import type { GitHubRestConnector } from "../modules/connector/github-rest.js";
import type { WorkflowMonitor } from "../modules/monitoring/workflow-monitor.js";
import type { ToolDefinition } from "./repositories.js";

export function buildMonitorTools(
  connector: GitHubRestConnector,
  monitor: WorkflowMonitor,
  intervalMs: number
): ToolDefinition[] {
  return [
    {
      name: "github_monitor_repository",
      description:
        "Start or stop continuous monitoring of a repository's GitHub Actions. Returns the list of currently monitored repositories.",
      parameters: z.object({
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        action: z
          .enum(["start", "stop", "list"])
          .default("start")
          .describe("'start' begins monitoring, 'stop' ends it, 'list' shows all monitored repos"),
      }),
      execute: async (args) => {
        const { owner, repo, action } = args as { owner: string; repo: string; action: "start" | "stop" | "list" };

        if (action === "list") {
          const monitored = monitor.listMonitored();
          return JSON.stringify({ monitoring: monitored, count: monitored.length }, null, 2);
        }

        if (action === "stop") {
          const stopped = monitor.stopMonitoring(owner, repo);
          return JSON.stringify({
            success: stopped,
            message: stopped ? `Stopped monitoring ${owner}/${repo}` : `${owner}/${repo} was not being monitored`,
            monitoring: monitor.listMonitored(),
          }, null, 2);
        }

        const key = monitor.startMonitoring(connector, owner, repo, intervalMs);
        return JSON.stringify({
          success: true,
          message: `Now monitoring ${key} every ${intervalMs / 1000}s for workflow changes`,
          monitoringKey: key,
          monitoring: monitor.listMonitored(),
        }, null, 2);
      },
    },
  ];
}
