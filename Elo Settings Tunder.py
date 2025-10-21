import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import json
from pathlib import Path
import itertools
import math
import statistics
from collections import defaultdict
import numpy as np
from maps import maps
from multiprocessing import Pool, cpu_count, Manager
from functools import partial

# --- Elo Calculation Logic (adapted from tracker.py) ---

def default_unit_counts():
    """Provides a default dictionary for unit counts."""
    return {"min": "0", "max": "100"}

def get_unit_average_player_count(unit_name: str, week_idx: int, season_data: list, global_unit_counts: dict) -> float:
    """Gets the average player count for a unit for a specific week."""
    week = season_data[week_idx]
    
    # Priority: Week-specific > Global > Default
    week_player_counts = week.get("unit_player_counts", {})
    if unit_name in week_player_counts:
        counts = week_player_counts[unit_name]
    elif unit_name in global_unit_counts:
        counts = global_unit_counts[unit_name]
    else:
        counts = {"min": "0", "max": "100"}
        
    try:
        min_players = int(counts.get("min", 0))
        max_players = int(counts.get("max", 0))
        return (min_players + max_players) / 2
    except (ValueError, TypeError):
        return 0

def run_single_simulation(args, season_data, global_unit_counts):
    i, settings = args
    final_elos, predictions, history = calculate_elo_for_season(season_data, settings, global_unit_counts)
    
    metrics = {
        'brier': calculate_brier_score(predictions),
        'accuracy': calculate_accuracy(predictions),
        'rmse': calculate_elo_volatility(history),
        'drift': calculate_mean_abs_drift(history),
        'r_squared': calculate_r_squared(predictions),
    }
    return (i, settings, metrics)

