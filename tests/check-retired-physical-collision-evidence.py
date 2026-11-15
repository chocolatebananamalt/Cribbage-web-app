"""Independent exported-evidence check; no database/provider connection."""
import hashlib
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
run = Path(sys.argv[1]).resolve()
assert run.parent == root / "test-results"
load = lambda name: json.loads((run / name).read_text(encoding="utf-8-sig"))
result = load("retired-event-physical-collision-result.json")
cases = load("retired-event-direct-physical-collisions.json")
assert result["passed"] is True
assert result["physicalGuardBranchTraversalProven"] is True
assert result["collisionScope"] == "retired-event-history"
assert load("retired-event-baseline-final.json") == {"status": "blocked", "code": "award_rank_order_invalid"}
assert len(cases) == 2 and len({case["physical"] for case in cases}) == 2
for case in cases:
    assert case["globalCollision"] is True and case["oldEventScopedCollision"] is False
    for key, status in (("source", "blocked"), ("write", "rejected"), ("final", "blocked")):
        assert case[key]["status"] == status
        assert case[key]["code"] == "physical_evidence_conflict"
source = load("fresh-fund-review-source-after.json")
assert source["status"] == "review_source_available"
overrides = source["recipientSource"]["proposal"]["editor"]["overrideHistory"]
assert any(row["firstPlace"] == 3 and row["lastPlace"] == 4 and row["perPersonMinor"] == 500 and row["voided"] is False for row in overrides)
total = source["totals"]
assert total["regularEntryMinor"] - total["benefitExpenseMinor"] - total["operatingExpenseMinor"] + total["unrestrictedIncomeMinor"] == total["recordedFundMinor"] == 48100
assert source["sanctioning"]["totalMinor"] == 5400
assert result["providerSessionVerified"] is False and result["moneyMoved"] is False
trace = load("trace.json")
checked = []
for entry in trace:
    if "file" not in entry or "sha256" not in entry:
        continue
    matches = list((root / "database").rglob(entry["file"]))
    assert len(matches) == 1
    digest = hashlib.sha256(matches[0].read_bytes()).hexdigest()
    assert digest == entry["sha256"].lower()
    checked.append({"file": str(matches[0].relative_to(root)), "sha256": digest})
assert len(checked) == 79
cleanup = load("cleanup.json")
assert cleanup["removed"] is True and cleanup["verifiedAbsentByIdAndName"] is True
assert cleanup["runnerExitCode"] == 0
receipt = {"passed": True, "kind": "independent-retired-history-physical-guard-evidence-check", "cases": len(cases), "exactBranchesPerCase": 3, "installedSqlHashes": checked, "fundMinor": 48100, "sanctioningCountedOnce": True, "scope": "retired-event-history-only", "twoActiveNativeEventsVerified": False, "actualProviderSessionVerified": False, "hostedChanges": False, "moneyMoved": False}
(run / "root-retired-physical-collision-check.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: value for key, value in receipt.items() if key != "installedSqlHashes"}))
