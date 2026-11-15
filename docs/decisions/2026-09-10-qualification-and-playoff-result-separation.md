# Qualification order and playoff-result separation

**Decision date:** 2026-09-10  
**Status:** Accepted; supersedes the earlier sample-PDF instruction that placed the event winner and runner-up first in qualifying order

## Decision

An event has two related but distinct result sets:

1. **Qualification results** rank the completed qualifying scorecards from highest to lowest and determine which players enter the playoffs.
2. **Event results** record the playoff outcome, including winner, runner-up, and any other paid playoff placements.

The playoff winner and runner-up must have qualified for the playoffs, but their final playoff placements do not change their earlier qualifying ranks. A winner may have entered the playoffs from any qualifying position.

The qualification display and generated report must list qualifiers in their original qualifying order. The **High Non-Qualifier** is the first ranked player immediately outside the qualifying cutoff and is displayed directly after the last qualifier as a separately labeled, visually distinct row. It is not an Event Results placement.

Before playoffs finish, the Main Event Qualification Preview shows the ranking, cutoff, qualifier count, unresolved cutoff ties, and provisional High Non-Qualifier. It does not show a winner or runner-up. After event finalization, the report shows Event/Playoff Results separately from Qualification Results.

If the ACC reporting interface requires High Non-Qualifier as a separate field or section, the export adapter may map the same semantic record into that required position. The application display order must not falsely turn the High Non-Qualifier into a playoff placement.

## Evidence and limitation

Current public ACC tournament-result examples separate `Main Tournament` playoff placements from `Main Qualifying` ranks. Those examples do not display a High Non-Qualifier, so they support separation of the two result sets but do not establish a mandatory ACC display location for that person. The precise private-portal field placement remains an export-mapping confirmation, not a reason to combine the categories.

The existing sample PDF and demonstration Qualification Preview are known to be outdated until regenerated against this decision.
