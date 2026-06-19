import type { GitHubRestConnector } from "../connector/github-rest.js";

export interface WorkflowEvent {
  type: "run_started" | "run_completed" | "run_failed" | "run_cancelled";
  owner: string;
  repo: string;
  runId: number;
  workflowName: string;
  conclusion: string | null;
  timestamp: string;
}

type EventCallback = (event: WorkflowEvent) => void;

interface MonitorEntry {
  owner: string;
  repo: string;
  intervalMs: number;
  connector: GitHubRestConnector;
  lastSeenRunId: number;
  timer: NodeJS.Timeout;
}

export class WorkflowMonitor {
  private monitors = new Map<string, MonitorEntry>();
  private listeners: EventCallback[] = [];

  onEvent(callback: EventCallback): void {
    this.listeners.push(callback);
  }

  startMonitoring(
    connector: GitHubRestConnector,
    owner: string,
    repo: string,
    intervalMs: number
  ): string {
    const key = `${owner}/${repo}`;
    if (this.monitors.has(key)) return key;

    const timer = setInterval(() => void this.poll(key), intervalMs);
    this.monitors.set(key, { owner, repo, intervalMs, connector, lastSeenRunId: 0, timer });

    void this.poll(key);
    return key;
  }

  stopMonitoring(owner: string, repo: string): boolean {
    const key = `${owner}/${repo}`;
    const entry = this.monitors.get(key);
    if (!entry) return false;
    clearInterval(entry.timer);
    this.monitors.delete(key);
    return true;
  }

  listMonitored(): string[] {
    return Array.from(this.monitors.keys());
  }

  private async poll(key: string): Promise<void> {
    const entry = this.monitors.get(key);
    if (!entry) return;

    try {
      const runs = await entry.connector.listWorkflowRuns(entry.owner, entry.repo, { perPage: 10 });
      const newRuns = runs.filter((r) => r.id > entry.lastSeenRunId);

      for (const run of newRuns) {
        const type: WorkflowEvent["type"] =
          run.status === "in_progress"
            ? "run_started"
            : run.conclusion === "failure"
            ? "run_failed"
            : run.conclusion === "cancelled"
            ? "run_cancelled"
            : "run_completed";

        const event: WorkflowEvent = {
          type,
          owner: entry.owner,
          repo: entry.repo,
          runId: run.id,
          workflowName: run.name ?? "Unknown Workflow",
          conclusion: run.conclusion ?? null,
          timestamp: new Date().toISOString(),
        };

        this.listeners.forEach((cb) => cb(event));
      }

      if (runs.length > 0) {
        entry.lastSeenRunId = Math.max(...runs.map((r) => r.id));
      }
    } catch (error) {
      console.error(`[WorkflowMonitor] Error polling ${key}:`, error);
    }
  }
}
