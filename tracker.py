import json
import tkinter as tk
from tkinter import ttk # Added for Treeview
from tkinter import messagebox, filedialog, font as tkFont
from collections import Counter, defaultdict
from pathlib import Path
import csv
import itertools
import math
import statistics
import ast
from maps import maps


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

class DraggableListbox(tk.Listbox):
    """A tkinter Listbox with drag-and-drop reordering of items."""
    def __init__(self, master, **kw):
        super().__init__(master, **kw)
        self.bind("<Button-1>", self.on_start_drag)
        self.bind("<B1-Motion>", self.on_drag)
        self.bind("<ButtonRelease-1>", self.on_drop)
        self.selection_anchor_index = None
        self._dragged_item_text = None

    def on_start_drag(self, event):
        if self.size() > 0:
            self.selection_anchor_index = self.nearest(event.y)
            self._dragged_item_text = self.get(self.selection_anchor_index)

    def on_drag(self, event):
        if self.selection_anchor_index is None:
            return
        
        i = self.nearest(event.y)
        if i != self.selection_anchor_index:
            # Reorder inside the same listbox
            item_text = self.get(self.selection_anchor_index)
            self.delete(self.selection_anchor_index)
            self.insert(i, item_text)
            self.selection_anchor_index = i

    def on_drop(self, event):
        if self._dragged_item_text is None:
            return

        # find the target listbox
        target_listbox = self.winfo_containing(event.x_root, event.y_root)

        if target_listbox is not self and isinstance(target_listbox, DraggableListbox):
            # Dropped on a different listbox
            y_in_target = target_listbox.winfo_pointery() - target_listbox.winfo_rooty()
            target_index = target_listbox.nearest(y_in_target)
            
            if self._dragged_item_text not in target_listbox.get(0, tk.END):
                target_listbox.insert(target_index, self._dragged_item_text)
                target_listbox.update_idletasks() # Force redraw
            
            self.delete(self.get(0, tk.END).index(self._dragged_item_text))

        self.selection_anchor_index = None
        self._dragged_item_text = None
        
