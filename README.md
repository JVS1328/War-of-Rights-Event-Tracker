# War of Rights - Event Tracker

A comprehensive suite of tools for managing and tracking **War of Rights** competitive events, including season tracking, log analysis, and campaign management. This repository contains both Python-based and React-based applications for the Smoke & Steel League and other organized events.

## Tools Overview

This repository includes four distinct tools:

1. **[Season Tracker (Python)](#python-season-tracker)** - Original Tkinter GUI application for comprehensive season management
2. **[Season Tracker (React)](#react-season-tracker)** - Modern web-based season tracking with real-time standings
3. **[Log Analyzer](#log-analyzer)** - Web-based tool for parsing and analyzing War of Rights combat logs
4. **[Campaign Tool](#campaign-tool)** - Interactive campaign tracker with USA territory map and turn-based gameplay
5. Map Rangefinder

---

## Python Season Tracker

The original `tracker.py` application is a Python-based GUI tool designed to manage and track seasons for **War of Rights events**, specifically for the Smoke & Steel League. 

## Description

The `tracker.py` application allows users to:

*   **Manage Seasons:** Create new seasons, load existing ones, and save progress. Data is stored in JSON format (defaulting to `season_data.json`).
*   **Track Weekly Matches:**
    *   Add and remove weeks for a season.
    *   Define and manage a global list of participating units (e.g., regiments or companies).
    *   Assign units to "Team A" or "Team B" for each week.
    *   Record winners for up to two rounds per week.
    *   Designate "Lead Units" for each team per week.
    *   **Track Casualties:** Input casualties for each team per round.
    *   **Automated Team Balancer:**
        *   Automatically partition a pool of available units into two teams based on multiple constraints.
        *   Define unit-specific player counts (min/max) to simulate variable turnouts.
        *   Set a maximum player difference between the two teams.
        *   Force specific units onto opposing teams.
        *   The balancer uses an exhaustive search algorithm to find the mathematically optimal solution, prioritizing teams that can have overlapping player counts, then minimizing the difference in minimum players, and finally using historical teammate data to encourage team variety.
    *   **Advanced Game Modes:**
        *   **Playoffs Mode:** Designate weeks as "playoffs," allowing for separate lead units per round and disabling point calculations for those weeks.
        *   **Non-Token Units:** Mark units as "non-token" to exclude them from the official points table (e.g., for guest units).
    *   **Calculate Points & Stats:**
    *   Automatically calculate points for units based on round wins, lead unit performance, and 2-0 bonuses, using a **configurable point system**.
    *   **Customizable Point Values:** Users can define specific point values for winning lead, winning assist, losing lead, losing assist, 2-0 bonus for lead, and 2-0 bonus for assist via a settings dialog.
    *   Display a dynamic "Points Table" showing current unit rankings rank changes from the previous week, total Leading wins and losses up to that week, and total assisting wins and losses up to that week.
    *   View detailed season statistics, including:
        *   Teammate counts (how often units played together).
        *   Opponent counts (how often units played against each other).
        *   Overall unit points.
    *   Generate visual "Teammate Heatmaps" and "Opponent Heatmaps" with tooltips showing detailed interaction history.
    *   **Casualty Report:** View a comprehensive, sortable table of casualties inflicted, casualties lost, K/D ratio, and per-game averages for lead units.
*   **Data Export:**
    *   Export detailed season data, including round-by-round results and total losses, to a CSV file for external analysis.
*   **User-Friendly GUI:** Provides a graphical interface built with Tkinter for easy data entry, viewing, and configuration of settings.

## Getting Started

### Prerequisites

*   **Python 3.x:** Ensure Python 3 is installed on your system. You can download it from [python.org](https://www.python.org/).
*   **Tkinter:** This is usually included with standard Python installations. If not, you may need to install it separately (e.g., `sudo apt-get install python3-tk` on Debian/Ubuntu, or it might be part of a `python3-devel` or `python3-tkinter` package on other systems).

### Running the Tracker

1.  Navigate to the project directory in your terminal:
    ```bash
    cd path/to/Smoke & Steel League
    ```
2.  Run the script:
    ```bash
    python "tracker.py"
    ```
    (If your Python executable is named `python3`, use `python3 "tracker.py"`)

The application window will open, and it will automatically attempt to load `season_data.json` if it exists in the same directory.

## Key Features

*   **Persistent Data:** Save and load entire seasons.
*   **Flexible Unit Management:** Add, remove, and assign units easily.
*   **Detailed Weekly Tracking:** Capture team compositions, round winners, and lead units.
*   **Comprehensive Statistics:**
    *   Points table with rank delta.
    *   Teammate/Opponent frequency.
    *   Interactive heatmaps for visual analysis of unit interactions.
    *   **Configurable Point System:** Allows users to define custom point allocations for different match outcomes.
*   **Automated Team Balancer:** Generate balanced teams based on player counts, historical data, and other constraints.
*   **Intuitive GUI:** Menu-driven operations for managing seasons, viewing data, and adjusting settings.

## Team Balancer Feature

The application includes a powerful **Team Balancer** to help automate the creation of fair and varied weekly matchups. This tool is designed to handle the complexities of organizing events where unit attendance can fluctuate.

### How It Works

The balancer attempts to partition a given pool of "available" units into two teams. The balancing process is guided by a sophisticated, multi-stage algorithm that considers several user-defined constraints to find the optimal team composition.

### Constraints

You can configure the following parameters in the balancer window:

*   **Available Units Pool:** Select which units are participating in the current week's match.
*   **Unit Player Counts:** For each unit in the league, you can specify a **minimum** and **maximum** number of players they are expected to bring. This allows the balancer to work with player ranges rather than fixed numbers, reflecting real-world attendance variations. These counts are saved with the season data.
*   **Max Player Difference:** Set the maximum acceptable difference between the total number of players on Team A and Team B. For example, a value of `1` means the teams' player counts can only differ by one.
*   **Opposing Units:** You can force certain units to be on opposite teams. This is useful for creating specific matchups or rivalries.

### The Algorithm

The balancer uses an **exhaustive search algorithm** (`itertools.combinations`) to evaluate every possible partition of the available units. For each potential team composition, it calculates a multi-part score to determine its quality. The goal is to find the solution with the "best" (lexicographically smallest) score.

The score consists of four components, prioritized in the following order:

1.  **`gap` (Highest Priority):** This measures the "unbridgeable" gap between team player counts. If Team A's maximum possible players is less than Team B's minimum, there is a gap. A valid balance **must** have a gap of `0`, meaning the teams' player count ranges can overlap.
2.  **`min_diff` (Secondary Priority):** The absolute difference between the two teams' *minimum* possible player counts (`abs(min_A - min_B)`). The algorithm seeks to make the teams' starting strengths as close as possible.
3.  **`teammate_score` (Tertiary Priority):** A "heat" score calculated from historical data. To encourage variety and prevent the same units from always playing together, the algorithm gives a better score to team compositions where units have been teammates less frequently in the past.
4.  **`avg_diff` (Lowest Priority):** The difference between the teams' *average* player counts. This serves as a final tie-breaker if all other scoring components are equal.

After finding the best possible solution, the algorithm checks if it satisfies the **Max Player Difference** constraint. If it does, the result is displayed; otherwise, it will inform the user why a valid balance could not be found with the given constraints.

## File Structure (Python Tracker)

*   `.gitignore`: Specifies intentionally untracked files that Git should ignore.
*   `tracker.py`: The main Python application script.
*   `season_data.json` (optional, created by the script): Stores the season tracking data.
*   `README.md`: This file.

---

## React Season Tracker

A modern React-based web application for tracking regiment performance across a War of Rights competitive season. This tool provides a streamlined, browser-based alternative to the Python tracker with real-time data updates and a clean interface.

### Features

- **Week Management**: Create and manage weekly matches
- **Unit/Regiment Tracking**: Add and organize participating units
- **Team Rosters**: Assign units to teams for each week
- **Configurable Point System**: Customize point allocations for wins, losses, and bonuses
- **Real-Time Standings**: Automatically calculated standings based on performance
- **Data Persistence**: Automatic saving to browser localStorage
- **Import/Export**: Save and load season data as JSON files

### Getting Started

#### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

#### Installation & Running

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

#### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory and can be deployed to any static hosting service.

### Point System Configuration

Configure point allocations in Settings:
- **Win Lead Points**: Points for leading unit on winning team
- **Win Assist Points**: Points for non-lead units on winning team
- **Loss Lead Points**: Points for leading unit on losing team
- **Loss Assist Points**: Points for non-lead units on losing team
- **2-0 Bonus Lead**: Bonus points for lead unit on 2-0 sweep
- **2-0 Bonus Assist**: Bonus points for assist units on 2-0 sweep

### Technology Stack

- **React 19**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS 4**: Styling
- **Lucide React**: Icons

See [`season-tracker/README.md`](season-tracker/README.md) for detailed documentation.

---

## Log Analyzer

A React-based web application for parsing and analyzing War of Rights combat log files. Extract detailed statistics about regiment performance, individual player metrics, and combat effectiveness.

### Features

- **Log File Parsing**: Upload and parse War of Rights log files
- **Regiment Statistics**: Track kills, deaths, K/D ratios, and combat time per regiment
- **Player Assignment**: Assign players to regiments for accurate tracking
- **Multi-Round Analysis**: Compare performance across multiple rounds
- **Time-Based Filtering**: Analyze specific time periods within rounds
- **Smart Regiment Matching**: Intelligent player-to-regiment assignment suggestions
- **Data Persistence**: Automatic saving to browser localStorage
- **Export Functionality**: Export analyzed data for external use

### Getting Started

#### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

#### Installation & Running

1. Navigate to the log-analyzer directory:
```bash
cd log-analyzer
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

#### Usage

1. **Upload Log File**: Click "Upload Log File" and select a War of Rights log file
2. **Assign Players**: Use the player assignment editor to map players to regiments
3. **View Statistics**: Analyze regiment performance, K/D ratios, and combat metrics
4. **Compare Rounds**: Upload multiple rounds to compare performance over time

#### Building for Production

```bash
npm run build
```

### Technology Stack

- **React 19**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS 4**: Styling
- **Lucide React**: Icons

---

## Campaign Tool

A React-based campaign tracking tool that adapts the RS2: Vietnam territory control system for War of Rights. Features an interactive USA map with territory management, battle recording, and turn-based campaign progression.

### Features

- **Interactive Map Visualization**: Display USA territories with clear boundaries and ownership
- **Territory Management**: Track ownership (USA vs CSA) for each territory
- **Command Point (CP) System**: Manage resources for attacking and defending territories
- **Battle Recording**: Log battles with map selection, winner designation, and casualty tracking
- **Campaign Progression**: Turn-based system where battles determine territory control
- **Victory Conditions**: Multiple win conditions including VP targets, territorial dominance, and capital control
- **Map Editor**: Create and modify custom campaign maps
- **Data Persistence**: Automatic saving to browser localStorage
- **Import/Export**: Save and load campaign data as JSON files

### Getting Started

#### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

#### Installation & Running

1. Navigate to the campaign-tool directory:
```bash
cd campaign-tool
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

#### Basic Workflow

1. **Create Campaign**: Start a new campaign with custom settings or use Map Editor to design custom territories
2. **Record Battles**: Select a map, record the winner and casualties
3. **Track Territory**: Territories change ownership based on battle results and CP expenditure
4. **Monitor Victory Points**: Track VP accumulation for both sides
5. **Advance Turns**: Progress through the campaign turn by turn
6. **Export/Import**: Save campaign progress for later

#### Victory Conditions

- **Victory Points**: First side to reach the VP target wins
- **Territorial Dominance**: Control 75% of all territories
- **Capital Control**: Capture all capital territories

#### Campaign Settings

- **Victory Point Target**: Points needed to win (default: 100)
- **VP Per Territory**: Points awarded for territory capture
- **VP Per Battle**: Points awarded for battle victory
- **Capital Bonus Multiplier**: VP multiplier for capital territories
- **Adjacent Attack Requirement**: Restrict attacks to adjacent territories
- **Casualty Tracking**: Enable/disable casualty recording

#### Building for Production

```bash
npm run build
```

### Technology Stack

- **React 19**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS 4**: Styling with dark theme (slate-900/800 background, amber-400 accents)
- **Lucide React**: Icons

See [`campaign-tool/README.md`](campaign-tool/README.md) and [`campaign-tool/TECHNICAL_SPECIFICATION.md`](campaign-tool/TECHNICAL_SPECIFICATION.md) for detailed documentation.

---

## Repository Structure

```
War-of-Rights-Event-Tracker/
├── tracker.py              # Python season tracker (original)
├── season_data.json        # Python tracker data file
├── season-tracker/         # React season tracker
│   ├── src/
│   ├── package.json
│   └── README.md
├── log-analyzer/           # React log analysis tool
│   ├── src/
│   ├── package.json
│   └── README.md
├── campaign-tool/          # React campaign tracker
│   ├── src/
│   ├── package.json
│   ├── README.md
│   ├── TECHNICAL_SPECIFICATION.md
│   └── CP_SYSTEM_SPECIFICATION.md
└── README.md               # This file
```

## Design Philosophy

All React-based tools follow consistent design principles:
- **KISS** (Keep It Simple, Stupid)
- **DRY** (Don't Repeat Yourself)
- **SOLID** principles
- **YAGNI** (You Aren't Gonna Need It)

## License

This project is part of the War of Rights Event Tracker suite developed for the Smoke & Steel League and other organized War of Rights events.