def calculate_elo_for_season(season_data, settings, global_unit_counts):
    """
    Runs a full Elo calculation for a season with a given set of settings.
    Returns the Elo ratings after each week and a list of prediction results for analysis.
    """
    initial_rating = settings["initial_elo"]
    k_factor_standard = settings["k_factor_standard"]
    k_factor_provisional = settings["k_factor_provisional"]
    provisional_rounds = settings["provisional_rounds"]
    sweep_bonus_multiplier = settings["sweep_bonus_multiplier"]
    lead_multiplier = settings["lead_multiplier"]
    size_influence = settings["size_influence"]
    playoff_multiplier = settings["playoff_multiplier"]
    bias_light_att = settings["bias_light_att"]
    bias_heavy_att = settings["bias_heavy_att"]
    bias_light_def = settings["bias_light_def"]
    bias_heavy_def = settings["bias_heavy_def"]

    all_units = set()
    for week in season_data:
        all_units.update(week.get("A", []))
        all_units.update(week.get("B", []))

    elo_ratings = defaultdict(lambda: initial_rating)
    for unit in all_units:
        _ = elo_ratings[unit]
        
    rounds_played = defaultdict(int)
    elo_history_by_week = [elo_ratings.copy()]
    prediction_results = [] # Store tuples of (expected, actual) for Brier score

    for week_idx, week_data in enumerate(season_data):
        last_week_elos = elo_history_by_week[-1]
        current_week_elos = last_week_elos.copy()

        team_A_units = week_data.get("A", set())
        team_B_units = week_data.get("B", set())

        if not team_A_units or not team_B_units:
            elo_history_by_week.append(current_week_elos)
            continue

        is_playoffs = week_data.get("playoffs", False)
        
        round1_winner = week_data.get("round1_winner")
        round2_winner = week_data.get("round2_winner")

        sweep_bonus_A = sweep_bonus_multiplier if (round1_winner == "A" and round2_winner == "A") else 1.0
        sweep_bonus_B = sweep_bonus_multiplier if (round1_winner == "B" and round2_winner == "B") else 1.0

        for r in [1, 2]:
            winner = week_data.get(f"round{r}_winner")
            if not winner:
                continue

            total_players_A = sum(get_unit_average_player_count(u, week_idx, season_data, global_unit_counts) for u in team_A_units)
            total_players_B = sum(get_unit_average_player_count(u, week_idx, season_data, global_unit_counts) for u in team_B_units)
            
            if total_players_A == 0 or total_players_B == 0: continue

            avg_elo_A = sum(current_week_elos[u] * get_unit_average_player_count(u, week_idx, season_data, global_unit_counts) for u in team_A_units) / total_players_A
            avg_elo_B = sum(current_week_elos[u] * get_unit_average_player_count(u, week_idx, season_data, global_unit_counts) for u in team_B_units) / total_players_B
            
            if is_playoffs:
                lead_A, lead_B = week_data.get(f"lead_A_r{r}"), week_data.get(f"lead_B_r{r}")
            else:
                lead_A, lead_B = week_data.get("lead_A"), week_data.get("lead_B")
            
            map_name = week_data.get(f"round{r}_map")

            # --- NEW: Apply Map Bias ---
            map_bias_level = 0
            # A simple map name to bias level mapping (can be externalized)
            if map_name in maps.get("Heavily_Attacker_Biased", []): map_bias_level = 1.5
            elif map_name in maps.get("Lightly_Attacker_Biased", []): map_bias_level = 1.0
            elif map_name in maps.get("Heavily_Defender_Biased", []): map_bias_level = 2.5
            elif map_name in maps.get("Lightly_Defender_Biased", []): map_bias_level = 2.0
            
            # Instead of Elo offsets, define percentage multipliers from settings
            bias_percent_map = {
               0: 1.00,
               1: 1.0 + (bias_light_att / 100.0),
               1.5: 1.0 + (bias_heavy_att / 100.0),
               2: 1.0 - (bias_light_def / 100.0),
               2.5: 1.0 - (bias_heavy_def / 100.0)
            }
            bias_multiplier = bias_percent_map.get(map_bias_level, 1.00)
            
            # Determine which team is the attacker
            usa_attack_maps = set(itertools.chain.from_iterable(maps.values())) # Crude but works for now
            is_usa_attack = any(base_map in map_name for base_map in usa_attack_maps if base_map in map_name) if map_name else False
            flipped = week_data.get(f"round{r}_flipped", False)
            usa_side = "A" if not flipped else "B"
            attacker_side = usa_side if is_usa_attack else ("B" if usa_side == "A" else "A")

            # Compute expected outcome first
            expected_A = 1 / (1 + 10 ** ((avg_elo_B - avg_elo_A) / 400))

            # Apply percent bias to expected probability
            if attacker_side == "A":
                expected_A *= bias_multiplier
            else:
                expected_A /= bias_multiplier # Defender bias reduces attacker's chance

            expected_A = max(0.01, min(0.99, expected_A)) # Clamp to avoid extremes

            score_A = 1 if winner == "A" else 0
            
            prediction_results.append({"expected": expected_A, "actual": score_A, "week": week_idx, "round": r})
            base_change = score_A - expected_A

            def apply_elo_changes(team_units, lead_unit, sign, sweep_bonus):
                if not team_units: return

                weights = {
                    u: (math.log(1 + get_unit_average_player_count(u, week_idx, season_data, global_unit_counts)) ** size_influence)
                    * (lead_multiplier if u == lead_unit else 1)
                    for u in team_units
                }
                total_weight = sum(weights.values())
                if total_weight == 0: return

                for u in weights:
                    weights[u] /= total_weight

                team_avg_elo = sum(current_week_elos[u] for u in team_units) / len(team_units)
                
                for u, w in weights.items():
                    k = k_factor_provisional if rounds_played[u] < provisional_rounds else k_factor_standard
                    round_multiplier = playoff_multiplier if is_playoffs else 1.0
                    relative_factor = max(0.8, min(1.2, (team_avg_elo / current_week_elos[u]) ** 0.5)) if current_week_elos[u] > 0 else 1.0
                    delta = k * base_change * w * sign * round_multiplier * sweep_bonus * relative_factor
                    current_week_elos[u] += delta

            apply_elo_changes(team_A_units, lead_A, 1, sweep_bonus_A)
            apply_elo_changes(team_B_units, lead_B, -1, sweep_bonus_B)
            
            for unit in set(team_A_units) | set(team_B_units):
                rounds_played[unit] += 1
        
        elo_history_by_week.append(current_week_elos)

    final_elos = elo_history_by_week[-1]
    return final_elos, prediction_results, elo_history_by_week

