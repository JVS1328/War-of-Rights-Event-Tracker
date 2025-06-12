import json
import tkinter as tk
from tkinter import ttk # Added for Treeview
from tkinter import messagebox, filedialog
from collections import Counter, defaultdict
from pathlib import Path


# Helper class for Tooltips
class Tooltip:
    def __init__(self, widget, text_func):
        self.widget = widget
        self.text_func = text_func
        self.tip_window = None
        self.id = None
        self.x = self.y = 0
        self.widget.bind("<Enter>", self.enter)
        self.widget.bind("<Leave>", self.leave)
        self.widget.bind("<ButtonPress>", self.leave) # Hide on click too

    def enter(self, event=None):
        self.schedule()

    def leave(self, event=None):
        self.unschedule()
        self.hidetip()

    def schedule(self):
        self.unschedule()
        self.id = self.widget.after(500, self.showtip) # Delay before showing

    def unschedule(self):
        id = self.id
        self.id = None
        if id:
            self.widget.after_cancel(id)

    def showtip(self):
        if self.tip_window or not self.text_func:
            return
        
        # Get text dynamically
        text = self.text_func()
        if not text:
            return

        x, y, _, _ = self.widget.bbox("insert")
        x += self.widget.winfo_rootx() + 25
        y += self.widget.winfo_rooty() + 20

        self.tip_window = tw = tk.Toplevel(self.widget)
        tw.wm_overrideredirect(True) # No window decorations
        tw.wm_geometry(f"+{x}+{y}")

        label = tk.Label(tw, text=text, justify=tk.LEFT,
                         background="#ffffe0", relief=tk.SOLID, borderwidth=1,
                         font=("tahoma", "8", "normal"))
        label.pack(ipadx=1)

    def hidetip(self):
        tw = self.tip_window
        self.tip_window = None
        if tw:
            tw.destroy()

