import { Octokit } from "@octokit/rest";
import type { GitHubAuth } from "../auth/github-auth.js";

export class GitHubRestConnector {
  private octokit: Octokit;

  constructor(auth: GitHubAuth) {
    this.octokit = auth.createRestClient();
  }

  // ── Repositories ──────────────────────────────────────────────
  async listRepositories(type: "all" | "owner" | "member" = "owner") {
    const { data } = await this.octokit.repos.listForAuthenticatedUser({
      type,
      sort: "updated",
      per_page: 100,
    });
    return data;
  }

  // ── Workflows ─────────────────────────────────────────────────
  async listWorkflows(owner: string, repo: string) {
    const { data } = await this.octokit.actions.listRepoWorkflows({ owner, repo });
    return data.workflows;
  }

  async listWorkflowRuns(
    owner: string,
    repo: string,
    options?: {
      workflowId?: number | string;
      status?: "completed" | "in_progress" | "queued" | "waiting" | "requested" | "pending";
      branch?: string;
      perPage?: number;
    }
  ) {
    if (options?.workflowId) {
      const { data } = await this.octokit.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: options.workflowId,
        status: options.status,
        branch: options.branch,
        per_page: options.perPage ?? 30,
      });
      return data.workflow_runs;
    }
    const { data } = await this.octokit.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      status: options?.status,
      branch: options?.branch,
      per_page: options?.perPage ?? 30,
    });
    return data.workflow_runs;
  }

  async getWorkflowRun(owner: string, repo: string, runId: number) {
    const { data } = await this.octokit.actions.getWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });
    return data;
  }

  async getWorkflowRunJobs(owner: string, repo: string, runId: number) {
    const { data } = await this.octokit.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });
    return data.jobs;
  }

  // ── Logs ──────────────────────────────────────────────────────
  async getJobLogs(owner: string, repo: string, jobId: number): Promise<string> {
    const response = await this.octokit.request(
      "GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs",
      { owner, repo, job_id: jobId }
    );
    return String(response.data ?? "");
  }

  async getWorkflowRunLogsUrl(owner: string, repo: string, runId: number): Promise<string> {
    const response = await this.octokit.request(
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs",
      { owner, repo, run_id: runId, request: { redirect: "manual" } }
    );
    return (response.headers as Record<string, string>)["location"] ?? "";
  }

  // ── Actions ───────────────────────────────────────────────────
  async rerunWorkflow(owner: string, repo: string, runId: number) {
    await this.octokit.actions.reRunWorkflow({ owner, repo, run_id: runId });
    return { success: true, message: `Workflow run ${runId} restarted.` };
  }

  async rerunFailedJobs(owner: string, repo: string, runId: number) {
    await this.octokit.actions.reRunWorkflowFailedJobs({ owner, repo, run_id: runId });
    return { success: true, message: `Failed jobs in run ${runId} restarted.` };
  }

  async cancelWorkflow(owner: string, repo: string, runId: number) {
    await this.octokit.actions.cancelWorkflowRun({ owner, repo, run_id: runId });
    return { success: true, message: `Workflow run ${runId} cancelled.` };
  }

  // ── Artifacts ─────────────────────────────────────────────────
  async listArtifacts(owner: string, repo: string, runId: number) {
    const { data } = await this.octokit.actions.listWorkflowRunArtifacts({
      owner,
      repo,
      run_id: runId,
    });
    return data.artifacts;
  }

  async getArtifactDownloadUrl(owner: string, repo: string, artifactId: number): Promise<string> {
    const response = await this.octokit.request(
      "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}",
      { owner, repo, artifact_id: artifactId, archive_format: "zip", request: { redirect: "manual" } }
    );
    return (response.headers as Record<string, string>)["location"] ?? "";
  }

  // ── Deployments ───────────────────────────────────────────────
  async listDeployments(owner: string, repo: string, environment?: string) {
    const { data } = await this.octokit.repos.listDeployments({
      owner,
      repo,
      environment,
      per_page: 30,
    });
    return data;
  }

  async getDeploymentStatuses(owner: string, repo: string, deploymentId: number) {
    const { data } = await this.octokit.repos.listDeploymentStatuses({
      owner,
      repo,
      deployment_id: deploymentId,
    });
    return data;
  }

  async createDeployment(owner: string, repo: string, ref: string, environment: string) {
    const { data } = await this.octokit.repos.createDeployment({
      owner,
      repo,
      ref,
      environment,
      auto_merge: false,
      required_contexts: [],
    });
    return data;
  }

  async createDeploymentStatus(
    owner: string,
    repo: string,
    deploymentId: number,
    state: "inactive" | "error" | "failure" | "pending" | "success"
  ) {
    const { data } = await this.octokit.repos.createDeploymentStatus({
      owner,
      repo,
      deployment_id: deploymentId,
      state,
    });
    return data;
  }
}
