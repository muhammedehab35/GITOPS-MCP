import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  GITHUB_TOKEN: z.string().min(1, "GITHUB_TOKEN is required — create a PAT at https://github.com/settings/tokens"),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required — get it at https://console.anthropic.com/"),
  POLLING_INTERVAL_MS: z
    .string()
    .default("30000")
    .transform((v) => parseInt(v, 10)),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Environment configuration error:\n${errors}`);
  }
  return result.data;
}

export const env = loadEnv();
