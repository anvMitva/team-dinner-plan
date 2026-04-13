# completed_matches.json Data Usage Notes

## Why this file matters
- `completed_matches.json` is the authoritative source for actual IPL results and rich post-match metadata.
- It allows us to remove manual winner input and run points automation reliably.

## Immediate uses already implemented
- Winner automation:
  - Match by `MatchDate + HomeTeamName + AwayTeamName` against `ipl-matches.json`.
  - Read winner from `WinningTeamID`.
  - Resolve winner team name from `HomeTeamID/AwayTeamID` and write to `match-picks-db.json`.
- Daily scheduler:
  - Automatic sync runs at 07:00 server local time.

## High-value fields for our app roadmap
- Match identity and mapping:
  - `MatchID`, `MatchDate`, `HomeTeamName`, `AwayTeamName`, `HomeTeamID`, `AwayTeamID`, `WinningTeamID`, `MatchOrder`, `CompetitionName`
- Result summary and context:
  - `Comments`, `Commentss`, `MatchStatus`, `TossTeam`, `TossDetails`, `FirstBattingSummary`, `SecondBattingSummary`
- Branding/UI assets:
  - `HomeTeamLogo`, `AwayTeamLogo`, `MatchHomeTeamLogo`, `MatchAwayTeamLogo`
- Venue and scheduling:
  - `GroundName`, `city`, `MatchTime`, `GMTMatchTime`, `timezone1`
- Player spotlight / live match snapshot:
  - `CurrentStrikerName`, `CurrentNonStrikerName`, `CurrentBowlerName`
  - `StrikerRuns/Balls/SR`, `BowlerOvers/Wickets/Economy`
  - `MOM`, `MOM_TYPE`, `MOMImage`
- Media and engagement:
  - `PreMatchCommentary`, `PostMatchCommentary`, `VideoScorecard`, `AudioHighlightsPath`, `AudioPodcastPath`, `FBURL`

## Proposed features we can build from this dataset
- Auto result badge on match cards:
  - Show "Won by" text from `Comments` and winning team logo.
- Match center panel:
  - Toss, innings summaries, MOM, and venue details.
- Detailed analytics:
  - Team win trends by venue/time slot.
  - Batting-first vs chasing win split.
- Content module:
  - Pre/post commentary snippets in expandable sections.
- Media links:
  - CTA buttons for highlights, scorecard video, podcasts.

## Data quality checks to run daily
- Ensure each completed match has non-empty `WinningTeamID`.
- Ensure `HomeTeamID/AwayTeamID` map correctly to names.
- Ensure one-to-one mapping with `ipl-matches.json` for date + teams.
- Flag any mismatch where winner ID does not match home/away IDs.

## Risks and mitigations
- Risk: Team names differ slightly between sources.
  - Mitigation: Add normalization/alias table for known name variants.
- Risk: Delayed `WinningTeamID` updates for rain/no result matches.
  - Mitigation: Keep winner blank until official ID appears.
- Risk: Schedule mismatch by date/timezone.
  - Mitigation: Match by date + both teams, not by time only.

## Meeting agenda suggestion
1. Confirm MVP scope: result badges + toss + innings summaries.
2. Decide where to show long commentary blocks.
3. Finalize normalization rules for source mismatches.
4. Prioritize analytics widgets for dashboard.
