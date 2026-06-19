# GitHub MCP Server

An intelligent MCP (Model Context Protocol) server that gives AI agents full control over GitHub Actions CI/CD pipelines.

## Features

- **13 MCP tools** covering repositories, workflows, logs, deployments, and monitoring
- **AI-powered failure analysis** using Claude to diagnose CI/CD errors
- **Real-time monitoring** via configurable polling
- **Secure** — GitHub token never exposed in logs or responses

## Prerequisites

- Node.js 20+
- GitHub Personal Access Token (scopes: `repo`, `workflow`, `read:org`)
- Anthropic API key

## Quick Start

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your tokens

# 3. Run in development
npm run dev

# 4. Build for production
npm run build
npm start
```

## Connect to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["/absolute/path/to/github-mcp-server/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token",
        "ANTHROPIC_API_KEY": "sk-ant-your_key"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `github_list_repositories` | List accessible repositories |
| `github_list_workflows` | List GitHub Actions workflows in a repo |
| `github_list_workflow_runs` | List runs with status/branch filters |
| `github_get_workflow_run` | Get run details with job statuses |
| `github_watch_workflow` | Poll run until completion (5 min timeout) |
| `github_get_workflow_logs` | Parse and return structured job logs |
| `github_analyze_failure` | AI diagnosis of failed runs via Claude |
| `github_rerun_workflow` | Rerun all or failed jobs only |
| `github_cancel_workflow` | Cancel a running workflow |
| `github_download_artifacts` | List/download run artifacts |
| `github_get_deployments` | List deployments by environment |
| `github_rollback_deployment` | Roll back to a previous ref |
| `github_monitor_repository` | Start/stop continuous repo monitoring |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | ✅ | GitHub Personal Access Token |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key for Claude |
| `POLLING_INTERVAL_MS` | ❌ | Monitor polling interval (default: 30000) |
| `LOG_LEVEL` | ❌ | Log level: debug/info/warn/error (default: info) |

## Docker

```bash
# Build and run
docker-compose up -d

# Or build manually
docker build -t github-mcp-server .
docker run --env-file .env github-mcp-server
```

## Development

```bash
npm test          # Run all tests
npm run typecheck # TypeScript type check
npm run dev       # Start with tsx (no build needed)
npm run build     # Compile TypeScript
```

## Architecture

```
src/
├── index.ts                    # MCP server entry point (FastMCP)
├── config/env.ts               # Environment config (Zod validation)
├── modules/
│   ├── auth/github-auth.ts     # GitHub PAT authentication
│   ├── connector/github-rest.ts # GitHub REST API wrapper (Octokit)
│   ├── logs/logs-analyzer.ts   # Log parsing & error extraction
│   ├── ai/ai-engine.ts         # Claude API integration
│   └── monitoring/workflow-monitor.ts # Polling-based monitor
└── tools/                      # 13 MCP tool definitions
    ├── repositories.ts
    ├── workflows.ts
    ├── watcher.ts
    ├── logs.ts
    ├── actions.ts
    ├── artifacts.ts
    ├── deployments.ts
    └── monitor.ts
```

## License

MIT
