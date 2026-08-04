# Season Tracker — UI overhaul prototype

A navigable, non-functional prototype of a redesigned season-tracker, covering
every surface the app has today. Open `prototype.html` in a browser — it is
self-contained (fonts and data inlined, no network).

Nothing here ships. It exists to settle the design before any of it is built
into `season-tracker/src`.

## What it covers

26 screens, listed in the left rail:

| Group | Screens |
|---|---|
| Season | Overview · Standings · Schedule · Night builder · Balancer · Night matchup · Playoffs · Schedule maker · Elo ladder · Heatmaps |
| Player stats | Stats overview · Round matchup · Rounds · Players · Player card · Units · Unit card · Compare · Maps |
| Setup | Events & seasons · Unit & player identity · Company splitter · Settings · Import · Share & export |

Not drawn: the casualty quick-entry shortcut, and the playoff planner's
"apply this format" write-back (the audit and recommendations are there; the
apply flow is not).

## The data is real where it can be

- **Standings, schedule, divisions, maps** come from `SSL Season 3.json`,
  computed with the same rules as `SeasonTracker.jsx` (`calculateStandings`,
  including the 2–0 sweep bonus and manual adjustments).
- **Elo** is produced by running the real `season-tracker/src/utils/eloEngine.js`
  (`replayActiveSeasonUpToWeek`) over that season, once per week, so the ladder
  and its trend lines are the engine's own output.
- **Heatmaps** use the same per-round, swap-aware pairing count as
  `calculateTeammateHeatmapForSeasons`, keyed on each pair's share of the rounds
  where both were active.
- **Player and scoreboard stats are synthetic.** The season JSON carries no
  scoreboards, so per-player rounds are generated against the real unit roster,
  real maps and real week results. Numbers are plausible, not true.

## Design decisions worth keeping

**The app's own visual language, sharpened.** Squared corners, hairline rules,
monospace, no drop shadows. What was missing was hierarchy: a scoreline is 46px,
a column label is 10px, and nothing in between competes. The current app tops
out at 19px, which is why everything reads at one volume.

**Monospace stopped being universal.** Numbers and the tracker's own labels stay
mono; player and unit names move to sans.

**Faction colour means faction and nothing else.** Selection is an ink
inversion, won/lost is monochrome, and the 1/3/5 ticket stances get their own
ordinal ramp, so one colour never carries two meanings on a screen.

**Comparison is one component.** The mirrored spine renders a round, a night,
two players and two units.

**Acronyms explain themselves.** ×Td and ×Tk read as "cost per death" and
"value per kill" in every column head, with the short forms kept in a glossary.

**Ranks travel with numbers.** 6.43 K/D means nothing until it says 2nd of 78.

## Findings that apply to the shipping app

These are defects in the current code, not the prototype.

1. **Faction colours fail colour-vision separation.** The USA green
   (`--color-ok`) and CSA tan (`--color-accent`) measure ΔE 5.1–6.2 under
   protanopia against a floor of 8, and **13.5 for normal vision against a floor
   of 15** — full-colour readers struggle to tell them apart. Affects every
   faction pill, bar and chip. The prototype uses a validated pair — Union blue
   `#1a6493` / `#3f8ec8`, butternut `#b06a0a` / `#bc8630` — which passes every
   check in both themes at ΔE ~20, and is closer to the game's own colours.

2. **`button { text-transform: uppercase }` in `src/index.css` rewrites data.**
   Player names and unit tags render inside buttons, so `vanreiswick` displays as
   VANREISWICK and `1stTX` as 1STTX — while the same names appear correctly in
   the Rounds table, which doesn't use buttons. Names are identity; the CSS is
   editing them.

3. **The Regiments tab is unreadable at a glance.** Each unit is one wrapped
   line of right-aligned grey text, so nothing lines up vertically and K/D can't
   be compared down a column.

4. **`SPECIAL_COMPANY_CAP` is a fixed export** in `src/utils/companySplit.ts`.
   Making it editable means adding `specialCap` to `CompanySideConfig` and
   `clampSideConfig`, the way `cavalryCap` already works.

5. **Home/away has no home in the data model.** The tracker has Team A/Team B
   and a lead per side, but nothing meaning "home". The prototype maps
   home → Team A lead throughout. If home is meant to carry more than that (map
   pick, side pick), it needs a field.

6. **Map bias was removed** from the design at the league's request — unused and
   not coming back.

7. **The expected-result blend needs a minimum-sample floor.** Blending Elo with
   a map's own record makes thin maps distort: Reno's Fall has one recorded
   round, so map history reads 0% and pulls a 53% Elo edge down to 38%.

8. **The pasted 2026 schedule has its dates out of order.** Weeks 4 and 5 are
   dated before week 3 (W3 9/2, W4 8/26, W5 8/19). Its lead constraints are
   otherwise perfect: all 15 units get 4 leads, 2 home / 2 away, one R1 and one
   R2 within each, no repeat pairings, no unit leading both rounds of a night.

## Rebuilding

`prototype.html` is generated. `src/template.html` holds the page — tokens, CSS,
shell and every screen; `src/screens*.js` are the later screens spliced into it;
`src/build.py` inlines the fonts and the dataset.

The dataset itself was assembled iteratively (season aggregation, an Elo dump
via a temporary vitest harness against the real engine, a schedule parse) and is
**not** fully reproducible from what is committed here — `src/gen-season.py` and
`src/gen-schedule.py` are the two substantial pieces, kept for reference. Treat
`prototype.html` as the artifact and `template.html` as the design source.
