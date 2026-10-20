import fs from "node:fs";
import path from "node:path";
import { countLegacyOrders } from "@/lib/legacy-order-migration";

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const fixturePath = path.resolve(argument("--fixture", "tests/fixtures/orders/legacy-orders.json"));
const parsed = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
if (!Array.isArray(parsed)) throw new Error("FIXTURE_MUST_BE_ARRAY");
console.log(JSON.stringify({ mode: "read_only_inventory", source: path.basename(fixturePath), counts: countLegacyOrders(parsed) }, null, 2));
