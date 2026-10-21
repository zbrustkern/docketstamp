/** Read-only: verifies the public Auth project behind each checked-in web API key. */
import { resolveFirebaseConfig } from "../lib/firebase-config";

async function main() {
  const config = resolveFirebaseConfig(process.env);
  if (!config.apiKey) throw new Error("Inject NEXT_PUBLIC_FIREBASE_API_KEY from the selected project's Secret Manager first.");
  const hostname = config.projectId === "docketstamp-staging" ? "staging.docketstamp.com" : "docketstamp.com";
  {
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
