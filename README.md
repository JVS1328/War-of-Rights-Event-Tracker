# Smoke & Steel League - Season Tracker

This project provides a Python-based GUI application, `SSL Tracker.py`, designed to manage and track seasons for **War of Rights events**, specifically for the Smoke & Steel League.

## Description

The `SSL Tracker.py` application allows users to:

*   **Manage Seasons:** Create new seasons, load existing ones, and save progress. Data is stored in JSON format (defaulting to `season_data.json`).
*   **Track Weekly Matches:**
    *   Add and remove weeks for a season.
    *   Define and manage a global list of participating units (e.g., regiments or companies).
    *   Assign units to "Team A" or "Team B" for each week.
    *   Record winners for up to two rounds per week.
    *   Designate "Lead Units" for each team per week.
    *   **Track Casualties:** Input casualties for each team per round.
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
    python "SSL Tracker.py"
    ```
    (If your Python executable is named `python3`, use `python3 "SSL Tracker.py"`)

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
*   **Intuitive GUI:** Menu-driven operations for managing seasons, viewing data, and adjusting settings.

## File Structure

*   `.gitignore`: Specifies intentionally untracked files that Git should ignore.
*   `SSL Tracker.py`: The main Python application script.
*   `season_data.json` (optional, created by the script): Stores the season tracking data.
*   `README.md`: This file.