import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Print locations only. Never echo a matched credential into CI logs.
const patterns = [
  ["Google API key", /AIza[A-Za-z0-9_-]{35}/g],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{80,}?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ["Stripe secret", /(?:sk|rk)_live_[A-Za-z0-9]{20,}/g],
  ["GitHub token", /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/g],
];
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
let failures = 0;
for (const file of files) {
  let contents;
  try { contents = readFileSync(file, "utf8"); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
  for (const [label, pattern] of patterns) {
    for (const match of contents.matchAll(pattern)) {
      const line = contents.slice(0, match.index).split("\n").length;
      console.error(`${file}:${line}: ${label} must be supplied outside the repository`);
      failures++;
    }
  }
}
if (failures) process.exitCode = 1;
else console.log(`Credential hygiene passed for ${files.length} tracked files.`);
