/**
 * Google Cloud authentication bootstrap.
 *
 * On Vercel/serverless environments, we can't run `gcloud auth application-default login`.
 * Instead we ship a service account JSON key as a base64-encoded env var
 * (GOOGLE_APPLICATION_CREDENTIALS_BASE64), decode it to a temp file at startup,
 * and point GOOGLE_APPLICATION_CREDENTIALS at that file.
 *
 * Locally, this module is a no-op when GOOGLE_APPLICATION_CREDENTIALS_BASE64 is
 * unset, so ADC continues to work for development.
 */

import { writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let initialized = false;

/**
 * Writes the base64-encoded service account JSON to a temp file
 * and sets GOOGLE_APPLICATION_CREDENTIALS so the Google SDKs can find it.
 * Idempotent. Safe to call multiple times.
 */
export function ensureGoogleCredentials(): void {
  if (initialized) return;
  initialized = true;

  const base64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
  if (!base64) {
    // Local development: rely on `gcloud auth application-default login`.
    return;
  }

  const credPath = join(tmpdir(), "agenlens-gcp-credentials.json");

  if (!existsSync(credPath)) {
    const json = Buffer.from(base64, "base64").toString("utf-8");
    writeFileSync(credPath, json, { mode: 0o600 });
  }

  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
}