class SeasonTrackerGUI:
    """Two-team season tracker with minimal GUI, persistent save/load, and a global units list."""

    DEFAULT_PATH = Path("season_data.json")

    def __init__(self, master: tk.Tk):
        self.master = master
        master.title("Season Tracker")
        master.geometry("940x680") # Increased height
        master.resizable(True, True)
        master.minsize(940, 680) # Lock minimum size

        # -------------------- DATA --------------------
        self.units: set[str] = set()
        self.non_token_units: set[str] = set()
        self.season: list[dict] = []  # Expanded structure below
        # Each week dict:
        # {
        #   "A": set[str], "B": set[str],
        #   "round1_winner": str | None, "round2_winner": str | None, # "A", "B", or None
        #   "lead_A": str | None, "lead_B": str | None, # Unit name or None
        #   "playoffs": bool,
        #   "lead_A_r1": str | None, "lead_B_r1": str | None,
        #   "lead_A_r2": str | None, "lead_B_r2": str | None,
        #   "round1_map": str | None, "round2_map": str | None,
        #   "round1_flipped": bool, "round2_flipped": bool
        # }
        self.current_week: dict | None = None
        self.team_names = {"A": tk.StringVar(value="USA"), "B": tk.StringVar(value="CSA")}
        self.roster_strength_vars = {"A": tk.StringVar(value="Strength: -"), "B": tk.StringVar(value="Strength: -")}
        self.win_chance_vars = {"A": tk.StringVar(value="Win Chance: -"), "B": tk.StringVar(value="Win Chance: -")}
        self.unit_points: defaultdict[str, int] = defaultdict(int)
        self.unit_player_counts: defaultdict[str, dict] = defaultdict(lambda: {"min": "0", "max": "100"})
        self.manual_point_adjustments: defaultdict[str, int] = defaultdict(int)
        self.divisions: list[dict] = []
        self.weekly_casualties: defaultdict[int, dict] = defaultdict(dict) # week_idx -> {unit: deaths}
        
        # Point system settings - dictionary of StringVars
        self.point_system_values = {
            "win_lead": tk.StringVar(value="4"),
            "win_assist": tk.StringVar(value="2"),
            "loss_lead": tk.StringVar(value="0"),
            "loss_assist": tk.StringVar(value="1"),
            "bonus_2_0_lead": tk.StringVar(value="0"),
            "bonus_2_0_assist": tk.StringVar(value="1"),
        }
        
        self.elo_system_values = {
            "initial_elo": tk.StringVar(value="1500"),
            "k_factor_standard": tk.StringVar(value="96"),
            "k_factor_provisional": tk.StringVar(value="128"),
            "provisional_rounds": tk.StringVar(value="10"),
            "sweep_bonus_multiplier": tk.StringVar(value="1.25"),
            "lead_multiplier": tk.StringVar(value="2.0"),
            "size_influence": tk.StringVar(value="1.0"),
            "playoff_multiplier": tk.StringVar(value="1.25"),
        }
        
        self.elo_bias_percentages = {
            "light_attacker": tk.StringVar(value="15"),
            "heavy_attacker": tk.StringVar(value="30"),
            "light_defender": tk.StringVar(value="15"),
            "heavy_defender": tk.StringVar(value="30"),
        }
        
        self.map_biases: dict[str, tk.StringVar] = {}

        # For round winner and lead selection
        self.round1_winner_var = tk.StringVar()
        self.round2_winner_var = tk.StringVar()
        self.lead_A_var = tk.StringVar()
        self.lead_B_var = tk.StringVar()
        self.round1_map_var = tk.StringVar()
        self.round2_map_var = tk.StringVar()
        self.round1_flipped_var = tk.BooleanVar()
        self.round2_flipped_var = tk.BooleanVar()
        
        # For casualties
        self.r1_casualties_A_var = tk.StringVar(value="0")
        self.r1_casualties_B_var = tk.StringVar(value="0")
        self.r2_casualties_A_var = tk.StringVar(value="0")
        self.r2_casualties_B_var = tk.StringVar(value="0")
        
        # For playoffs
        self.playoffs_var = tk.BooleanVar()
        self.lead_A_r1_var = tk.StringVar()
        self.lead_B_r1_var = tk.StringVar()
        self.lead_A_r2_var = tk.StringVar()
        self.lead_B_r2_var = tk.StringVar()
        self.show_non_token_elo_var = tk.BooleanVar(value=True)


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
        self.week_list = tk.Listbox(left, width=15, height=25, exportselection=False)
        self.week_list.pack(fill=tk.Y, expand=True)
        self.week_list.bind("<<ListboxSelect>>", self.on_week_select)
        self.week_list.bind("<Double-Button-1>", self.start_rename_week)

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
        self.units_list.bind("<Button-2>", self.toggle_non_token_status) # Middle-click

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

        # Team A
        team_a_header = tk.Frame(right)
        team_a_header.grid(row=0, column=0, sticky="ew")
        team_a_header.grid_columnconfigure(0, weight=1)
        tk.Entry(team_a_header, textvariable=self.team_names["A"], justify="center").pack(fill=tk.X, expand=True)
        strength_frame_A = tk.Frame(team_a_header)
        strength_frame_A.pack()
        tk.Label(strength_frame_A, textvariable=self.roster_strength_vars["A"], font=("Arial", 8)).pack(side=tk.LEFT)
        tk.Label(strength_frame_A, textvariable=self.win_chance_vars["A"], font=("Arial", 8)).pack(side=tk.LEFT, padx=(5, 0))
        
        # Team B
        team_b_header = tk.Frame(right)
        team_b_header.grid(row=0, column=2, sticky="ew")
        team_b_header.grid_columnconfigure(0, weight=1)
        tk.Entry(team_b_header, textvariable=self.team_names["B"], justify="center").pack(fill=tk.X, expand=True)
        strength_frame_B = tk.Frame(team_b_header)
        strength_frame_B.pack()
        tk.Label(strength_frame_B, textvariable=self.roster_strength_vars["B"], font=("Arial", 8)).pack(side=tk.LEFT)
        tk.Label(strength_frame_B, textvariable=self.win_chance_vars["B"], font=("Arial", 8)).pack(side=tk.LEFT, padx=(5, 0))


        self.list_a = tk.Listbox(right, selectmode=tk.SINGLE, width=25, exportselection=False)
        self.list_b = tk.Listbox(right, selectmode=tk.SINGLE, width=25, exportselection=False)
        self.list_a.grid(row=1, column=0, rowspan=4, sticky="nsew")
        self.list_b.grid(row=1, column=2, rowspan=4, sticky="nsew")

        tctl = tk.Frame(right)
        tctl.grid(row=1, column=1, sticky="n")
        tk.Button(tctl, text="← Move", command=lambda: self.move_between_teams("B", "A")).pack(fill=tk.X)
        tk.Button(tctl, text="Move →", command=lambda: self.move_between_teams("A", "B")).pack(fill=tk.X, pady=(2, 0))
        tk.Button(tctl, text="Remove", command=self.remove_from_team).pack(fill=tk.X, pady=(10, 0))
        tk.Button(tctl, text="Map Stats", command=self.show_map_stats).pack(fill=tk.X, pady=(2,0))
        tk.Button(tctl, text="Export Data", command=self.export_data).pack(fill=tk.X, pady=(30, 0))
        tk.Button(tctl, text="Points Table", command=self.show_points_table).pack(fill=tk.X, pady=(2,0)) # New Button
        tk.Button(tctl, text="Casualties", command=self.show_casualties_table).pack(fill=tk.X, pady=(2,0))
        tk.Button(tctl, text="Team Heatmap", command=self.show_heatmap_stats).pack(fill=tk.X, pady=(2, 0))
        tk.Button(tctl, text="Opponent Heatmap", command=self.show_opponent_heatmap_stats).pack(fill=tk.X, pady=(2, 0))
        self.balancer_button = tk.Button(tctl, text="Balancer", command=self.open_balancer_window, state=tk.DISABLED)
        self.balancer_button.pack(fill=tk.X, pady=(2, 0))
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
        
        # --- Map Selection UI ---
        map_frame = tk.Frame(right, pady=5)
        map_frame.grid(row=2, column=2, sticky="ew", padx=(10,0)) # Next to round winners
        tk.Label(map_frame, text="R1 Map:").pack(side=tk.LEFT)
        self.r1_map_menu = tk.OptionMenu(map_frame, self.round1_map_var, "", *self.get_all_maps(), command=lambda v: self.set_round_map(1, v))
        self.r1_map_menu.pack(side=tk.LEFT, expand=True, fill=tk.X)
        
        map_frame2 = tk.Frame(right, pady=5)
        map_frame2.grid(row=3, column=2, sticky="ew", padx=(10,0)) # Next to round winners
        tk.Label(map_frame2, text="R2 Map:").pack(side=tk.LEFT)
        self.r2_map_menu = tk.OptionMenu(map_frame2, self.round2_map_var, "", *self.get_all_maps(), command=lambda v: self.set_round_map(2, v))
        self.r2_map_menu.pack(side=tk.LEFT, expand=True, fill=tk.X)
        
        tk.Checkbutton(map_frame, text="Flipped", variable=self.round1_flipped_var, command=lambda: self.set_round_flipped(1, self.round1_flipped_var.get())).pack(side=tk.LEFT)
        tk.Checkbutton(map_frame2, text="Flipped", variable=self.round2_flipped_var, command=lambda: self.set_round_flipped(2, self.round2_flipped_var.get())).pack(side=tk.LEFT)
        
        # --- Casualties Frame ---
        casualties_frame = tk.Frame(right, pady=5)
        casualties_frame.grid(row=4, column=1, sticky="ew", pady=(10,0))
        
        tk.Label(casualties_frame, text="R1 Casualties - A:").grid(row=0, column=0, sticky="w")
        tk.Entry(casualties_frame, textvariable=self.r1_casualties_A_var, width=5).grid(row=0, column=1)
        tk.Label(casualties_frame, text="R1 Casualties - B:").grid(row=1, column=0, sticky="w")
        tk.Entry(casualties_frame, textvariable=self.r1_casualties_B_var, width=5).grid(row=1, column=1)
        
        tk.Label(casualties_frame, text="R2 Casualties - A:").grid(row=2, column=0, sticky="w")
        tk.Entry(casualties_frame, textvariable=self.r2_casualties_A_var, width=5).grid(row=2, column=1)
        tk.Label(casualties_frame, text="R2 Casualties - B:").grid(row=3, column=0, sticky="w")
        tk.Entry(casualties_frame, textvariable=self.r2_casualties_B_var, width=5).grid(row=3, column=1)

        # Bind casualty updates
        self.r1_casualties_A_var.trace_add("write", lambda *_: self.set_casualties('r1_casualties_A', self.r1_casualties_A_var.get()))
        self.r1_casualties_B_var.trace_add("write", lambda *_: self.set_casualties('r1_casualties_B', self.r1_casualties_B_var.get()))
        self.r2_casualties_A_var.trace_add("write", lambda *_: self.set_casualties('r2_casualties_A', self.r2_casualties_A_var.get()))
        self.r2_casualties_B_var.trace_add("write", lambda *_: self.set_casualties('r2_casualties_B', self.r2_casualties_B_var.get()))


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

        # --- Playoffs Checkbox ---
        playoffs_frame = tk.Frame(right)
        playoffs_frame.grid(row=6, column=1, pady=(10,0)) # Adjusted row
        tk.Checkbutton(playoffs_frame, text="Playoffs Week", variable=self.playoffs_var, command=self.toggle_playoffs_mode).pack()

        # --- Playoffs Lead Selection UI (initially hidden) ---
        self.playoffs_lead_frame = tk.Frame(right)
        self.playoffs_lead_frame.grid(row=5, column=0, columnspan=3, sticky="ew", pady=(5,0))
        self.playoffs_lead_frame.grid_remove() # Hide it initially

        # R1 Leads
        tk.Label(self.playoffs_lead_frame, text="R1 Lead A:").grid(row=0, column=0, sticky="w")
        self.lead_A_r1_menu = tk.OptionMenu(self.playoffs_lead_frame, self.lead_A_r1_var, "", command=lambda v: self.set_lead_unit("A_r1", v))
        self.lead_A_r1_menu.grid(row=0, column=1, sticky="ew")
        tk.Label(self.playoffs_lead_frame, text="R1 Lead B:").grid(row=0, column=2, sticky="w", padx=(10,0))
        self.lead_B_r1_menu = tk.OptionMenu(self.playoffs_lead_frame, self.lead_B_r1_var, "", command=lambda v: self.set_lead_unit("B_r1", v))
        self.lead_B_r1_menu.grid(row=0, column=3, sticky="ew")
        
        # R2 Leads
        tk.Label(self.playoffs_lead_frame, text="R2 Lead A:").grid(row=1, column=0, sticky="w")
        self.lead_A_r2_menu = tk.OptionMenu(self.playoffs_lead_frame, self.lead_A_r2_var, "", command=lambda v: self.set_lead_unit("A_r2", v))
        self.lead_A_r2_menu.grid(row=1, column=1, sticky="ew")
        tk.Label(self.playoffs_lead_frame, text="R2 Lead B:").grid(row=1, column=2, sticky="w", padx=(10,0))
        self.lead_B_r2_menu = tk.OptionMenu(self.playoffs_lead_frame, self.lead_B_r2_var, "", command=lambda v: self.set_lead_unit("B_r2", v))
        self.lead_B_r2_menu.grid(row=1, column=3, sticky="ew")

        self.playoffs_lead_frame.grid_columnconfigure(1, weight=1)
        self.playoffs_lead_frame.grid_columnconfigure(3, weight=1)


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
            "name": f"Week {len(self.season) + 1}",
            "A": set(),
            "B": set(),
            "round1_winner": None,
            "round2_winner": None,
            "lead_A": None,
            "lead_B": None,
            "playoffs": False,
            "lead_A_r1": None, "lead_B_r1": None,
            "lead_A_r2": None, "lead_B_r2": None,
            "r1_casualties_A": 0, "r1_casualties_B": 0,
            "r2_casualties_A": 0, "r2_casualties_B": 0,
            "round1_map": None,
            "round2_map": None,
            "round1_flipped": False,
            "round2_flipped": False,
            "unit_player_counts": {},
            "weekly_casualties": {
                "USA": {"r1": {}, "r2": {}},
                "CSA": {"r1": {}, "r2": {}}
            } # New field for per-unit casualties
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
        for i, week in enumerate(self.season):
            # For backward compatibility with old save files
            week_name = week.get("name", f"Week {i + 1}")
            self.week_list.insert(tk.END, week_name)

    def start_rename_week(self, event):
        """Handles the double-click event on the week listbox to start renaming."""
        sel_idx_tuple = self.week_list.curselection()
        if not sel_idx_tuple:
            return
        sel_idx = sel_idx_tuple[0]

        # Get the bounding box of the item
        bbox = self.week_list.bbox(sel_idx)
        if not bbox:  # Item not visible
            return
        x, y, width, height = bbox

        # Create an Entry widget over the item
        entry = tk.Entry(self.week_list, bd=0, highlightthickness=1, font=self.week_list.cget("font"))
        entry.place(x=x, y=y, width=width, height=height)

        # Set initial text and select it
        original_name = self.week_list.get(sel_idx)
        entry.insert(0, original_name)
        entry.select_range(0, tk.END)
        entry.focus_set()

        def on_commit(e=None):
            new_name = entry.get().strip()
            entry.destroy()  # Clean up the entry widget
            if new_name and new_name != original_name:
                # Update data source
                self.season[sel_idx]['name'] = new_name
                # Refresh listbox and preserve selection
                self.refresh_week_list()
                self.week_list.selection_set(sel_idx)

        def on_cancel(e=None):
            entry.destroy()

        entry.bind("<Return>", on_commit)
        entry.bind("<FocusOut>", on_commit)
        entry.bind("<Escape>", on_cancel)

    def on_week_select(self, _=None):
        sel = self.week_list.curselection()
        if sel:
            self.current_week = self.season[sel[0]]
            self.balancer_button.config(state=tk.NORMAL)
            self.round1_winner_var.set(self.current_week.get("round1_winner") or "None")
            self.round2_winner_var.set(self.current_week.get("round2_winner") or "None")
            self.lead_A_var.set(self.current_week.get("lead_A") or "")
            self.lead_B_var.set(self.current_week.get("lead_B") or "")
            self.round1_map_var.set(self.current_week.get("round1_map") or "")
            self.round2_map_var.set(self.current_week.get("round2_map") or "")
            self.round1_flipped_var.set(self.current_week.get("round1_flipped", False))
            self.round2_flipped_var.set(self.current_week.get("round2_flipped", False))
            self.r1_casualties_A_var.set(self.current_week.get("r1_casualties_A", 0))
            self.r1_casualties_B_var.set(self.current_week.get("r1_casualties_B", 0))
            self.r2_casualties_A_var.set(self.current_week.get("r2_casualties_A", 0))
            self.r2_casualties_B_var.set(self.current_week.get("r2_casualties_B", 0))
            self.playoffs_var.set(self.current_week.get("playoffs", False))
            self.lead_A_r1_var.set(self.current_week.get("lead_A_r1") or "")
            self.lead_B_r1_var.set(self.current_week.get("lead_B_r1") or "")
            self.lead_A_r2_var.set(self.current_week.get("lead_A_r2") or "")
            self.lead_B_r2_var.set(self.current_week.get("lead_B_r2") or "")
        else:
            self.current_week = None
            self.balancer_button.config(state=tk.DISABLED)
            self.round1_winner_var.set("None")
            self.round2_winner_var.set("None")
            self.lead_A_var.set("")
            self.lead_B_var.set("")
            self.round1_map_var.set("")
            self.round2_map_var.set("")
            self.round1_flipped_var.set(False)
            self.round2_flipped_var.set(False)
            self.r1_casualties_A_var.set("0")
            self.r1_casualties_B_var.set("0")
            self.r2_casualties_A_var.set("0")
            self.r2_casualties_B_var.set("0")
            self.playoffs_var.set(False)
            self.lead_A_r1_var.set("")
            self.lead_B_r1_var.set("")
            self.lead_A_r2_var.set("")
            self.lead_B_r2_var.set("")

        self.toggle_playoffs_mode(update_data=False) # Update UI based on loaded data
        self.refresh_team_lists()
        self.refresh_units_list()
        self.calculate_and_display_roster_strength()

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
            display_text = f"*{u}" if u in self.non_token_units else u
            self.units_list.insert(tk.END, display_text)

    # ------------------------------------------------------------------
    # Roster editing
    def move_unit_from_units(self, team: str):
        if not self.current_week:
            messagebox.showwarning("No week selected", "Select a week first.")
            return
        sel = self.units_list.curselection()
        if not sel:
            return
        unit = self.units_list.get(sel[0]).lstrip("*")
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

    def toggle_non_token_status(self, event):
        """Toggles the non-token status of the selected unit on middle-click."""
        # Find the item under the cursor
        sel_idx = self.units_list.nearest(event.y)
        if sel_idx == -1:
            return

        # It's better to get the value from the listbox directly
        unit_name = self.units_list.get(sel_idx).lstrip("*")

        if unit_name in self.non_token_units:
            self.non_token_units.discard(unit_name)
        else:
            self.non_token_units.add(unit_name)

        # Refresh to show visual change, but preserve selection
        current_selection = self.units_list.curselection()
        self.refresh_units_list()
        if current_selection:
            # If the clicked item was selected, re-select it
            if sel_idx == current_selection[0]:
                 self.units_list.selection_set(sel_idx)
                 self.units_list.activate(sel_idx)

    def _place_unit(self, team: str, unit: str):
        other = "B" if team == "A" else "A"
        self.current_week[team].add(unit)
        self.current_week[other].discard(unit)
        self.refresh_team_lists()
        self.refresh_units_list()
        self.calculate_and_display_roster_strength()

    def refresh_team_lists(self):
        self.list_a.delete(0, tk.END)
        self.list_b.delete(0, tk.END)
        if not self.current_week:
            return

        # Calculate Elo and TII up to the week *before* the current one
        current_week_idx = self.season.index(self.current_week)
        previous_week_idx = current_week_idx - 1
        
        initial_rating = int(self.elo_system_values["initial_elo"].get())
        if previous_week_idx < 0:
            elo_ratings = defaultdict(lambda: initial_rating)
            tii_stats = {}
        else:
            try:
                elo_ratings, _ = self.calculate_elo_ratings(max_week_index=previous_week_idx)
                tii_stats, _ = self.calculate_teammate_impact(max_week_index=previous_week_idx)
            except Exception:
                elo_ratings = defaultdict(lambda: initial_rating)
                tii_stats = {}

        # Helper to format and insert text
        def insert_unit_with_stats(listbox, unit_name):
            elo = elo_ratings.get(unit_name, initial_rating)
            tii_data = tii_stats.get(unit_name, {})
            tii = tii_data.get('adjusted_tii_score', 0) if tii_data else 0

            asterisk = "*" if unit_name in self.non_token_units else ""
            display_text = f"{asterisk}{unit_name} | TII: {tii:.2f} | Elo: {elo:.0f}"
            listbox.insert(tk.END, display_text)

        for u in sorted(self.current_week["A"]):
            insert_unit_with_stats(self.list_a, u)
        for u in sorted(self.current_week["B"]):
            insert_unit_with_stats(self.list_b, u)
            
        self.update_lead_menus()
        self.calculate_and_display_roster_strength()

    def update_lead_menus(self):
        """Updates the lead unit OptionMenus based on current_week team rosters."""
        # Regular season leads
        for team_id, lead_var, lead_menu in [("A", self.lead_A_var, self.lead_A_menu),
                                             ("B", self.lead_B_var, self.lead_B_menu)]:
            self._update_single_lead_menu(team_id, lead_var, lead_menu, f"lead_{team_id}")

        # Playoffs leads
        for team_id, lead_var, lead_menu in [("A", self.lead_A_r1_var, self.lead_A_r1_menu),
                                             ("B", self.lead_B_r1_var, self.lead_B_r1_menu)]:
            self._update_single_lead_menu(team_id, lead_var, lead_menu, f"lead_{team_id}_r1")
        
        for team_id, lead_var, lead_menu in [("A", self.lead_A_r2_var, self.lead_A_r2_menu),
                                             ("B", self.lead_B_r2_var, self.lead_B_r2_menu)]:
            self._update_single_lead_menu(team_id, lead_var, lead_menu, f"lead_{team_id}_r2")


    def _update_single_lead_menu(self, team_id: str, lead_var: tk.StringVar, lead_menu: tk.OptionMenu, lead_key: str):
        """Helper to update one lead menu."""
        menu = lead_menu["menu"]
        menu.delete(0, tk.END)
        
        current_lead = None
        options = [""] # Start with a blank option
        if self.current_week and self.current_week.get(team_id):
            options.extend(sorted(list(self.current_week[team_id])))
            current_lead = self.current_week.get(lead_key)

        # Determine the correct callback based on the lead_key
        callback_team_id = team_id
        if "_r1" in lead_key: callback_team_id += "_r1"
        elif "_r2" in lead_key: callback_team_id += "_r2"

        for option in options:
            menu.add_command(label=option, command=tk._setit(lead_var, option, lambda v=option, t=callback_team_id: self.set_lead_unit(t, v)))
        
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
        
    def set_round_map(self, round_num: int, map_name: str):
        if not self.current_week: return
        actual_map = map_name if map_name else None
        if round_num == 1:
            self.current_week["round1_map"] = actual_map
        elif round_num == 2:
            self.current_week["round2_map"] = actual_map
    
    def set_round_flipped(self, round_num: int, flipped: bool):
        if not self.current_week: return
        if round_num == 1:
            self.current_week["round1_flipped"] = flipped
        elif round_num == 2:
            self.current_week["round2_flipped"] = flipped
    
    def set_lead_unit(self, team_id_key: str, unit_name: str):
        if not self.current_week: return
        actual_unit = unit_name if unit_name else None # Store None if blank

        # Determine the actual team ('A' or 'B') from the key ('A_r1', 'B_r2', etc.)
        base_team_id = team_id_key[0]
        
        # Ensure the selected unit is actually on the team for the current week
        if actual_unit and self.current_week and actual_unit not in self.current_week.get(base_team_id, set()):
            # This case should ideally not happen if OptionMenu is populated correctly
            # but as a safeguard, reset it.
            # We find the correct variable to reset based on the team_id_key
            var_to_reset = {
                "A": self.lead_A_var, "B": self.lead_B_var,
                "A_r1": self.lead_A_r1_var, "B_r1": self.lead_B_r1_var,
                "A_r2": self.lead_A_r2_var, "B_r2": self.lead_B_r2_var
            }.get(team_id_key)
            if var_to_reset:
                var_to_reset.set(self.current_week.get(f"lead_{team_id_key}") or "")
            return

        # Map the team_id_key to the correct dictionary key in self.current_week
        lead_storage_key = f"lead_{team_id_key}"
        self.current_week[lead_storage_key] = actual_unit
        # print(f"Set lead for key {lead_storage_key} to {actual_unit} for week {self.week_list.curselection()}")

    def toggle_playoffs_mode(self, update_data=True):
        """Shows/hides lead selection frames based on playoffs checkbox."""
        if self.current_week and update_data:
            self.current_week["playoffs"] = self.playoffs_var.get()

        if self.playoffs_var.get():
            # Hide regular lead frames, show playoff lead frames
            for child in [self.lead_A_menu, self.lead_B_menu]:
                child.master.grid_remove()
            self.playoffs_lead_frame.grid()
        else:
            # Show regular lead frames, hide playoff lead frames
            for child in [self.lead_A_menu, self.lead_B_menu]:
                child.master.grid()
            self.playoffs_lead_frame.grid_remove()

    def get_all_maps(self):
        """Returns a flat list of all map names."""
        all_maps = []
        for map_group in maps.values():
            all_maps.extend(map_group)
        return sorted(all_maps)

    # ------------------------------------------------------------------
    # Stats
    def set_casualties(self, key: str, value: str):
        if not self.current_week: return
        try:
            # Try to convert to int, default to 0 if empty or invalid
            self.current_week[key] = int(value) if value else 0
        except ValueError:
            # If text is not a valid integer, you might want to reset it
            # or show an error. For now, we'll just ignore non-integer input
            # and keep the old value.
            pass # Or reset the variable: self.r1_casualties_A_var.set(self.current_week.get(key, 0))

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
    
    def calculate_min_max(self, data):
        """Calculates the minimum and maximum values from a list of numbers."""
        if not data:
            return 0, 0
        return min(data), max(data)

    def calculate_average(self, data):
        """Calculates the average of a list of numbers."""
        if not data:
            return 0
        return statistics.mean(data)

    def calculate_std_dev(self, data):
        """Calculates the standard deviation of a list of numbers."""
        if len(data) < 2:
            return 0
        return statistics.stdev(data)

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

    def calculate_points(self, max_week_index: int | None = None) -> defaultdict[str, dict]:
        """
        Calculates points and win/loss stats for units based on the user-configured point system.
        If max_week_index is provided, calculates points up to and including that week index.
        Otherwise, calculates for the entire season.
        Returns a dict where keys are unit names and values are dicts with stats.
        """
        stats = defaultdict(lambda: {"points": 0, "lw": 0, "ll": 0, "aw": 0, "al": 0})

        def get_point_value(key: str, default_val: int = 0) -> int:
            try:
                if key in self.point_system_values:
                    val_str = self.point_system_values[key].get()
                    return int(val_str) if val_str and val_str.strip() else default_val
                return default_val
            except ValueError:
                return default_val

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
            is_playoffs = week_data.get("playoffs", False)
            team_A_units = week_data.get("A", set())
            team_B_units = week_data.get("B", set())
            r1_winner = week_data.get("round1_winner")
            r2_winner = week_data.get("round2_winner")

            # Determine leads for each round
            leads = {
                1: {"A": week_data.get("lead_A_r1") if is_playoffs else week_data.get("lead_A"),
                    "B": week_data.get("lead_B_r1") if is_playoffs else week_data.get("lead_B")},
                2: {"A": week_data.get("lead_A_r2") if is_playoffs else week_data.get("lead_A"),
                    "B": week_data.get("lead_B_r2") if is_playoffs else week_data.get("lead_B")}
            }

            for round_num, winner in [(1, r1_winner), (2, r2_winner)]:
                if not winner:
                    continue

                lead_A = leads[round_num]["A"]
                lead_B = leads[round_num]["B"]
                
                winning_team_units, losing_team_units = (team_A_units, team_B_units) if winner == "A" else (team_B_units, team_A_units)
                winning_lead, losing_lead = (lead_A, lead_B) if winner == "A" else (lead_B, lead_A)

                # Handle winning team
                if winning_lead and winning_lead in winning_team_units:
                    if not is_playoffs: stats[winning_lead]["points"] += pts_win_lead
                    stats[winning_lead]["lw"] += 1
                for unit in winning_team_units:
                    if unit != winning_lead:
                        if not is_playoffs: stats[unit]["points"] += pts_win_assist
                        stats[unit]["aw"] += 1
                
                # Handle losing team
                if losing_lead and losing_lead in losing_team_units:
                    if not is_playoffs: stats[losing_lead]["points"] += pts_loss_lead
                    stats[losing_lead]["ll"] += 1
                for unit in losing_team_units:
                    if unit != losing_lead:
                        if not is_playoffs: stats[unit]["points"] += pts_loss_assist
                        stats[unit]["al"] += 1

            # --- Bonus for 2-0 week (only for non-playoff weeks) ---
            if not is_playoffs and r1_winner and r1_winner == r2_winner:
                winning_team_units = team_A_units if r1_winner == "A" else team_B_units
                winning_team_lead = leads[1]["A"] if r1_winner == "A" else leads[1]["B"] # Use R1 lead for consistency
                
                for unit in winning_team_units:
                    if unit == winning_team_lead and winning_team_lead in winning_team_units:
                        stats[unit]["points"] += pts_bonus_2_0_lead
                    elif unit != winning_team_lead:
                        stats[unit]["points"] += pts_bonus_2_0_assist
        
        return stats

    def get_unit_average_player_count(self, unit_name: str, max_week_index: int | None = None) -> float:
        """
        Calculates the average number of players a unit brings across all weeks they participated in,
        up to a given max_week_index, using week-specific data if available.
        If a week's data is missing, it's skipped. Defaults to 0 if no data exists.
        """
        weeks_to_process = self.season
        if max_week_index is not None:
            weeks_to_process = self.season[:max_week_index + 1]

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
        
    def calculate_teammate_impact(self, max_week_index: int | None = None):
        """
        Calculates multiple Teammate Impact metrics:
        1. Original TII based on average loss rate of teammates.
        2. Impact as a Lead unit (unit's win rate when leading).
        3. Impact as an Assist unit (unit's win rate when not leading).
        """
        weeks_to_process = self.season
        if max_week_index is not None and 0 <= max_week_index < len(self.season):
            weeks_to_process = self.season[:max_week_index + 1]

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
            all_unit_avg_players = [self.get_unit_average_player_count(u, max_week_index) for u in participating_units]
            league_avg_players = statistics.mean(all_unit_avg_players) if all_unit_avg_players else 0 # Default to 0 if no one played

            unit_avg_players = self.get_unit_average_player_count(unit_u, max_week_index)
            
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

    def show_points_table(self):
        if not self.season:
            messagebox.showinfo("Points Table", "No season data available.")
            return
        if not self.units:
            messagebox.showinfo("Points Table", "No units defined.")
            return

        sel = self.week_list.curselection()
        selected_week_idx = sel[0] if sel else len(self.season) - 1
        week_number = selected_week_idx + 1

        win = tk.Toplevel(self.master)
        win.title(f"Week {week_number} Points")
        win.geometry("900x500")
        win.minsize(750, 400)

        cols = ["unit", "total_pts", "rank", "delta", "base_pts", "manual_adj", "lw", "ll", "aw", "al"]
        col_names = {
            "unit": "Unit", "total_pts": "Total Pts", "rank": "Rank", "delta": "Rank Δ",
            "base_pts": "Base Pts", "manual_adj": "Manual Adj",
            "lw": "L-Wins", "ll": "L-Loss", "aw": "A-Wins", "al": "A-Loss"
        }

        tree_frame = ttk.Frame(win)
        tree_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        tree = ttk.Treeview(tree_frame, columns=cols, show="headings")
        
        for col_id in cols:
            tree.heading(col_id, text=col_names[col_id], command=lambda c=col_id: self.sort_column(tree, c, False))
            tree.column(col_id, width=70, anchor=tk.CENTER)
        tree.column("unit", width=150, anchor=tk.W)
        tree.column("total_pts", width=70, anchor=tk.CENTER)
        tree.column("base_pts", width=70, anchor=tk.CENTER)
        tree.column("manual_adj", width=80, anchor=tk.CENTER)
        tree.column("rank", width=50, anchor=tk.CENTER)
        tree.column("delta", width=60, anchor=tk.CENTER)
        
        # --- Bottom Frame for Buttons ---
        bottom_frame = ttk.Frame(win)
        bottom_frame.pack(fill=tk.X, padx=10, pady=(0, 10))

        projections_button = ttk.Button(bottom_frame, text="Season Projections", command=lambda: self.show_projections_ui(win, self.group_view_enabled.get()))
        projections_button.pack(side=tk.LEFT, pady=(5,0))

        tii_button = ttk.Button(bottom_frame, text="Teammate Impact Index", command=self.show_tii_table)
        tii_button.pack(side=tk.LEFT, padx=(10, 0), pady=(5,0))

        elo_button = ttk.Button(bottom_frame, text="Elo Calculator", command=self.show_elo_calculator)
        elo_button.pack(side=tk.LEFT, padx=(10, 0), pady=(5,0))
        # --- Grouping Button ---
        self.group_view_enabled = tk.BooleanVar(value=False)
        
        def toggle_group_view():
            self.group_view_enabled.set(not self.group_view_enabled.get())
            redraw_table()

        group_button = ttk.Button(bottom_frame, text="Group Standings", command=toggle_group_view)
        # Only show the button if there is division data
        if self.divisions:
            group_button.pack(side=tk.LEFT, padx=(10, 0), pady=(5,0))


        def redraw_table():
            # Clear existing items
            for item in tree.get_children():
                tree.delete(item)

            # --- Data Preparation ---
            current_week_idx = selected_week_idx
            if current_week_idx < 0:
                return # Nothing to draw

            base_stats_data = self.calculate_points(max_week_index=current_week_idx)

            # Combine with manual points to get total points for sorting and display
            all_units_stats = []
            for unit in self.units:
                if unit in self.non_token_units: continue
                base_stats = base_stats_data.get(unit, {"points": 0, "lw": 0, "ll": 0, "aw": 0, "al": 0})
                manual_adj = self.manual_point_adjustments.get(unit, 0)
                all_units_stats.append({
                    "unit": unit,
                    "base_pts": base_stats["points"],
                    "manual_adj": manual_adj,
                    "total_pts": base_stats["points"] + manual_adj,
                    "lw": base_stats["lw"], "ll": base_stats["ll"],
                    "aw": base_stats["aw"], "al": base_stats["al"],
                })

            sorted_current_week_units = sorted(all_units_stats, key=lambda item: (-item["total_pts"], item["unit"]))
            
            current_ranks = {item["unit"]: rank for rank, item in enumerate(sorted_current_week_units, 1)}

            # Calculate previous week's ranks including manual adjustments for accurate delta
            previous_week_ranks = {}
            if current_week_idx > 0:
                prev_stats_data = self.calculate_points(max_week_index=current_week_idx - 1)
                prev_total_points_list = []
                for unit in self.units:
                    if unit in self.non_token_units: continue
                    base_pts = prev_stats_data.get(unit, {}).get("points", 0)
                    manual_adj = self.manual_point_adjustments.get(unit, 0)
                    prev_total_points_list.append({"unit": unit, "total_pts": base_pts + manual_adj})
                
                sorted_prev_week_units = sorted(prev_total_points_list, key=lambda item: (-item["total_pts"], item["unit"]))
                previous_week_ranks = {item["unit"]: rank for rank, item in enumerate(sorted_prev_week_units, 1)}

            # --- Populate Treeview ---
            if self.group_view_enabled.get():
                # --- Grouped (Division) View ---
                group_button.config(text="Overall Standings") # Update button text
                all_units_by_division = {u for div in self.divisions for u in div.get("units", [])}
                
                for division in self.divisions:
                    division_name = division.get("name", "Unnamed Division")
                    division_units = set(division.get("units", []))
                    
                    # Create a collapsible header for the division with a custom tag
                    division_id = tree.insert("", tk.END, text=division_name, open=True, values=(f"--- {division_name} ---", "", "", "", "", "", "", "", "", ""), tags=('division_header',))

                    # Filter stats for units in the current division
                    division_stats = [s for s in all_units_stats if s["unit"] in division_units]
                    
                    # Sort and rank within the division
                    sorted_division_units = sorted(division_stats, key=lambda item: (-item["total_pts"], item["unit"]))
                    
                    # Calculate previous week's ranks for this division specifically
                    previous_week_division_ranks = {}
                    if current_week_idx > 0:
                        prev_stats_data = self.calculate_points(max_week_index=current_week_idx - 1)
                        prev_division_stats = []
                        for unit_in_div in division_units:
                            if unit_in_div in self.non_token_units: continue
                            base_pts = prev_stats_data.get(unit_in_div, {}).get("points", 0)
                            manual_adj = self.manual_point_adjustments.get(unit_in_div, 0)
                            prev_division_stats.append({"unit": unit_in_div, "total_pts": base_pts + manual_adj})
                        
                        sorted_prev_division_units = sorted(prev_division_stats, key=lambda item: (-item["total_pts"], item["unit"]))
                        previous_week_division_ranks = {item["unit"]: rank for rank, item in enumerate(sorted_prev_division_units, 1)}

                    for rank_in_div, stats in enumerate(sorted_division_units, 1):
                        unit_name = stats["unit"]
                        total_pts, base_pts, manual_adj = stats["total_pts"], stats["base_pts"], stats["manual_adj"]
                        lw, ll, aw, al = stats["lw"], stats["ll"], stats["aw"], stats["al"]

                        delta_display = "-"
                        prev_rank = previous_week_division_ranks.get(unit_name)
                        if prev_rank is not None:
                            change = prev_rank - rank_in_div
                            if change > 0: delta_display = f"↑{change}"
                            elif change < 0: delta_display = f"↓{abs(change)}"
                            else: delta_display = "↔0"
                        
                        tree.insert(division_id, tk.END, values=(unit_name, total_pts, rank_in_div, delta_display, base_pts, manual_adj, lw, ll, aw, al))

            else:
                # --- Overall (Default) View ---
                group_button.config(text="Group Standings") # Reset button text
                for stats in sorted_current_week_units:
                    unit_name = stats["unit"]
                    rank = current_ranks.get(unit_name, "-")
                    total_pts, base_pts, manual_adj = stats["total_pts"], stats["base_pts"], stats["manual_adj"]
                    lw, ll, aw, al = stats["lw"], stats["ll"], stats["aw"], stats["al"]
                    
                    delta_display = "-"
                    prev_rank = previous_week_ranks.get(unit_name)
                    if prev_rank is not None and rank != "-":
                        change = prev_rank - rank
                        if change > 0: delta_display = f"↑{change}"
                        elif change < 0: delta_display = f"↓{abs(change)}"
                        else: delta_display = "↔0"
                    
                    tree.insert("", tk.END, values=(unit_name, total_pts, rank, delta_display, base_pts, manual_adj, lw, ll, aw, al))

        def on_tree_double_click(event):
            item_id = tree.identify_row(event.y)
            column_id = tree.identify_column(event.x)
            
            # Check if the click is on the "Manual Adj" column
            if not item_id or tree.heading(column_id, "text") != "Manual Adj":
                return

            x, y, width, height = tree.bbox(item_id, column_id)
            
            # Get current value and unit name
            values = tree.item(item_id, "values")
            unit_name = values[0]
            current_adj = values[cols.index("manual_adj")]
            
            entry_var = tk.StringVar(value=current_adj)
            entry = ttk.Entry(tree, textvariable=entry_var, justify='center')
            entry.place(x=x, y=y, width=width, height=height)
            entry.focus_set()
            entry.select_range(0, tk.END)

            def on_entry_commit(event=None):
                new_value_str = entry_var.get()
                entry.destroy()
                try:
                    # Allow empty string to reset to 0
                    new_value = int(new_value_str) if new_value_str else 0
                    self.manual_point_adjustments[unit_name] = new_value
                    # If value becomes 0, remove it from dict to keep save file clean
                    if new_value == 0 and unit_name in self.manual_point_adjustments:
                        del self.manual_point_adjustments[unit_name]
                    redraw_table() # Redraw to reflect changes in totals and ranks
                except ValueError:
                    messagebox.showerror("Invalid Input", "Manual adjustment must be an integer.", parent=win)

            entry.bind("<FocusOut>", on_entry_commit)
            entry.bind("<Return>", on_entry_commit)
            entry.bind("<Escape>", lambda e: entry.destroy())

        # Scrollbars
        vsb = ttk.Scrollbar(tree_frame, orient="vertical", command=tree.yview)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        tree.configure(yscrollcommand=vsb.set)
        tree.pack(fill=tk.BOTH, expand=True)
        
        # Bindings & Initial Draw
        tree.bind("<Double-1>", on_tree_double_click)
        redraw_table()

    def show_tii_table(self):
        """Displays a table for the new Teammate Impact metrics."""
        if not self.season:
            messagebox.showinfo("Teammate Impact", "No season data available.")
            return

        sel = self.week_list.curselection()
        selected_week_idx = sel[0] if sel else len(self.season) - 1
        week_number = selected_week_idx + 1

        win = tk.Toplevel(self.master)
        win.title(f"Teammate Impact Index (Up to Week {week_number})")
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

        impact_data, global_avg_loss_rate = self.calculate_teammate_impact(max_week_index=selected_week_idx)

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
            
        # Scrollbar
        vsb = ttk.Scrollbar(win, orient="vertical", command=tree.yview)
        # --- Bottom Frame for Buttons ---
        bottom_frame = ttk.Frame(win)
        bottom_frame.pack(fill=tk.X, side=tk.BOTTOM, padx=10, pady=(5, 10))

        synergy_button = ttk.Button(bottom_frame, text="Roster Synergy Matrix", command=self.show_synergy_matrix)
        synergy_button.pack(side=tk.LEFT)
        explain_button = ttk.Button(bottom_frame, text="Explain Metrics", command=self.show_tii_explanations)
        explain_button.pack(side=tk.LEFT, padx=(10, 0))
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
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
        if not self.season:
            messagebox.showinfo("Roster Synergy Matrix", "No season data available.")
            return

        sel = self.week_list.curselection()
        selected_week_idx = sel[0] if sel else len(self.season) - 1
        week_number = selected_week_idx + 1

        win = tk.Toplevel(self.master)
        win.title(f"Roster Synergy Matrix (Up to Week {week_number})")
        win.geometry("900x700")

        # Main frame
        main_frame = ttk.Frame(win, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        notebook = ttk.Notebook(main_frame)
        notebook.pack(fill=tk.BOTH, expand=True)

        # Synergy Tab
        synergy_tab = ttk.Frame(notebook)
        notebook.add(synergy_tab, text="Synergy Matrix")
        
        synergy_data, best_lineups, worst_lineups = self.calculate_roster_synergy(max_week_index=selected_week_idx)

        if synergy_data:
            active_units = sorted(list(set(unit for pair in synergy_data.keys() for unit in pair)))
            
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

        attack_defense_stats = self.calculate_attack_defense_performance(max_week_index=selected_week_idx)

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
            
        # Most Likely to Win/Lose Tab
        likely_lineups_tab = ttk.Frame(notebook)
        notebook.add(likely_lineups_tab, text="Most Likely Lineups")
        
        # This frame will hold the buttons at the top
        top_button_frame = ttk.Frame(likely_lineups_tab, padding=(10, 10, 10, 0))
        top_button_frame.pack(fill=tk.X)

        # This frame will hold the results of the calculation
        results_display_frame = ttk.Frame(likely_lineups_tab, padding=(10, 0, 10, 10))
        results_display_frame.pack(fill=tk.BOTH, expand=True)

        # Add buttons to the top frame
        calc_button = ttk.Button(top_button_frame, text="Calculate Most Likely Lineups", command=lambda: self.calculate_most_likely_lineups(selected_week_idx, results_display_frame))
        calc_button.pack(side=tk.LEFT, padx=5)

        explain_button = ttk.Button(top_button_frame, text="Explain Calculation", command=self.show_lineup_explanation)
        explain_button.pack(side=tk.LEFT, padx=5)


    def show_lineup_explanation(self):
        """Displays a messagebox explaining the Most Likely Lineups calculation."""
        explanation = """
**Most Likely Lineups Calculation Explained:**

This tool identifies the strongest and weakest possible team compositions based on historical performance up to the selected week.

**1. Data Collection:**
- The system gathers three key metrics for every regiment that has participated:
    - **Win Rate:** The overall percentage of rounds won.
    - **Elo Rating:** A skill rating adjusted for strength of schedule.
    - **Adjusted TII:** The Teammate Impact Index, measuring a unit's effect on its teammates' success, weighted by player count.

**2. Average Team Player Count:**
- It calculates the average number of total players per team across all rounds played in the season so far. This determines the target player count for the generated lineups (e.g., 175 players).

**3. Lineup Generation (Subset Sum):**
- Using the average player count for each unit, the system finds all combinations of units whose total player counts are close to the target player count (within a certain tolerance). This is a variation of the "Subset Sum" or "Knapsack" problem.

**4. Power Score Calculation:**
- Each generated lineup is assigned a "Power Score".
- For each regiment in the lineup, its Win Rate, Elo, and TII are normalized to a common scale and combined using a weighted average:
    - **Win Rate: 40%**
    - **Elo Rating: 30%**
    - **Adjusted TII: 30%**
- The total Power Score for the lineup is the average of the individual power scores of its members.

**5. Ranking:**
- All generated lineups are ranked by their final Power Score. The "Most Likely to Win" list shows the lineups with the highest scores, and the "Most Likely to Lose" list shows those with the lowest.
"""
        messagebox.showinfo("Lineup Calculation Explained", explanation, parent=self.master)

    def calculate_roster_synergy(self, max_week_index: int | None = None):
        weeks_to_process = self.season
        if max_week_index is not None and 0 <= max_week_index < len(self.season):
            weeks_to_process = self.season[:max_week_index + 1]

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
        best_lineups = [(r, wr, g) for r, (wr, g) in sorted_lineups[:5]]
        worst_lineups = sorted([(r, wr, g) for r, (wr, g) in sorted_lineups[-5:]], key=lambda x: x[1])


        return synergy_data, best_lineups, worst_lineups

    def calculate_most_likely_lineups(self, max_week_index, parent_frame):
        """Calculates and displays the most and least likely to win lineups."""
        # Clear only the results frame, not the buttons
        for widget in parent_frame.winfo_children():
            widget.destroy()

        # --- 1. GATHER DATA ---
        weeks_to_process = self.season[:max_week_index + 1]
        if not weeks_to_process:
            ttk.Label(parent_frame, text="Not enough historical data.").pack(pady=10)
            return

        # Get Elo, TII, and Win Rates
        elos, _ = self.calculate_elo_ratings(max_week_index=max_week_index)
        tii_stats, _ = self.calculate_teammate_impact(max_week_index=max_week_index)
        
        # Calculate overall win rate for each unit
        unit_win_loss = defaultdict(lambda: {'wins': 0, 'games': 0})
        for week in weeks_to_process:
            for r_num in [1, 2]:
                winner = week.get(f"round{r_num}_winner")
                if not winner: continue
                
                team_a = week.get("A", set())
                team_b = week.get("B", set())
                winning_team = team_a if winner == "A" else team_b
                losing_team = team_b if winner == "A" else team_a

                for unit in winning_team:
                    unit_win_loss[unit]['wins'] += 1
                    unit_win_loss[unit]['games'] += 1
                for unit in losing_team:
                    unit_win_loss[unit]['games'] += 1

        unit_win_rates = {
            unit: (data['wins'] / data['games']) if data['games'] > 0 else 0
            for unit, data in unit_win_loss.items()
        }

        # --- 2. DETERMINE AVERAGE TEAM PLAYER COUNT ---
        total_players_per_team_per_week = []
        for week_idx, week in enumerate(weeks_to_process):
            team_a_units = week.get("A", set())
            team_b_units = week.get("B", set())
            
            if team_a_units:
                size_a = sum(self.get_unit_average_player_count(u, week_idx) for u in team_a_units)
                total_players_per_team_per_week.append(size_a)
            if team_b_units:
                size_b = sum(self.get_unit_average_player_count(u, week_idx) for u in team_b_units)
                total_players_per_team_per_week.append(size_b)

        if not total_players_per_team_per_week:
            ttk.Label(parent_frame, text="Not enough historical player data.").pack(pady=10)
            return
            
        avg_player_count_target = statistics.mean(total_players_per_team_per_week)
        
        participating_units = {
            unit: self.get_unit_average_player_count(unit, max_week_index)
            for unit, data in unit_win_loss.items()
            if data['games'] > 0 and self.get_unit_average_player_count(unit, max_week_index) > 0
        }

        # --- 3. GENERATE AND SCORE LINEUPS (KNAPSACK-LIKE APPROACH) ---
        # Find all combinations of units that are close to the target player count
        all_possible_lineups = self._find_lineups_for_player_target(participating_units, avg_player_count_target)
        if not all_possible_lineups:
            ttk.Label(parent_frame, text="Could not generate any valid lineups with the given units.").pack(pady=10)
            return

        scored_lineups = []
        for lineup in all_possible_lineups:
            power_score = self._calculate_lineup_power(lineup, elos, tii_stats, unit_win_rates)
            scored_lineups.append((lineup, power_score))
            
        # Sort lineups by power score
        scored_lineups.sort(key=lambda x: x[1], reverse=True)

        # --- 4. DISPLAY RESULTS ---
        results_frame = ttk.Frame(parent_frame)
        results_frame.pack(fill=tk.BOTH, expand=True, pady=10)
        results_frame.grid_columnconfigure(0, weight=1)
        results_frame.grid_columnconfigure(1, weight=1)
        
        win_frame = ttk.LabelFrame(results_frame, text=f"Most Likely to Win (Target Players: {avg_player_count_target:.0f})")
        win_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 5))
        
        lose_frame = ttk.LabelFrame(results_frame, text=f"Most Likely to Lose (Target Players: {avg_player_count_target:.0f})")
        lose_frame.grid(row=0, column=1, sticky="nsew", padx=(5, 0))

        # Display top 15 winning
        win_tree = ttk.Treeview(win_frame, columns=("roster", "score"), show="headings", selectmode="none")
        win_tree.heading("roster", text="Roster")
        win_tree.heading("score", text="Power Score")
        win_tree.column("roster", width=300)
        win_tree.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        for lineup, score in scored_lineups[:15]:
            win_tree.insert("", "end", values=(", ".join(lineup), f"{score:.2f}"))

        # Display bottom 15 losing
        lose_tree = ttk.Treeview(lose_frame, columns=("roster", "score"), show="headings", selectmode="none")
        lose_tree.heading("roster", text="Roster")
        lose_tree.heading("score", text="Power Score")
        lose_tree.column("roster", width=300)
        lose_tree.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        for lineup, score in scored_lineups[-15:][::-1]: # Show worst at top
            lose_tree.insert("", "end", values=(", ".join(lineup), f"{score:.2f}"))

    def _find_lineups_for_player_target(self, units_with_players, target, tolerance_percent=5):
        """
        Finds combinations of units whose total average player count is close to the target.
        This is a variation of the subset sum / knapsack problem.
        """
        items = list(units_with_players.items())
        n = len(items)
        # dp[i][j] will store combinations of first i items that sum to j
        dp = defaultdict(list)
        dp[0] = [[]] # Base case: sum of 0 is an empty set

        for i in range(n):
            unit_name, player_count = items[i]
            player_count = int(round(player_count))
            if player_count <= 0: continue

            # Iterate backwards to avoid using the same item multiple times in one combination
            for current_sum in sorted(dp.keys(), reverse=True):
                new_sum = current_sum + player_count
                for combo in dp[current_sum]:
                    dp[new_sum].append(combo + [unit_name])
        
        # Find all combinations within the tolerance of the target
        lower_bound = target * (1 - tolerance_percent / 100)
        upper_bound = target * (1 + tolerance_percent / 100)
        
        valid_lineups = []
        for s, combos in dp.items():
            if lower_bound <= s <= upper_bound:
                valid_lineups.extend(combos)
        
        # To avoid giant lists, we can limit the number of lineups
        # and prioritize those closer to the target
        valid_lineups.sort(key=lambda x: abs(sum(units_with_players[u] for u in x) - target))

        return valid_lineups[:5000] # Limit to a reasonable number of lineups


    def _calculate_lineup_power(self, lineup, elos, tii_stats, unit_win_rates):
        """Calculates a power score for a given lineup."""
        total_power = 0
        
        # Normalize Elo scores to a 0-1 scale for combination
        all_elo_values = [v for k, v in elos.items() if isinstance(v, (int, float))]
        min_elo, max_elo = (min(all_elo_values), max(all_elo_values)) if all_elo_values else (1500, 1500)
        
        # Normalize TII scores
        all_tii_values = [v['adjusted_tii_score'] for v in tii_stats.values() if v.get('assist_games',0) + v.get('lead_games',0) > 0]
        min_tii, max_tii = (min(all_tii_values), max(all_tii_values)) if all_tii_values else (0,1)

        for unit in lineup:
            # Win Rate (Weight: 0.4)
            win_rate_score = unit_win_rates.get(unit, 0)
            
            # Normalized Elo (Weight: 0.3)
            elo = elos.get(unit, 1500)
            norm_elo = (elo - min_elo) / (max_elo - min_elo) if max_elo > min_elo else 0.5

            # Normalized TII (Weight: 0.3)
            tii = tii_stats.get(unit, {}).get('adjusted_tii_score', 0)
            norm_tii = (tii - min_tii) / (max_tii - min_tii) if max_tii > min_tii else 0.5
            
            # Combine scores
            unit_power = (win_rate_score * 0.4) + (norm_elo * 0.3) + (norm_tii * 0.3)
            total_power += unit_power
            
        return total_power / len(lineup) if lineup else 0


    def calculate_attack_defense_performance(self, max_week_index: int | None = None):
        weeks_to_process = self.season
        if max_week_index is not None:
            weeks_to_process = self.season[:max_week_index + 1]

        unit_performance = defaultdict(lambda: {
            "attack_wins": 0, "attack_losses": 0,
            "defend_wins": 0, "defend_losses": 0
        })

        usa_attack_maps = {
            "East Woods Skirmish", "Nicodemus Hill", "Hooker's Push", "Bloody Lane",
            "Pry Ford", "Smith Field", "Alexander Farm", "Crossroads",
            "Wagon Road", "Hagertown Turnpike", "Pry Grist Mill", "Otto & Sherrick Farm",
            "Piper Farm", "West Woods", "Dunker Church", "Burnside Bridge",
            "Garland's Stand", "Cox's Push", "Hatch's Attack", "Colquitt's Defense",
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
        tree.configure(yscrollcommand=vsb.set)
        tree.pack(fill=tk.BOTH, expand=True)
    def calculate_casualties(self, max_week_index: int | None = None) -> tuple[defaultdict[str, int], defaultdict[str, int]]:
        """
        Calculates casualties inflicted and lost for each unit based on weekly attendance and death reports.
        Kills are distributed based on a weighted formula considering unit size, deaths, and a constant.
        """
        inflicted = defaultdict(int)
        lost = defaultdict(int)
        c = 5  # Constant for weight calculation, prevents division by zero

        weeks_to_process = self.season
        if max_week_index is not None:
            weeks_to_process = self.season[:max_week_index + 1]

        # First, aggregate all deaths for each unit across all relevant weeks
        for week in weeks_to_process:
            weekly_cas = week.get("weekly_casualties", {})
            team_a_name = self.team_names["A"].get()
            team_b_name = self.team_names["B"].get()

            for team_name in [team_a_name, team_b_name]:
                for round_key in ["r1", "r2"]:
                    cas_data = weekly_cas.get(team_name, {}).get(round_key, {})
                    for unit, deaths in cas_data.items():
                        if deaths >= 0:
                            lost[unit] += deaths
        
        # Now, iterate again to distribute kills based on the final death counts
        for week in weeks_to_process:
            week_idx = self.season.index(week)
            weekly_cas = week.get("weekly_casualties", {})
            if not weekly_cas:
                continue
            
            team_a_name = self.team_names["A"].get()
            team_b_name = self.team_names["B"].get()

            # Helper function to distribute kills
            def distribute_kills(total_deaths_inflicted, friendly_units_data, current_week_idx):
                if not friendly_units_data:
                    return

                # Create a list of dicts for easier processing
                regiments = []
                for unit, deaths in friendly_units_data.items():
                    avg_players = self.get_unit_average_player_count(unit, max_week_index=current_week_idx)
                    regiments.append({"name": unit, "men": avg_players, "deaths": lost.get(unit, 0)})

                # Step 1: Compute participation weights
                for r in regiments:
                    # Use the total deaths for the unit from the first pass
                    total_unit_deaths = r["deaths"]
                    r["weight"] = r["men"] * (total_unit_deaths / (total_unit_deaths + c)) if (total_unit_deaths + c) != 0 else 0


                # Step 2: Normalize weights
                total_weight = sum(r.get("weight", 0) for r in regiments)
                if total_weight == 0:  # Prevent division by zero if all weights are 0
                    if regiments:
                        # Fallback to even distribution if no weights could be calculated
                        kills_per_unit = total_deaths_inflicted / len(regiments)
                        for r in regiments:
                            inflicted[r["name"]] += kills_per_unit
                    return
                
                # Step 3: Assign kills
                for r in regiments:
                    est_kills = total_deaths_inflicted * (r["weight"] / total_weight)
                    inflicted[r["name"]] += est_kills

            # --- Round 1 ---
            usa_cas_r1 = {u: d for u, d in weekly_cas.get(team_a_name, {}).get("r1", {}).items() if d >= 0}
            csa_cas_r1 = {u: d for u, d in weekly_cas.get(team_b_name, {}).get("r1", {}).items() if d >= 0}
            total_usa_deaths_r1 = sum(usa_cas_r1.values())
            total_csa_deaths_r1 = sum(csa_cas_r1.values())
            
            distribute_kills(total_usa_deaths_r1, csa_cas_r1, week_idx)
            distribute_kills(total_csa_deaths_r1, usa_cas_r1, week_idx)

            # --- Round 2 ---
            usa_cas_r2 = {u: d for u, d in weekly_cas.get(team_a_name, {}).get("r2", {}).items() if d >= 0}
            csa_cas_r2 = {u: d for u, d in weekly_cas.get(team_b_name, {}).get("r2", {}).items() if d >= 0}
            total_usa_deaths_r2 = sum(usa_cas_r2.values())
            total_csa_deaths_r2 = sum(csa_cas_r2.values())
            
            distribute_kills(total_usa_deaths_r2, csa_cas_r2, week_idx)
            distribute_kills(total_csa_deaths_r2, usa_cas_r2, week_idx)

        return inflicted, lost

    def show_casualties_table(self):
        """Displays a table of casualties inflicted and lost by each lead unit, up to a selected week."""
        if not self.season:
            messagebox.showinfo("Casualty Report", "No season data available.")
            return
        if not self.units:
            messagebox.showinfo("Casualty Report", "No units defined.")
            return

        win = tk.Toplevel(self.master)
        win.title("Casualty Report")
        win.geometry("850x450")
        win.resizable(True, True)
        win.minsize(850, 300)

        # --- UI Elements ---
        top_frame = tk.Frame(win, padx=10, pady=10)
        top_frame.pack(fill=tk.X)

        week_selector_var = tk.StringVar()
        week_options = [f"Week {i+1}" for i in range(len(self.season))]
        
        # Default to the currently selected week in the main window, or the last week
        sel = self.week_list.curselection()
        default_week_index = sel[0] if sel else len(self.season) - 1
        if default_week_index < len(week_options):
            week_selector_var.set(week_options[default_week_index])

        tk.Label(top_frame, text="Show Stats Up To:").pack(side=tk.LEFT, padx=(0, 5))
        week_selector = ttk.Combobox(top_frame, textvariable=week_selector_var, values=week_options, state="readonly", width=15)
        week_selector.pack(side=tk.LEFT)

        bottom_frame = tk.Frame(win, padx=10, pady=5)
        bottom_frame.pack(fill=tk.X, side=tk.BOTTOM)

        tk.Button(bottom_frame, text="Input Weekly Casualties", command=self.open_weekly_casualty_input).pack(side=tk.LEFT)

        tree_frame = ttk.Frame(win)
        tree_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))

        cols = ["unit", "inflicted", "lost", "kd", "inflicted_per_game", "lost_per_game"]
        col_names = {
            "unit": "Unit", "inflicted": "Inflicted", "lost": "Lost", "kd": "K/D",
            "inflicted_per_game": "Inflicted/Game", "lost_per_game": "Lost/Game"
        }
        tree = ttk.Treeview(tree_frame, columns=cols, show="headings")

        for col_id in cols:
            tree.heading(col_id, text=col_names[col_id], command=lambda c=col_id: sort_column(c, False))
            tree.column(col_id, width=85, anchor=tk.CENTER)
        tree.column("unit", width=140, anchor=tk.W)

        vsb = ttk.Scrollbar(tree_frame, orient="vertical", command=tree.yview)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        tree.configure(yscrollcommand=vsb.set)
        tree.pack(fill=tk.BOTH, expand=True)

        # --- Data and Redraw Logic ---
        def redraw_table(selected_week_str: str):
            for item in tree.get_children():
                tree.delete(item)

            try:
                max_week_idx = int(selected_week_str.split(" ")[1]) - 1
            except (ValueError, IndexError):
                return # Should not happen with combobox

            win.title(f"Casualty Report (Up to Week {max_week_idx + 1})")

            inflicted, lost = self.calculate_casualties(max_week_index=max_week_idx)
            
            # Count games attended for each unit up to the selected week
            games_attended = defaultdict(int)
            for week_idx, week in enumerate(self.season):
                if week_idx > max_week_idx: break
                weekly_cas = week.get("weekly_casualties", {})
                team_a_name = self.team_names["A"].get()
                team_b_name = self.team_names["B"].get()
                
                # Check attendance for round 1
                r1_attended = set(weekly_cas.get(team_a_name, {}).get("r1", {}).keys()) | \
                              set(weekly_cas.get(team_b_name, {}).get("r1", {}).keys())
                for unit in r1_attended:
                    games_attended[unit] += 1
                
                # Check attendance for round 2
                r2_attended = set(weekly_cas.get(team_a_name, {}).get("r2", {}).keys()) | \
                              set(weekly_cas.get(team_b_name, {}).get("r2", {}).keys())
                for unit in r2_attended:
                    games_attended[unit] += 1

            table_data = []
            all_involved_units = set(inflicted.keys()) | set(lost.keys())
            for unit in sorted(list(all_involved_units)):
                inflicted_count = inflicted.get(unit, 0)
                lost_count = lost.get(unit, 0)
                games = games_attended.get(unit, 0)

                kd_ratio_val = inflicted_count / lost_count if lost_count > 0 else float('inf')
                kd_ratio_str = f"{kd_ratio_val:.2f}" if lost_count > 0 else "∞"

                inflicted_pg = f"{inflicted_count / games:.2f}" if games > 0 else "0.00"
                lost_pg = f"{lost_count / games:.2f}" if games > 0 else "0.00"

                table_data.append((unit, int(inflicted_count), lost_count, kd_ratio_str, inflicted_pg, lost_pg, kd_ratio_val))

            # Default sort by K/D
            table_data.sort(key=lambda x: x[6], reverse=True)

            for row_data in table_data:
                tree.insert("", tk.END, values=row_data[:-1]) # Exclude the raw K/D value used for sorting

        # --- Sorting Logic ---
        def sort_column(col, reverse):
            # Map column ID to data index and type
            sort_map = {
                "unit": (0, str), "inflicted": (1, int), "lost": (2, int),
                "kd": (6, float), # Use the hidden raw value for sorting
                "inflicted_per_game": (4, float), "lost_per_game": (5, float)
            }
            if col not in sort_map: return

            idx, sort_type = sort_map[col]
            
            # Grab data from tree, converting to appropriate type
            data = []
            for child in tree.get_children():
                val = tree.item(child, 'values')[idx]
                # Special handling for K/D string
                if col == 'kd':
                    if val == '∞': val = float('inf')
                    else: val = float(val)
                data.append((sort_type(val), child))

            data.sort(key=lambda t: t[0], reverse=reverse)

            for index, (val, child) in enumerate(data):
                tree.move(child, '', index)
            
            # Toggle sort direction for next click
            tree.heading(col, command=lambda: sort_column(col, not reverse))

        # --- Initial Setup and Bindings ---
        week_selector.bind("<<ComboboxSelected>>", lambda event: redraw_table(week_selector_var.get()))
        redraw_table(week_selector_var.get()) # Initial draw
    def sort_column(self, tree, col, reverse):
        """Generic treeview column sorting function."""
        try:
            # Get data from tree, converting to numeric type if possible
            data = []
            for child in tree.get_children(''):
                val = tree.item(child, 'values')[tree['columns'].index(col)]
                try:
                    # Attempt to convert to float for robust numeric sorting
                    num_val = float(val)
                    data.append((num_val, child))
                except (ValueError, TypeError):
                    # Keep as string if conversion fails
                    data.append((val, child))

            # Sort data
            data.sort(key=lambda t: t[0], reverse=reverse)

            # Rearrange items in tree
            for index, (val, child) in enumerate(data):
                tree.move(child, '', index)

            # Toggle sort direction for next click
            tree.heading(col, command=lambda: self.sort_column(tree, col, not reverse))
        except Exception as e:
            print(f"Error sorting column {col}: {e}")


    def export_data(self):
        """Exports season data to a CSV file."""
        path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
            title="Save Data Export"
        )
        if not path:
            return

        records = []
        header = ['Week', 'Unit', 'Team', 'Round', 'Map', 'Loss']
        
        for week_idx, week_data in enumerate(self.season):
            week_num = week_idx + 1
            
            # --- Round 1 ---
            winner_r1 = week_data.get("round1_winner")
            map_r1 = week_data.get("round1_map", "N/A")
            if winner_r1 and winner_r1 != "None":
                loser_r1 = 'B' if winner_r1 == 'A' else 'A'
                
                for unit in week_data.get(winner_r1, set()):
                    records.append([week_num, unit, self.team_names[winner_r1].get(), 1, map_r1, 0])
                
                for unit in week_data.get(loser_r1, set()):
                    records.append([week_num, unit, self.team_names[loser_r1].get(), 1, map_r1, 1])

            # --- Round 2 ---
            winner_r2 = week_data.get("round2_winner")
            map_r2 = week_data.get("round2_map", "N/A")
            if winner_r2 and winner_r2 != "None":
                loser_r2 = 'B' if winner_r2 == 'A' else 'A'

                for unit in week_data.get(winner_r2, set()):
                    records.append([week_num, unit, self.team_names[winner_r2].get(), 2, map_r2, 0])

                for unit in week_data.get(loser_r2, set()):
                    records.append([week_num, unit, self.team_names[loser_r2].get(), 2, map_r2, 1])

        # Now, calculate the total losses per unit from the records
        losses_per_unit = Counter()
        for record in records:
            if record[5] == 1: # if loss is 1
                losses_per_unit[record[1]] += 1

        # Write to CSV
        try:
            with open(path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                
                writer.writerow(['Losses by Unit (Binary)'])
                writer.writerow(header)
                writer.writerows(records)
                
                writer.writerow([])
                
                writer.writerow(['Total Losses per Unit'])
                writer.writerow(['Unit', 'Total Losses'])
                for unit, total_losses in sorted(losses_per_unit.items()):
                    writer.writerow([unit, total_losses])
                    
            messagebox.showinfo("Export Successful", f"Data exported to {path}")
        except IOError as e:
            messagebox.showerror("Export Error", f"Could not save file: {e}")

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
            # --- Teammate Interaction Stats ---
            interaction_counts = []
            processed_pairs = set()
            for unit1, teammates in teammate_stats.items():
                for unit2, count in teammates.items():
                    pair = tuple(sorted((unit1, unit2)))
                    if pair not in processed_pairs:
                        interaction_counts.append(count)
                        processed_pairs.add(pair)

            if interaction_counts:
                min_val, max_val = self.calculate_min_max(interaction_counts)
                avg_val = self.calculate_average(interaction_counts)
                std_dev = self.calculate_std_dev(interaction_counts)
                
                week_str = f"Week {max_week_idx + 1}" if max_week_idx is not None else "All Weeks"
                print(f"--- Teammate Interaction Stats for {week_str} ---")
                print(f"  Min Times Played Together: {min_val}")
                print(f"  Max Times Played Together: {max_val}")
                print(f"  Average Times Played Together: {avg_val:.2f}")
                print(f"  Standard Deviation of Times Played Together: {std_dev:.2f}")
                print("-------------------------------------------------")

            # Find max count for color scaling
            max_teammate_count = max(interaction_counts) if interaction_counts else 0
            
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
                    if found_cell_tag in cell_info_map:
                        unit1, unit2 = cell_info_map[found_cell_tag]
                        tooltip_text = format_tooltip_text_for_cell(unit1, unit2)
                        if not tooltip_text:
                            tooltip_label.place_forget()
                            return
                        tooltip_label.config(text=tooltip_text)
                        bbox = canvas.bbox(found_cell_tag)
                        if bbox:
                            canvas.create_rectangle(bbox, outline="blue", width=2, tags="highlight_rect")
                    else:
                        tooltip_label.place_forget()

                if found_cell_tag in cell_info_map:
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

    def show_map_stats(self):
        """Displays a window with statistics for each map."""
        stats_win = tk.Toplevel(self.master)
        stats_win.title("Map Statistics")
        stats_win.geometry("960x650") # Widened for new columns

        # List of maps where USA is the attacker
        usa_attack_maps = {
            "East Woods Skirmish", "Nicodemus Hill", "Hooker's Push", "Bloody Lane",
            "Pry Ford", "Smith Field", "Alexander Farm", "Crossroads",
            "Wagon Road", "Hagertown Turnpike", "Pry Grist Mill", "Otto & Sherrick Farm",
            "Piper Farm", "West Woods", "Dunker Church", "Burnside Bridge",
            "Garland's Stand", "Cox's Push", "Hatch's Attack", "Colquitt's Defense",
            "Flemming's Meadow", "Crossley Creek", "Confederate Encampment"
        }

        # --- Data Calculation ---
        map_stats = defaultdict(lambda: {
            "plays": 0,
            "usa_wins": 0, "csa_wins": 0,
            "attacker_wins": 0, "defender_wins": 0,
            "total_casualties": 0, "usa_casualties": 0, "csa_casualties": 0
        })
        
        overall_stats = {"attack_wins": 0, "defense_wins": 0, "total_plays": 0}

        for week in self.season:
            for r in [1, 2]:
                map_name = week.get(f"round{r}_map")
                winner = week.get(f"round{r}_winner")
                flipped = week.get(f"round{r}_flipped", False)
                if not map_name or winner is None:
                    continue

                stats = map_stats[map_name]
                stats["plays"] += 1
                overall_stats["total_plays"] += 1

                # Determine who is USA/CSA for this round
                usa_side = "A" if not flipped else "B"
                csa_side = "B" if not flipped else "A"

                # Determine who is Attacker/Defender for this map
                map_usa_is_attacker = map_name in usa_attack_maps
                attacker_side = usa_side if map_usa_is_attacker else csa_side
                defender_side = csa_side if map_usa_is_attacker else usa_side
                
                # Tally USA/CSA wins
                if winner == usa_side: stats["usa_wins"] += 1
                elif winner == csa_side: stats["csa_wins"] += 1

                # Tally Attacker/Defender wins
                if winner == attacker_side:
                    stats["attacker_wins"] += 1
                    overall_stats["attack_wins"] += 1
                elif winner == defender_side:
                    stats["defender_wins"] += 1
                    overall_stats["defense_wins"] += 1

                # Tally casualties
                cas_a = week.get(f"r{r}_casualties_A", 0)
                cas_b = week.get(f"r{r}_casualties_B", 0)
                usa_cas, csa_cas = (cas_a, cas_b) if not flipped else (cas_b, cas_a)
                stats["usa_casualties"] += usa_cas
                stats["csa_casualties"] += csa_cas
                stats["total_casualties"] += usa_cas + csa_cas

        # --- UI Setup ---
        main_frame = tk.Frame(stats_win)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        tree_frame = ttk.Frame(main_frame)
        tree_frame.pack(fill=tk.BOTH, expand=True)

        cols = ["map", "plays", "att_win", "att_win_pct", "def_win", "def_win_pct", "usa_wins", "csa_wins", "usa_cas", "csa_cas", "total_cas", "avg_cas"]
        col_names = {
            "map": "Map", "plays": "Plays",
            "att_win": "Att Wins", "att_win_pct": "Att Win %",
            "def_win": "Def Wins", "def_win_pct": "Def Win %",
            "usa_wins": "USA Wins", "csa_wins": "CSA Wins",
            "usa_cas": "USA Cas.", "csa_cas": "CSA Cas.",
            "total_cas": "Total Cas.", "avg_cas": "Avg Cas."
        }

        tree = ttk.Treeview(tree_frame, columns=cols, show="headings")
        for col_id in cols:
            tree.heading(col_id, text=col_names[col_id], command=lambda c=col_id: self.sort_column(tree, c, False))
            tree.column(col_id, anchor=tk.CENTER, width=80)
        tree.column("map", anchor=tk.W, width=150)
        tree.column("plays", anchor=tk.CENTER, width=50)

        # --- Populate Tree ---
        for map_name, data in sorted(map_stats.items()):
            plays = data['plays']
            att_win_ratio = (data['attacker_wins'] / plays * 100) if plays > 0 else 0
            def_win_ratio = (data['defender_wins'] / plays * 100) if plays > 0 else 0
            avg_cas = data['total_casualties'] / plays if plays > 0 else 0
            tree.insert("", "end", values=(
                map_name,
                plays,
                data["attacker_wins"], f"{att_win_ratio:.1f}%",
                data["defender_wins"], f"{def_win_ratio:.1f}%",
                data["usa_wins"],
                data["csa_wins"],
                data["usa_casualties"],
                data["csa_casualties"],
                data["total_casualties"],
                f"{avg_cas:.0f}"
            ))
        
        # --- Add Summary Footer ---
        footer_frame = tk.Frame(main_frame)
        footer_frame.pack(fill=tk.X, side=tk.BOTTOM, pady=(5,0))
        
        total_plays = overall_stats['total_plays']
        overall_attack_wins = overall_stats['attack_wins']
        overall_defense_wins = overall_stats['defense_wins']
        
        overall_attack_pct = (overall_attack_wins / total_plays * 100) if total_plays > 0 else 0
        overall_defense_pct = (overall_defense_wins / total_plays * 100) if total_plays > 0 else 0

        summary_text = (f"Attacker Wins: {overall_attack_wins} ({overall_attack_pct:.1f}%)   |   "
                        f"Defender Wins: {overall_defense_wins} ({overall_defense_pct:.1f}%)   |   "
                        f"Total Rounds: {total_plays}")
        
        tk.Label(footer_frame, text=summary_text, font=("Arial", 9, "bold")).pack()


        vsb = ttk.Scrollbar(tree_frame, orient="vertical", command=tree.yview)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        tree.configure(yscrollcommand=vsb.set)
        tree.pack(fill=tk.BOTH, expand=True)

    # ------------------------------------------------------------------
    # Persistence helpers
    def save_to_file(self, path: Path):
        data = {
            "units": sorted(list(self.units)),
            "non_token_units": sorted(list(self.non_token_units)),
            "season": [
                {
                    "name": wk.get("name", f"Week {i+1}"),
                    "A": sorted(list(wk.get("A", set()))),
                    "B": sorted(list(wk.get("B", set()))),
                    "round1_winner": wk.get("round1_winner"),
                    "round2_winner": wk.get("round2_winner"),
                    "lead_A": wk.get("lead_A"),
                    "lead_B": wk.get("lead_B"),
                    "playoffs": wk.get("playoffs", False),
                    "lead_A_r1": wk.get("lead_A_r1"),
                    "lead_B_r1": wk.get("lead_B_r1"),
                    "lead_A_r2": wk.get("lead_A_r2"),
                    "lead_B_r2": wk.get("lead_B_r2"),
                    "r1_casualties_A": wk.get("r1_casualties_A", 0),
                    "r1_casualties_B": wk.get("r1_casualties_B", 0),
                    "r2_casualties_A": wk.get("r2_casualties_A", 0),
                    "r2_casualties_B": wk.get("r2_casualties_B", 0),
                    "round1_map": wk.get("round1_map"),
                    "round2_map": wk.get("round2_map"),
                    "round1_flipped": wk.get("round1_flipped", False),
                    "round2_flipped": wk.get("round2_flipped", False),
                    "unit_player_counts": wk.get("unit_player_counts", {}),
                    "weekly_casualties": wk.get("weekly_casualties", {"USA": {"r1": {}, "r2": {}}, "CSA": {"r1": {}, "r2": {}}}),
                } for i, wk in enumerate(self.season)
            ],
            "team_names": {k: v.get() for k, v in self.team_names.items()},
            "point_system_values": {k: v.get() for k, v in self.point_system_values.items()},
            "unit_player_counts": self.unit_player_counts,
            "manual_point_adjustments": self.manual_point_adjustments,
            "divisions": self.divisions,
            "elo_system_values": {k: v.get() for k, v in self.elo_system_values.items()},
            "elo_bias_percentages": {k: v.get() for k, v in self.elo_bias_percentages.items()},
            "map_biases": {k: v.get() for k, v in self.map_biases.items()},
        }
        path.write_text(json.dumps(data, indent=2))

    def load_from_file(self, path: Path):
        try:
            data = json.loads(path.read_text())
            self.units = set(data.get("units", []))
            self.non_token_units = set(data.get("non_token_units", []))
            loaded_season = data.get("season", [])
            self.season = []
            for i, wk_data in enumerate(loaded_season):
                self.season.append({
                    "name": wk_data.get("name", f"Week {i + 1}"),
                    "A": set(wk_data.get("A", [])),
                    "B": set(wk_data.get("B", [])),
                    "round1_winner": wk_data.get("round1_winner"),
                    "round2_winner": wk_data.get("round2_winner"),
                    "lead_A": wk_data.get("lead_A"),
                    "lead_B": wk_data.get("lead_B"),
                    "playoffs": wk_data.get("playoffs", False),
                    "lead_A_r1": wk_data.get("lead_A_r1"),
                    "lead_B_r1": wk_data.get("lead_B_r1"),
                    "lead_A_r2": wk_data.get("lead_A_r2"),
                    "lead_B_r2": wk_data.get("lead_B_r2"),
                    "r1_casualties_A": wk_data.get("r1_casualties_A", 0),
                    "r1_casualties_B": wk_data.get("r1_casualties_B", 0),
                    "r2_casualties_A": wk_data.get("r2_casualties_A", 0),
                    "r2_casualties_B": wk_data.get("r2_casualties_B", 0),
                    "round1_map": wk_data.get("round1_map"),
                    "round2_map": wk_data.get("round2_map"),
                    "round1_flipped": wk_data.get("round1_flipped", False),
                    "round2_flipped": wk_data.get("round2_flipped", False),
                    "unit_player_counts": wk_data.get("unit_player_counts", {}),
                    "weekly_casualties": wk_data.get("weekly_casualties", {"USA": {"r1": {}, "r2": {}}, "CSA": {"r1": {}, "r2": {}}}),
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

            # Load global player counts, but ensure it's a defaultdict
            self.unit_player_counts = defaultdict(lambda: {"min": "0", "max": "100"})
            global_counts = data.get("unit_player_counts", {})
            if isinstance(global_counts, dict):
                self.unit_player_counts.update(global_counts)

            self.manual_point_adjustments = defaultdict(int)
            self.manual_point_adjustments.update(data.get("manual_point_adjustments", {}))
            
            self.divisions = data.get("divisions", [])

            loaded_elo_system = data.get("elo_system_values", {})
            default_elo = {
                "initial_elo": "1500",
                "k_factor_standard": "96",
                "k_factor_provisional": "128",
                "provisional_rounds": "10",
                "sweep_bonus_multiplier": "1.25",
                "lead_multiplier": "2.0",
                "size_influence": "1.0",
                "playoff_multiplier": "1.25"
            }
            for key, var in self.elo_system_values.items():
                var.set(loaded_elo_system.get(key, default_elo.get(key, "0")))

            loaded_elo_bias = data.get("elo_bias_percentages", {})
            default_bias = {
               "light_attacker": "15",
               "heavy_attacker": "30",
               "light_defender": "15",
               "heavy_defender": "30",
            }
            for key, var in self.elo_bias_percentages.items():
               var.set(loaded_elo_bias.get(key, default_bias.get(key, "0")))
            
            # Load map biases, creating StringVars as we go
            self.map_biases.clear()
            loaded_map_biases = data.get("map_biases", {})
            default_biases = {
               # ANTIETAM
               "East Woods Skirmish": "2", "Hooker's Push": "2.5", "Hagerstown Turnpike": "1",
               "Miller's Cornfield": "1.5", "East Woods": "2.5", "Nicodemus Hill": "2.5",
               "Bloody Lane": "1.5", "Pry Ford": "2", "Pry Grist Mill": "1", "Pry House": "1.5",
               "West Woods": "1.5", "Dunker Church": "1.5", "Burnside's Bridge": "2.5",
               "Cooke's Countercharge": "1.5", "Otto and Sherrick Farms": "1",
               "Roulette Lane": "1.5", "Piper Farm": "2", "Hill's Counterattack": "1",
               # HARPERS FERRY
               "Maryland Heights": "1.5", "River Crossing": "2.5", "Downtown": "1",
               "School House Ridge": "1", "Bolivar Heights Camp": "1.5", "High Street": "1",
               "Shenandoah Street": "1.5", "Harpers Ferry Graveyard": "1", "Washington Street": "1",
               "Bolivar Heights Redoubt": "2",
               # SOUTH MOUNTAIN
               "Garland's Stand": "2.5", "Cox's Push": "2.5", "Hatch's Attack": "2",
               "Anderson's Counterattack": "1", "Reno's Fall": "1.5", "Colquitt's Defense": "2",
               # DRILL CAMP
               "Alexander Farm": "2", "Crossroads": "0", "Smith Field": "1",
               "Crecy's Cornfield": "1.5", "Crossley Creek": "1", "Larsen Homestead": "1.5",
               "South Woodlot": "1.5", "Flemming's Meadow": "2", "Wagon Road": "2",
               "Union Camp": "1.5", "Pat's Turnpike": "1.5", "Stefan's Lot": "1",
               "Confederate Encampment": "2"
            }
            for map_name in self.get_all_maps():
                # Use saved value, but fall back to the new default, then to "0"
                bias_value = loaded_map_biases.get(map_name, default_biases.get(map_name, "0"))
                self.map_biases[map_name] = tk.StringVar(value=str(bias_value))
 
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

            self.elo_system_values["initial_elo"].set("1500")
            self.elo_system_values["k_factor_standard"].set("96")
            self.elo_system_values["k_factor_provisional"].set("128")
            self.elo_system_values["provisional_rounds"].set("10")
            self.elo_system_values["sweep_bonus_multiplier"].set("1.25")
            self.elo_system_values["lead_multiplier"].set("2.0")
            self.elo_system_values["size_influence"].set("1.0")
            self.elo_system_values["playoff_multiplier"].set("1.25")
            
            self.unit_points.clear()
            self.manual_point_adjustments.clear()
            self.divisions.clear()
            self.map_biases.clear()
 
            # Re-initialize map biases to default
            default_biases = {
               # ANTIETAM
               "East Woods Skirmish": "2", "Hooker's Push": "2.5", "Hagerstown Turnpike": "1",
               "Miller's Cornfield": "1.5", "East Woods": "2.5", "Nicodemus Hill": "2.5",
               "Bloody Lane": "1.5", "Pry Ford": "2", "Pry Grist Mill": "1", "Pry House": "1.5",
               "West Woods": "1.5", "Dunker Church": "1.5", "Burnside's Bridge": "2.5",
               "Cooke's Countercharge": "1.5", "Otto and Sherrick Farms": "1",
               "Roulette Lane": "1.5", "Piper Farm": "2", "Hill's Counterattack": "1",
               # HARPERS FERRY
               "Maryland Heights": "1.5", "River Crossing": "2.5", "Downtown": "1",
               "School House Ridge": "1", "Bolivar Heights Camp": "1.5", "High Street": "1",
               "Shenandoah Street": "1.5", "Harpers Ferry Graveyard": "1", "Washington Street": "1",
               "Bolivar Heights Redoubt": "2",
               # SOUTH MOUNTAIN
               "Garland's Stand": "2.5", "Cox's Push": "2.5", "Hatch's Attack": "2",
               "Anderson's Counterattack": "1", "Reno's Fall": "1.5", "Colquitt's Defense": "2",
               # DRILL CAMP
               "Alexander Farm": "2", "Crossroads": "0", "Smith Field": "1",
               "Crecy's Cornfield": "1.5", "Crossley Creek": "1", "Larsen Homestead": "1.5",
               "South Woodlot": "1.5", "Flemming's Meadow": "2", "Wagon Road": "2",
               "Union Camp": "1.5", "Pat's Turnpike": "1.5", "Stefan's Lot": "1",
               "Confederate Encampment": "2"
            }
            for map_name in self.get_all_maps():
               default_value = default_biases.get(map_name, "0")
               self.map_biases[map_name] = tk.StringVar(value=default_value)
 
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
        
        divisions_button = tk.Button(buttons_frame, text="Manage Divisions", command=self.open_division_manager)
        divisions_button.pack(side=tk.LEFT, pady=(10,0), padx=(0,5))
        
        elo_button = tk.Button(buttons_frame, text="Modify Elo System", command=self.open_elo_system_dialog)
        elo_button.pack(side=tk.LEFT, pady=(10,0), padx=(5,0))
 
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
    def open_balancer_window(self):
        if not self.current_week:
            messagebox.showwarning("No Week Selected", "Please select a week before opening the balancer.")
            return

        balancer_window = tk.Toplevel(self.master)
        balancer_window.title("Team Balancer")
        balancer_window.geometry("900x700")
        balancer_window.minsize(800, 600)
        balancer_window.grab_set()
        balancer_window.transient(self.master)

        # --- Data ---
        week_idx = self.season.index(self.current_week)
        # Determine which player counts to use
        counts_to_use = {}
        if self.current_week.get("unit_player_counts"):
            # 1. Use counts from the current week if they exist
            counts_to_use = self.current_week["unit_player_counts"]
        elif week_idx > 0 and self.season[week_idx - 1].get("unit_player_counts"):
            # 2. Fallback to the previous week's counts
            counts_to_use = self.season[week_idx - 1]["unit_player_counts"]
        else:
            # 3. Fallback to global counts
            counts_to_use = self.unit_player_counts

        assigned_in_week = self.current_week["A"].union(self.current_week["B"])
        all_available_units = sorted(list(self.units - assigned_in_week))
        
        # These lists will be dynamically managed
        available_pool = tk.StringVar(value=all_available_units)

        # --- UI ---
        main_frame = tk.Frame(balancer_window, padx=10, pady=10)
        main_frame.pack(fill=tk.BOTH, expand=True)
        main_frame.grid_columnconfigure(0, weight=2)
        main_frame.grid_columnconfigure(1, weight=2)
        main_frame.grid_rowconfigure(0, weight=1)

        # --- LEFT: Available ---
        left_frame = tk.Frame(main_frame)
        left_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 5))
        left_frame.grid_rowconfigure(1, weight=1) # Make listbox expand
        left_frame.grid_columnconfigure(0, weight=1)

        tk.Label(left_frame, text="Available Units Pool").grid(row=0, column=0, sticky="ew")
        available_list = tk.Listbox(left_frame, listvariable=available_pool, selectmode=tk.EXTENDED)
        available_list.grid(row=1, column=0, sticky="nsew")

        # --- RIGHT: Constraints ---
        right_frame = tk.Frame(main_frame)
        right_frame.grid(row=0, column=1, sticky="nsew", padx=(5, 0))
        right_frame.grid_columnconfigure(0, weight=1)
        right_frame.grid_rowconfigure(1, weight=1) # Make treeview expand
        right_frame.grid_rowconfigure(3, weight=1) # Make treeview expand

        # Max Player Difference
        diff_frame = tk.Frame(right_frame)
        diff_frame.pack(fill=tk.X, pady=(0, 10))
        tk.Label(diff_frame, text="Max Player Difference:").pack(side=tk.LEFT)
        max_diff_spinbox = tk.Spinbox(diff_frame, from_=0, to=100, width=5)
        max_diff_spinbox.pack(side=tk.LEFT, padx=5)
        max_diff_spinbox.delete(0, "end")
        max_diff_spinbox.insert(0, "1")

        # Unit Counts
        unit_counts_frame = tk.LabelFrame(right_frame, text="Unit Player Counts (Double-click to edit)", padx=5, pady=5)
        unit_counts_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        unit_counts_tree = ttk.Treeview(unit_counts_frame, columns=("Unit", "Min", "Max"), show="headings")
        unit_counts_tree.heading("Unit", text="Unit")
        unit_counts_tree.heading("Min", text="Min Players")
        unit_counts_tree.heading("Max", text="Max Players")
        unit_counts_tree.column("Unit", width=120, stretch=tk.YES)
        unit_counts_tree.column("Min", width=60, anchor="center")
        unit_counts_tree.column("Max", width=60, anchor="center")
        unit_counts_tree.pack(fill=tk.BOTH, expand=True)

        # Populate unit counts smartly
        all_units_for_counts = sorted(list(self.units))
        for unit in all_units_for_counts:
            # Use the determined counts, but fallback to global defaults if a unit is somehow missing
            counts = counts_to_use.get(unit, self.unit_player_counts.get(unit, {"min": "0", "max": "100"}))
            unit_counts_tree.insert("", "end", values=(unit, counts.get("min", "0"), counts.get("max", "100")))

        # Opposing Units
        opposing_units_frame = tk.LabelFrame(right_frame, text="Opposing Units", padx=5, pady=5)
        opposing_units_frame.pack(fill=tk.BOTH, expand=True)
        opposing_units_tree = ttk.Treeview(opposing_units_frame, columns=("UnitA", "UnitB"), show="headings", height=4)
        opposing_units_tree.heading("UnitA", text="Team A")
        opposing_units_tree.heading("UnitB", text="Team B")
        opposing_units_tree.column("UnitA", stretch=tk.YES)
        opposing_units_tree.column("UnitB", stretch=tk.YES)
        opposing_units_tree.pack(fill=tk.BOTH, expand=True)
        
        def add_opposing_pair():
            # Simple dialog to add a pair
            dlg = tk.Toplevel(balancer_window)
            dlg.title("Add Opposing Pair")
            dlg.transient(balancer_window)
            dlg.grab_set()
            
            var1 = tk.StringVar()
            var2 = tk.StringVar()
            
            tk.Label(dlg, text="Team A:").pack(padx=5, pady=2)
            ttk.Combobox(dlg, textvariable=var1, values=all_units_for_counts).pack(padx=5, pady=2)
            tk.Label(dlg, text="Team B:").pack(padx=5, pady=2)
            ttk.Combobox(dlg, textvariable=var2, values=all_units_for_counts).pack(padx=5, pady=2)

            def on_ok():
                u1, u2 = var1.get(), var2.get()
                if u1 and u2 and u1 != u2:
                    opposing_units_tree.insert("", "end", values=(u1, u2))
                    dlg.destroy()
                else:
                    messagebox.showwarning("Invalid Pair", "Please select two different units.", parent=dlg)

            tk.Button(dlg, text="OK", command=on_ok).pack(pady=10)
            dlg.geometry(f"+{balancer_window.winfo_rootx()+50}+{balancer_window.winfo_rooty()+50}")


        def remove_opposing_pair():
            selected_items = opposing_units_tree.selection()
            for item in selected_items:
                opposing_units_tree.delete(item)

        opposing_buttons_frame = tk.Frame(opposing_units_frame)
        opposing_buttons_frame.pack(fill=tk.X, pady=(5,0))
        tk.Button(opposing_buttons_frame, text="Add Pair...", command=add_opposing_pair).pack(side=tk.LEFT)
        tk.Button(opposing_buttons_frame, text="Remove Selected", command=remove_opposing_pair).pack(side=tk.LEFT, padx=5)

        # --- BOTTOM: Action Buttons ---
        bottom_frame = tk.Frame(balancer_window)
        bottom_frame.pack(fill=tk.X, side=tk.BOTTOM, padx=10, pady=(10, 0))

        status_label = tk.Label(bottom_frame, text="")
        status_label.pack(side=tk.LEFT)

        def collect_and_run_balancer():
            """Helper to gather current constraints and run the main logic."""
            constraints = {
                "available": ast.literal_eval(available_pool.get()) if available_pool.get() else [],
                "max_diff": max_diff_spinbox.get(),
                "unit_counts": {unit_counts_tree.item(i, "values")[0]: {"min": unit_counts_tree.item(i, "values")[1], "max": unit_counts_tree.item(i, "values")[2]} for i in unit_counts_tree.get_children()},
                "opposing": [opposing_units_tree.item(i, "values") for i in opposing_units_tree.get_children()]
            }
            self.run_balancer(balancer_window, status_label, constraints, save_unit_counts)

        balance_button = tk.Button(bottom_frame, text="Balance!", command=collect_and_run_balancer)
        balance_button.pack(side=tk.RIGHT, padx=(5,0))

        # --- Save and Close Logic ---
        def save_unit_counts(apply_to_week=False):
            """
            Saves the current values from the treeview to the main app's global dictionary
            and optionally to the current week's specific dictionary.
            """
            current_counts_in_balancer = {}
            for item_id in unit_counts_tree.get_children():
                values = unit_counts_tree.item(item_id, "values")
                if values:
                    unit, min_val, max_val = values
                    # Update the global dictionary first
                    self.unit_player_counts[unit] = {"min": min_val, "max": max_val}
                    current_counts_in_balancer[unit] = {"min": min_val, "max": max_val}
            
            # If not applying a balance, we still save the current state of the balancer to the week
            if not apply_to_week and self.current_week:
                self.current_week["unit_player_counts"] = current_counts_in_balancer

        def on_close_window():
            save_unit_counts(apply_to_week=False)
            balancer_window.destroy()

        close_button = tk.Button(bottom_frame, text="Close", command=on_close_window)
        close_button.pack(side=tk.RIGHT)

        # --- Treeview Editing Logic ---
        def on_tree_double_click(event):
            item_id = unit_counts_tree.identify_row(event.y)
            column_id = unit_counts_tree.identify_column(event.x)
            
            if not item_id or column_id in ("#0", "#1"): # Not editable or Unit column
                return

            x, y, width, height = unit_counts_tree.bbox(item_id, column_id)
            
            value = unit_counts_tree.set(item_id, column_id)
            entry_var = tk.StringVar(value=value)
            
            entry = ttk.Entry(unit_counts_tree, textvariable=entry_var)
            entry.place(x=x, y=y, width=width, height=height)
            entry.focus_set()

            def on_entry_commit(event=None):
                new_value = entry_var.get()
                # Basic validation
                if new_value.isdigit():
                    unit_counts_tree.set(item_id, column_id, new_value)
                entry.destroy()

            entry.bind("<FocusOut>", on_entry_commit)
            entry.bind("<Return>", on_entry_commit)

        unit_counts_tree.bind("<Double-1>", on_tree_double_click)
        balancer_window.protocol("WM_DELETE_WINDOW", on_close_window)


    def run_balancer(self, window, status_label, constraints, save_counts_func):
        """Placeholder for the actual balancing logic."""
        status_label.config(text="Balancing...")
        window.update_idletasks()

        # --- 1. GATHER & VALIDATE INPUTS ---
        try:
            available = set(constraints["available"])

            max_diff = int(constraints["max_diff"])
            
            unit_counts = {}
            for unit, counts in constraints["unit_counts"].items():
                unit_counts[unit] = {"min": int(counts["min"]), "max": int(counts["max"])}

            opposing_pairs = [tuple(p) for p in constraints["opposing"]]
            for u1, u2 in opposing_pairs:
                pass

        except ValueError as e:
            messagebox.showerror("Invalid Constraint", str(e), parent=window)
            status_label.config(text="Error!")
            return

        # --- 2. FETCH HISTORY ---
        teammate_history, _ = self.compute_stats() # Full season history

        # --- 3. RUN ALGORITHM ---
        result = self._balance_teams(
            available=list(available),
            unit_counts=unit_counts,
            opposing_pairs=opposing_pairs,
            max_player_diff=max_diff,
            teammate_history=teammate_history
        )
        
        # --- 4. DISPLAY RESULTS ---
        if result:
            team_A, team_B, score, min_A, max_A, min_B, max_B = result
            status_label.config(text=f"Best solution found! Avg. Diff: {score:.1f}")
            self._display_balance_results(window, team_A, team_B, score, min_A, max_A, min_B, max_B, save_counts_func)
        else:
            # The _balance_teams function will show its own, more specific message box.
            status_label.config(text="Failed to find a valid balance.")

    def _balance_teams(self, available, unit_counts, opposing_pairs, max_player_diff, teammate_history):
        """
        Finds the most balanced team composition by partitioning units,
        respecting min/max player counts, max total player difference,
        and opposing unit constraints.
        """
        try:
            unit_data = {
                unit: {"min": int(counts["min"]), "max": int(counts["max"])}
                for unit, counts in unit_counts.items()
            }
        except (ValueError, TypeError):
            messagebox.showerror("Invalid Constraint", "Min/Max values for all units must be valid integers.")
            return None

        # Filter out units with 0 min and 0 max, as they are not participating.
        present_units = {
            unit for unit, data in unit_data.items()
            if not (data["min"] == 0 and data["max"] == 0)
        }
        
        players = sorted(list(set(available) & present_units))
        n_players = len(players)

        opposing_map = defaultdict(set)
        for p1, p2 in opposing_pairs:
            opposing_map[p1].add(p2)
            opposing_map[p2].add(p1)

        best_solution = {"score": (float('inf'), float('inf'), float('inf'), float('inf')), "teams": None, "stats": None}

        # --- Calculate average teammate count for penalty ---
        all_counts = []
        counted_pairs = set()
        for u1, others in teammate_history.items():
            for u2, count in others.items():
                pair = tuple(sorted((u1, u2)))
                if pair not in counted_pairs:
                    all_counts.append(count)
                    counted_pairs.add(pair)
        
        average_teammate_count = sum(all_counts) / len(all_counts) if all_counts else 0
        over_teaming_threshold = round(average_teammate_count) #* 1.25
        # A higher multiplier means a stronger penalty for going over the threshold.
        over_teaming_penalty_multiplier = 10
        print(f'Average Teammate Count: {average_teammate_count}')
        print(f'Over Teaming Threshold: {over_teaming_threshold}')

        # --- Handle forced teams from opposing pairs ---
        forced_A = {p[0] for p in opposing_pairs if p[0]}
        forced_B = {p[1] for p in opposing_pairs if p[1]}

        # Check for contradictions
        conflict = forced_A.intersection(forced_B)
        if conflict:
            messagebox.showerror("Constraint Error", f"Units cannot be in both opposing teams: {', '.join(conflict)}")
            return None

        # Players to be assigned are those available, present, and not already forced into a team.
        players_to_assign = sorted(list((set(available) & present_units) - forced_A - forced_B))
        n_to_assign = len(players_to_assign)

        # --- Iterative Solver using itertools ---
        # Iterate through all possible sizes for the first team's additional members.
        for size_A_additional in range(n_to_assign + 1):
            for team_A_additional_tuple in itertools.combinations(players_to_assign, size_A_additional):
                
                team_A = forced_A.union(set(team_A_additional_tuple))
                team_B = forced_B.union(set(players_to_assign) - set(team_A_additional_tuple))

                # Evaluate this partition
                min_A = sum(unit_data.get(p, {}).get('min', 0) for p in team_A)
                max_A = sum(unit_data.get(p, {}).get('max', 0) for p in team_A)
                min_B = sum(unit_data.get(p, {}).get('min', 0) for p in team_B)
                max_B = sum(unit_data.get(p, {}).get('max', 0) for p in team_B)

                gap = 0
                if max_A < min_B:
                    gap = min_B - max_A
                elif max_B < min_A:
                    gap = min_A - max_B
                
                min_diff = abs(min_A - min_B)
                avg_A = (min_A + max_A) / 2 if team_A else 0
                avg_B = (min_B + max_B) / 2 if team_B else 0
                avg_diff = abs(avg_A - avg_B)

                # Calculate teammate "heat" score. Lower is better, as it means units have played together less.
                teammate_score = 0
                for u1, u2 in itertools.combinations(team_A, 2):
                    count = teammate_history[u1][u2]
                    teammate_score += count
                    # Add penalty for over-teaming
                    if average_teammate_count > 0 and count > over_teaming_threshold:
                        teammate_score += (count - over_teaming_threshold) * over_teaming_penalty_multiplier
                for u1, u2 in itertools.combinations(team_B, 2):
                    count = teammate_history[u1][u2]
                    teammate_score += count
                    # Add penalty for over-teaming
                    if average_teammate_count > 0 and count > over_teaming_threshold:
                        teammate_score += (count - over_teaming_threshold) * over_teaming_penalty_multiplier

                current_score = (gap, min_diff, teammate_score, avg_diff)

                if current_score < best_solution["score"]:
                    best_solution["score"] = current_score
                    best_solution["teams"] = (list(team_A), list(team_B))
                    best_solution["stats"] = (min_A, max_A, min_B, max_B)

        # --- Main Execution ---
        if best_solution["teams"]:
            gap, min_diff, teammate_score, avg_diff = best_solution["score"]
            if gap <= max_player_diff and min_diff <= max_player_diff:
                team_A, team_B = best_solution["teams"]
                min_A, max_A, min_B, max_B = best_solution["stats"]
                return team_A, team_B, avg_diff, min_A, max_A, min_B, max_B
            else:
                msg = f"Could not find a balance within the max player difference of {max_player_diff}.\n"
                if gap > max_player_diff:
                    msg += f"The best possible balance has a range gap of {gap:.0f} players.\n"
                if min_diff > max_player_diff:
                    msg += f"The best possible balance has a minimums difference of {min_diff:.0f} players.\n"
                messagebox.showinfo("Balancing Failed", msg.strip())
                return None
        else:
            messagebox.showwarning("Balancing Failed", "No valid team composition could be found with the given constraints.")
            return None

    def _display_balance_results(self, parent_window, team_A, team_B, score, min_A, max_A, min_B, max_B, save_counts_func):
        results_window = tk.Toplevel(parent_window)
        results_window.title("Balancer Results")
        results_window.geometry("600x400")
        results_window.transient(parent_window)
        results_window.grab_set()

        main_frame = tk.Frame(results_window, padx=10, pady=10)
        main_frame.pack(fill=tk.BOTH, expand=True)
        main_frame.grid_columnconfigure(0, weight=1)
        main_frame.grid_columnconfigure(1, weight=1)
        main_frame.grid_rowconfigure(1, weight=1)

        tk.Label(main_frame, text=f"Best Balance Found! Average Player Difference: {score:.1f}", font=("Arial", 12, "bold")).grid(row=0, column=0, columnspan=2, pady=(0,10))

        # Team A Display
        frame_a = tk.LabelFrame(main_frame, text=f"Team A ({len(team_A)} units) | Players: {min_A}-{max_A}")
        frame_a.grid(row=1, column=0, sticky="nsew", padx=(0,5))
        list_a = tk.Listbox(frame_a)
        list_a.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        for unit in sorted(team_A):
            list_a.insert(tk.END, unit)

        # Team B Display
        frame_b = tk.LabelFrame(main_frame, text=f"Team B ({len(team_B)} units) | Players: {min_B}-{max_B}")
        frame_b.grid(row=1, column=1, sticky="nsew", padx=(5,0))
        list_b = tk.Listbox(frame_b)
        list_b.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        for unit in sorted(team_B):
            list_b.insert(tk.END, unit)

        def apply_and_close():
            if not self.current_week: return
            
            # First, save the unit counts from the balancer UI to the global setting
            # This ensures the "master" list is up-to-date.
            # This function is now designed to be called with True, signaling that
            # we are applying a balance, so the week-specific data is finalized here.
            save_counts_func(apply_to_week=True)

            # Apply balanced teams to the current week's roster
            self.current_week["A"] = set(team_A)
            self.current_week["B"] = set(team_B)
            
            # Refresh main GUI to reflect the new rosters
            self.refresh_team_lists()
            self.refresh_units_list()

            # Close balancer windows
            results_window.destroy()
            parent_window.destroy()

        button_frame = tk.Frame(main_frame)
        button_frame.grid(row=2, column=0, columnspan=2, pady=(10,0))
        tk.Button(button_frame, text="Apply to Week", command=apply_and_close).pack(side=tk.LEFT, padx=5)
        tk.Button(button_frame, text="Close", command=results_window.destroy).pack(side=tk.LEFT, padx=5)

    def show_projections_ui(self, parent_window, group_view=False):
        """Displays the UI for season projections based on theoretical future results."""
        proj_win = tk.Toplevel(parent_window)
        proj_win.title("Season Projections")
        proj_win.geometry("1100x600")
        proj_win.minsize(900, 400)
        proj_win.transient(parent_window)
        proj_win.grab_set()

        # Data structure for inputs
        self.projection_inputs = defaultdict(lambda: {
            "theoretical_2_0_lead_wins": tk.StringVar(value="0"),
            "theoretical_2_0_assist_wins": tk.StringVar(value="0"),
            "theoretical_1_1_lead_wins": tk.StringVar(value="0"),
            "theoretical_1_1_assist_wins": tk.StringVar(value="0"),
            "theoretical_0_2_lead_losses": tk.StringVar(value="0"),
            "theoretical_0_2_assist_losses": tk.StringVar(value="0"),
        })

        # --- UI SETUP ---
        main_frame = ttk.Frame(proj_win, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        cols = [
            "unit", "current_pts",
            "theoretical_2_0_lead_wins", "theoretical_2_0_assist_wins",
            "theoretical_1_1_lead_wins", "theoretical_1_1_assist_wins",
            "theoretical_0_2_lead_losses", "theoretical_0_2_assist_losses",
            "projected_pts", "rank"
        ]
        col_names = {
            "unit": "Unit", "current_pts": "Current Pts",
            "theoretical_2_0_lead_wins": "2-0 L-Wins",
            "theoretical_2_0_assist_wins": "2-0 A-Wins",
            "theoretical_1_1_lead_wins": "1-1 L-Wins",
            "theoretical_1_1_assist_wins": "1-1 A-Wins",
            "theoretical_0_2_lead_losses": "0-2 L-Loss",
            "theoretical_0_2_assist_losses": "0-2 A-Loss",
            "projected_pts": "Projected Pts",
            "rank": "Projected Rank"
        }

        tree = ttk.Treeview(main_frame, columns=cols, show="headings")
        tree.pack(fill=tk.BOTH, expand=True)

        for col_id in cols:
            tree.heading(col_id, text=col_names[col_id], command=lambda c=col_id: self.sort_column(tree, c, False))
            tree.column(col_id, width=80, anchor=tk.CENTER)
        tree.column("unit", width=150, anchor=tk.W)
        tree.column("rank", width=80, anchor=tk.CENTER)


        # --- INITIAL DATA POPULATION ---
        self.populate_projections_tree(tree, group_view)

        # --- IN-PLACE EDITING LOGIC ---
        def on_tree_double_click(event):
            item_id = tree.identify_row(event.y)
            column_id_str = tree.identify_column(event.x)
            
            if not item_id or not column_id_str: return
            
            # Prevent editing on division headers
            if tree.tag_has('division_header', item_id):
                return

            column_index = int(column_id_str.replace('#', '')) - 1
            column_key = cols[column_index]

            # Only allow editing of theoretical input columns
            if column_key not in self.projection_inputs[item_id]:
                return

            x, y, width, height = tree.bbox(item_id, column_id_str)
            
            entry_var = self.projection_inputs[item_id][column_key]
            entry = ttk.Entry(tree, textvariable=entry_var, justify='center')
            entry.place(x=x, y=y, width=width, height=height)
            entry.focus_set()
            entry.select_range(0, tk.END)

            def on_entry_commit(event=None):
                new_value = entry_var.get()
                entry.destroy()
                if not new_value.isdigit():
                    entry_var.set("0") # Reset to 0 if invalid
                
                # Update the specific cell in the treeview
                tree.set(item_id, column_key, entry_var.get())
                
                # After editing, immediately recalculate for the single row
                self.calculate_and_display_projections(tree, group_view)


            entry.bind("<FocusOut>", on_entry_commit)
            entry.bind("<Return>", on_entry_commit)
            entry.bind("<Escape>", lambda e: entry.destroy())

        tree.bind("<Double-1>", on_tree_double_click)

        # --- CALCULATION BUTTON ---
        calc_button = ttk.Button(
            main_frame,
            text="Calculate All Projections",
            command=lambda: self.calculate_and_display_projections(tree, group_view)
        )
        calc_button.pack(pady=(10, 0))

    def populate_projections_tree(self, tree, group_view=False):
        """Prepares and populates the projections treeview for either overall or group view."""
        for item in tree.get_children():
            tree.delete(item)

        current_stats_data = self.calculate_points()
        all_units_stats = []
        for unit in self.units:
            if unit in self.non_token_units: continue
            base_stats = current_stats_data.get(unit, {"points": 0})
            manual_adj = self.manual_point_adjustments.get(unit, 0)
            total_pts = base_stats["points"] + manual_adj
            all_units_stats.append({
                "unit": unit,
                "total_pts": total_pts
            })

        if group_view and self.divisions:
            # Grouped (Division) View
            for division in self.divisions:
                division_name = division.get("name", "Unnamed Division")
                division_units = set(division.get("units", []))
                
                division_id = tree.insert("", tk.END, text=division_name, open=True, values=(f"--- {division_name} ---", "", "", "", "", "", "", "", "", ""), tags=('division_header',))
                
                division_stats = [s for s in all_units_stats if s["unit"] in division_units]
                sorted_division_units = sorted(division_stats, key=lambda item: (-item["total_pts"], item["unit"]))
                
                for rank, stats in enumerate(sorted_division_units, 1):
                    unit_name = stats["unit"]
                    values = [unit_name, stats["total_pts"]] + ["0"] * 6 + [stats["total_pts"], rank]
                    tree.insert(division_id, tk.END, values=values, iid=unit_name)
        else:
            # Overall (Default) View
            sorted_units = sorted(all_units_stats, key=lambda item: (-item["total_pts"], item["unit"]))
            for rank, stats in enumerate(sorted_units, 1):
                unit_name = stats["unit"]
                values = [unit_name, stats["total_pts"]] + ["0"] * 6 + [stats["total_pts"], rank]
                tree.insert("", tk.END, values=values, iid=unit_name)

    def calculate_and_display_projections(self, tree, group_view=False):
        """Calculates and updates the projections in the UI, handling both overall and group ranking."""
        def get_point_value(key: str, default_val: int = 0) -> int:
            try:
                val_str = self.point_system_values[key].get()
                return int(val_str) if val_str and val_str.strip() else default_val
            except (ValueError, KeyError): return default_val

        pts_win_lead = get_point_value("win_lead", 4)
        pts_win_assist = get_point_value("win_assist", 2)
        pts_loss_lead = get_point_value("loss_lead", 0)
        pts_loss_assist = get_point_value("loss_assist", 1)
        pts_bonus_2_0_lead = get_point_value("bonus_2_0_lead", 0)
        pts_bonus_2_0_assist = get_point_value("bonus_2_0_assist", 1)

        all_projections = []

        # --- Step 1: Calculate projected points for all units ---
        def process_item(item_id):
            values = tree.item(item_id, "values")
            unit_name = values[0]
            current_total_points = int(values[1])
            
            inputs = self.projection_inputs[unit_name]
            
            try:
                t_2_0_lw = int(inputs["theoretical_2_0_lead_wins"].get())
                t_2_0_aw = int(inputs["theoretical_2_0_assist_wins"].get())
                t_1_1_lw = int(inputs["theoretical_1_1_lead_wins"].get())
                t_1_1_aw = int(inputs["theoretical_1_1_assist_wins"].get())
                t_0_2_ll = int(inputs["theoretical_0_2_lead_losses"].get())
                t_0_2_al = int(inputs["theoretical_0_2_assist_losses"].get())

                lead_wins = (t_2_0_lw * 2) + (t_1_1_lw * 1)
                assist_wins = (t_2_0_aw * 2) + (t_1_1_aw * 1)
                lead_losses = (t_1_1_lw * 1) + (t_0_2_ll * 2)
                assist_losses = (t_1_1_aw * 1) + (t_0_2_al * 2)
                
                bonus_points = (t_2_0_lw * pts_bonus_2_0_lead) + (t_2_0_aw * pts_bonus_2_0_assist)

                theoretical_points = (
                    (lead_wins * pts_win_lead) +
                    (assist_wins * pts_win_assist) +
                    (lead_losses * pts_loss_lead) +
                    (assist_losses * pts_loss_assist) +
                    bonus_points
                )
                
                projected_points = current_total_points + theoretical_points
                tree.set(item_id, "projected_pts", projected_points)
                all_projections.append({"unit": unit_name, "projected_pts": projected_points, "iid": item_id})
            except (ValueError, IndexError):
                tree.set(item_id, "projected_pts", "Error")

        for item_id in tree.get_children(''):
            # If it's a division header, process its children
            if tree.tag_has('division_header', item_id):
                for child_id in tree.get_children(item_id):
                    process_item(child_id)
            # Otherwise, it's a regular item in the root
            else:
                process_item(item_id)

        # --- Step 2: Sort and update ranks ---
        if group_view and self.divisions:
            # Grouped ranking
            for division in self.divisions:
                division_units = set(division.get("units", []))
                
                division_projections = [p for p in all_projections if p["unit"] in division_units]
                sorted_division = sorted(division_projections, key=lambda x: (-x["projected_pts"], x["unit"]))
                
                for rank, proj in enumerate(sorted_division, 1):
                    tree.set(proj["iid"], "rank", rank)
        else:
            # Overall ranking
            sorted_projections = sorted(all_projections, key=lambda x: (-x["projected_pts"], x["unit"]))
            for rank, proj in enumerate(sorted_projections, 1):
                tree.set(proj["iid"], "rank", rank)
    def open_division_manager(self):
        division_window = tk.Toplevel(self.master)
        division_window.title("Division Management")
        division_window.geometry("800x600")
        division_window.minsize(600, 400)
        division_window.transient(self.master)
        division_window.grab_set()

        # --- Data ---
        # Make a deep copy for editing, so changes can be cancelled
        edited_divisions = [d.copy() for d in self.divisions]
        
        assigned_units = {unit for div in edited_divisions for unit in div.get("units", [])}
        unassigned_units = sorted(list(self.units - assigned_units))

        # --- UI Elements ---
        main_frame = tk.Frame(division_window, padx=10, pady=10)
        main_frame.pack(fill=tk.BOTH, expand=True)
        main_frame.grid_columnconfigure(0, weight=1)
        main_frame.grid_columnconfigure(1, weight=3) # Give more space to divisions
        main_frame.grid_rowconfigure(0, weight=1)

        # Unassigned Units Pane
        unassigned_frame = tk.LabelFrame(main_frame, text="Unassigned Units")
        unassigned_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        unassigned_list = DraggableListbox(unassigned_frame, selectmode=tk.EXTENDED)
        unassigned_list.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        for unit in unassigned_units:
            unassigned_list.insert(tk.END, unit)

        # Configured Divisions Pane
        divisions_container = tk.LabelFrame(main_frame, text="Configured Divisions")
        divisions_container.grid(row=0, column=1, sticky="nsew")
        divisions_container.grid_rowconfigure(0, weight=1)
        divisions_container.grid_columnconfigure(0, weight=1)

        canvas = tk.Canvas(divisions_container)
        scrollbar = ttk.Scrollbar(divisions_container, orient="vertical", command=canvas.yview)
        divisions_frame = ttk.Frame(canvas) # This frame will hold the division widgets

        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        canvas_frame = canvas.create_window((0, 0), window=divisions_frame, anchor="nw")

        def on_frame_configure(event):
            canvas.configure(scrollregion=canvas.bbox("all"))

        def on_canvas_configure(event):
            canvas.itemconfig(canvas_frame, width=event.width)

        divisions_frame.bind("<Configure>", on_frame_configure)
        canvas.bind('<Configure>', on_canvas_configure)

        # --- Function to sync data model from UI state ---
        def sync_data_from_ui():
            nonlocal unassigned_units
            current_divisions = []
            all_division_units = set()
            
            # Scrape units from each division listbox
            for div_frame in divisions_frame.winfo_children():
                if isinstance(div_frame, tk.LabelFrame):
                    division_name = div_frame.cget("text")
                    units_in_division = []
                    # Find the listbox
                    listbox = next((c for c in div_frame.winfo_children() if isinstance(c, tk.Listbox)), None)
                    if not listbox: # More robustly find the listbox
                         list_frame = next((c for c in div_frame.winfo_children() if isinstance(c, tk.Frame)), None)
                         if list_frame:
                           listbox = next((c for c in list_frame.winfo_children() if isinstance(c, DraggableListbox)), None)

                    if listbox:
                        units_in_division = list(listbox.get(0, tk.END))
                        all_division_units.update(units_in_division)
                    
                    current_divisions.append({"name": division_name, "units": units_in_division})
            
            edited_divisions[:] = current_divisions
            
            # Update unassigned list based on what's NOT in a division
            unassigned_units[:] = sorted(list(self.units - all_division_units))


        # --- Function to redraw the divisions (simple & robust) ---
        def redraw_divisions():
            # Destroy all old division frames
            for widget in list(divisions_frame.winfo_children()):
                widget.destroy()

            # Re-create all frames from the synced data model
            for division in edited_divisions:
                division_sub_frame = tk.LabelFrame(divisions_frame, text=division.get("name", "Unnamed Division"), padx=5, pady=5)
                division_sub_frame.pack(fill=tk.X, expand=True, padx=5, pady=5)
                
                list_frame = tk.Frame(division_sub_frame)
                list_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

                unit_listbox = DraggableListbox(list_frame, selectmode=tk.EXTENDED, height=4)
                unit_listbox.pack(fill=tk.BOTH, expand=True)
                
                for unit in sorted(division.get("units", [])):
                    unit_listbox.insert(tk.END, unit)

                controls_frame = tk.Frame(division_sub_frame)
                controls_frame.pack(side=tk.RIGHT, fill=tk.Y, padx=(5,0))
                tk.Button(controls_frame, text="Rename", command=lambda d=division: rename_division(d)).pack(pady=2)
                tk.Button(controls_frame, text="Delete", command=lambda d=division: delete_division(d)).pack(pady=2)

            tk.Button(divisions_frame, text="+ Create Division", command=create_division).pack(pady=10)
            
            # Refresh the main unassigned list
            unassigned_list.delete(0, tk.END)
            for unit in unassigned_units:
                unassigned_list.insert(tk.END, unit)

        def create_division():
            sync_data_from_ui() # Sync before modifying
            from tkinter import simpledialog
            new_name = simpledialog.askstring("Create Division", "Enter new division name:", parent=division_window)
            if new_name and not any(d.get("name") == new_name for d in edited_divisions):
                edited_divisions.append({"name": new_name, "units": []})
                redraw_divisions()
            elif new_name:
                messagebox.showerror("Error", f"A division with the name '{new_name}' already exists.", parent=division_window)
        
        def rename_division(division_data):
            sync_data_from_ui() # Sync before modifying
            from tkinter import simpledialog
            old_name = division_data.get("name")
            new_name = simpledialog.askstring("Rename Division", "Enter new name:", initialvalue=old_name, parent=division_window)
            
            if new_name and new_name != old_name:
                # Check if new name already exists
                if any(d.get("name") == new_name for d in edited_divisions):
                    messagebox.showerror("Error", f"A division with the name '{new_name}' already exists.", parent=division_window)
                    return

                # Find the actual dictionary in the list and update it
                for div in edited_divisions:
                    if div.get("name") == old_name:
                        div["name"] = new_name
                        break
                redraw_divisions()

        def delete_division(division_data):
            if messagebox.askyesno("Delete Division", f"Are you sure you want to delete '{division_data.get('name')}'?", parent=division_window):
                sync_data_from_ui() # Get the most up-to-date unit assignments
                
                # Find the units that need to be returned to the pool
                units_to_return = []
                for div in edited_divisions:
                    if div['name'] == division_data['name']:
                        units_to_return = div.get('units', [])
                        break
                
                # Add them back to the unassigned list's source
                unassigned_units.extend(units_to_return)

                # Now, actually remove the division from the data
                edited_divisions[:] = [d for d in edited_divisions if d['name'] != division_data['name']]
                
                # Finally, redraw the entire UI from the updated data
                redraw_divisions()

        redraw_divisions()
                                     

        # Bottom Buttons
        buttons_frame = tk.Frame(division_window, padx=10, pady=10)
        buttons_frame.pack(fill=tk.X, side=tk.BOTTOM)

        def save_and_close():
            # Scrape the data from the UI to save it
            new_division_data = []
            for div_frame in divisions_frame.winfo_children():
                if isinstance(div_frame, tk.LabelFrame):
                    division_name = div_frame.cget("text")
                    units_in_division = []
                    # Find the listbox within the frame
                    for list_frame in div_frame.winfo_children():
                        if isinstance(list_frame, tk.Frame):
                            for listbox in list_frame.winfo_children():
                                if isinstance(listbox, DraggableListbox):
                                    units_in_division = list(listbox.get(0, tk.END))
                                    break
                    # Making sure to check for empty divisions
                    new_division_data.append({"name": division_name, "units": units_in_division})
            
            self.divisions = new_division_data
            division_window.destroy()

        save_button = tk.Button(buttons_frame, text="Save", command=save_and_close)
        save_button.pack(side=tk.RIGHT, padx=5)
        cancel_button = tk.Button(buttons_frame, text="Cancel", command=division_window.destroy)
        cancel_button.pack(side=tk.RIGHT)
        
    def open_elo_system_dialog(self):
        dialog = tk.Toplevel(self.master)
        dialog.title("Configure Elo System")
        dialog.transient(self.master)
        dialog.grab_set()
        dialog.resizable(False, False)

        main_frame = tk.Frame(dialog, padx=10, pady=10)
        main_frame.pack(fill=tk.BOTH, expand=True)

        dialog_vars = {key: tk.StringVar(value=var.get()) for key, var in self.elo_system_values.items()}
        bias_dialog_vars = {key: tk.StringVar(value=var.get()) for key, var in self.elo_bias_percentages.items()}

        fields = [
            ("initial_elo", "Initial Elo:"),
            ("k_factor_provisional", "Provisional K-Factor:"),
            ("provisional_rounds", "Provisional Rounds:"),
            ("k_factor_standard", "Standard K-Factor:"),
            ("sweep_bonus_multiplier", "2-0 Sweep Bonus Multiplier:"),
            ("lead_multiplier", "Lead Unit Multiplier:"),
            ("size_influence", "Size Influence (Higher = More Impact):"),
            ("playoff_multiplier", "Playoff Multiplier:"),
        ]

        for i, (key, label_text) in enumerate(fields):
            tk.Label(main_frame, text=label_text).grid(row=i, column=0, sticky=tk.W, pady=2)
            entry = tk.Entry(main_frame, textvariable=dialog_vars[key], width=10)
            entry.grid(row=i, column=1, sticky=tk.E, pady=2, padx=5)
            
        # --- BIAS PERCENTAGES ---
        tk.Label(main_frame, text="").grid(row=len(fields), column=0) # Spacer
        tk.Label(main_frame, text="Map Bias Elo Multipliers (%)", font=("Arial", 9, "bold")).grid(row=len(fields)+1, column=0, columnspan=2, pady=(5,2))

        bias_fields = [
            ("light_attacker", "Light Attacker Bias %:"),
            ("heavy_attacker", "Heavy Attacker Bias %:"),
            ("light_defender", "Light Defender Bias %:"),
            ("heavy_defender", "Heavy Defender Bias %:"),
        ]

        for i, (key, label_text) in enumerate(bias_fields):
            row_idx = len(fields) + 2 + i
            tk.Label(main_frame, text=label_text).grid(row=row_idx, column=0, sticky=tk.W, pady=2)
            entry = tk.Entry(main_frame, textvariable=bias_dialog_vars[key], width=10)
            entry.grid(row=row_idx, column=1, sticky=tk.E, pady=2, padx=5)


        buttons_frame = tk.Frame(main_frame)
        buttons_frame.grid(row=len(fields) + len(bias_fields) + 2, column=0, columnspan=2, pady=(15, 5))

        def on_ok():
            temp_values = {}
            try:
                # Validate and convert
                temp_values["initial_elo"] = int(dialog_vars["initial_elo"].get())
                temp_values["k_factor_standard"] = int(dialog_vars["k_factor_standard"].get())
                temp_values["k_factor_provisional"] = int(dialog_vars["k_factor_provisional"].get())
                temp_values["provisional_rounds"] = int(dialog_vars["provisional_rounds"].get())
                temp_values["sweep_bonus_multiplier"] = float(dialog_vars["sweep_bonus_multiplier"].get())
                temp_values["lead_multiplier"] = float(dialog_vars["lead_multiplier"].get())
                temp_values["size_influence"] = float(dialog_vars["size_influence"].get())
                temp_values["playoff_multiplier"] = float(dialog_vars["playoff_multiplier"].get())
                
                # Validate bias percentages
                bias_values = {}
                for key, s_var in bias_dialog_vars.items():
                    val_str = s_var.get()
                    if not val_str.strip(): # Allow empty string, treat as 0
                        bias_values[key] = 0
                        continue
                    bias_values[key] = int(val_str)

            except ValueError:
                messagebox.showerror("Invalid Input", "All Elo values must be valid numbers (integers or decimals). Bias must be an integer.", parent=dialog)
                return

            # If all valid, update the main StringVars
            for key, value in temp_values.items():
                self.elo_system_values[key].set(str(value))
            for key, value in bias_values.items():
               self.elo_bias_percentages[key].set(str(value))

            dialog.destroy()

        def on_cancel():
            dialog.destroy()

        ok_button = tk.Button(buttons_frame, text="OK", command=on_ok, width=10)
        ok_button.pack(side=tk.LEFT, padx=10)
        
        cancel_button = tk.Button(buttons_frame, text="Cancel", command=on_cancel, width=10)
        cancel_button.pack(side=tk.RIGHT, padx=10)

        map_biases_button = tk.Button(buttons_frame, text="Map Biases", command=self.open_map_bias_dialog)
        map_biases_button.pack(side=tk.LEFT, pady=(10,0), padx=(0,5))

        dialog.update_idletasks()
        master_x = self.master.winfo_rootx()
        master_y = self.master.winfo_rooty()
        master_width = self.master.winfo_width()
        master_height = self.master.winfo_height()
        
        dialog_width = dialog.winfo_reqwidth()
        dialog_height = dialog.winfo_reqheight()

        x_offset = (master_width - dialog_width) // 2
        y_offset = (master_height - dialog_height) // 2
        
        dialog.geometry(f"+{master_x + x_offset}+{master_y + y_offset}")
        dialog.focus_set()

    def open_map_bias_dialog(self):
        """Opens a dialog to configure map biases."""
        dialog = tk.Toplevel(self.master)
        dialog.title("Configure Map Biases")
        dialog.transient(self.master)
        dialog.grab_set()
        dialog.geometry("500x600")

        main_frame = tk.Frame(dialog, padx=10, pady=10)
        main_frame.pack(fill=tk.BOTH, expand=True)

        canvas = tk.Canvas(main_frame)
        scrollbar = ttk.Scrollbar(main_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(
                scrollregion=canvas.bbox("all")
            )
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # --- BIAS OPTIONS ---
        default_biases = {
            # ANTIETAM
            "East Woods Skirmish": "2", "Hooker's Push": "2.5", "Hagerstown Turnpike": "1",
            "Miller's Cornfield": "1.5", "East Woods": "2.5", "Nicodemus Hill": "2.5",
            "Bloody Lane": "1.5", "Pry Ford": "2", "Pry Grist Mill": "1", "Pry House": "1.5",
            "West Woods": "1.5", "Dunker Church": "1.5", "Burnside's Bridge": "2.5",
            "Cooke's Countercharge": "1.5", "Otto and Sherrick Farms": "1",
            "Roulette Lane": "1.5", "Piper Farm": "2", "Hill's Counterattack": "1",
            # HARPERS FERRY
            "Maryland Heights": "1.5", "River Crossing": "2.5", "Downtown": "1",
            "School House Ridge": "1", "Bolivar Heights Camp": "1.5", "High Street": "1",
            "Shenandoah Street": "1.5", "Harpers Ferry Graveyard": "1", "Washington Street": "1",
            "Bolivar Heights Redoubt": "2",
            # SOUTH MOUNTAIN
            "Garland's Stand": "2.5", "Cox's Push": "2.5", "Hatch's Attack": "2",
            "Anderson's Counterattack": "1", "Reno's Fall": "1.5", "Colquitt's Defense": "2",
            # DRILL CAMP
            "Alexander Farm": "2", "Crossroads": "0", "Smith Field": "1",
            "Crecy's Cornfield": "1.5", "Crossley Creek": "1", "Larsen Homestead": "1.5",
            "South Woodlot": "1.5", "Flemming's Meadow": "2", "Wagon Road": "2",
            "Union Camp": "1.5", "Pat's Turnpike": "1.5", "Stefan's Lot": "1",
            "Confederate Encampment": "2"
        }
        bias_options = {
            "Balanced": "0",
            "Lightly Attack Biased": "1", "Heavily Attack Biased": "1.5",
            "Lightly Defense Biased": "2", "Heavily Defense Biased": "2.5",
        }
        # Create a reverse mapping to display the text in the OptionMenu
        reverse_bias_options = {v: k for k, v in bias_options.items()}

        # Helper class for collapsible frames
        class CollapsibleFrame(ttk.Frame):
            def __init__(self, parent, text="", *args, **kwargs):
                super().__init__(parent, *args, **kwargs)
                self.columnconfigure(0, weight=1)
                self.text = text
                self.is_open = tk.BooleanVar(value=False) # Start Closed

                header_frame = ttk.Frame(self, style="Collapsible.TFrame")
                header_frame.grid(row=0, column=0, sticky="ew")
                header_frame.columnconfigure(0, weight=1)

                self.button = ttk.Label(header_frame, text=f"▶ {self.text}", font=("Segoe UI", 10, "bold"), anchor="w")
                self.button.grid(row=0, column=0, sticky="ew", padx=5, pady=2)
                self.button.bind("<Button-1>", self.toggle)
                
                self.frame = ttk.Frame(self, padding=(10, 5, 10, 10))
                self.frame.grid(row=1, column=0, sticky="ew")
                self.frame.grid_remove() # Start closed

            def toggle(self, event=None):
                if self.is_open.get():
                    self.frame.grid_remove()
                    self.button.config(text=f"▶ {self.text}")
                    self.is_open.set(False)
                else:
                    self.frame.grid()
                    self.button.config(text=f"▼ {self.text}")
                    self.is_open.set(True)

        style = ttk.Style(dialog)
        style.configure("TFrame", background="#f0f0f0")
        style.configure("Collapsible.TFrame", background="#e0e0e0")
        style.configure("TLabel", background="#f0f0f0")
        style.configure("TMenubutton", background="white", borderwidth=1, relief="solid")

        small_font = tkFont.Font(family="Segoe UI", size=9)

        for area, map_list in maps.items():
            collapsible = CollapsibleFrame(scrollable_frame, text=area.replace("_", " ").title())
            collapsible.pack(fill="x", expand=True, pady=(5, 0), padx=5)

            # Use a grid within the collapsible frame for better alignment
            collapsible.frame.columnconfigure(1, weight=1)
            for i, map_name in enumerate(sorted(map_list)):
                if map_name not in self.map_biases:
                     default_value = default_biases.get(map_name, "0")
                     self.map_biases[map_name] = tk.StringVar(value=default_value)

                map_var = self.map_biases[map_name]

                ttk.Label(collapsible.frame, text=f"{map_name}:", font=small_font) \
                   .grid(row=i, column=0, sticky="w", padx=5, pady=3)

                current_bias_text = reverse_bias_options.get(map_var.get(), "Balanced")
                display_var = tk.StringVar(value=current_bias_text)

                def create_callback(mv, dv):
                    return lambda chosen_text: (mv.set(bias_options[chosen_text]), dv.set(chosen_text))

                option_menu = ttk.OptionMenu(
                    collapsible.frame,
                    display_var,
                    current_bias_text, # Initial value
                    *bias_options.keys(),
                    command=create_callback(map_var, display_var),
                    style="TMenubutton"
                )
                
                option_menu.grid(row=i, column=1, sticky="e", padx=5, pady=3)

        scrollable_frame.columnconfigure(0, weight=1)
        buttons_frame = tk.Frame(dialog, bg="#f0f0f0")
        buttons_frame.pack(fill=tk.X, padx=10, pady=10, side=tk.BOTTOM)

        ok_button = tk.Button(buttons_frame, text="OK", command=dialog.destroy, width=10)
        ok_button.pack(side=tk.RIGHT)
        
    def show_elo_calculator(self):
        """Displays a window to calculate and show Elo ratings for all units."""
        if not self.season:
            messagebox.showinfo("Elo Calculator", "No season data available.")
            return

        sel = self.week_list.curselection()
        selected_week_idx = sel[0] if sel else len(self.season) - 1

        try:
            # Get current and previous week's ratings to calculate change
            current_elos, elo_changes = self.calculate_elo_ratings(max_week_index=selected_week_idx)
            
        except Exception as e:
            messagebox.showerror("Elo Error", f"An error occurred during Elo calculation: {e}", parent=self.master)
            return

        # --- UI Setup ---
        win = tk.Toplevel(self.master)
        win.title(f"Elo Ratings (Up to Week {selected_week_idx + 1})")
        win.geometry("600x600")

        cols = ["rank", "unit", "rating", "change"]
        tree = ttk.Treeview(win, columns=cols, show="headings")
        tree.heading("rank", text="Rank", command=lambda: self.sort_column(tree, "rank", False))
        tree.heading("unit", text="Unit (Rounds Played)", command=lambda: self.sort_column(tree, "unit", False))
        tree.heading("rating", text="Elo Rating", command=lambda: self.sort_column(tree, "rating", False))
        tree.heading("change", text="Elo Change", command=lambda: self.sort_column(tree, "change", False))

        tree.column("rank", width=60, anchor="center")
        tree.column("unit", width=200, anchor="w")
        tree.column("rating", width=100, anchor="center")
        tree.column("change", width=100, anchor="center")

        # Combine data for sorting and display
        display_data = []
        rounds_played = current_elos.pop("rounds_played", {})
        for unit, rating in current_elos.items():
            change = elo_changes.get(unit, 0)
            rounds = rounds_played.get(unit, 0)
            # Only include units that have played at least one round
            if rounds > 0:
                display_data.append({"unit": unit, "rating": rating, "change": change, "rounds": rounds})

        # Sort data by Elo rating descending
        display_data.sort(key=lambda item: item["rating"], reverse=True)


        vsb = ttk.Scrollbar(win, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=vsb.set)

        bottom_frame = ttk.Frame(win)
        bottom_frame.pack(fill=tk.X, side=tk.BOTTOM, padx=10, pady=(5, 10))
        explain_button = ttk.Button(bottom_frame, text="Explain Elo", command=self.show_elo_explanation)
        explain_button.pack(side=tk.LEFT)

        history_button = ttk.Button(bottom_frame, text="Show History", command=self.show_elo_history)
        history_button.pack(side=tk.LEFT, padx=(10, 0))

        def redraw_elo_table():
            """Clears and redraws the Elo table based on the toggle state."""
            for item in tree.get_children():
                tree.delete(item)

            show_non_token = self.show_non_token_elo_var.get()

            # Filter data based on the toggle
            filtered_data = []
            for item in display_data:
                if show_non_token or item["unit"] not in self.non_token_units:
                    filtered_data.append(item)
            
            # Re-sort and rank the filtered data
            filtered_data.sort(key=lambda item: item["rating"], reverse=True)

            for i, data in enumerate(filtered_data, 1):
                change_val = data['change']
                change_str = "↔ 0.00"
                if change_val > 0.005:
                    change_str = f"↑ {change_val:.2f}"
                elif change_val < -0.005:
                    change_str = f"↓ {abs(change_val):.2f}"
                
                unit_display = f"*{data['unit']}" if data['unit'] in self.non_token_units else data['unit']
                unit_display_with_rounds = f"{unit_display} ({data['rounds']})"
                tree.insert("", tk.END, values=(i, unit_display_with_rounds, f"{data['rating']:.2f}", change_str))

        toggle_button = ttk.Checkbutton(
            bottom_frame,
            text="Show Non-Token Units",
            variable=self.show_non_token_elo_var,
            command=redraw_elo_table
        )
        toggle_button.pack(side=tk.RIGHT, padx=(10, 0))

        # Initial drawing of the table through the redraw function
        redraw_elo_table()
        
        tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)

    def show_elo_explanation(self):
        """Displays a messagebox explaining the custom Elo rating system."""
        explanation = """
    **Custom Elo Rating System Explained**

    Our Elo system measures the relative strength of regiments based on weekly match performance. It expands the classic Elo formula with custom mechanics designed for War of Rights  capturing the unique dynamics of regiment size, leadership, and consistency.

    **1. Core Concept**
        - Every regiment starts with a baseline rating (typically **1500**).
        - When two teams play, the system calculates an **expected outcome** based on their average Elo difference.
        - If a team performs better than expected, they gain points; if worse, they lose points.

    **2. Strength of Field & Upsets**
        - **Upset Bonus:** Defeating a team rated much higher than your own grants extra Elo  the greater the upset, the bigger the reward.
        - **Punishment for Upsets:** Losing to a much lower-rated team results in a heavier Elo loss.
        - Upset effects scale smoothly with the Elo gap  there’s no arbitrary cutoff.

    **3. Player Count Weighting (Log-Scaled & Normalized)**
        - Each regiment’s Elo contribution is weighted by its **average player count**, 
        but with *diminishing returns* using a **logarithmic scale**.
        - Larger regiments still matter more, but each additional player adds slightly less impact.
        - All weights are **normalized**, ensuring total Elo change per team is always balanced  
        large rosters can’t inflate results, and smaller regiments still see meaningful movement.
        - Example: A 30-player unit has ~1.5× the influence of a 10-player unit (not 3× as before).

    **4. Map Bias Adjustment**
        - To account for built-in map imbalances, the system adjusts the **expected outcome** before calculating Elo changes.
        - Each map is classified as balanced, light/heavy attacker-favored, or light/heavy defender-favored.
        - Based on this, a **bias multiplier** is applied to the starting win probability. For example, a heavy attacker-favored map increases the attacker's expected win chance by **30%**, making a defender victory a significant upset worth more Elo.
        - This ensures that wins on difficult maps are rewarded more heavily, and losses are less punishing.

    **5. Lead Unit Multiplier (×2.0)**
        - The designated **Lead Unit** for a round has its Elo impact doubled.
        - A win as lead is more rewarding; a loss is more punishing  reflecting the higher responsibility of command.

    **6. Match Outcomes & Round Structure**
        - Each week typically includes **two rounds**.
            - **2–0 Sweep:** Awards a **1.25× Sweep Bonus** for dominating both rounds.
        - Round results are processed independently, keeping the system accurate even when rosters shift week to week.

    **7. Dynamic K-Factor & Other Multipliers**
        - **Provisional K-Factor (128):** Used for a regiment’s first 10 rounds; helps new units reach accurate ratings quickly.
        - **Standard K-Factor (96):** Used afterward to stabilize ratings.
        - **Playoff Multiplier (×1.25):** Increases Elo volatility during playoff matches to reflect higher stakes.

    **8. Proportional Intra-Team Elo Distribution**
        - To ensure fairness within a team, the amount of Elo gained or lost is **proportional** to a unit’s rating relative to its own team’s average.
        - **Higher-rated units** gain slightly less on a win and lose a bit more on a loss, as they are expected to perform well.
        - **Lower-rated units** gain more on a win and lose less on a loss, rewarding them for contributing to an upset.
        - This prevents high-Elo units from "farming" points off lower-rated teammates and ensures every unit's contribution is fairly recognized.

    **9. Fairness & Long-Term Balance**
        - Elo changes are proportional and self-correcting over time.
        - Smaller regiments aren’t overshadowed by larger allies.
        - Ratings naturally stabilize around 1500, preventing inflation across seasons.

    In short:  Our Elo system rewards **performance**, **leadership**, and **consistency** not just size. Every regiment, big or small, can climb the ranks through teamwork, execution, and grit.
    """
        messagebox.showinfo("Elo System Explained", explanation, parent=self.master)


    def show_elo_history(self):
        """Displays a table with the Elo history and rank of each unit week by week."""
        if not self.season:
            messagebox.showinfo("Elo History", "No season data available.")
            return

        sel = self.week_list.curselection()
        # Default to the last week if none is selected
        max_week_idx = sel[0] if sel else len(self.season) - 1

        win = tk.Toplevel(self.master)
        win.title(f"Unit Elo History (Up to Week {max_week_idx + 1})")
        win.geometry("1400x600")

        # --- Data Calculation ---
        # Calculate history only up to the selected week
        elo_history_by_week = [self.calculate_elo_ratings(max_week_index=i)[0] for i in range(max_week_idx + 1)]

        # --- UI Setup ---
        week_columns = ["Initial"] + [f"Week {i+1}" for i in range(max_week_idx + 1)]
        cols = ["unit"] + week_columns
        
        # Get all units that have participated up to the selected week
        final_elos_for_participation = elo_history_by_week[-1] if elo_history_by_week else {}
        rounds_played = final_elos_for_participation.get("rounds_played", {})
        participating_units = sorted([unit for unit, rounds in rounds_played.items() if rounds > 0])

        tree = ttk.Treeview(win, columns=cols, show="headings")

        # --- Dynamic Column Sizing ---
        # Calculate width for the 'Unit' column based on the longest name
        if participating_units:
            # Add extra chars for the asterisk and round count `* (XX)`
            longest_unit_name = max(participating_units, key=len) + " (XX)"
            font = tkFont.Font()
            unit_col_width = font.measure(longest_unit_name) + 20 # Add padding
        else:
            unit_col_width = 150

        tree.heading("unit", text="Unit", command=lambda: self.sort_column(tree, "unit", False))
        tree.column("unit", width=unit_col_width, anchor=tk.W, stretch=tk.NO)

        # Make other columns responsive
        padding = 100 # Approx space for scrollbar, etc.
        available_width = 1400 - unit_col_width - padding
        week_col_width = available_width // len(week_columns) if week_columns else 100
        week_col_width = max(week_col_width, 90) # Minimum width of 90

        for i, week_col in enumerate(week_columns):
            tree.heading(week_col, text=week_col, command=lambda c=week_col: self.sort_column(tree, c, False))
            tree.column(week_col, width=week_col_width, anchor=tk.CENTER)

        
        # Prepare data for display
        display_data_by_unit = defaultdict(dict)
        initial_rating = 1500 # As defined in calculate_elo_ratings

        for unit in participating_units:
             display_data_by_unit[unit]["Initial"] = f"{initial_rating} (-)"

        for week_idx, elo_data in enumerate(elo_history_by_week):
            # Sort units by Elo for ranking within this week
            sorted_units_this_week = sorted(
                [item for item in elo_data.items() if isinstance(item[1], (int, float))],
                key=lambda item: item[1],
                reverse=True
            )
            ranks_this_week = {unit: rank for rank, (unit, _) in enumerate(sorted_units_this_week, 1)}
            
            # Get previous week's elo for change calculation
            prev_week_elos = elo_history_by_week[week_idx-1] if week_idx > 0 else defaultdict(lambda: initial_rating)

            for unit, rating in elo_data.items():
                if isinstance(rating, (int, float)):
                    rank = ranks_this_week.get(unit, '-')
                    change = rating - prev_week_elos[unit]
                    change_str = "↔"
                    if change > 0.005: change_str = f"↑{change:.0f}"
                    elif change < -0.005: change_str = f"↓{abs(change):.0f}"
                    
                    display_data_by_unit[unit][f"Week {week_idx+1}"] = f"{rating:.0f} ({rank}, {change_str})"

            
        vsb = ttk.Scrollbar(win, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=vsb.set)

        def redraw_history_table():
            """Clears and redraws the Elo history table based on the toggle."""
            for item in tree.get_children():
                tree.delete(item)

            show_non_token = self.show_non_token_elo_var.get()
            
            filtered_units = []
            if show_non_token:
                filtered_units = participating_units
            else:
                filtered_units = [u for u in participating_units if u not in self.non_token_units]

            for unit in filtered_units:
                display_text = f"*{unit}" if unit in self.non_token_units else unit
                values = [display_text]
                for week_col in week_columns:
                    values.append(display_data_by_unit[unit].get(week_col, "N/A"))
                tree.insert("", "end", values=values)
        
        bottom_frame = ttk.Frame(win)
        bottom_frame.pack(fill=tk.X, side=tk.BOTTOM, padx=10, pady=(5, 10))

        toggle_button = ttk.Checkbutton(
            bottom_frame,
            text="Show Non-Token Units",
            variable=self.show_non_token_elo_var,
            command=redraw_history_table
        )
        toggle_button.pack(side=tk.RIGHT)

        redraw_history_table() # Initial draw

        tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)

    def get_map_bias_level(self, map_name):
        """
        Returns the bias level for a given map from the configured Map Biases.
        0 = Balanced, 1 = Attacker Lightly Favored, 1.5 = Attacker Heavily Favored, 2 = Defender lightly favored, 2.5 = defender heavily favored.
        """
        if map_name and map_name in self.map_biases:
            try:
                return float(self.map_biases[map_name].get())
            except (ValueError, TypeError):
                return 0.0 # Default to balanced on error
        return 0.0 # Default to balanced if map not found

    def calculate_elo_ratings(self, max_week_index: int | None = None):
        """
        Calculates Elo ratings for all units, using a dynamic K-factor and accounting for player counts and lead units.
        Returns the final ratings, the changes from the last week, and total rounds played for each unit.
        """
        try:
            initial_rating = int(self.elo_system_values["initial_elo"].get())
            k_factor_standard = int(self.elo_system_values["k_factor_standard"].get())
            k_factor_provisional = int(self.elo_system_values["k_factor_provisional"].get())
            provisional_rounds = int(self.elo_system_values["provisional_rounds"].get())
            sweep_bonus_multiplier = float(self.elo_system_values["sweep_bonus_multiplier"].get())
            lead_multiplier = float(self.elo_system_values["lead_multiplier"].get())
            size_influence = float(self.elo_system_values["size_influence"].get())
            playoff_multiplier = float(self.elo_system_values["playoff_multiplier"].get())
        except (ValueError, KeyError):
            # Fallback to defaults if settings are invalid
            initial_rating=1500
            k_factor_standard=96
            k_factor_provisional=128
            provisional_rounds=10
            sweep_bonus_multiplier = 1.25
            lead_multiplier=2.0
            size_influence = 1.0
            playoff_multiplier = 1.25

        elo_ratings = defaultdict(lambda: initial_rating)
        rounds_played = defaultdict(int)

        # Initialize all units, including non-token ones, to get a baseline
        for unit in self.units:
            _ = elo_ratings[unit]
            
        elo_history_by_week = [elo_ratings.copy()]
        weeks_to_process = self.season[:max_week_index + 1] if max_week_index is not None else self.season

        for week_idx, week_data in enumerate(weeks_to_process):
            last_week_elos = elo_history_by_week[-1]
            current_week_elos = last_week_elos.copy()

            team_A_units = week_data.get("A", set())
            team_B_units = week_data.get("B", set())
            
            if not team_A_units or not team_B_units:
                elo_history_by_week.append(current_week_elos)
                continue

            # --- Calculate player-weighted Elo for each team ---
            is_playoffs = week_data.get("playoffs", False)

            # --- Determine sweep bonuses before any rounds ---
            round1_winner = week_data.get("round1_winner")
            round2_winner = week_data.get("round2_winner")

            sweep_bonus_A = sweep_bonus_multiplier if (round1_winner == "A" and round2_winner == "A") else 1.0
            sweep_bonus_B = sweep_bonus_multiplier if (round1_winner == "B" and round2_winner == "B") else 1.0

            # --- Process each round ---
            for r in [1, 2]:
                winner = week_data.get(f"round{r}_winner")
                if not winner: continue

                # Calculate team Elo averages before each round
                total_players_A = sum(self.get_unit_average_player_count(u, week_idx) for u in team_A_units)
                total_players_B = sum(self.get_unit_average_player_count(u, week_idx) for u in team_B_units)

                avg_elo_A = sum(current_week_elos[u] * self.get_unit_average_player_count(u, week_idx) for u in team_A_units) / total_players_A if total_players_A > 0 else initial_rating
                avg_elo_B = sum(current_week_elos[u] * self.get_unit_average_player_count(u, week_idx) for u in team_B_units) / total_players_B if total_players_B > 0 else initial_rating

                # Determine leads for the round
                if is_playoffs:
                    lead_A = week_data.get(f"lead_A_r{r}")
                    lead_B = week_data.get(f"lead_B_r{r}")
                else:
                    lead_A = week_data.get("lead_A")
                    lead_B = week_data.get("lead_B")

                # --- NEW: Apply Map Bias ---
                map_name = week_data.get(f"round{r}_map")
                map_bias_level = self.get_map_bias_level(map_name) if map_name else 0
                
                # Instead of Elo offsets, define percentage multipliers
                try:
                   light_att = int(self.elo_bias_percentages["light_attacker"].get())
                   heavy_att = int(self.elo_bias_percentages["heavy_attacker"].get())
                   light_def = int(self.elo_bias_percentages["light_defender"].get())
                   heavy_def = int(self.elo_bias_percentages["heavy_defender"].get())
                   bias_percent_map = {
                       0: 1.00,
                       1: 1.0 + (light_att / 100.0),
                       1.5: 1.0 + (heavy_att / 100.0),
                       2: 1.0 - (light_def / 100.0),
                       2.5: 1.0 - (heavy_def / 100.0)
                   }
                except (ValueError, KeyError):
                   bias_percent_map = {0: 1.00, 1: 1.15, 1.5: 1.30, 2: 0.85, 2.5: 0.70} # Fallback
                bias_multiplier = bias_percent_map.get(map_bias_level, 1.00)

                usa_attack_maps = {
                    "East Woods Skirmish", "Nicodemus Hill", "Hooker's Push", "Bloody Lane",
                    "Pry Ford", "Smith Field", "Alexander Farm", "Crossroads",
                    "Wagon Road", "Hagertown Turnpike", "Pry Grist Mill", "Otto & Sherrick Farm",
                    "Piper Farm", "West Woods", "Dunker Church", "Burnside Bridge",
                    "Garland's Stand", "Cox's Push", "Hatch's Attack", "Colquitt's Defense",
                    "Flemming's Meadow", "Crossley Creek", "Confederate Encampment"
                }

                if map_name:
                    is_usa_attack = any(base_map in map_name for base_map in usa_attack_maps)
                    flipped = week_data.get(f"round{r}_flipped", False)
                    usa_side = "A" if not flipped else "B"
                    
                    attacker_side = usa_side if is_usa_attack else ("B" if usa_side == "A" else "A")

                    # Compute expected outcome first
                    expected_A = 1 / (1 + 10 ** ((avg_elo_B - avg_elo_A) / 400))

                    # Apply percent bias to expected probability
                    if attacker_side == "A":
                        expected_A *= bias_multiplier
                    else:
                        expected_A /= bias_multiplier

                    expected_A = max(0.05, min(0.95, expected_A)) # Clamp to avoid extremes
                else:
                    expected_A = 1 / (1 + 10**((avg_elo_B - avg_elo_A) / 400))
                
                score_A, score_B = (1, 0) if winner == "A" else (0, 1)
                base_change = score_A - expected_A
                
                # --- Distribute change based on player contribution & lead status ---
                def apply_elo_changes(team_units, total_players, lead_unit, sign, sweep_bonus):
                    if total_players <= 0: return
                    ''' Old Method of Calculating Elo Changes Below - Disbabled for now.
                    # Calculate weighted changes with lead multiplier
                    weighted_changes = {
                        unit: (self.get_unit_average_player_count(unit, week_idx) / total_players) * (lead_multiplier if unit == lead_unit else 1)
                        for unit in team_units
                    }
                    
                    # Normalize so the sum of weights is 1 again - was disabled
                    total_weight = sum(weighted_changes.values())
                    if total_weight > 0:
                        for u in team_units:
                            weighted_changes[u] /= total_weight
                    
                    for unit in team_units:
                        # Determine K-factor for this unit based on rounds played BEFORE this round
                        k = k_factor_provisional if rounds_played[unit] < provisional_rounds else k_factor_standard
                        
                        # Apply the normalized, weighted change

                        # Optional Playoff Multiplayer (higher stakes)
                        round_multiplier = 1.25 if is_playoffs else 1.0

                        delta = k * base_change * weighted_changes[unit] * sign * round_multiplier * sweep_bonus
                        current_week_elos[unit] += delta
                        '''
                    # Log-scaled + normalized weights
                    weights = {
                        u: (math.log(1 + self.get_unit_average_player_count(u, week_idx)) ** size_influence)
                        * (lead_multiplier if u == lead_unit else 1)
                        for u in team_units
                    }
                    total_weight = sum(weights.values())
                    for u in weights:
                        weights[u] /= total_weight

                    #Make Elo you gain/lose within a team, more proportional to the Elo of the unit and those around it.
                    team_avg_elo = sum(current_week_elos[u] for u in team_units) / len(team_units)

                    for u, w in weights.items():
                        k = k_factor_provisional if rounds_played[u] < provisional_rounds else k_factor_standard
                        round_multiplier = playoff_multiplier if is_playoffs else 1.0
                        # Relative factor: how far below or above the team average this unit is
                        relative_factor = max(0.8, min(1.2, (team_avg_elo / current_week_elos[u]) ** 0.5))
                        delta = k * base_change * w * sign * round_multiplier * sweep_bonus * relative_factor
                        current_week_elos[u] += delta

                apply_elo_changes(team_A_units, total_players_A, lead_A, 1, sweep_bonus_A)
                apply_elo_changes(team_B_units, total_players_B, lead_B, -1, sweep_bonus_B)

                # Increment rounds played AFTER Elo for the round is calculated
                for unit in team_A_units: rounds_played[unit] += 1
                for unit in team_B_units: rounds_played[unit] += 1

            elo_history_by_week.append(current_week_elos)

        final_elos = elo_history_by_week[-1]
        
        # Pass rounds played back with the ratings
        final_elos["rounds_played"] = rounds_played
        
        if len(elo_history_by_week) > 1:
            prev_elos = elo_history_by_week[-2]
            elo_changes = {unit: final_elos[unit] - prev_elos.get(unit, initial_rating) for unit in self.units}
        else:
            elo_changes = {unit: final_elos[unit] - initial_rating for unit in self.units}
            
        return final_elos, elo_changes


    def calculate_and_display_roster_strength(self):
        """Calculates and updates the Roster Strength labels in the UI."""
        if not self.current_week:
            self.roster_strength_vars["A"].set("Strength: -")
            self.roster_strength_vars["B"].set("Strength: -")
            self.win_chance_vars["A"].set("Win Chance: -")
            self.win_chance_vars["B"].set("Win Chance: -")
            return

        # Calculate Elo ratings up to the week *before* the current one
        # to get a baseline strength before this week's match.
        current_week_idx = self.season.index(self.current_week)
        previous_week_idx = current_week_idx - 1

        initial_rating = int(self.elo_system_values["initial_elo"].get())
        if previous_week_idx < 0:
            # No previous weeks, so all units are at initial rating
            elo_ratings = defaultdict(lambda: initial_rating)
        else:
            try:
                elo_ratings, _ = self.calculate_elo_ratings(max_week_index=previous_week_idx)
            except Exception:
                # If Elo fails for any reason, gracefully fall back
                elo_ratings = defaultdict(lambda: initial_rating)

        team_A_units = self.current_week.get("A", set())
        team_B_units = self.current_week.get("B", set())

        avg_elo_A, avg_elo_B = initial_rating, initial_rating
        
        # Calculate weighted average for Team A
        total_players_A = sum(self.get_unit_average_player_count(u, current_week_idx) for u in team_A_units)
        if team_A_units and total_players_A > 0:
            avg_elo_A = sum(elo_ratings[u] * self.get_unit_average_player_count(u, current_week_idx) for u in team_A_units) / total_players_A
            self.roster_strength_vars["A"].set(f"Strength: {avg_elo_A:.0f}")
        else:
            self.roster_strength_vars["A"].set("Strength: -")
            self.win_chance_vars["A"].set("Win Chance: -")

        # Calculate weighted average for Team B
        total_players_B = sum(self.get_unit_average_player_count(u, current_week_idx) for u in team_B_units)
        if team_B_units and total_players_B > 0:
            avg_elo_B = sum(elo_ratings[u] * self.get_unit_average_player_count(u, current_week_idx) for u in team_B_units) / total_players_B
            self.roster_strength_vars["B"].set(f"Strength: {avg_elo_B:.0f}")
        else:
            self.roster_strength_vars["B"].set("Strength: -")
            self.win_chance_vars["B"].set("Win Chance: -")

        # Calculate and display win chance if both teams have units
        if team_A_units and team_B_units and total_players_A > 0 and total_players_B > 0:
            expected_A = 1 / (1 + 10**((avg_elo_B - avg_elo_A) / 400))
            expected_B = 1 - expected_A
            self.win_chance_vars["A"].set(f"Win Chance: {expected_A:.1%}")
            self.win_chance_vars["B"].set(f"Win Chance: {expected_B:.1%}")
        else:
            # If one team is empty, the other has 100% chance, or it's undefined if both are empty
            if team_A_units and total_players_A > 0:
                self.win_chance_vars["A"].set("Win Chance: 100.0%")
                self.win_chance_vars["B"].set("Win Chance: 0.0%")
            elif team_B_units and total_players_B > 0:
                self.win_chance_vars["A"].set("Win Chance: 0.0%")
                self.win_chance_vars["B"].set("Win Chance: 100.0%")
            else:
                self.win_chance_vars["A"].set("Win Chance: -")
                self.win_chance_vars["B"].set("Win Chance: -")


    def open_weekly_casualty_input(self):
        """Opens a dialog to input per-unit attendance and casualties for the selected week."""
        sel = self.week_list.curselection()
        if not sel:
            messagebox.showwarning("No Week Selected", "Please select a week to input casualties for.")
            return
        week_idx = sel[0]
        week_data = self.season[week_idx]

        dialog = tk.Toplevel(self.master)
        dialog.title(f"Input Casualties for {week_data.get('name', f'Week {week_idx+1}')}")
        dialog.geometry("700x550")
        dialog.minsize(600, 400)
        dialog.transient(self.master)
        dialog.grab_set()

        # Data store for the dialog
        dialog_data = {
            self.team_names["A"].get(): {"casualties": {"r1": {}, "r2": {}}},
            self.team_names["B"].get(): {"casualties": {"r1": {}, "r2": {}}}
        }

        main_frame = ttk.Frame(dialog, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        main_frame.columnconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(0, weight=1)

        def create_team_panel(parent, team_name, team_id):
            panel = ttk.LabelFrame(parent, text=f"{team_name} Units")
            panel.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
            panel.columnconfigure(0, weight=1)
            panel.rowconfigure(1, weight=1)

            # Attending List
            ttk.Label(panel, text="Attending").grid(row=0, column=0, sticky="ew")
            attending_list = tk.Listbox(panel, selectmode=tk.EXTENDED)
            attending_list.grid(row=1, column=0, sticky="nsew", padx=5)
            
            # Auto-populate with units from the selected week's roster
            roster_units = sorted(list(week_data.get(team_id, set())))
            for unit in roster_units:
                attending_list.insert(tk.END, unit)

            # --- Casualties Frames ---
            cas_main_frame = ttk.Frame(panel)
            cas_main_frame.grid(row=2, column=0, sticky="nsew", pady=(10,0))
            cas_main_frame.columnconfigure(0, weight=1)
            cas_main_frame.columnconfigure(1, weight=1)

            def create_casualty_sub_panel(parent_frame, round_num):
                round_key = f"r{round_num}"
                cas_frame = ttk.LabelFrame(parent_frame, text=f"Round {round_num} Casualties")
                cas_frame.pack(fill=tk.BOTH, expand=True, padx=(0, 2), pady=(0,5))
                
                # This frame will contain the dynamically added casualty entries
                entries_frame = ttk.Frame(cas_frame)
                entries_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
                entries_frame.columnconfigure(1, weight=1)
                
                # Ensure the dict exists
                dialog_data[team_name]["casualties"][round_key] = {}

                # Load existing data for this week for the specific round
                existing_casualties = week_data.get("weekly_casualties", {}).get(team_name, {}).get(round_key, {})

                # Create new entries for currently listed units
                for i, unit in enumerate(attending_list.get(0, tk.END)):
                    ttk.Label(entries_frame, text=f"{unit}:").grid(row=i, column=0, sticky="w")
                    var = tk.StringVar(value=str(existing_casualties.get(unit, 0)))
                    entry = ttk.Entry(entries_frame, textvariable=var, width=8)
                    entry.grid(row=i, column=1, sticky="w", padx=5)
                    dialog_data[team_name]["casualties"][round_key][unit] = var

            # Create panels for both rounds
            r1_frame = ttk.Frame(cas_main_frame)
            r1_frame.grid(row=0, column=0, sticky="nsew")
            create_casualty_sub_panel(r1_frame, 1)

            r2_frame = ttk.Frame(cas_main_frame)
            r2_frame.grid(row=0, column=1, sticky="nsew")
            create_casualty_sub_panel(r2_frame, 2)

            return attending_list

        team_a_name = self.team_names["A"].get()
        team_b_name = self.team_names["B"].get()
        
        usa_attending = create_team_panel(main_frame, team_a_name, "A")
        csa_attending = create_team_panel(main_frame, team_b_name, "B")

        def on_save():
            try:
                team_a_name = self.team_names["A"].get()
                team_b_name = self.team_names["B"].get()
                
                # Helper to process a round's data
                def process_round_casualties(team_name, round_key):
                    casualties = {}
                    if round_key in dialog_data[team_name]["casualties"]:
                        for unit, var in dialog_data[team_name]["casualties"][round_key].items():
                            try:
                                casualties[unit] = int(var.get()) if var.get() else 0
                            except ValueError:
                                casualties[unit] = 0 # Default to 0 on invalid input
                    return casualties

                # Process both rounds for both teams
                usa_r1_cas = process_round_casualties(team_a_name, "r1")
                usa_r2_cas = process_round_casualties(team_a_name, "r2")
                csa_r1_cas = process_round_casualties(team_b_name, "r1")
                csa_r2_cas = process_round_casualties(team_b_name, "r2")

                week_data["weekly_casualties"] = {
                    team_a_name: {"r1": usa_r1_cas, "r2": usa_r2_cas},
                    team_b_name: {"r1": csa_r1_cas, "r2": csa_r2_cas},
                }

                # Recalculate and save the main casualty numbers for the week
                week_data["r1_casualties_A"] = sum(usa_r1_cas.values())
                week_data["r1_casualties_B"] = sum(csa_r1_cas.values())
                week_data["r2_casualties_A"] = sum(usa_r2_cas.values())
                week_data["r2_casualties_B"] = sum(csa_r2_cas.values())


                self.on_week_select() # Refresh main window UI
                dialog.destroy()
            except ValueError:
                messagebox.showerror("Invalid Input", "Casualties must be whole numbers.", parent=dialog)

        button_frame = ttk.Frame(dialog)
        button_frame.pack(fill=tk.X, side=tk.BOTTOM, padx=10, pady=10)
        ttk.Button(button_frame, text="Save", command=on_save).pack(side=tk.RIGHT)
        ttk.Button(button_frame, text="Cancel", command=dialog.destroy).pack(side=tk.RIGHT, padx=5)


if __name__ == "__main__":
    root = tk.Tk()
    SeasonTrackerGUI(root)
    root.mainloop()
    