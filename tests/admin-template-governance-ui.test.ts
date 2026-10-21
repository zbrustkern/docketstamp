import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync('components/admin/TemplateGovernancePanel.tsx', 'utf8');
const navigation = readFileSync('app/admin/page.tsx', 'utf8');

describe('template governance admin UI contract', () => {
  it('uses the frozen admin API and carries optimistic revision, digest, reason and idempotency on writes', () => {
    assert.match(panel, /fetch\("\/api\/admin\/console\/templates", \{ cache: "no-store" \}\)/);
    assert.match(panel, /action: "set_global", expectedRevision: data\.policy\.revision, reason:/);
    assert.match(panel, /action: "set_template", slug: selected\.slug, expectedRevision: data\.policy\.revision, expectedContentDigest: selected\.contentDigest/);
    assert.match(panel, /const requestId = crypto\.randomUUID\(\)/);
    assert.match(panel, /response\.status === 409/);
    assert.match(panel, /Retry exact save/);
  });

  it('exposes review separately from enabled state and renders source and compiled content read-only', () => {
    assert.match(panel, /Template enabled/);
    assert.match(panel, /Approval is a recorded review status; it never enables a paused template/);
    assert.match(panel, /Explicitly update review record/);
    assert.match(panel, /Read-only compiled letter and fields/);
    assert.match(panel, /Mandatory UPL compliance footer/);
    assert.match(panel, /Source kind/);
    assert.match(panel, /Reproduction status/);
    assert.match(panel, /safeHttpUrl\(source\.url\)/);
    assert.match(panel, /reviewCurrent/);
    assert.match(panel, /Migration defaults · not a saved policy/);
  });

  it('makes policy dimensions and grandfathered-lock cutoff visible', () => {
    assert.match(panel, /Consumer residence/);
    assert.match(panel, /Property \/ matter state/);
    assert.match(panel, /never inferred from IP or recipient address/);
    assert.match(panel, /A lock committed first is grandfathered, including its later Stripe intent\/payment and dispatch/);
    assert.match(panel, /Global availability/);
  });

  it('keeps state-code text editable until blur and validates every entered state', () => {
    assert.match(panel, /const \[rawStates, setRawStates\] = useState\(statesValue\)/);
    assert.match(panel, /onChange=\{\(event\) => setRawStates\(event\.target\.value\)\}/);
    assert.match(panel, /onBlur=\{\(\) => \{ if \(invalidStates\.length === 0\) onChange\(\{ \.\.\.rule, states: parseStates\(rawStates\) \}\); \}\}/);
    assert.match(panel, /invalidStateTokens\(rawStates\)/);
    assert.match(panel, /if \(mode === "all"\)[\s\S]*setRawStates\(""\)[\s\S]*onValidityChange\(validationKey, false\)[\s\S]*onChange\(\{ mode, states: \[\] \}\)/);
    assert.match(panel, /disabled=\{disabled \|\| rule\.mode === "all"\}/);
    assert.match(panel, /key=\{`template-residence:\$\{selectedSlug\}:\$\{editorResetEpoch\}`\}/);
    assert.match(panel, /setEditorResetEpoch\(\(epoch\) => epoch \+ 1\)/);
    assert.match(panel, /invalidGeoRules\["global-residence"\] \|\| invalidGeoRules\["global-property"\]/);
    assert.match(panel, /validationKey=\{`template-residence:\$\{selectedSlug\}`\}/);
  });

  it('preserves idempotent retry only for uncertain outcomes and makes stale policy read-only', () => {
    assert.match(panel, /response\.status >= 400 && response\.status < 500/);
    assert.match(panel, /setPending\(null\);\s*const message = result\.error/);
    assert.match(panel, /if \(response\.status === 401 \|\| response\.status === 403\)/);
    assert.match(panel, /if \(!response\.ok \|\| !result\.success\) throw new Error/);
    assert.match(panel, /all policy writes are disabled until a successful reload/);
    assert.match(panel, /const canWrite = Boolean\(data\?\.canManage && policyFresh\)/);
    assert.match(panel, /disabled=\{!canWrite \|\| saving \|\| !reason\.trim\(\)/);
  });

  it('confirms the proposed policy values before applying them', () => {
    assert.match(panel, /Proposed global change[\s\S]*service \$\{globalDraft\.enabled[\s\S]*residence \$\{describeGeoRule\(globalDraft\.residence\)\}[\s\S]*property\/matter \$\{describeGeoRule\(globalDraft\.property\)\}/);
    assert.match(panel, /Proposed change for “\$\{selected\.title\}”[\s\S]*template \$\{templateDraft\.enabled[\s\S]*review \$\{reviewStatus\}[\s\S]*residence \$\{describeGeoRule\(templateDraft\.residence\)\}/);
  });

  it('is reachable in desktop tabs, mobile navigation, and the protected dashboard content', () => {
    assert.match(navigation, /"templates"/);
    assert.match(navigation, /Templates &amp; coverage/);
    assert.match(navigation, /activeTab === "templates" && <TemplateGovernancePanel \/>/);
    assert.match(navigation, /<span className="text-\[10px\] mt-0\.5">Templates<\/span>/);
  });
});
