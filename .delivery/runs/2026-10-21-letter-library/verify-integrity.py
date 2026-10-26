"""Verify this sprint preserves baseline work and record its final source hashes."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
import subprocess

root = Path(__file__).resolve().parents[3]
run = Path(__file__).resolve().parent

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None

protected = json.loads((run / 'protected-files.json').read_text())
baseline = json.loads((run / 'baseline-files.json').read_text())
protected_changes = [name for name, expected in protected.items() if digest(root / name) != expected]
baseline_changes = [name for name, expected in baseline.items() if digest(root / name) != expected]
allowed = {'docs/sprints/ledger.json', 'docs/DOCKETSTAMP_PRODUCT_OPPORTUNITIES_2026-10-21.md'}
unexpected_changes = sorted(set(baseline_changes) - allowed)
old_ledger = json.loads((run / 'baseline-ledger.json').read_text())
ledger = json.loads((root / 'docs/sprints/ledger.json').read_text())
prior_entries_unchanged = ledger['sprints'][:-1] == old_ledger['sprints']
assert ledger['sprints'][-1]['id'] == 'SPRINT-0013'
assert ledger['schema_version'] == old_ledger['schema_version']

documents = [root / 'docs/DOCKETSTAMP_PRODUCT_OPPORTUNITIES_2026-10-21.md', root / 'docs/sprints/SPRINT-0013.md', *run.glob('*.md')]
missing_links = []
for document in documents:
    for target in re.findall(r'\]\(([^)]+)\)', document.read_text()):
        if '://' in target or target.startswith('#') or target.startswith('mailto:'):
            continue
        local = target.split('#', 1)[0]
        if local and not (document.parent / local).exists():
            missing_links.append({'document': str(document.relative_to(root)), 'target': target})

source_paths = ['src/lib/docket/letter-library.ts', 'src/components/docket/LetterLibraryClient.tsx', 'app/letters/page.tsx', 'app/page.tsx', 'app/sitemap.ts', 'tests/letter-library.test.ts']
diff_check = subprocess.run(['git', 'diff', '--check'], cwd=root, text=True, capture_output=True)
result = {
    'passed': not protected_changes and not unexpected_changes and prior_entries_unchanged and not missing_links and diff_check.returncode == 0,
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'protectedFileCount': len(protected), 'protectedChanges': protected_changes,
    'baselineFileCount': len(baseline), 'intentionalBaselineChanges': sorted(set(baseline_changes) & allowed),
    'unexpectedBaselineChanges': unexpected_changes, 'priorLedgerEntriesUnchanged': prior_entries_unchanged,
    'priorLedgerEntryCount': len(old_ledger['sprints']), 'missingDocumentationLinks': missing_links,
    'gitDiffCheckExitCode': diff_check.returncode,
    'sourceHashes': {name: digest(root / name) for name in source_paths},
}
(run / 'evidence/integrity.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
assert result['passed'], 'Integrity checks failed'
