# War of Rights - Event Tracker

This project provides a Python-based GUI application, `tracker.py`, designed to manage and track seasons for **War of Rights events**, specifically for the Smoke & Steel League. 

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

## File Structure

*   `.gitignore`: Specifies intentionally untracked files that Git should ignore.
*   `tracker.py`: The main Python application script.
*   `season_data.json` (optional, created by the script): Stores the season tracking data.
*   `README.md`: This file.
