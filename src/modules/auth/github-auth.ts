import { Octokit } from "@octokit/rest";

export class GitHubAuth {
  private token: string;

  constructor(token: string) {
    if (!token || token.trim() === "") {
      throw new Error("GitHub token must not be empty");
    }
    this.token = token;
  }

  createRestClient(): Octokit {
    return new Octokit({
      auth: this.token,
      userAgent: "github-mcp-server/1.0.0",
    });
  }

  getToken(): string {
    return this.token;
  }

  maskToken(): string {
    return `${this.token.slice(0, 4)}${"*".repeat(this.token.length - 8)}${this.token.slice(-4)}`;
  }
}
