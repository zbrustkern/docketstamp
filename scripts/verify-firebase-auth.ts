/** Read-only: verifies the public Auth project behind each checked-in web API key. */
import { PROD_FIREBASE_CONFIG, STAGING_FIREBASE_CONFIG } from "../lib/firebase-config";

async function main() {
  for (const [config, hostname] of [
    [STAGING_FIREBASE_CONFIG, "staging.docketstamp.com"],
    [PROD_FIREBASE_CONFIG, "docketstamp.com"],
  ] as const) {
    const endpoint = new URL("https://identitytoolkit.googleapis.com/v1/projects");
    endpoint.searchParams.set("key", config.apiKey);
    const response = await fetch(endpoint, {
      headers: { Referer: `https://${hostname}/` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`${config.projectId}: Auth configuration request failed (${response.status}).`);
    const result = await response.json() as { projectId?: string; authorizedDomains?: string[] };
    if (result.projectId !== config.messagingSenderId) {
      throw new Error(`${config.projectId}: API key resolves to a different project number.`);
    }
    if (!result.authorizedDomains?.includes(hostname)) {
      throw new Error(`${config.projectId}: ${hostname} is missing from Firebase Auth authorized domains.`);
    }
    console.log(`PASS ${config.projectId}: registered project ${result.projectId}; ${hostname} authorized.`);
  }
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : "Firebase verification failed.");
  process.exitCode = 1;
});
