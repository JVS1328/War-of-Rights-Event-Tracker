# War of Rights Season Tracker

A React-based web application for tracking regiment performance across a War of Rights competitive season. Built with the same design patterns as the Log Analyzer.

## Features

- **Week Management**: Create and manage weekly matches
- **Unit/Regiment Tracking**: Add and organize participating units
- **Team Rosters**: Assign units to teams for each week
- **Point System**: Configurable point system for wins, losses, and bonuses
- **Team Balancer**: Weighted balancing of units across the two sides, with an optional skill-based post-season weight for playoffs
- **Round Types**: Regular, Single Round Leads, Playoffs, and Fun Round (exhibition — no points, no map cooldown, no Elo)
- **Season Simulator**: Generate a season of lead assignments, evenly spaced per unit, with spread analytics and a sheet-ready schedule export
- **Playoff Brackets**: Seeded knockout (any number of groups) or two-conference format, with group qualification and wildcards
- **Playoff Format Planner**: Audits the playoff settings you have and recommends the ones that fit your league and your remaining nights, one click to apply
- **Standings**: Real-time standings based on performance
- **Data Persistence**: Automatic saving to browser localStorage
- **Import/Export**: Save and load season data as JSON files

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Navigate to the season-tracker directory:
```bash
cd season-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to the URL shown (typically http://localhost:5173)

## Usage

### Basic Workflow

1. **Add Units**: Enter regiment names in the Units section
2. **Create Weeks**: Add weeks for your season schedule
3. **Assign Teams**: Select a week and assign units to Team A or Team B
4. **Set Leaders**: Choose lead units for each team
5. **Record Results**: Select round winners (Round 1 and Round 2)
6. **View Standings**: Check the real-time standings based on points

### Point System

Configure the point system in Settings:
- **Win Lead Points**: Points for leading unit on winning team
- **Win Assist Points**: Points for non-lead units on winning team
- **Loss Lead Points**: Points for leading unit on losing team
- **Loss Assist Points**: Points for non-lead units on losing team
- **2-0 Bonus Lead**: Bonus points for lead unit on 2-0 sweep
- **2-0 Bonus Assist**: Bonus points for assist units on 2-0 sweep
- **Balance Points**: Points for units moved to rebalance a round, awarded Per Night, Per Round, or Per Round (Loss Only) — the last awards only when the balanced unit ends up on the losing side

Point System settings — like the balancer weights and round types — are stored independently per season, so each season can be tuned on its own.

### Season Simulator

The overflow menu's **Simulate** builds a season's worth of weeks from a lead schedule:

- **Full Lead Weeks**: two units lead each night, both rounds each — so a night costs 2 lead slots
- **Lead Rounds**: four different units lead each night, one per side per round — a night costs 4 lead slots, and no unit ever leads both rounds of the same night
- **# of Lead Nights per Token Unit**: how many nights each unit leads. Weeks generated = token units × lead nights ÷ leads a night; any leftover slots mean that many units lead one night fewer, which the dialog calls out up front.
- Each unit's lead nights are spread as evenly across the season as the numbers allow, so everyone waits about the same time between leads. Repeat lead matchups and repeated lead pairings are avoided unless the spacing would suffer badly.
- **Schedule Only** stops at the leads — no teams, maps or results.

The summary popup afterwards reports season length, average/shortest/longest gap between a unit's leads against the ideal gap, a per-unit breakdown, and — when rounds were simulated — the lead vs assist point split. It also renders the schedule as a tab-separated block you can copy straight into a matchup sheet, or download as CSV.

### Playoff Formats

Playoffs draw in one of two styles, set under **Bracket Style** (Stats → Playoffs):

- **Seeded Knockout** — every qualifier is reseeded 1–N on total points and paired 1-vs-N down the bracket, so seeds 1 and 2 can only meet in the final. An 8-team field is 1v8, 4v5, 2v7, 3v6 into quarterfinals, semifinals and a final. Fields of 4 to 16 all draw; anything short of a power of two gives the top seeds a first-round bye. **Groups only decide who gets in, not who plays whom**, so this works with any number of groups — three of five, five of three, or none at all.
- **Conference** — splits the field between two conferences, each crowning a winner before a championship. It needs exactly two conferences, which come from the first word of a division name, so "North Valley" and "North Ridge" are one conference.

With **Qualify Through Groups** on, each group sends its top N. Any remaining wildcard seats go to the best units left over — league-wide in a knockout, per-conference in a conference bracket.

### Playoff Format Planner

Turning on **Enable Playoff Tracking** opens a planner above the playoff picture. Tell it how many playoff nights the calendar can spare and it does two things:

- **Audits the settings you have.** What field they actually produce, which stages get drawn, how many nights that takes, and anything broken — a conference too small to draw, qualifiers that get a seed but never a matchup, units that group play shuts out.
- **Recommends formats that fit.** Up to three genuinely different brackets, each with its entry rule, field size, share of the league and length. **Apply** writes it straight into the settings.

Two facts about the tracker drive most of the advice:

- **A round hosts one matchup**, since each side has one lead, and a night is two rounds. So two matchups fit in a night, and that — not the number of stages — is what decides how long a bracket takes. An 8-team bracket is seven series; a 4-team one is three. Best-of-3 across an 8-team bracket runs 7–11 nights; single-round quarterfinals bring the same bracket down to 5–7.
- **"Rounds per match" is really first to (N ÷ 2) + 1 wins.** 2 and 3 are the same series: both need two wins, and both can run to a third round if the first two split. The planner labels these honestly and prefers the odd setting, which says what it means.

The **Rounds per Playoff Stage** inputs are labelled with the stages your current settings actually draw — Quarterfinals, Semifinals, Finals — rather than fixed names, so they read the way the bracket will.

Recommendations only include brackets the tracker draws whole, and prefer a field that fills every slot over one that hands out byes. A field it half-draws — where the standings promise a seed the bracket never plays — is never recommended, though the audit will explain it if you configure one by hand.

### Data Management

- **Export**: Download your season data as a JSON file
- **Import**: Load previously saved season data
- **Auto-Save**: Data automatically saves to browser localStorage

## Design Philosophy

This application follows the KISS (Keep It Simple, Stupid), DRY (Don't Repeat Yourself), SOLID, and YAGNI (You Aren't Gonna Need It) principles, matching the design patterns used in the Log Analyzer component.

## Technology Stack

- **React 19**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS 4**: Styling
- **Lucide React**: Icons
- **localStorage**: Data persistence

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## License

This project is part of the War of Rights Event Tracker suite.