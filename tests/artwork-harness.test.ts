import assert from "node:assert/strict";
import { buildRefinedPrompt, sanitizeArtPrompt, NEGATIVE_PROMPT } from "../lib/nano-banana";

// Physical presentation is not a printable subject or an allowed fallback.
assert.equal(sanitizeArtPrompt("greeting card mockup on textured paper"), "a tasteful botanical illustration");
assert.equal(sanitizeArtPrompt("watercolor roses on rough cream paper"), "watercolor roses");
assert.equal(sanitizeArtPrompt("lavender with paper texture"), "lavender with");
// Illustration styles and deliberate blank backgrounds remain legitimate art.
assert.equal(sanitizeArtPrompt("watercolor fox on a white background"), "watercolor fox on a white background");
assert.equal(sanitizeArtPrompt("a ceramic mug on a wooden desk"), "a ceramic mug on a wooden desk");
const prompt = buildRefinedPrompt("watercolor roses on textured paper", "Thank You");
assert.ok(prompt.includes("17:22 crop"));
assert.ok(!prompt.includes("roses on textured paper"));
assert.ok(prompt.includes("no sheet of paper"));
assert.ok(prompt.includes("do not simulate their paper substrate"));
assert.ok(prompt.includes("Preserve the requested subject inside the illustration itself"));
assert.ok(NEGATIVE_PROMPT.includes("paper grain"));
assert.ok(NEGATIVE_PROMPT.includes("product photograph"));
console.log("Artwork harness: 12 assertions passed. No provider calls or generated images.");
