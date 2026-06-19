# GitHub Actions MCP Server

> An intelligent MCP (Model Context Protocol) server that gives AI agents full control over GitHub Actions CI/CD pipelines — including real-time monitoring, log analysis, AI-powered failure diagnosis, and deployment management.

---

## Why This Exists

Most GitHub MCP servers let AI agents read files, create issues, and manage pull requests.  
**But they can't touch your CI/CD pipelines.**

| Capability | Existing GitHub MCPs | This Server |
|------------|:-------------------:|:-----------:|
| List workflow runs | ❌ | ✅ |
| Fetch execution logs | ❌ | ✅ |
| Diagnose failures with AI | ❌ | ✅ |
| Rerun / cancel workflows | ❌ | ✅ |
| Track deployments & rollback | ❌ | ✅ |
| Monitor repos in real time | ❌ | ✅ |

This server closes that gap — enabling autonomous DevOps agents that can **monitor, diagnose, and act** on your pipelines without human intervention.

---

## Features

- **13 purpose-built MCP tools** covering the full CI/CD lifecycle
- **AI-powered failure analysis** — sends parsed logs to Claude, returns root cause + suggested fixes + severity
- **Real-time pipeline monitoring** — polling-based watcher with configurable interval
- **Full workflow control** — rerun (all or failed jobs only), cancel, watch until completion
- **Deployment management** — list environments, track statuses, trigger rollbacks
- **Artifact handling** — list and get pre-signed download URLs
- **Secure by design** — tokens never logged or exposed in responses
- **Docker-ready** — multi-stage build for production deployment

---

## Demo

Ask Claude (or any MCP-compatible AI agent):

```
"Why did my CI pipeline fail on the main branch?"
```

The agent will automatically:
1. Fetch the latest failed workflow run
2. Retrieve and parse the execution logs
3. Send the error context to Claude for analysis
4. Return a structured diagnosis:

```json
{
  "probableCause": "npm peer dependency conflict between react@18 and testing-library@13",
  "suggestedFixes": [
    "Add --legacy-peer-deps to your npm install command",
    "Upgrade @testing-library/react to v14",
    "Pin react to v17 until dependencies are resolved"
  ],
  "severity": "high",
  "diagnosticReport": "The build failed during dependency installation due to an unresolvable peer conflict introduced in the last commit. This is a common issue when mixing React 18 with older testing utilities."
}
```

---

## Prerequisites

