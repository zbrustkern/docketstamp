import fs from "node:fs";
import path from "node:path";
import { planLegacyOrderMigration, type LegacyOrderMigrationManifest } from "@/lib/legacy-order-migration";

function argument(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const fixturePath = path.resolve(argument("--fixture", "tests/fixtures/orders/legacy-orders.json")!);
const outputPath = path.resolve(argument("--out", ".delivery/legacy-order-migration-dry-run.json")!);
const parsed = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
if (!Array.isArray(parsed)) throw new Error("FIXTURE_MUST_BE_ARRAY");

const resumePath = argument("--resume");
const priorManifest = resumePath
  ? JSON.parse(fs.readFileSync(path.resolve(resumePath), "utf8")) as LegacyOrderMigrationManifest
  : undefined;
const manifest = planLegacyOrderMigration({
  records: parsed,
  runId: argument("--run-id", priorManifest?.runId || "local-fixture-dry-run")!,
  batchSize: Number(argument("--batch-size", "100")),
  priorManifest,
});
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  mode: "dry_run_only",
  source: path.basename(fixturePath),
  manifest: path.relative(process.cwd(), outputPath),
  beforeCounts: manifest.beforeCounts,
  afterCounts: manifest.afterCounts,
  changes: manifest.changes.length,
  quarantined: manifest.quarantined.length,
  checkpoint: manifest.checkpoint,
}, null, 2));