# --- Analysis Metrics ---

def calculate_brier_score(predictions):
    if not predictions: return 0
    return np.mean([(p['expected'] - p['actual'])**2 for p in predictions])

def calculate_accuracy(predictions):
    if not predictions: return 0
    correct = sum(1 for p in predictions if (p['expected'] > 0.5 and p['actual'] == 1) or (p['expected'] < 0.5 and p['actual'] == 0))
    return correct / len(predictions)

def calculate_elo_volatility(elo_history):
    if len(elo_history) < 2: return 0
    
    total_squared_change = 0
    num_changes = 0
    all_units = set(elo_history[0].keys())
    
    for i in range(1, len(elo_history)):
        prev_week = elo_history[i-1]
        curr_week = elo_history[i]
        for unit in all_units:
            change = curr_week.get(unit, 1500) - prev_week.get(unit, 1500)
            if abs(change) > 1e-9: # Only count if there was a change
                total_squared_change += change**2
                num_changes += 1

    return np.sqrt(total_squared_change / num_changes) if num_changes > 0 else 0


def calculate_mean_abs_drift(elo_history):
    if len(elo_history) < 2: return 0
    drifts = []
    for i in range(1, len(elo_history)):
        avg_before = np.mean(list(elo_history[i-1].values()))
        avg_after = np.mean(list(elo_history[i].values()))
        drifts.append(abs(avg_after - avg_before))
    return np.mean(drifts)

def calculate_r_squared(predictions):
    if len(predictions) < 2: return 0
    
    actuals = np.array([p['actual'] for p in predictions])
    expecteds = np.array([p['expected'] for p in predictions])
    
    correlation_matrix = np.corrcoef(actuals, expecteds)
    correlation_xy = correlation_matrix[0,1]
    r_squared = correlation_xy**2
    return r_squared

