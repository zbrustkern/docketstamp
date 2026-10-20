import {
  getAllScenarios,
  parseScenarioNote,
  mapScenarioFontId,
} from "../lib/seo-scenarios";
import { draftReducer, createInitialDraft } from "../lib/draft/reducer";
import { HANDWRITING_STYLES } from "../components/v3/Step2NoteComposition";

console.log("=================================================");
console.log("🧪 RUNNING SCENARIO PRE-SEEDING & DRAFT TESTS");
console.log("=================================================\n");

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

// --- 1. Test Font Mapping to Verified Handwrytten Styles ---
console.log("--- 1. Testing Font ID Mapping ---");
assert(mapScenarioFontId("1") === "hwKate", "Font '1' maps to 'hwKate' (Warm Cursive)");
assert(mapScenarioFontId("2") === "hwKate", "Font '2' maps to 'hwKate' (Classic Cursive)");
assert(mapScenarioFontId("3") === "hwAdam", "Font '3' maps to 'hwAdam' (Architect Print)");
assert(mapScenarioFontId("4") === "hwAdam", "Font '4' maps to 'hwAdam' (Executive Adam)");
assert(mapScenarioFontId("hwDavid") === "hwDavid", "Direct key 'hwDavid' preserved");
assert(mapScenarioFontId("hwChase") === "hwChase", "Direct key 'hwChase' preserved");
assert(mapScenarioFontId(undefined) === "hwDavid", "Default font is 'hwDavid'");

// --- 2. Test Parsing and Pre-seeding Across All 12 Canonical Scenarios ---
console.log("\n--- 2. Testing Parsing & Character Limits Across All Scenarios ---");
const scenarios = getAllScenarios();
assert(scenarios.length >= 12, `Verified ${scenarios.length} canonical scenarios exist`);

for (const scenario of scenarios) {
  const parsed = parseScenarioNote(scenario.handwrittenNote);
  assert(
    parsed.bodyNote.length > 20,
    `[${scenario.slug}] bodyNote extracted with content (${parsed.bodyNote.length} chars)`
  );
  assert(
    parsed.salutation.length > 0,
    `[${scenario.slug}] salutation extracted: "${parsed.salutation}"`
  );
  assert(
    parsed.signOff.length > 0,
    `[${scenario.slug}] signOff extracted: "${parsed.signOff.replace("\n", " ")}"`
  );

  const fullLetter = [parsed.salutation, parsed.bodyNote, parsed.signOff]
    .filter(Boolean)
    .join("\n\n");
  assert(
    fullLetter.length <= 450,
    `[${scenario.slug}] Full letter (${fullLetter.length} chars) complies with 450 char limit`
  );

  // Verify that the mapped font exists in HANDWRITING_STYLES
  const fontKey = mapScenarioFontId(scenario.fontStyleId);
  const fontExists = HANDWRITING_STYLES.some((s) => s.id === fontKey);
  assert(
    fontExists,
    `[${scenario.slug}] Mapped font '${fontKey}' exists in active Handwrytten SVG styles`
  );

  // Verify draft reducer hydration with scenario data
  let draft = createInitialDraft("candidate_v1");
  draft = draftReducer(draft, {
    type: "SELECT_DESIGN",
    payload: {
      presetId: scenario.slug,
      imageUrl: scenario.coverUrl,
      title: scenario.h1Title,
      occasion: scenario.occasionName,
      source: "preset",
      accepted: true,
    },
  });
  draft = draftReducer(draft, {
    type: "UPDATE_NOTE",
    payload: {
      salutation: parsed.salutation,
      text: parsed.bodyNote,
      signOff: parsed.signOff,
      style: fontKey,
    },
  });

  assert(
    draft.selectedDesign?.imageUrl === scenario.coverUrl,
    `[${scenario.slug}] Draft retains scenario coverUrl`
  );
  assert(
    draft.selectedDesign?.accepted === true,
    `[${scenario.slug}] Draft selected design marked accepted`
  );
  assert(
    draft.note.text === parsed.bodyNote,
    `[${scenario.slug}] Draft retains scenario body note`
  );
  assert(
    draft.note.style === fontKey,
    `[${scenario.slug}] Draft retains mapped handwriting style`
  );
}

console.log("\n=================================================");
console.log(`Test Summary: ${passed} Passed, ${failed} Failed`);
console.log("=================================================");

if (failed > 0) {
  process.exit(1);
}