- **Node.js** 20+
- **GitHub Personal Access Token** with scopes: `repo`, `workflow`, `read:org`  
  → Create at [github.com/settings/tokens](https://github.com/settings/tokens)
- **Anthropic API Key** for Claude-powered analysis  
  → Get at [console.anthropic.com](https://console.anthropic.com)

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/github-actions-mcp.git
cd github-actions-mcp

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Fill in GITHUB_TOKEN and ANTHROPIC_API_KEY in .env

# 4. Build
npm run build

# 5. Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Connect to Claude Desktop

Find your config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["/absolute/path/to/github-actions-mcp/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here",
        "ANTHROPIC_API_KEY": "sk-ant-your_key_here",
        "POLLING_INTERVAL_MS": "30000",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Restart Claude Desktop. You'll see the 🔨 tools icon — the server is connected.

---

## Available Tools

### Repositories
| Tool | Description |
|------|-------------|
| `github_list_repositories` | List all repositories accessible with your token, with language, stars, and visibility |

### Workflows
| Tool | Description |
|------|-------------|
| `github_list_workflows` | List all GitHub Actions workflows defined in a repository |
| `github_list_workflow_runs` | List recent runs with filters for status, branch, and count |
| `github_get_workflow_run` | Get full details of a run including all job statuses and timing |
| `github_watch_workflow` | Poll a run every 10s until completion or 5-minute timeout |

### Logs & Analysis
| Tool | Description |
|------|-------------|
| `github_get_workflow_logs` | Fetch and parse per-job logs with automatic error extraction |
| `github_analyze_failure` | **AI diagnosis** — root cause, fixes, severity, and diagnostic report via Claude |

### Actions
| Tool | Description |
|------|-------------|
| `github_rerun_workflow` | Rerun a workflow — all jobs or failed jobs only |
| `github_cancel_workflow` | Cancel a workflow that is queued or in progress |

### Artifacts
| Tool | Description |
|------|-------------|
| `github_download_artifacts` | List artifacts or get a pre-signed download URL for a specific one |

### Deployments
| Tool | Description |
|------|-------------|
| `github_get_deployments` | List deployments by environment with latest status |
| `github_rollback_deployment` | Create a new deployment pointing to a previous stable ref |

### Monitoring
| Tool | Description |
|------|-------------|
| `github_monitor_repository` | Start / stop continuous polling of a repo for workflow changes |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `GITHUB_TOKEN` | ✅ | — | GitHub Personal Access Token (`repo`, `workflow`, `read:org`) |
| `ANTHROPIC_API_KEY` | ✅ | — | Anthropic API key for Claude-powered failure analysis |
| `POLLING_INTERVAL_MS` | ❌ | `30000` | How often `monitor_repository` polls GitHub (milliseconds) |
| `LOG_LEVEL` | ❌ | `info` | Log verbosity: `debug` / `info` / `warn` / `error` |

---

## Docker

```bash
# Start with Docker Compose (reads from .env automatically)
docker-compose up -d

# Or build and run manually
docker build -t github-actions-mcp .
docker run --env-file .env github-actions-mcp
```

---

## Development

```bash
npm run dev        # Run with tsx (no build step needed)
npm run build      # Compile TypeScript to dist/
npm start          # Run compiled output
npm test           # Run all tests (Vitest)
npm run typecheck  # TypeScript type check without emitting
```

### Running Tests

```bash
npm test
```

```
✓ tests/modules/logs-analyzer.test.ts   (5 tests)
✓ tests/modules/ai-engine.test.ts       (2 tests)
✓ tests/tools/repositories.test.ts      (2 tests)
✓ tests/tools/workflows.test.ts         (3 tests)

Test Files  4 passed (4)
Tests       12 passed (12)
```

---

## Architecture

```
src/
├── index.ts                          # FastMCP server — wires all 13 tools
├── config/
│   └── env.ts                        # Zod-validated environment config
├── modules/
│   ├── auth/
│   │   └── github-auth.ts            # GitHub PAT → Octokit instance
│   ├── connector/
│   │   └── github-rest.ts            # All GitHub REST API calls (Octokit)
│   ├── logs/
│   │   └── logs-analyzer.ts          # Log parsing & error pattern detection
│   ├── ai/
│   │   └── ai-engine.ts              # Claude API — failure diagnosis
│   └── monitoring/
│       └── workflow-monitor.ts       # Polling-based repo watcher
└── tools/
    ├── repositories.ts               # github_list_repositories
    ├── workflows.ts                  # github_list_workflows, list_runs, get_run
    ├── watcher.ts                    # github_watch_workflow
    ├── logs.ts                       # github_get_workflow_logs, analyze_failure
    ├── actions.ts                    # github_rerun_workflow, cancel_workflow
    ├── artifacts.ts                  # github_download_artifacts
    ├── deployments.ts                # github_get_deployments, rollback_deployment
    └── monitor.ts                    # github_monitor_repository
```

### How `github_analyze_failure` works

```
Agent calls github_analyze_failure(owner, repo, runId)
        │
        ├─► getWorkflowRun()        → confirm conclusion = "failure"
        ├─► getWorkflowRunJobs()    → identify failed jobs
        ├─► getJobLogs() × N        → fetch raw log text
        │
        ├─► LogsAnalyzer.parseWorkflowLogs()     → extract failed steps + errors
        ├─► LogsAnalyzer.extractErrorContext()   → get surrounding log lines
        │
        └─► AIEngine.analyzeFailure()            → send to Claude
                │
                └─► Returns: probableCause · suggestedFixes · severity · diagnosticReport
```

---

## Roadmap

- [ ] Web dashboard for real-time pipeline visualization
- [ ] Slack / webhook notifications on workflow events
- [ ] GitLab CI/CD support
- [ ] Azure DevOps connector
- [ ] Self-healing pipelines (auto-rerun with AI-suggested fixes)
- [ ] Multi-repository aggregated dashboard

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with <a href="https://github.com/punkpeye/fastmcp">FastMCP</a> · 
  Powered by <a href="https://www.anthropic.com">Claude</a> · 
  GitHub API via <a href="https://github.com/octokit/rest.js">Octokit</a>
</p>