class SeasonTrackerGUI:
    """Two-team season tracker with minimal GUI, persistent save/load, and a global units list."""

    DEFAULT_PATH = Path("season_data.json")

    def __init__(self, master: tk.Tk):
        self.master = master
        master.title("Season Tracker")
        master.geometry("900x550") # Increased height
        master.resizable(True, True)
        master.minsize(900, 550) # Lock minimum size

        # -------------------- DATA --------------------
        self.units: set[str] = set()
        self.season: list[dict] = []  # Expanded structure below
        # Each week dict:
        # {
        #   "A": set[str], "B": set[str],
        #   "round1_winner": str | None, "round2_winner": str | None, # "A", "B", or None
        #   "lead_A": str | None, "lead_B": str | None # Unit name or None
        # }
        self.current_week: dict | None = None
        self.team_names = {"A": tk.StringVar(value="Team A"), "B": tk.StringVar(value="Team B")}
        self.unit_points: defaultdict[str, int] = defaultdict(int)
        
        # Point system settings - dictionary of StringVars
        self.point_system_values = {
            "win_lead": tk.StringVar(value="4"),
            "win_assist": tk.StringVar(value="2"),
            "loss_lead": tk.StringVar(value="0"),
            "loss_assist": tk.StringVar(value="1"),
            "bonus_2_0_lead": tk.StringVar(value="0"),
            "bonus_2_0_assist": tk.StringVar(value="1"),
        }

        # For round winner and lead selection
        self.round1_winner_var = tk.StringVar()
        self.round2_winner_var = tk.StringVar()
        self.lead_A_var = tk.StringVar()
        self.lead_B_var = tk.StringVar()

        # Auto-load previous data (if available)
        if self.DEFAULT_PATH.exists():
            self.load_from_file(self.DEFAULT_PATH)

        # -------------------- MENU BAR --------------------
        menubar = tk.Menu(master)
        file_menu = tk.Menu(menubar, tearoff=0)
        file_menu.add_command(label="New Season", command=self.new_season)
        file_menu.add_command(label="Load Season…", command=self.load_dialog)
        file_menu.add_command(label="Save Season", command=self.save_dialog)
        file_menu.add_separator()
        file_menu.add_command(label="Quit", command=self.on_close)
        menubar.add_cascade(label="File", menu=file_menu)
        master.config(menu=menubar)

        # ------------------------------------------------------------------
        #  LAYOUT OVERVIEW: | Weeks | Units | Teams A+B |
        # ------------------------------------------------------------------
        # LEFT — WEEKS ------------------------------------------------------
        left = tk.Frame(master, padx=8, pady=8)
        left.pack(side=tk.LEFT, fill=tk.Y)

        tk.Label(left, text="Weeks").pack()
        self.week_list = tk.Listbox(left, width=12, height=25, exportselection=False)
        self.week_list.pack(fill=tk.Y, expand=True)
        self.week_list.bind("<<ListboxSelect>>", self.on_week_select)

        btns = tk.Frame(left, pady=4)
        btns.pack(fill=tk.X)
        tk.Button(btns, text="Add Week", command=self.add_week).pack(fill=tk.X)
        tk.Button(btns, text="Remove Week", command=self.remove_week).pack(fill=tk.X)

        # MIDDLE — UNITS ----------------------------------------------------
        mid = tk.Frame(master, padx=8, pady=8)
        mid.pack(side=tk.LEFT, fill=tk.Y)

        tk.Label(mid, text="UNITS").pack()
        self.units_list = tk.Listbox(mid, width=20, height=25, selectmode=tk.SINGLE, exportselection=False)
        self.units_list.pack(fill=tk.BOTH, expand=True)
        self.units_list.bind("<Double-Button-1>", lambda _: self.move_unit_from_units("A"))
        self.units_list.bind("<Button-3>", lambda _: self.move_unit_from_units("B"))

        unit_ctl = tk.Frame(mid, pady=4)
        unit_ctl.pack(fill=tk.X)
        self.unit_entry = tk.Entry(unit_ctl, width=15)
        self.unit_entry.pack(side=tk.LEFT, padx=2)
        tk.Button(unit_ctl, text="Add", command=self.add_global_unit).pack(side=tk.LEFT)
        tk.Button(unit_ctl, text="Remove", command=self.remove_global_unit).pack(side=tk.LEFT, padx=(4, 0))

        move_ctl = tk.Frame(mid, pady=6)
        move_ctl.pack(fill=tk.X)
        tk.Button(move_ctl, text="→ Team A", command=lambda: self.move_unit_from_units("A")).pack(fill=tk.X)
        tk.Button(move_ctl, text="→ Team B", command=lambda: self.move_unit_from_units("B")).pack(fill=tk.X, pady=(2, 0))

        # RIGHT — TEAMS -----------------------------------------------------
        right = tk.Frame(master, padx=8, pady=8)
        right.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        right.grid_rowconfigure(1, weight=1)
        right.grid_columnconfigure(0, weight=1)
        right.grid_columnconfigure(2, weight=1)

        tk.Entry(right, textvariable=self.team_names["A"], justify="center").grid(row=0, column=0)
        tk.Entry(right, textvariable=self.team_names["B"], justify="center").grid(row=0, column=2)

        self.list_a = tk.Listbox(right, selectmode=tk.SINGLE, width=25, exportselection=False)
        self.list_b = tk.Listbox(right, selectmode=tk.SINGLE, width=25, exportselection=False)
        self.list_a.grid(row=1, column=0, rowspan=4, sticky="nsew")
        self.list_b.grid(row=1, column=2, rowspan=4, sticky="nsew")

        tctl = tk.Frame(right)
        tctl.grid(row=1, column=1, sticky="n")
        tk.Button(tctl, text="← Move", command=lambda: self.move_between_teams("B", "A")).pack(fill=tk.X)
        tk.Button(tctl, text="Move →", command=lambda: self.move_between_teams("A", "B")).pack(fill=tk.X, pady=(2, 0))
        tk.Button(tctl, text="Remove", command=self.remove_from_team).pack(fill=tk.X, pady=(10, 0))
        tk.Button(tctl, text="Show Stats", command=self.show_stats).pack(fill=tk.X, pady=(30, 0))
        tk.Button(tctl, text="Points Table", command=self.show_points_table).pack(fill=tk.X, pady=(2,0)) # New Button
        tk.Button(tctl, text="Team Heatmap", command=self.show_heatmap_stats).pack(fill=tk.X, pady=(2, 0))
        tk.Button(tctl, text="Opponent Heatmap", command=self.show_opponent_heatmap_stats).pack(fill=tk.X, pady=(2, 0))
        tk.Button(tctl, text="Point System", command=self.open_point_system_dialog).pack(fill=tk.X, pady=(2, 0)) # New Button

        # --- Round Winner and Lead Selection UI ---
        round_frame = tk.Frame(right, pady=10)
        round_frame.grid(row=2, column=1, sticky="ew") # Below team move buttons

        tk.Label(round_frame, text="Round 1 Winner:").pack(side=tk.LEFT, padx=(0,5))
        self.r1_winner_menu = tk.OptionMenu(round_frame, self.round1_winner_var, "None", "A", "B", command=lambda v: self.set_round_winner(1, v))
        self.r1_winner_menu.pack(side=tk.LEFT, expand=True, fill=tk.X)

        round_frame2 = tk.Frame(right, pady=5) # Separate frame for layout
        round_frame2.grid(row=3, column=1, sticky="ew")

        tk.Label(round_frame2, text="Round 2 Winner:").pack(side=tk.LEFT, padx=(0,5))
        self.r2_winner_menu = tk.OptionMenu(round_frame2, self.round2_winner_var, "None", "A", "B", command=lambda v: self.set_round_winner(2, v))
        self.r2_winner_menu.pack(side=tk.LEFT, expand=True, fill=tk.X)

        lead_frame_A = tk.Frame(right, pady=5)
        lead_frame_A.grid(row=5, column=0, sticky="ew", pady=(5,0)) # Below List A
        tk.Label(lead_frame_A, text="Lead Unit A:").pack(side=tk.LEFT)
        self.lead_A_menu = tk.OptionMenu(lead_frame_A, self.lead_A_var, "", command=lambda v: self.set_lead_unit("A", v)) # Options populated dynamically
        self.lead_A_menu.pack(side=tk.LEFT, expand=True, fill=tk.X)

        lead_frame_B = tk.Frame(right, pady=5)
        lead_frame_B.grid(row=5, column=2, sticky="ew", pady=(5,0)) # Below List B
        tk.Label(lead_frame_B, text="Lead Unit B:").pack(side=tk.LEFT)
        self.lead_B_menu = tk.OptionMenu(lead_frame_B, self.lead_B_var, "", command=lambda v: self.set_lead_unit("B", v)) # Options populated dynamically
        self.lead_B_menu.pack(side=tk.LEFT, expand=True, fill=tk.X)

        # Populate widgets with any loaded data
        self.refresh_week_list()
        if self.season:
            self.week_list.selection_set(0)
            self.on_week_select()
        self.refresh_units_list()

        # Hook close event for auto-save
        self.master.protocol("WM_DELETE_WINDOW", self.on_close)

    # ------------------------------------------------------------------
    # Week management
    def add_week(self):
        new_week_data = {
            "A": set(),
            "B": set(),
            "round1_winner": None,
            "round2_winner": None,
            "lead_A": None,
            "lead_B": None
        }
        self.season.append(new_week_data)
        self.refresh_week_list()
        self.week_list.selection_clear(0, tk.END)
        self.week_list.selection_set(tk.END)
        self.on_week_select()

    def remove_week(self):
        sel = self.week_list.curselection()
        if not sel:
            return
        idx = sel[0]
        del self.season[idx]
        self.refresh_week_list()
        self.current_week = None
        self.refresh_team_lists()

    def refresh_week_list(self):
        self.week_list.delete(0, tk.END)
        for i in range(len(self.season)):
            self.week_list.insert(tk.END, f"Week {i + 1}")

    def on_week_select(self, _=None):
        sel = self.week_list.curselection()
        if sel:
            self.current_week = self.season[sel[0]]
            self.round1_winner_var.set(self.current_week.get("round1_winner") or "None")
            self.round2_winner_var.set(self.current_week.get("round2_winner") or "None")
            self.lead_A_var.set(self.current_week.get("lead_A") or "")
            self.lead_B_var.set(self.current_week.get("lead_B") or "")
        else:
            self.current_week = None
            self.round1_winner_var.set("None")
            self.round2_winner_var.set("None")
            self.lead_A_var.set("")
            self.lead_B_var.set("")
        self.refresh_team_lists() # This will also call update_lead_menus
        self.refresh_units_list() # Refresh units list to show available units for selected week

    # ------------------------------------------------------------------
    # Units management
    def add_global_unit(self):
        name = self.unit_entry.get().strip()
        if not name:
            return
        if name in self.units:
            messagebox.showinfo("Duplicate", f"'{name}' already in units list.")
            return
        self.units.add(name)
        self.unit_entry.delete(0, tk.END)
        self.refresh_units_list()

    def remove_global_unit(self):
        sel = self.units_list.curselection()
        if not sel:
            return
        unit = self.units_list.get(sel[0])
        if messagebox.askyesno("Remove unit", f"Remove '{unit}' from units list and all rosters?"):
            self.units.discard(unit)
            for wk in self.season:
                wk["A"].discard(unit)
                wk["B"].discard(unit)
            self.refresh_units_list()
            self.refresh_team_lists()

    def refresh_units_list(self):
        self.units_list.delete(0, tk.END)
        
        # Get units that are currently assigned to teams in the selected week
        assigned_units = set()
        if self.current_week:
            assigned_units.update(self.current_week.get("A", set()))
            assigned_units.update(self.current_week.get("B", set()))
        
        # Only show units that are not assigned to any team in the current week
        available_units = self.units - assigned_units
        for u in sorted(available_units):
            self.units_list.insert(tk.END, u)

    # ------------------------------------------------------------------
    # Roster editing
    def move_unit_from_units(self, team: str):
        if not self.current_week:
            messagebox.showwarning("No week selected", "Select a week first.")
            return
        sel = self.units_list.curselection()
        if not sel:
            return
        unit = self.units_list.get(sel[0])
        self._place_unit(team, unit)

    def move_between_teams(self, from_team: str, to_team: str):
        if not self.current_week:
            return
        src_list = self.list_a if from_team == "A" else self.list_b
        sel = src_list.curselection()
        if not sel:
            return
        unit = src_list.get(sel[0])
        self._place_unit(to_team, unit)

    def remove_from_team(self):
        if not self.current_week:
            return
        sel_a = self.list_a.curselection()
        sel_b = self.list_b.curselection()
        if sel_a:
            unit = self.list_a.get(sel_a[0])
            self.current_week["A"].discard(unit)
        elif sel_b:
            unit = self.list_b.get(sel_b[0])
            self.current_week["B"].discard(unit)
        self.refresh_team_lists()
        self.refresh_units_list()  # Refresh units list to re-add unassigned unit

    def _place_unit(self, team: str, unit: str):
        other = "B" if team == "A" else "A"
        self.current_week[team].add(unit)
        self.current_week[other].discard(unit)
        self.refresh_team_lists()
        self.refresh_units_list()  # Refresh units list to remove assigned unit

    def refresh_team_lists(self):
        self.list_a.delete(0, tk.END)
        self.list_b.delete(0, tk.END)
        if not self.current_week:
            return
        for u in sorted(self.current_week["A"]):
            self.list_a.insert(tk.END, u)
        for u in sorted(self.current_week["B"]):
            self.list_b.insert(tk.END, u)
        self.update_lead_menus()

    def update_lead_menus(self):
        """Updates the lead unit OptionMenus based on current_week team rosters."""
        for team_id, lead_var, lead_menu in [("A", self.lead_A_var, self.lead_A_menu),
                                             ("B", self.lead_B_var, self.lead_B_menu)]:
            menu = lead_menu["menu"]
            menu.delete(0, tk.END)
            
            current_lead = None
            options = [""] # Start with a blank option
            if self.current_week and self.current_week.get(team_id):
                options.extend(sorted(list(self.current_week[team_id])))
                current_lead = self.current_week.get(f"lead_{team_id}")

            for option in options:
                menu.add_command(label=option, command=tk._setit(lead_var, option, lambda v=option, t=team_id: self.set_lead_unit(t, v)))
            
            if current_lead and current_lead in options:
                lead_var.set(current_lead)
            elif options: # Set to blank if current lead not valid or no lead
                lead_var.set(options[0])
            else: # No units on team
                lead_var.set("")


    # ------------------------------------------------------------------
    # Callbacks for round winners and leads
    def set_round_winner(self, round_num: int, winner: str):
        if not self.current_week: return
        actual_winner = winner if winner in ["A", "B"] else None
        if round_num == 1:
            self.current_week["round1_winner"] = actual_winner
        elif round_num == 2:
            self.current_week["round2_winner"] = actual_winner
        # print(f"Set Round {round_num} winner to {actual_winner} for week {self.week_list.curselection()}")

    def set_lead_unit(self, team_id: str, unit_name: str):
        if not self.current_week: return
        actual_unit = unit_name if unit_name else None # Store None if blank
        
        # Ensure the selected unit is actually on the team for the current week
        if actual_unit and self.current_week and actual_unit not in self.current_week.get(team_id, set()):
            # This case should ideally not happen if OptionMenu is populated correctly
            # but as a safeguard, reset it or show an error.
            # For now, let's just not set it if it's invalid.
            # print(f"Warning: Unit {actual_unit} not in team {team_id} for current week. Lead not set.")
            if team_id == "A": self.lead_A_var.set(self.current_week.get("lead_A") or "") # Revert to old value
            else: self.lead_B_var.set(self.current_week.get("lead_B") or "")
            return

        if team_id == "A":
            self.current_week["lead_A"] = actual_unit
        elif team_id == "B":
            self.current_week["lead_B"] = actual_unit
        # print(f"Set lead for team {team_id} to {actual_unit} for week {self.week_list.curselection()}")

    # ------------------------------------------------------------------
    # Stats
    def compute_stats(self, max_week_index: int | None = None):
        teammate = defaultdict(Counter)
        opponent = defaultdict(Counter)
        
        weeks_to_process = self.season
        if max_week_index is not None and 0 <= max_week_index < len(self.season):
            weeks_to_process = self.season[:max_week_index + 1]

        for wk in weeks_to_process:
            a, b = wk["A"], wk["B"]
            for u in a:
                teammate[u].update(v for v in a if v != u)
                opponent[u].update(b)
            for u in b:
                teammate[u].update(v for v in b if v != u)
                opponent[u].update(a)
        return teammate, opponent

    def get_detailed_interactions(self):
        """
        Computes detailed teammate and opponent interactions, including week numbers.
        Returns:
            dict: {unit1: {unit2: {"teammate_weeks": [w1, w2], "opponent_weeks": [w3, w4]}}}
        """
        interactions = defaultdict(lambda: defaultdict(lambda: {"teammate_weeks": [], "opponent_weeks": []}))

        for week_idx, week_data in enumerate(self.season):
            week_num = week_idx + 1
            team_a_units = list(week_data.get("A", set()))
            team_b_units = list(week_data.get("B", set()))

            # Teammates in Team A
            for i in range(len(team_a_units)):
                for j in range(i + 1, len(team_a_units)):
                    u1, u2 = team_a_units[i], team_a_units[j]
                    interactions[u1][u2]["teammate_weeks"].append(week_num)
                    interactions[u2][u1]["teammate_weeks"].append(week_num)

            # Teammates in Team B
            for i in range(len(team_b_units)):
                for j in range(i + 1, len(team_b_units)):
                    u1, u2 = team_b_units[i], team_b_units[j]
                    interactions[u1][u2]["teammate_weeks"].append(week_num)
                    interactions[u2][u1]["teammate_weeks"].append(week_num)
            
            # Opponents (Team A vs Team B)
            for u_a in team_a_units:
                for u_b in team_b_units:
                    interactions[u_a][u_b]["opponent_weeks"].append(week_num)
                    interactions[u_b][u_a]["opponent_weeks"].append(week_num)
        
        # Sort week numbers for consistent display
        for unit1_data in interactions.values():
            for unit2_data in unit1_data.values():
                unit2_data["teammate_weeks"].sort()
                unit2_data["opponent_weeks"].sort()
        
        return interactions

    def calculate_points(self, max_week_index: int | None = None) -> defaultdict[str, int]:
        """
        Calculates points for units based on the user-configured point system.
        If max_week_index is provided, calculates points up to and including that week index.
        Otherwise, calculates for the entire season.
        """
        points = defaultdict(int)

        def get_point_value(key: str, default_val: int = 0) -> int:
            try:
                # Ensure the key exists in the dictionary before trying to get() from StringVar
                if key in self.point_system_values:
                    val_str = self.point_system_values[key].get()
                    return int(val_str) if val_str and val_str.strip() else default_val
                return default_val # Key not found, return default
            except ValueError: # Handles non-integer strings
                return default_val # Fallback if not an int

        pts_win_lead = get_point_value("win_lead", 4)
        pts_win_assist = get_point_value("win_assist", 2)
        pts_loss_lead = get_point_value("loss_lead", 0)
        pts_loss_assist = get_point_value("loss_assist", 1)
        pts_bonus_2_0_lead = get_point_value("bonus_2_0_lead", 0)
        pts_bonus_2_0_assist = get_point_value("bonus_2_0_assist", 1)

        weeks_to_process = self.season
        if max_week_index is not None and 0 <= max_week_index < len(self.season):
            weeks_to_process = self.season[:max_week_index + 1]

        for week_data in weeks_to_process:
            team_A_units = week_data.get("A", set())
            team_B_units = week_data.get("B", set())
            lead_A = week_data.get("lead_A")
            lead_B = week_data.get("lead_B")
            r1_winner = week_data.get("round1_winner")
            r2_winner = week_data.get("round2_winner")

            # --- Round 1 ---
            if r1_winner == "A":
                if lead_A and lead_A in team_A_units:
                    points[lead_A] += pts_win_lead
                for unit in team_A_units:
                    if unit != lead_A:
                        points[unit] += pts_win_assist
                for unit in team_B_units: # Losing team B
                    if unit == lead_B and lead_B in team_B_units:
                        points[unit] += pts_loss_lead
                    elif unit != lead_B:
                        points[unit] += pts_loss_assist
            elif r1_winner == "B":
                if lead_B and lead_B in team_B_units:
                    points[lead_B] += pts_win_lead
                for unit in team_B_units:
                    if unit != lead_B:
                        points[unit] += pts_win_assist
                for unit in team_A_units: # Losing team A
                    if unit == lead_A and lead_A in team_A_units:
                        points[unit] += pts_loss_lead
                    elif unit != lead_A:
                        points[unit] += pts_loss_assist
            
            # --- Round 2 ---
            if r2_winner == "A":
                if lead_A and lead_A in team_A_units:
                    points[lead_A] += pts_win_lead
                for unit in team_A_units:
                    if unit != lead_A:
                        points[unit] += pts_win_assist
                for unit in team_B_units: # Losing team B
                     if unit == lead_B and lead_B in team_B_units:
                        points[unit] += pts_loss_lead
                     elif unit != lead_B:
                        points[unit] += pts_loss_assist
            elif r2_winner == "B":
                if lead_B and lead_B in team_B_units:
                    points[lead_B] += pts_win_lead
                for unit in team_B_units:
                    if unit != lead_B:
                        points[unit] += pts_win_assist
                for unit in team_A_units: # Losing team A
                    if unit == lead_A and lead_A in team_A_units:
                        points[unit] += pts_loss_lead
                    elif unit != lead_A:
                        points[unit] += pts_loss_assist

            # --- Bonus for 2-0 week ---
            if r1_winner and r1_winner == r2_winner: # If a team won both rounds
                winning_team_units = team_A_units if r1_winner == "A" else team_B_units
                winning_team_lead = lead_A if r1_winner == "A" else lead_B
                
                for unit in winning_team_units:
                    # Ensure winning_team_lead is actually part of the winning_team_units before comparing
                    if unit == winning_team_lead and winning_team_lead in winning_team_units:
                        points[unit] += pts_bonus_2_0_lead
                    elif unit != winning_team_lead:
                        points[unit] += pts_bonus_2_0_assist
        
        return points

    def show_points_table(self):
        if not self.season:
            messagebox.showinfo("Points Table", "No season data available.")
            return
        if not self.units:
            messagebox.showinfo("Points Table", "No units defined.")
            return

        # Check if a week is selected, default to latest week if none selected
        sel = self.week_list.curselection()
        if sel:
            selected_week_idx = sel[0]
        else:
            # Default to the latest week if no week is selected
            selected_week_idx = len(self.season) - 1
        
        week_number = selected_week_idx + 1

        win = tk.Toplevel(self.master)
        win.title(f"Week {week_number} Points")
        win.geometry("500x400") # Adjusted size
        win.minsize(500, 400) # Lock minimum size

        cols = ["unit", "pts", "rank", "delta"]
        col_names = {
            "unit": "Unit",
            "pts": "Points",
            "rank": "Rank",
            "delta": "Rank Δ"
        }

        tree_frame = ttk.Frame(win)
        tree_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        tree = ttk.Treeview(tree_frame, columns=cols, show="headings")
        
        for col_id in cols:
            tree.heading(col_id, text=col_names[col_id])
            tree.column(col_id, width=100, anchor=tk.CENTER) # Default width
        tree.column("unit", width=150, anchor=tk.W)
        tree.column("delta", width=80)


        # --- Data Preparation ---
        current_week_idx = selected_week_idx
        if current_week_idx < 0:
             tk.Label(win, text="No season data to display.").pack(padx=20, pady=20)
             return # Nothing to show

        # Calculate points for the current week
        current_week_points_data = self.calculate_points(max_week_index=current_week_idx)
        current_week_scores = {
            unit: current_week_points_data.get(unit, 0) for unit in self.units
        }
        sorted_current_week_units = sorted(
            current_week_scores.items(),
            key=lambda item: (-item[1], item[0]) # Sort by points (desc), then name (asc)
        )
        
        current_ranks = {unit: rank for rank, (unit, _) in enumerate(sorted_current_week_units, 1)}

        # Calculate points for the previous week (if it exists)
        previous_week_ranks = {}
        if current_week_idx > 0:
            prev_week_idx = current_week_idx - 1
            prev_week_points_data = self.calculate_points(max_week_index=prev_week_idx)
            prev_week_scores = {
                unit: prev_week_points_data.get(unit, 0) for unit in self.units
            }
            sorted_prev_week_units = sorted(
                prev_week_scores.items(),
                key=lambda item: (-item[1], item[0])
            )
            previous_week_ranks = {unit: rank for rank, (unit, _) in enumerate(sorted_prev_week_units, 1)}

        # --- Populate Treeview ---
        # Units are already sorted by current week's rank via sorted_current_week_units
        for unit_name, pts in sorted_current_week_units:
            rank = current_ranks.get(unit_name, "-")
            
            delta_display = "-"
            prev_rank = previous_week_ranks.get(unit_name)
            if prev_rank is not None and rank != "-":
                change = prev_rank - rank # Positive for improvement
                if change > 0:
                    delta_display = f"↑{change}"
                elif change < 0:
                    delta_display = f"↓{abs(change)}"
                else:
                    delta_display = "↔0"
            
            row_values = (unit_name, pts, rank, delta_display)
            tree.insert("", tk.END, values=row_values)

        # Scrollbars
        vsb = ttk.Scrollbar(tree_frame, orient="vertical", command=tree.yview)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        tree.configure(yscrollcommand=vsb.set)

        # No horizontal scrollbar needed for fewer columns, typically.
        # hsb = ttk.Scrollbar(tree_frame, orient="horizontal", command=tree.xview)
        # hsb.pack(side=tk.BOTTOM, fill=tk.X)
        # tree.configure(xscrollcommand=hsb.set)

        tree.pack(fill=tk.BOTH, expand=True)


    def show_stats(self):
        teammate, opponent = self.compute_stats()
        current_points = self.calculate_points() # Calculate total points for the season

        win = tk.Toplevel(self.master)
        win.title("Season Stats")
        text = tk.Text(win, wrap=tk.NONE, width=80, height=35)
        text.pack(fill=tk.BOTH, expand=True)
        def dump(title, data):
            text.insert(tk.END, f"{title}\n")
            for unit in sorted(data):
                text.insert(tk.END, f"{unit}:\n")
                for other, n in data[unit].most_common():
                    text.insert(tk.END, f"   {other}: {n}\n")
                text.insert(tk.END, "\n")
        dump("=== TEAMMATE COUNTS ===", teammate)
        dump("=== OPPONENT COUNTS ===", opponent)
        
        text.insert(tk.END, "=== UNIT POINTS ===\n")
        if not self.units:
            text.insert(tk.END, "No units defined.\n")
        else:
            # Get points for all defined units, defaulting to 0
            all_unit_scores = {unit: current_points.get(unit, 0) for unit in self.units}
            
            if not all_unit_scores and not current_points: # Handles case where self.units might be empty if logic changes
                 text.insert(tk.END, "No points calculated yet or no units defined.\n")
            # Sort points by value (descending), then by unit name (ascending)
            elif all_unit_scores:
                sorted_display_points = sorted(all_unit_scores.items(), key=lambda item: (-item[1], item[0]))
                for unit, pts in sorted_display_points:
                    text.insert(tk.END, f"{unit}: {pts}\n")
            else: # Should not be reached if self.units is populated
                text.insert(tk.END, "No points to display.\n")

        text.insert(tk.END, "\n")
        
        text.config(state=tk.DISABLED)

    def show_heatmap_stats(self):
        if not self.units:
            messagebox.showinfo("Heatmap", "No units defined to generate heatmap.")
            return
        if not self.season:
            messagebox.showinfo("Heatmap", "No season data available to generate heatmap.")
            return

        win = tk.Toplevel(self.master)
        win.title("Teammate & Opponent Heatmap (Hover for Details)")

        # --- Main layout ---
        main_frame = tk.Frame(win)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        top_frame = tk.Frame(main_frame)
        top_frame.pack(side=tk.TOP, fill=tk.X, pady=(0, 10))

        title_label = tk.Label(top_frame, text="Teammate Heat Index", font=("Arial", 12, "bold"))
        title_label.pack(side=tk.LEFT, expand=True)

        # --- Week Selector ---
        week_selector_var = tk.StringVar()
        week_options = ["All Weeks"] + [f"Week {i+1}" for i in range(len(self.season))]
        week_selector = ttk.Combobox(top_frame, textvariable=week_selector_var, values=week_options, state="readonly")
        week_selector.pack(side=tk.RIGHT)
        week_selector.set("All Weeks")

        # --- Canvas for heatmap ---
        canvas_frame = tk.Frame(main_frame)
        canvas_frame.pack(fill=tk.BOTH, expand=True)
        canvas = tk.Canvas(canvas_frame, bg="white")
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # --- Tooltip setup ---
        tooltip_label = tk.Label(canvas, text="", background="#FFFFE0", relief=tk.SOLID, borderwidth=1,
                                 font=("Arial", 8, "bold"), justify=tk.LEFT, wraplength=250)
        
        all_units_in_heatmap = sorted(list(self.units))
        detailed_interactions = self.get_detailed_interactions() # For tooltip content, calculated once
        cell_info_map = {}
        current_hover_tag = None

        def redraw_heatmap(selected_week_str: str):
            nonlocal cell_info_map
            canvas.delete("all") # Clear previous drawing
            cell_info_map.clear()

            max_week_idx = None
            if selected_week_str != "All Weeks":
                try:
                    # Extract number and convert to 0-based index
                    max_week_idx = int(selected_week_str.split(" ")[1]) - 1
                except (ValueError, IndexError):
                    max_week_idx = None # Fallback

            teammate_stats, _ = self.compute_stats(max_week_index=max_week_idx)

            # Find max count for color scaling
            max_teammate_count = 0
            for unit_data in teammate_stats.values():
                for count_val in unit_data.values():
                    if count_val > max_teammate_count:
                        max_teammate_count = count_val
            
            cell_size = 60
            padding = 75
            label_font = ("Arial", 9)
            num_units = len(all_units_in_heatmap)
            canvas_width = num_units * cell_size + padding * 2
            canvas_height = num_units * cell_size + padding * 2
            canvas.config(width=canvas_width, height=canvas_height)

            # Draw axis labels
            for i, unit_name in enumerate(all_units_in_heatmap):
                x_label_pos = padding + i * cell_size + cell_size / 2
                canvas.create_text(x_label_pos, padding - 5, text=unit_name, anchor=tk.S, font=label_font)
                y_label_pos = padding + i * cell_size + cell_size / 2
                canvas.create_text(padding - 5, y_label_pos, text=unit_name, anchor=tk.E, font=label_font)

            # Draw heatmap cells
            for r_idx, unit_row in enumerate(all_units_in_heatmap):
                for c_idx, unit_col in enumerate(all_units_in_heatmap):
                    x1, y1 = padding + c_idx * cell_size, padding + r_idx * cell_size
                    x2, y2 = x1 + cell_size, y1 + cell_size
                    
                    cell_tag = f"cell_{r_idx}_{c_idx}"
                    cell_info_map[cell_tag] = (unit_row, unit_col)

                    if unit_row == unit_col:
                        canvas.create_rectangle(x1, y1, x2, y2, fill="lightgrey", outline="grey", tags=(cell_tag,))
                        canvas.create_line(x1 + 5, y1 + 5, x2 - 5, y2 - 5, fill="black", width=1, tags=(cell_tag,))
                        canvas.create_line(x1 + 5, y2 - 5, x2 - 5, y1 + 5, fill="black", width=1, tags=(cell_tag,))
                    else:
                        count = teammate_stats.get(unit_row, {}).get(unit_col, 0)
                        intensity = count / max_teammate_count if max_teammate_count > 0 else 0.0
                        
                        r, g, b = 255, int(255 * (1 - intensity)), int(224 * (1 - intensity))
                        color = f"#{r:02x}{g:02x}{b:02x}"
                        
                        canvas.create_rectangle(x1, y1, x2, y2, fill=color, outline="grey", tags=(cell_tag,))
                        
                        if count > 0:
                            text_color = "black" if intensity < 0.6 else "white"
                            canvas.create_text(x1 + cell_size / 2, y1 + cell_size / 2,
                                              text=str(count), fill=text_color, font=label_font,
                                              tags=(f"text_{cell_tag}", "cell_content"))
            
            win.update_idletasks()
            win.minsize(win.winfo_width(), win.winfo_height())


        def format_tooltip_text_for_cell(u1, u2):
            if u1 == u2: return ""
            interaction_data = detailed_interactions.get(u1, {}).get(u2, {})
            teammate_w = interaction_data.get("teammate_weeks", [])
            opponent_w = interaction_data.get("opponent_weeks", [])
            if not teammate_w and not opponent_w: return f"{u1} & {u2}:\nNo interactions"
            text = f"{u1} & {u2}:\n"
            if teammate_w: text += f"  Teammates in Wk(s): {', '.join(map(str, teammate_w))}\n"
            if opponent_w: text += f"  Opponents in Wk(s): {', '.join(map(str, opponent_w))}\n"
            return text.strip()

        def on_canvas_motion(event):
            nonlocal current_hover_tag
            canvas.delete("highlight_rect")
            items = canvas.find_closest(event.x, event.y)
            item_id = items[0] if items else None
            
            found_cell_tag = None
            if item_id:
                for tag in canvas.gettags(item_id):
                    if tag.startswith("cell_"):
                        found_cell_tag = tag
                        break
            
            if found_cell_tag:
                if found_cell_tag != current_hover_tag:
                    current_hover_tag = found_cell_tag
                    unit1, unit2 = cell_info_map[found_cell_tag]
                    tooltip_text = format_tooltip_text_for_cell(unit1, unit2)
                    if not tooltip_text:
                        tooltip_label.place_forget()
                        return
                    tooltip_label.config(text=tooltip_text)
                    bbox = canvas.bbox(found_cell_tag)
                    if bbox:
                        canvas.create_rectangle(bbox, outline="blue", width=2, tags="highlight_rect")

                tip_x = canvas.winfo_pointerx() - win.winfo_rootx() + 15
                tip_y = canvas.winfo_pointery() - win.winfo_rooty() + 10
                canvas_width = canvas.winfo_width()
                canvas_height = canvas.winfo_height()
                if tip_x + tooltip_label.winfo_reqwidth() > canvas_width: tip_x = canvas_width - tooltip_label.winfo_reqwidth() - 5
                if tip_y + tooltip_label.winfo_reqheight() > canvas_height: tip_y = canvas_height - tooltip_label.winfo_reqheight() - 5
                if tip_x < 0: tip_x = 0
                if tip_y < 0: tip_y = 0
                tooltip_label.lift()
                tooltip_label.place(x=tip_x, y=tip_y)
            else:
                on_canvas_leave(event)

        def on_canvas_leave(event):
            nonlocal current_hover_tag
            tooltip_label.place_forget()
            canvas.delete("highlight_rect")
            current_hover_tag = None

        # --- Bindings ---
        canvas.bind("<Motion>", on_canvas_motion)
        canvas.bind("<Leave>", on_canvas_leave)
        week_selector.bind("<<ComboboxSelected>>", lambda event: (redraw_heatmap(week_selector_var.get()), win.focus_set()))


        # Initial draw
        redraw_heatmap("All Weeks")

    def show_opponent_heatmap_stats(self):
        if not self.units:
            messagebox.showinfo("Heatmap", "No units defined to generate heatmap.")
            return
        if not self.season:
            messagebox.showinfo("Heatmap", "No season data available to generate heatmap.")
            return

        win = tk.Toplevel(self.master)
        win.title("Opponent & Teammate Heatmap (Hover for Details)")

        # --- Main layout ---
        main_frame = tk.Frame(win)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        top_frame = tk.Frame(main_frame)
        top_frame.pack(side=tk.TOP, fill=tk.X, pady=(0, 10))

        title_label = tk.Label(top_frame, text="Opponent Heat Index", font=("Arial", 12, "bold"))
        title_label.pack(side=tk.LEFT, expand=True)

        # --- Week Selector ---
        week_selector_var = tk.StringVar()
        week_options = ["All Weeks"] + [f"Week {i+1}" for i in range(len(self.season))]
        week_selector = ttk.Combobox(top_frame, textvariable=week_selector_var, values=week_options, state="readonly")
        week_selector.pack(side=tk.RIGHT)
        week_selector.set("All Weeks")

        # --- Canvas for heatmap ---
        canvas_frame = tk.Frame(main_frame)
        canvas_frame.pack(fill=tk.BOTH, expand=True)
        canvas = tk.Canvas(canvas_frame, bg="white")
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # --- Tooltip setup ---
        tooltip_label = tk.Label(canvas, text="", background="#FFFFE0", relief=tk.SOLID, borderwidth=1,
                                 font=("Arial", 8, "bold"), justify=tk.LEFT, wraplength=250)
        
        all_units_in_heatmap = sorted(list(self.units))
        detailed_interactions = self.get_detailed_interactions()
        cell_info_map = {}
        current_hover_tag = None

        def redraw_heatmap(selected_week_str: str):
            nonlocal cell_info_map
            canvas.delete("all")
            cell_info_map.clear()

            max_week_idx = None
            if selected_week_str != "All Weeks":
                try:
                    max_week_idx = int(selected_week_str.split(" ")[1]) - 1
                except (ValueError, IndexError):
                    max_week_idx = None

            _, opponent_stats = self.compute_stats(max_week_index=max_week_idx)

            max_opponent_count = 0
            for unit_data in opponent_stats.values():
                for count_val in unit_data.values():
                    if count_val > max_opponent_count:
                        max_opponent_count = count_val
            
            cell_size = 60
            padding = 75
            label_font = ("Arial", 9)
            num_units = len(all_units_in_heatmap)
            canvas_width = num_units * cell_size + padding * 2
            canvas_height = num_units * cell_size + padding * 2
            canvas.config(width=canvas_width, height=canvas_height)

            for i, unit_name in enumerate(all_units_in_heatmap):
                x_label_pos = padding + i * cell_size + cell_size / 2
                canvas.create_text(x_label_pos, padding - 5, text=unit_name, anchor=tk.S, font=label_font)
                y_label_pos = padding + i * cell_size + cell_size / 2
                canvas.create_text(padding - 5, y_label_pos, text=unit_name, anchor=tk.E, font=label_font)

            for r_idx, unit_row in enumerate(all_units_in_heatmap):
                for c_idx, unit_col in enumerate(all_units_in_heatmap):
                    x1, y1 = padding + c_idx * cell_size, padding + r_idx * cell_size
                    x2, y2 = x1 + cell_size, y1 + cell_size
                    
                    cell_tag = f"cell_opp_{r_idx}_{c_idx}"
                    cell_info_map[cell_tag] = (unit_row, unit_col)

                    if unit_row == unit_col:
                        canvas.create_rectangle(x1, y1, x2, y2, fill="lightgrey", outline="grey", tags=(cell_tag,))
                        canvas.create_line(x1 + 5, y1 + 5, x2 - 5, y2 - 5, fill="black", width=1, tags=(cell_tag,))
                        canvas.create_line(x1 + 5, y2 - 5, x2 - 5, y1 + 5, fill="black", width=1, tags=(cell_tag,))
                    else:
                        count = opponent_stats.get(unit_row, {}).get(unit_col, 0)
                        intensity = count / max_opponent_count if max_opponent_count > 0 else 0.0
                        
                        r, g, b = 255, int(255 * (1 - intensity)), int(224 * (1 - intensity))
                        color = f"#{r:02x}{g:02x}{b:02x}"
                        
                        canvas.create_rectangle(x1, y1, x2, y2, fill=color, outline="grey", tags=(cell_tag,))
                        
                        if count > 0:
                            text_color = "black" if intensity < 0.6 else "white"
                            canvas.create_text(x1 + cell_size / 2, y1 + cell_size / 2,
                                              text=str(count), fill=text_color, font=label_font,
                                              tags=(f"text_{cell_tag}", "cell_content_opp"))
            
            win.update_idletasks()
            win.minsize(win.winfo_width(), win.winfo_height())

        def format_tooltip_text_for_cell(u1, u2):
            if u1 == u2: return ""
            interaction_data = detailed_interactions.get(u1, {}).get(u2, {})
            teammate_w = interaction_data.get("teammate_weeks", [])
            opponent_w = interaction_data.get("opponent_weeks", [])
            if not teammate_w and not opponent_w: return f"{u1} & {u2}:\nNo interactions"
            text = f"{u1} & {u2}:\n"
            if teammate_w: text += f"  Teammates in Wk(s): {', '.join(map(str, teammate_w))}\n"
            if opponent_w: text += f"  Opponents in Wk(s): {', '.join(map(str, opponent_w))}\n"
            return text.strip()

        def on_canvas_motion(event):
            nonlocal current_hover_tag
            canvas.delete("highlight_rect_opp")
            items = canvas.find_closest(event.x, event.y)
            item_id = items[0] if items else None
            
            found_cell_tag = None
            if item_id:
                for tag in canvas.gettags(item_id):
                    if tag.startswith("cell_opp_"):
                        found_cell_tag = tag
                        break
            
            if found_cell_tag:
                if found_cell_tag != current_hover_tag:
                    current_hover_tag = found_cell_tag
                    unit1, unit2 = cell_info_map[found_cell_tag]
                    tooltip_text = format_tooltip_text_for_cell(unit1, unit2)
                    if not tooltip_text:
                        tooltip_label.place_forget()
                        return
                    tooltip_label.config(text=tooltip_text)
                    bbox = canvas.bbox(found_cell_tag)
                    if bbox:
                        canvas.create_rectangle(bbox, outline="green", width=2, tags="highlight_rect_opp")

                tip_x = canvas.winfo_pointerx() - win.winfo_rootx() + 15
                tip_y = canvas.winfo_pointery() - win.winfo_rooty() + 10
                canvas_width = canvas.winfo_width()
                canvas_height = canvas.winfo_height()
                if tip_x + tooltip_label.winfo_reqwidth() > canvas_width: tip_x = canvas_width - tooltip_label.winfo_reqwidth() - 5
                if tip_y + tooltip_label.winfo_reqheight() > canvas_height: tip_y = canvas_height - tooltip_label.winfo_reqheight() - 5
                if tip_x < 0: tip_x = 0
                if tip_y < 0: tip_y = 0
                tooltip_label.lift()
                tooltip_label.place(x=tip_x, y=tip_y)
            else:
                on_canvas_leave(event)

        def on_canvas_leave(event):
            nonlocal current_hover_tag
            tooltip_label.place_forget()
            canvas.delete("highlight_rect_opp")
            current_hover_tag = None

        canvas.bind("<Motion>", on_canvas_motion)
        canvas.bind("<Leave>", on_canvas_leave)
        week_selector.bind("<<ComboboxSelected>>", lambda event: (redraw_heatmap(week_selector_var.get()), win.focus_set()))

        redraw_heatmap("All Weeks")

    # ------------------------------------------------------------------
    # Persistence helpers
    def save_to_file(self, path: Path):
        data = {
            "units": sorted(self.units),
            "season": [
                {
                    "A": sorted(list(wk.get("A", set()))),
                    "B": sorted(list(wk.get("B", set()))),
                    "round1_winner": wk.get("round1_winner"),
                    "round2_winner": wk.get("round2_winner"),
                    "lead_A": wk.get("lead_A"),
                    "lead_B": wk.get("lead_B"),
                } for wk in self.season
            ],
            "team_names": {k: v.get() for k, v in self.team_names.items()},
            "point_system_values": {k: v.get() for k, v in self.point_system_values.items()}, # Save all point values
        }
        path.write_text(json.dumps(data, indent=2))

    def load_from_file(self, path: Path):
        try:
            data = json.loads(path.read_text())
            self.units = set(data.get("units", []))
            loaded_season = data.get("season", [])
            self.season = []
            for wk_data in loaded_season:
                self.season.append({
                    "A": set(wk_data.get("A", [])),
                    "B": set(wk_data.get("B", [])),
                    "round1_winner": wk_data.get("round1_winner"),
                    "round2_winner": wk_data.get("round2_winner"),
                    "lead_A": wk_data.get("lead_A"),
                    "lead_B": wk_data.get("lead_B")
                })
            for k, v in data.get("team_names", {}).items():
                if k in self.team_names:
                    self.team_names[k].set(v)
            
            loaded_point_system = data.get("point_system_values", {})
            default_points = { # Define defaults here for clarity
                "win_lead": "4", "win_assist": "2",
                "loss_lead": "0", "loss_assist": "1",
                "bonus_2_0_lead": "0", "bonus_2_0_assist": "1",
            }
            for key, var in self.point_system_values.items():
                var.set(loaded_point_system.get(key, default_points.get(key, "0"))) # Fallback to default_points, then "0"

        except Exception as e:
            messagebox.showerror("Load error", str(e))
            # On error, reset to hardcoded defaults
            self.point_system_values["win_lead"].set("4")
            self.point_system_values["win_assist"].set("2")
            self.point_system_values["loss_lead"].set("0")
            self.point_system_values["loss_assist"].set("1")
            self.point_system_values["bonus_2_0_lead"].set("0")
            self.point_system_values["bonus_2_0_assist"].set("1")


    def new_season(self):
            if not messagebox.askyesno("New Season",
                                       "Are you sure you want to start a new season?\n"
                                       "Unsaved changes to the current season might be lost if not saved via 'Save Season'."):
                return

            self.season.clear()
            self.units.clear()
            self.current_week = None
            self.team_names["A"].set("Team A") # Reset to defaults
            self.team_names["B"].set("Team B")
            
            # Reset point system to defaults
            self.point_system_values["win_lead"].set("4")
            self.point_system_values["win_assist"].set("2")
            self.point_system_values["loss_lead"].set("0")
            self.point_system_values["loss_assist"].set("1")
            self.point_system_values["bonus_2_0_lead"].set("0")
            self.point_system_values["bonus_2_0_assist"].set("1")
            
            self.unit_points.clear()

            self.refresh_week_list()    # Updates week listbox (will be empty)
            self.refresh_units_list()   # Updates units listbox (will be empty)
            
            # Reset UI elements that depend on current_week or team rosters
            self.list_a.delete(0, tk.END)
            self.list_b.delete(0, tk.END)
            self.round1_winner_var.set("None")
            self.round2_winner_var.set("None")
            self.lead_A_var.set("")
            self.lead_B_var.set("")
            self.update_lead_menus() # Will correctly handle no current_week and empty rosters

            messagebox.showinfo("New Season", "New season started. Add weeks and units to begin.")

    def load_dialog(self):
        path = filedialog.askopenfilename(filetypes=[("JSON", "*.json"), ("All", "*")])
        if path:
            self.load_from_file(Path(path)) # Data is loaded (self.season, self.units, self.team_names)
            
            self.refresh_units_list()   # Populate global units list
            self.refresh_week_list()    # Populate weeks list

            if self.season:
                self.week_list.selection_clear(0, tk.END)
                self.week_list.selection_set(0)           # Select first week
                self.on_week_select()                     # Trigger update based on selection
            else:
                # No weeks in loaded season, ensure UI is cleared
                self.current_week = None
                self.list_a.delete(0, tk.END)
                self.list_b.delete(0, tk.END)
                self.round1_winner_var.set("None")
                self.round2_winner_var.set("None")
                self.lead_A_var.set("")
                self.lead_B_var.set("")
                self.update_lead_menus() # Ensure lead menus are empty/default
            messagebox.showinfo("Load Season", f"Season loaded from {Path(path).name}")

    def save_dialog(self):
        path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON", "*.json")])
        if path:
            self.save_to_file(Path(path))

    def on_close(self):
        # Auto-save to default path, ignore errors.
        try:
            self.save_to_file(self.DEFAULT_PATH)
        except Exception:
            pass
        self.master.destroy()

    def open_point_system_dialog(self):
        dialog = tk.Toplevel(self.master)
        dialog.title("Configure Point System")
        dialog.transient(self.master)
        dialog.grab_set()
        # dialog.geometry("350x280") # Adjusted size
        dialog.resizable(False, False)

        main_frame = tk.Frame(dialog, padx=10, pady=10)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Temporary StringVars for the dialog to avoid direct modification until "OK"
        dialog_vars = {key: tk.StringVar(value=var.get()) for key, var in self.point_system_values.items()}

        fields = [
            ("win_lead", "Winning Lead Points:"),
            ("win_assist", "Winning Assist Points:"),
            ("loss_lead", "Losing Lead Points:"),
            ("loss_assist", "Losing Assist Points:"),
            ("bonus_2_0_lead", "2-0 Bonus Lead Points:"),
            ("bonus_2_0_assist", "2-0 Bonus Assist Points:"),
        ]

        for i, (key, label_text) in enumerate(fields):
            tk.Label(main_frame, text=label_text).grid(row=i, column=0, sticky=tk.W, pady=2)
            entry = tk.Entry(main_frame, textvariable=dialog_vars[key], width=5)
            entry.grid(row=i, column=1, sticky=tk.E, pady=2, padx=5)

        buttons_frame = tk.Frame(main_frame)
        buttons_frame.grid(row=len(fields), column=0, columnspan=2, pady=(15,5))

        def on_ok():
            temp_values = {}
            try:
                for key, s_var in dialog_vars.items():
                    val_str = s_var.get()
                    if not val_str.strip(): # Allow empty string, treat as 0
                        temp_values[key] = 0
                        continue
                    temp_values[key] = int(val_str)
            except ValueError:
                messagebox.showerror("Invalid Input", "All point values must be integers (or empty for 0).", parent=dialog)
                return

            # If all valid, update the main StringVars
            for key, value in temp_values.items():
                self.point_system_values[key].set(str(value)) # Store as string
            
            # print("Updated point system values:", {k: v.get() for k,v in self.point_system_values.items()}) # For debugging
            dialog.destroy()

        def on_cancel():
            dialog.destroy()

        ok_button = tk.Button(buttons_frame, text="OK", command=on_ok, width=10)
        ok_button.pack(side=tk.LEFT, padx=10)
        
        cancel_button = tk.Button(buttons_frame, text="Cancel", command=on_cancel, width=10)
        cancel_button.pack(side=tk.RIGHT, padx=10)

        dialog.update_idletasks()
        master_x = self.master.winfo_rootx() # Use winfo_rootx for screen coordinates
        master_y = self.master.winfo_rooty()
        master_width = self.master.winfo_width()
        master_height = self.master.winfo_height()
        
        dialog_width = dialog.winfo_reqwidth() # Use reqwidth for initial size
        dialog_height = dialog.winfo_reqheight()

        x_offset = (master_width - dialog_width) // 2
        y_offset = (master_height - dialog_height) // 2
        
        dialog.geometry(f"{dialog_width}x{dialog_height}+{master_x + x_offset}+{master_y + y_offset}")
        dialog.focus_set() # Ensure dialog gets focus


if __name__ == "__main__":
    root = tk.Tk()
    SeasonTrackerGUI(root)
    root.mainloop()