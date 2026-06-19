import { FastMCP } from "fastmcp";
import { env } from "./config/env.js";
import { GitHubAuth } from "./modules/auth/github-auth.js";
import { GitHubRestConnector } from "./modules/connector/github-rest.js";
import { LogsAnalyzer } from "./modules/logs/logs-analyzer.js";
import { AIEngine } from "./modules/ai/ai-engine.js";
import { WorkflowMonitor } from "./modules/monitoring/workflow-monitor.js";
import { buildRepositoryTools } from "./tools/repositories.js";
import { buildWorkflowTools } from "./tools/workflows.js";
import { buildWatcherTools } from "./tools/watcher.js";
import { buildLogTools } from "./tools/logs.js";
import { buildActionTools } from "./tools/actions.js";
import { buildArtifactTools } from "./tools/artifacts.js";
import { buildDeploymentTools } from "./tools/deployments.js";
import { buildMonitorTools } from "./tools/monitor.js";

const server = new FastMCP({
  name: "github-mcp-server",
  version: "1.0.0",
});

const auth = new GitHubAuth(env.GITHUB_TOKEN);
const connector = new GitHubRestConnector(auth);
const logsAnalyzer = new LogsAnalyzer();
const aiEngine = new AIEngine();
const monitor = new WorkflowMonitor();

const allTools = [
  ...buildRepositoryTools(connector),
  ...buildWorkflowTools(connector),
  ...buildWatcherTools(connector),
  ...buildLogTools(connector, logsAnalyzer, aiEngine),
  ...buildActionTools(connector),
  ...buildArtifactTools(connector),
  ...buildDeploymentTools(connector),
  ...buildMonitorTools(connector, monitor, env.POLLING_INTERVAL_MS),
];

for (const tool of allTools) {
  server.addTool({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as never,
    execute: tool.execute as Parameters<typeof server.addTool>[0]["execute"],
  });
}

console.error(`[github-mcp-server] Starting with ${allTools.length} tools registered`);
console.error(`[github-mcp-server] GitHub token: ${auth.maskToken()}`);

await server.start({ transportType: "stdio" });