class EloSettingsTuner(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Elo Settings Tuner")
        self.geometry("1400x800")
        
        self.season_data = None
        self.global_unit_counts = {}

        self._build_ui()

    def _build_ui(self):
        # Main frame
        main_frame = ttk.Frame(self, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # --- Top Controls ---
        top_frame = ttk.Frame(main_frame)
        top_frame.pack(fill=tk.X, pady=(0, 10))
        
        load_btn = ttk.Button(top_frame, text="Load Season Data (.json)", command=self.load_data)
        load_btn.pack(side=tk.LEFT)
        
        self.file_label = ttk.Label(top_frame, text="No file loaded.")
        self.file_label.pack(side=tk.LEFT, padx=10)
        
        run_btn = ttk.Button(top_frame, text="Run Analysis", command=self.run_analysis)
        run_btn.pack(side=tk.RIGHT)
        
        # --- Parameter Configuration ---
        params_frame = ttk.LabelFrame(main_frame, text="Hyperparameter Search Space", padding="10")
        params_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.param_entries = {}
        param_grid = {
            "initial_elo": "1500",
            "k_factor_standard": "96",
            "k_factor_provisional": "128",
            "provisional_rounds": "10",
            "sweep_bonus_multiplier": "1.25",
            "lead_multiplier": "2.0",
            "size_influence": "1.0",
            "playoff_multiplier": "1.25",
            "bias_light_att": "15",
            "bias_heavy_att": "30",
            "bias_light_def": "15",
            "bias_heavy_def": "30",
        }

        row = 0
        for name, default_val in param_grid.items():
            # Create a sub-frame for each parameter row
            row_frame = ttk.Frame(params_frame)
            row_frame.pack(fill=tk.X, pady=2)

            # Label on the left
            label = ttk.Label(row_frame, text=f"{name.replace('_', ' ').title()}:", width=25)
            label.pack(side=tk.LEFT, padx=(0, 5))

            # Entry field on the right
            entry = ttk.Entry(row_frame)
            entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
            entry.insert(0, default_val)
            self.param_entries[name] = entry
            
            # Help text for ranges
            help_label = ttk.Label(row_frame, text=" (e.g., '1500' or '1400,1500,1600' or 'range(80,110,8)')", foreground="grey")
            help_label.pack(side=tk.LEFT, padx=(5,0))


        # --- Progress Bar ---
        progress_frame = ttk.Frame(main_frame)
        progress_frame.pack(fill=tk.X, pady=5)
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(progress_frame, variable=self.progress_var, maximum=100)
        self.progress_bar.pack(fill=tk.X, expand=True)

        # --- Results Table ---
        results_frame = ttk.LabelFrame(main_frame, text="Analysis Results", padding="10")
        results_frame.pack(fill=tk.BOTH, expand=True)

        self.results_tree = ttk.Treeview(results_frame)
        
        # Add a scrollbar
        scrollbar = ttk.Scrollbar(results_frame, orient="vertical", command=self.results_tree.yview)
        self.results_tree.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.results_tree.pack(fill=tk.BOTH, expand=True)
        
        # Define columns
        self.results_tree["columns"] = (
            "id", "brier", "accuracy", "rmse", "drift", "r_squared", "composite",
            "initial_elo", "k_std", "k_prov", "prov_r", "sweep_bonus", "lead_mult", "size_inf", "playoff_mult",
            "bias_light_att", "bias_heavy_att", "bias_light_def", "bias_heavy_def"
        )
        
        # Format columns
        self.results_tree.column("#0", width=0, stretch=tk.NO)
        for col in self.results_tree["columns"]:
            self.results_tree.heading(col, text=col.replace("_", " ").title(), command=lambda c=col: self.sort_column(c, False))
            self.results_tree.column(col, anchor=tk.W, width=80)

    def sort_column(self, col, reverse):
        """Generic treeview column sorting function."""
        try:
            data = []
            for child in self.results_tree.get_children(''):
                val_str = self.results_tree.set(child, col)
                try:
                    val = float(val_str.replace('%', ''))
                except (ValueError, TypeError):
                    val = val_str
                data.append((val, child))

            data.sort(key=lambda t: t[0], reverse=reverse)

            for index, (val, child) in enumerate(data):
                self.results_tree.move(child, '', index)

            self.results_tree.heading(col, command=lambda: self.sort_column(col, not reverse))
        except Exception as e:
            print(f"Error sorting column {col}: {e}")

    def load_data(self):
        file_path = filedialog.askopenfilename(
            title="Select Season Data File",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if not file_path:
            return

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Simple validation
            if "season" not in data or "units" not in data:
                raise ValueError("JSON file is missing 'season' or 'units' key.")

            self.season_data = data["season"]
            
            self.global_unit_counts = defaultdict(default_unit_counts)
            self.global_unit_counts.update(data.get("unit_player_counts", {}))

            self.file_label.config(text=f"Loaded: {Path(file_path).name}")
            messagebox.showinfo("Success", f"Successfully loaded {len(self.season_data)} weeks of data.")

        except Exception as e:
            messagebox.showerror("Error Loading File", f"Could not read or parse the file:\n{e}")
            self.season_data = None
            self.file_label.config(text="Failed to load file.")

    def get_settings_combinations(self):
        """Parses parameter ranges from UI and returns an iterator of all combinations."""
        param_ranges = {}
        for name, entry in self.param_entries.items():
            val_str = entry.get().strip()
            try:
                if val_str.lower().startswith("range("):
                    # Safely evaluate a range expression
                    args_str = val_str[6:-1]
                    args = [float(a.strip()) for a in args_str.split(',')]
                    param_ranges[name] = np.arange(*args)
                elif ',' in val_str:
                    # Comma-separated values
                    param_ranges[name] = [float(v.strip()) for v in val_str.split(',')]
                else:
                    # Single value
                    param_ranges[name] = [float(val_str)]
            except Exception as e:
                messagebox.showerror("Invalid Parameter", f"Error parsing '{name}': {e}\nValue: '{val_str}'")
                return None

        # Create all combinations using itertools.product
        keys, values = zip(*param_ranges.items())
        for v in itertools.product(*values):
            yield dict(zip(keys, v))
            
    def add_result_to_table(self, settings_id, settings, metrics):
        """Adds a single result row to the results treeview."""
        # Normalize scores for composite calculation
        # Lower is better for Brier, RMSE, Drift. Higher is better for Acc, R^2
        # We'll invert the "lower is better" metrics so higher is always better for the composite
        brier_norm = 1 - metrics['brier']
        rmse_norm = 1 - (metrics['rmse'] / 100) # Normalize assuming max RMSE around 100
        drift_norm = 1 - (metrics['drift'] / 10) # Normalize assuming max drift around 10
        
        composite = np.average([brier_norm, metrics['accuracy'], rmse_norm, drift_norm, metrics['r_squared']]) * 100

        values = (
            settings_id,
            f"{metrics['brier']:.4f}",
            f"{metrics['accuracy']:.1%}",
            f"{metrics['rmse']:.2f}",
            f"{metrics['drift']:.4f}",
            f"{metrics['r_squared']:.1%}",
            f"{composite:.2f}",
            settings["initial_elo"],
            settings["k_factor_standard"],
            settings["k_factor_provisional"],
            settings["provisional_rounds"],
            settings["sweep_bonus_multiplier"],
            settings["lead_multiplier"],
            settings["size_influence"],
            settings["playoff_multiplier"],
            settings["bias_light_att"],
            settings["bias_heavy_att"],
            settings["bias_light_def"],
            settings["bias_heavy_def"],
        )
        self.results_tree.insert("", "end", values=values)
        self.update_idletasks() # Force UI update

    def run_analysis(self):
        if not self.season_data:
            messagebox.showwarning("No Data", "Please load a season data file before running analysis.")
            return
            
        settings_combinations = list(self.get_settings_combinations())
        if settings_combinations is None:
            return

        if not messagebox.askyesno("Confirm Analysis", f"This will run {len(settings_combinations)} simulations. This might take a while. Continue?"):
            return
            
        # Clear previous results
        for item in self.results_tree.get_children():
            self.results_tree.delete(item)

        total_simulations = len(settings_combinations)
        self.progress_var.set(0)

        # Use a process pool to run simulations in parallel
        num_cores = cpu_count()
        
        # Prepare a partial function with fixed arguments (season_data, global_unit_counts)
        worker_func = partial(run_single_simulation, season_data=self.season_data, global_unit_counts=self.global_unit_counts)

        with Pool(processes=num_cores) as pool:
            # Use imap_unordered for progress updates as results come in
            results_iterator = pool.imap_unordered(worker_func, enumerate(settings_combinations))

            for i, (sim_id, settings, metrics) in enumerate(results_iterator):
                self.add_result_to_table(sim_id + 1, settings, metrics)
                
                # Update progress bar
                progress = ((i + 1) / total_simulations) * 100
                self.progress_var.set(progress)
        
        messagebox.showinfo("Analysis Complete", f"Finished {total_simulations} simulations.")
        self.progress_var.set(0)


if __name__ == "__main__":
    app = EloSettingsTuner()
    app.mainloop()