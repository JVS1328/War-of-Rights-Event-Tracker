import json
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from collections import Counter, defaultdict
import itertools
import statistics

class SeasonAnalysisGUI:
    def __init__(self, master: tk.Tk):
        self.master = master
        master.title("Season Analysis Tool")
        master.geometry("800x600")

        self.season_data = []
        self.units = set()

        # --- Menu Bar ---
        menubar = tk.Menu(master)
        file_menu = tk.Menu(menubar, tearoff=0)
        file_menu.add_command(label="Load Season...", command=self.load_season_dialog)
        file_menu.add_separator()
        file_menu.add_command(label="Quit", command=master.quit)
        menubar.add_cascade(label="File", menu=file_menu)
        master.config(menu=menubar)

        # --- Main Frame ---
        main_frame = tk.Frame(master, padx=10, pady=10)
        main_frame.pack(fill=tk.BOTH, expand=True)

        self.tii_button = tk.Button(main_frame, text="Teammate Impact Index (TII)", command=self.show_tii_table, state=tk.DISABLED)
        self.tii_button.pack(pady=5)

        self.synergy_button = tk.Button(main_frame, text="Roster Synergy Matrix", command=self.show_synergy_matrix, state=tk.DISABLED)
        self.synergy_button.pack(pady=5)

    def load_season_dialog(self):
        paths = filedialog.askopenfilenames(filetypes=[("JSON files", "*.json")])
        if paths:
            self.load_season_data(paths)

    def load_season_data(self, paths):
        
        # Reset data
        self.season_data = []
        self.units = set()

        for path in paths:
            try:
                with open(path, 'r') as f:
                    data = json.load(f)

                # Process raw data into the correct types, especially sets for teams.
                loaded_weeks = data.get("season", [])
                for week_data in loaded_weeks:
                    week_data["A"] = set(week_data.get("A", []))
                    week_data["B"] = set(week_data.get("B", []))
                
                self.season_data.extend(loaded_weeks)
                self.units.update(data.get("units", []))

            except Exception as e:
                messagebox.showerror("Error", f"Failed to load or parse {path}: {e}")
                # If one file fails, we should probably stop.
                # Resetting to a clean state.
                self.season_data = []
                self.units = set()
                self.tii_button.config(state=tk.DISABLED)
                self.synergy_button.config(state=tk.DISABLED)
                return

        if self.season_data and self.units:
            self.tii_button.config(state=tk.NORMAL)
            self.synergy_button.config(state=tk.NORMAL)
            messagebox.showinfo("Success", f"{len(paths)} season(s) loaded successfully.")
        else:
            messagebox.showerror("Error", "No valid season data found in the selected files.")

    def get_unit_average_player_count(self, unit_name: str, max_week_index: int | None = None) -> float:
        """
        Calculates the average number of players a unit brings across all weeks they participated in,
        up to a given max_week_index, using week-specific data if available.
        If a week's data is missing, it's skipped. Defaults to 0 if no data exists.
        """
        weeks_to_process = self.season_data
        # This function in Season Analysis doesn't support max_week_index, but mimicking signature
        # if max_week_index is not None:
        #     weeks_to_process = self.season_data[:max_week_index + 1]

        weekly_averages = []
        for week in weeks_to_process:
            # Check if the unit participated in this week
            if unit_name in week.get("A", set()) or unit_name in week.get("B", set()):
                # Use week-specific player counts if they exist
                week_player_counts = week.get("unit_player_counts", {})
                
                if unit_name in week_player_counts:
                    player_counts = week_player_counts[unit_name]
                    try:
                        min_players = int(player_counts.get("min", 0))
                        max_players = int(player_counts.get("max", 0))
                        
                        # Only calculate an average if we have a valid max number
                        if max_players > 0:
                            weekly_averages.append((min_players + max_players) / 2)
                            
                    except (ValueError, TypeError):
                        # Skip this week's data for this unit if it's malformed
                        continue
        
        if not weekly_averages:
            # If no valid weekly data was found across all participated weeks, return 0.
            return 0.0

        # Return the average of all the collected weekly averages.
        return statistics.mean(weekly_averages)

    # Adapted from tracker.py
    def calculate_teammate_impact(self):
        """
        Calculates multiple Teammate Impact metrics:
        1. Original TII based on average loss rate of teammates.
        2. Impact as a Lead unit (unit's win rate when leading).
        3. Impact as an Assist unit (unit's win rate when not leading).
        """
        if not self.season_data:
            return {}, 0
            
        weeks_to_process = self.season_data

        # --- Part 1: Setup for Original TII (Teammate Loss Rate) ---
        total_losses_records = []
        
        # --- Part 2: Setup for Lead/Assist Impact ---
        unit_performances = defaultdict(list)

        for week in weeks_to_process:
            is_playoffs = week.get("playoffs", False)
            for r_num in [1, 2]:
                winner = week.get(f"round{r_num}_winner")
                if not winner:
                    continue

                team_A, team_B = week.get("A", set()), week.get("B", set())
                winning_team, losing_team = (team_A, team_B) if winner == "A" else (team_B, team_A)

                # Part 1 data collection
                for unit in winning_team:
                    total_losses_records.append(0)
                for unit in losing_team:
                    total_losses_records.append(1)

                # Part 2 data collection
                if is_playoffs:
                    lead_A, lead_B = week.get(f"lead_A_r{r_num}"), week.get(f"lead_B_r{r_num}")
                else:
                    lead_A, lead_B = week.get("lead_A"), week.get("lead_B")
                
                winning_lead, losing_lead = (lead_A, lead_B) if winner == "A" else (lead_B, lead_A)

                for unit in winning_team:
                    unit_performances[unit].append((0, unit == winning_lead)) # (is_loss=0, is_lead)
                for unit in losing_team:
                    unit_performances[unit].append((1, unit == losing_lead)) # (is_loss=1, is_lead)

        # --- Part 1 Calculation: Global Average Loss Rate ---
        global_avg_loss_rate = statistics.mean(total_losses_records) if total_losses_records else 0

        impact_stats = {}
        all_units = self.units

        for unit_u in all_units:
            # --- Part 1 Calculation: TII for unit_u ---
            teammate_loss_rates = []
            for week in weeks_to_process:
                for r_num in [1, 2]:
                    winner = week.get(f"round{r_num}_winner")
                    if not winner: continue

                    team_A, team_B = week.get("A", set()), week.get("B", set())
                    if unit_u in team_A:
                        teammates = team_A - {unit_u}
                        is_loss = (winner == 'B')
                        if teammates:
                            teammate_loss_rates.extend([1 if is_loss else 0] * len(teammates))
                    elif unit_u in team_B:
                        teammates = team_B - {unit_u}
                        is_loss = (winner == 'A')
                        if teammates:
                            teammate_loss_rates.extend([1 if is_loss else 0] * len(teammates))
            
            avg_teammate_loss_rate = statistics.mean(teammate_loss_rates) if teammate_loss_rates else 0
            original_tii_score = 1 - avg_teammate_loss_rate
            
            # --- Part 2 Calculation: Lead/Assist Impact for unit_u ---
            performances = unit_performances.get(unit_u, [])
            lead_performances = [p[0] for p in performances if p[1]]
            assist_performances = [p[0] for p in performances if not p[1]]

            lead_impact = 1 - statistics.mean(lead_performances) if lead_performances else 0
            assist_impact = 1 - statistics.mean(assist_performances) if assist_performances else 0
            
            # --- Part 3: Player Count Modifier ---
            # Only calculate league average based on units that actually played.
            participating_units = [u for u, perfs in unit_performances.items() if perfs]
            all_unit_avg_players = [self.get_unit_average_player_count(u) for u in participating_units]
            league_avg_players = statistics.mean(all_unit_avg_players) if all_unit_avg_players else 0 # Default to 0 if no one played

            unit_avg_players = self.get_unit_average_player_count(unit_u)
            
            # The player modifier is based on how the unit's average count compares to the league's average count.
            player_modifier = unit_avg_players / league_avg_players if league_avg_players > 0 else 1.0

            # The "delta" from the average loss rate is what we modify.
            delta_from_avg = global_avg_loss_rate - avg_teammate_loss_rate
            modified_delta = delta_from_avg * player_modifier
            
            # The new TII is the inverse of the modified teammate loss rate.
            modified_avg_teammate_loss_rate = global_avg_loss_rate - modified_delta
            adjusted_tii_score = 1 - modified_avg_teammate_loss_rate

            impact_stats[unit_u] = {
                "impact_score": original_tii_score,
                "adjusted_tii_score": adjusted_tii_score,
                "avg_teammate_loss_rate_with": avg_teammate_loss_rate,
                "lead_impact": lead_impact,
                "assist_impact": assist_impact,
                "lead_games": len(lead_performances),
                "assist_games": len(assist_performances),
                "avg_players": unit_avg_players,
            }

        return impact_stats, global_avg_loss_rate
    
    # Adapted from tracker.py
    def calculate_roster_synergy(self):
        if not self.season_data:
            return {}, [], []
            
        weeks_to_process = self.season_data

        pair_stats = defaultdict(lambda: {'wins': 0, 'games': 0})
        roster_stats = defaultdict(lambda: {'wins': 0, 'games': 0})

        for week in weeks_to_process:
            for r_num in [1, 2]:
                winner_team = week.get(f"round{r_num}_winner")
                if not winner_team:
                    continue

                team_A = week.get("A", set())
                team_B = week.get("B", set())
                
                winning_roster = team_A if winner_team == "A" else team_B
                losing_roster = team_B if winner_team == "A" else team_A

                # Full roster stats
                roster_stats[tuple(sorted(winning_roster))]['wins'] += 1
                roster_stats[tuple(sorted(winning_roster))]['games'] += 1
                roster_stats[tuple(sorted(losing_roster))]['games'] += 1


                # Pair stats for winning team
                for pair in itertools.combinations(winning_roster, 2):
                    pair_key = tuple(sorted(pair))
                    pair_stats[pair_key]['wins'] += 1
                    pair_stats[pair_key]['games'] += 1

                # Pair stats for losing team
                for pair in itertools.combinations(losing_roster, 2):
                    pair_key = tuple(sorted(pair))
                    pair_stats[pair_key]['games'] += 1

        synergy_data = {pair: stats['wins'] / stats['games'] for pair, stats in pair_stats.items() if stats['games'] > 0}

        # Calculate best/worst lineups
        lineup_win_rates = {
            roster: (stats['wins'] / stats['games'], stats['games'])
            for roster, stats in roster_stats.items()
            if stats['games'] > 0
        }
        
        sorted_lineups = sorted(
            lineup_win_rates.items(),
            key=lambda item: item[1][0],
            reverse=True
        )
        
        # Format for display: (roster, win_rate, games)
        best_lineups = [(r, wr, g) for r, (wr, g) in sorted_lineups[:10]]
        worst_lineups = sorted([(r, wr, g) for r, (wr, g) in sorted_lineups[-10:]], key=lambda x: x[1])


        return synergy_data, best_lineups, worst_lineups

    def show_tii_table(self):
        """Displays a table for the new Teammate Impact metrics."""
        if not self.season_data:
            messagebox.showinfo("Teammate Impact", "No season data available.")
            return

        win = tk.Toplevel(self.master)
        win.title(f"Teammate Impact Index")
        win.geometry("700x500")

        cols = ["unit", "adjusted_tii", "impact_score", "lead_impact", "assist_impact", "avg_teammate_loss_rate", "delta_vs_league_avg"]
        col_names = {
            "unit": "Unit (Avg Players)",
            "adjusted_tii": "Adj. TII",
            "impact_score": "Original TII",
            "lead_impact": "Lead Impact",
            "assist_impact": "Assist Impact",
            "avg_teammate_loss_rate": "Avg Teammate Loss Rate",
            "delta_vs_league_avg": "Δ vs League Avg"
        }

        tree = ttk.Treeview(win, columns=cols, show="headings")
        for col_id in cols:
            tree.heading(col_id, text=col_names[col_id], command=lambda c=col_id: self.sort_column(tree, c, False))
            # Adjust column widths for new columns
            if col_id in ["lead_impact", "assist_impact"]:
                tree.column(col_id, width=110, anchor=tk.CENTER)
            elif col_id in ["impact_score", "adjusted_tii"]:
                tree.column(col_id, width=80, anchor=tk.CENTER)
            else:
                tree.column(col_id, width=150, anchor=tk.CENTER)
        tree.column("unit", anchor=tk.W, width=150) # Widen for player count
        tree.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        impact_data, global_avg_loss_rate = self.calculate_teammate_impact()

        table_data = []
        for unit, data in impact_data.items():
            lead_games = data.get('lead_games', 0)
            assist_games = data.get('assist_games', 0)
            total_games = lead_games + assist_games
            
            # Only include units that have played at least one round.
            if total_games == 0:
                continue

            delta = data.get("avg_teammate_loss_rate_with", 0) - global_avg_loss_rate
            table_data.append({
                "unit": unit,
                "adjusted_tii_score": data.get('adjusted_tii_score', 0),
                "impact_score": data.get('impact_score', 0),
                "lead_impact": data.get('lead_impact', 0),
                "assist_impact": data.get('assist_impact', 0),
                "lead_games": lead_games,
                "assist_games": assist_games,
                "avg_teammate_loss_rate": data.get('avg_teammate_loss_rate_with', 0),
                "delta_vs_league_avg": delta,
                "avg_players": data.get('avg_players', 0),
            })
        
        # Default sort by new Adjusted TII Score descending
        table_data.sort(key=lambda x: x["adjusted_tii_score"], reverse=True)

        for row in table_data:
            tree.insert("", tk.END, values=(
                f"{row['unit']} ({row['avg_players']:.1f})",
                f"{row['adjusted_tii_score']:.3f}",
                f"{row['impact_score']:.3f}",
                f"{row['lead_impact']:.1%} ({row['lead_games']})",
                f"{row['assist_impact']:.1%} ({row['assist_games']})",
                f"{row['avg_teammate_loss_rate']:.1%}",
                f"{row['delta_vs_league_avg']:+.1%}"
            ))
            
        vsb = ttk.Scrollbar(win, orient="vertical", command=tree.yview)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        tree.configure(yscrollcommand=vsb.set)

        # --- Bottom Frame for Buttons ---
        bottom_frame = ttk.Frame(win)
        bottom_frame.pack(fill=tk.X, side=tk.BOTTOM, padx=10, pady=(5, 10))

        synergy_button = ttk.Button(bottom_frame, text="Roster Synergy Matrix", command=self.show_synergy_matrix)
        synergy_button.pack(side=tk.LEFT)
        explain_button = ttk.Button(bottom_frame, text="Explain Metrics", command=self.show_tii_explanations)
        explain_button.pack(side=tk.LEFT, padx=(10, 0))

    def show_tii_explanations(self):
        """Displays a messagebox explaining the Teammate Impact Index metrics."""
        explanation = """
**Teammate Impact Index (TII) Metrics Explained:**

- **Adj. TII (Adjusted Teammate Impact Index):**
  - The primary ranking metric. This is the **Original TII** score modified by the number of players a unit typically brings.
  - It amplifies the impact (positive or negative) of units that bring more players than the league average and lessens the impact of those that bring fewer.
  - A unit's positive or negative effect on its teammates is considered more significant if they have a larger on-field presence.

- **Unit (Avg Players):**
  - Shows the unit's name and, in parentheses, the average number of players they are assumed to bring to each event (based on their min/max settings).

- **Original TII:**
  - Measures a unit's impact on its teammates' success, purely based on win/loss data.
  - Calculated as `1 - (Average Loss Rate of Teammates When You Are on Their Team)`.
  - A higher score suggests that when this unit is on a team, its teammates are more likely to win.

- **Lead Impact:**
  - The unit's win rate when it is assigned as the "Lead" unit for a round.
  - A high score indicates the unit is effective when leading the charge. The number in parentheses is the total number of rounds played as lead.

- **Assist Impact:**
  - The unit's win rate when it is NOT the "Lead" unit (i.e., acting as an "Assist").
  - A high score suggests the unit is a strong supporting member of the team. The number in parentheses is the total number of rounds played as an assist.

- **Avg Teammate Loss Rate:**
  - The average loss rate of a unit's teammates when this unit is present. This is the core component of the Original TII score. A lower percentage is better.

- **Δ vs League Avg (Delta vs League Average):**
  - The difference between this unit's "Avg Teammate Loss Rate" and the global average loss rate.
  - A negative percentage (e.g., -5.0%) is **GOOD**. It means your teammates' loss rate is 5% lower than average when you are playing with them.
"""
        messagebox.showinfo("TII Metric Explanations", explanation, parent=self.master)

    def show_synergy_matrix(self):
        """Displays a window with the Roster Synergy Matrix."""
        if not self.season_data:
            messagebox.showinfo("Roster Synergy Matrix", "No season data available.")
            return

        win = tk.Toplevel(self.master)
        win.title(f"Roster Synergy Matrix")
        win.geometry("900x700")

        # Main frame
        main_frame = ttk.Frame(win, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        notebook = ttk.Notebook(main_frame)
        notebook.pack(fill=tk.BOTH, expand=True)

        # Synergy Tab
        synergy_tab = ttk.Frame(notebook)
        notebook.add(synergy_tab, text="Synergy Matrix")
        
        synergy_data, best_lineups, worst_lineups = self.calculate_roster_synergy()

        if synergy_data:
            active_units = sorted(list(self.units))
            
            matrix_frame = ttk.LabelFrame(synergy_tab, text="Unit Pair Win Probability", padding="10")
            matrix_frame.pack(fill=tk.BOTH, expand=True, pady=5)
            
            tree = ttk.Treeview(matrix_frame)
            tree["columns"] = ["unit"] + active_units
            tree.column("#0", width=0, stretch=tk.NO)
            tree.column("unit", anchor=tk.W, width=120)
            tree.heading("unit", text="Unit", anchor=tk.W)

            for unit in active_units:
                tree.column(unit, anchor=tk.CENTER, width=60)
                tree.heading(unit, text=unit, anchor=tk.CENTER)

            for unit1 in active_units:
                values = [unit1]
                for unit2 in active_units:
                    if unit1 == unit2:
                        values.append("-")
                    else:
                        win_prob = synergy_data.get(tuple(sorted((unit1, unit2))), None)
                        values.append(f"{win_prob:.1%}" if win_prob is not None else "N/A")
                tree.insert("", "end", values=values)
            
            vsb = ttk.Scrollbar(matrix_frame, orient="vertical", command=tree.yview)
            vsb.pack(side=tk.RIGHT, fill=tk.Y)
            tree.configure(yscrollcommand=vsb.set)
            tree.pack(fill=tk.BOTH, expand=True)
            
        # Best/Worst Lineups Tab
        lineups_tab = ttk.Frame(notebook)
        notebook.add(lineups_tab, text="Best/Worst Lineups")

        lineups_frame = ttk.Frame(lineups_tab, padding="10")
        lineups_frame.pack(fill=tk.BOTH, expand=True)
        lineups_frame.grid_columnconfigure(0, weight=1)
        lineups_frame.grid_columnconfigure(1, weight=1)

        best_frame = ttk.LabelFrame(lineups_frame, text="Best Performing Lineups")
        best_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 5))
        
        worst_frame = ttk.LabelFrame(lineups_frame, text="Worst Performing Lineups")
        worst_frame.grid(row=0, column=1, sticky="nsew", padx=(5, 0))

        for frame, lineups in [(best_frame, best_lineups), (worst_frame, worst_lineups)]:
            lineup_tree = ttk.Treeview(frame, columns=("roster", "win_rate", "games"), show="headings")
            lineup_tree.heading("roster", text="Roster")
            lineup_tree.heading("win_rate", text="Win Rate")
            lineup_tree.heading("games", text="Rounds Played")
            lineup_tree.column("roster", width=300)
            lineup_tree.pack(fill=tk.BOTH, expand=True)
            for roster, rate, games in lineups:
                lineup_tree.insert("", "end", values=(", ".join(roster), f"{rate:.1%}", games))

        # Attack/Defend Tab
        attack_defense_tab = ttk.Frame(notebook)
        notebook.add(attack_defense_tab, text="Attack/Defense Stats")
        
        attack_defense_stats = self.calculate_attack_defense_performance()

        attack_tree = ttk.Treeview(attack_defense_tab, columns=("unit", "attack_wins", "attack_losses", "attack_win_rate", "defend_wins", "defend_losses", "defend_win_rate"), show="headings")
        for col in attack_tree["columns"]:
            attack_tree.heading(col, text=col.replace("_", " ").title())
        attack_tree.pack(fill=tk.BOTH, expand=True, pady=5)
        
        for unit, stats in sorted(attack_defense_stats.items(), key=lambda item: item[0]):
            attack_games = stats["attack_wins"] + stats["attack_losses"]
            defend_games = stats["defend_wins"] + stats["defend_losses"]
            attack_win_rate = stats["attack_wins"] / attack_games if attack_games > 0 else 0
            defend_win_rate = stats["defend_wins"] / defend_games if defend_games > 0 else 0
            attack_tree.insert("", "end", values=(
                unit,
                stats["attack_wins"], stats["attack_losses"], f"{attack_win_rate:.1%}",
                stats["defend_wins"], stats["defend_losses"], f"{defend_win_rate:.1%}"
            ))

    def calculate_attack_defense_performance(self):
        weeks_to_process = self.season_data

        unit_performance = defaultdict(lambda: {
            "attack_wins": 0, "attack_losses": 0,
            "defend_wins": 0, "defend_losses": 0
        })

        usa_attack_maps = {
            "East Woods Skirmish", "Nicodemus Hill", "Hooker's Push", "Bloody Lane",
            "Pry Ford", "Smith Field", "Alexander Farm", "Crossroads",
            "Wagon Road", "Hagertown Turnpike", "Pry Grist Mill", "Otto & Sherrick Farm",
            "Piper Farm", "West Woods", "Dunker Church", "Burnside Bridge",
            "Garland's Stand", "Cox's Push", "Hatch's Attack", "Colquitt's Defence",
            "Flemming's Meadow", "Crossley Creek", "Confederate Encampment"
        }

        for week in weeks_to_process:
            for r in [1, 2]:
                map_name = week.get(f"round{r}_map")
                winner = week.get(f"round{r}_winner")
                flipped = week.get(f"round{r}_flipped", False)
                if not map_name or not winner:
                    continue

                usa_side = "A" if not flipped else "B"
                csa_side = "B" if not flipped else "A"
                
                is_usa_attack = map_name in usa_attack_maps
                attacker_side = usa_side if is_usa_attack else csa_side
                defender_side = csa_side if is_usa_attack else usa_side

                winning_team = week.get(winner, set())
                losing_team_id = 'B' if winner == 'A' else 'A'
                losing_team = week.get(losing_team_id, set())
                
                if winner == attacker_side:
                    for unit in winning_team:
                        unit_performance[unit]["attack_wins"] += 1
                    for unit in losing_team:
                        unit_performance[unit]["defend_losses"] += 1
                else: # defender wins
                    for unit in winning_team:
                        unit_performance[unit]["defend_wins"] += 1
                    for unit in losing_team:
                        unit_performance[unit]["attack_losses"] += 1

        return unit_performance

    def sort_column(self, tree, col, reverse):
        """Generic treeview column sorting function."""
        try:
            # Get data from tree, converting to numeric type if possible
            data = []
            for child in tree.get_children(''):
                val = tree.item(child, 'values')[tree['columns'].index(col)]
                # Clean up percentages and parentheses for sorting
                val = val.split(' ')[0].replace('%', '').replace('+', '')
                try:
                    num_val = float(val)
                    data.append((num_val, child))
                except (ValueError, TypeError):
                    data.append((val, child))

            data.sort(key=lambda t: t[0], reverse=reverse)

            for index, (val, child) in enumerate(data):
                tree.move(child, '', index)

            tree.heading(col, command=lambda: self.sort_column(tree, col, not reverse))
        except Exception as e:
            print(f"Error sorting column {col}: {e}")

if __name__ == "__main__":
    root = tk.Tk()
    app = SeasonAnalysisGUI(root)
    root.mainloop()