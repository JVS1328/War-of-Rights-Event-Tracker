import json
import tkinter as tk
from tkinter import ttk # Added for Treeview
from tkinter import messagebox, filedialog, font as tkFont
from collections import Counter, defaultdict
from pathlib import Path
import csv
import itertools
import ast


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
        master.geometry("900x640") # Increased height
        master.resizable(True, True)
        master.minsize(900, 640) # Lock minimum size

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
        #   "lead_A_r2": str | None, "lead_B_r2": str | None
        # }
        self.current_week: dict | None = None
        self.team_names = {"A": tk.StringVar(value="Team A"), "B": tk.StringVar(value="Team B")}
        self.unit_points: defaultdict[str, int] = defaultdict(int)
        self.unit_player_counts: defaultdict[str, dict] = defaultdict(lambda: {"min": "0", "max": "100"})
        
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
            "r2_casualties_A": 0, "r2_casualties_B": 0
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
        self.refresh_units_list()  # Refresh units list to remove assigned unit

    def refresh_team_lists(self):
        self.list_a.delete(0, tk.END)
        self.list_b.delete(0, tk.END)
        if not self.current_week:
            return
        for u in sorted(self.current_week["A"]):
            display_text = f"*{u}" if u in self.non_token_units else u
            self.list_a.insert(tk.END, display_text)
        for u in sorted(self.current_week["B"]):
            display_text = f"*{u}" if u in self.non_token_units else u
            self.list_b.insert(tk.END, display_text)
        self.update_lead_menus()

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
        win.geometry("800x500")
        win.minsize(600, 400)

        cols = ["unit", "pts", "rank", "delta", "lw", "ll", "aw", "al"]
        col_names = {
            "unit": "Unit", "pts": "Points", "rank": "Rank", "delta": "Rank Δ",
            "lw": "L-Wins", "ll": "L-Loss", "aw": "A-Wins", "al": "A-Loss"
        }

        tree_frame = ttk.Frame(win)
        tree_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        tree = ttk.Treeview(tree_frame, columns=cols, show="headings")
        
        for col_id in cols:
            tree.heading(col_id, text=col_names[col_id], command=lambda c=col_id: self.sort_column(tree, c, False))
            tree.column(col_id, width=80, anchor=tk.CENTER)
        tree.column("unit", width=150, anchor=tk.W)
        tree.column("delta", width=60)
        tree.column("pts", width=60)
        tree.column("rank", width=60)


        # --- Data Preparation ---
        current_week_idx = selected_week_idx
        if current_week_idx < 0:
            tk.Label(win, text="No season data to display.").pack(padx=20, pady=20)
            return

        current_stats_data = self.calculate_points(max_week_index=current_week_idx)
        
        # Ensure all units have an entry
        for unit in self.units:
            if unit not in current_stats_data:
                current_stats_data[unit] # This will trigger the defaultdict factory

        sorted_current_week_units = sorted(
            current_stats_data.items(),
            key=lambda item: (-item[1]["points"], item[0])
        )
        
        current_ranks = {unit: rank for rank, (unit, _) in enumerate(sorted_current_week_units, 1)}

        previous_week_ranks = {}
        if current_week_idx > 0:
            prev_stats_data = self.calculate_points(max_week_index=current_week_idx - 1)
            sorted_prev_week_units = sorted(
                prev_stats_data.items(),
                key=lambda item: (-item[1]["points"], item[0])
            )
            previous_week_ranks = {unit: rank for rank, (unit, _) in enumerate(sorted_prev_week_units, 1)}

        # --- Populate Treeview ---
        for unit_name, stats in sorted_current_week_units:
            if unit_name in self.non_token_units:
                continue
            
            rank = current_ranks.get(unit_name, "-")
            pts = stats["points"]
            lw = stats["lw"]
            ll = stats["ll"]
            aw = stats["aw"]
            al = stats["al"]
            
            delta_display = "-"
            prev_rank = previous_week_ranks.get(unit_name)
            if prev_rank is not None and rank != "-":
                change = prev_rank - rank
                if change > 0: delta_display = f"↑{change}"
                elif change < 0: delta_display = f"↓{abs(change)}"
                else: delta_display = "↔0"
            
            tree.insert("", tk.END, values=(unit_name, pts, rank, delta_display, lw, ll, aw, al))

        # Scrollbars
        vsb = ttk.Scrollbar(tree_frame, orient="vertical", command=tree.yview)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        tree.configure(yscrollcommand=vsb.set)

        tree.pack(fill=tk.BOTH, expand=True)

    def calculate_casualties(self, max_week_index: int | None = None) -> tuple[defaultdict[str, int], defaultdict[str, int]]:
        """Calculates casualties inflicted and lost for each lead unit."""
        inflicted = defaultdict(int)
        lost = defaultdict(int)

        weeks_to_process = self.season
        if max_week_index is not None:
            weeks_to_process = self.season[:max_week_index + 1]

        for week in weeks_to_process:
            if week.get("playoffs", False):
                # Handle playoffs logic
                for r_num in [1, 2]:
                    lead_a = week.get(f"lead_A_r{r_num}")
                    lead_b = week.get(f"lead_B_r{r_num}")
                    cas_a = week.get(f"r{r_num}_casualties_A", 0)
                    cas_b = week.get(f"r{r_num}_casualties_B", 0)
                    if lead_a:
                        lost[lead_a] += cas_a
                        inflicted[lead_a] += cas_b
                    if lead_b:
                        lost[lead_b] += cas_b
                        inflicted[lead_b] += cas_a
            else:
                # Handle regular season logic
                lead_a = week.get("lead_A")
                lead_b = week.get("lead_B")
                r1_cas_a = week.get("r1_casualties_A", 0)
                r1_cas_b = week.get("r1_casualties_B", 0)
                r2_cas_a = week.get("r2_casualties_A", 0)
                r2_cas_b = week.get("r2_casualties_B", 0)

                if lead_a:
                    lost[lead_a] += r1_cas_a + r2_cas_a
                    inflicted[lead_a] += r1_cas_b + r2_cas_b
                if lead_b:
                    lost[lead_b] += r1_cas_b + r2_cas_b
                    inflicted[lead_b] += r1_cas_a + r2_cas_a
        
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
            
            # Count games played as lead for each unit up to the selected week
            games_as_lead = defaultdict(int)
            for week_idx, week in enumerate(self.season):
                if week_idx > max_week_idx: break
                if week.get("playoffs", False):
                    for r_num in [1, 2]:
                        lead_a = week.get(f"lead_A_r{r_num}")
                        lead_b = week.get(f"lead_B_r{r_num}")
                        if lead_a: games_as_lead[lead_a] += 1
                        if lead_b: games_as_lead[lead_b] += 1
                else:
                    lead_a = week.get("lead_A")
                    lead_b = week.get("lead_B")
                    if lead_a: games_as_lead[lead_a] += 1
                    if lead_b: games_as_lead[lead_b] += 1

            table_data = []
            all_lead_units = set(inflicted.keys()) | set(lost.keys())
            for unit in sorted(list(all_lead_units)):
                inflicted_count = inflicted.get(unit, 0)
                lost_count = lost.get(unit, 0)
                games = games_as_lead.get(unit, 0)
                
                kd_ratio_val = inflicted_count / lost_count if lost_count > 0 else float('inf')
                kd_ratio_str = f"{kd_ratio_val:.2f}" if lost_count > 0 else "∞"
                
                inflicted_pg = f"{inflicted_count / games:.2f}" if games > 0 else "0.00"
                lost_pg = f"{lost_count / games:.2f}" if games > 0 else "0.00"

                table_data.append((unit, inflicted_count, lost_count, kd_ratio_str, inflicted_pg, lost_pg, kd_ratio_val))

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
        header = ['Week', 'Unit', 'Team', 'Round', 'Loss']
        
        for week_idx, week_data in enumerate(self.season):
            week_num = week_idx + 1
            
            # --- Round 1 ---
            winner_r1 = week_data.get("round1_winner")
            if winner_r1 and winner_r1 != "None":
                loser_r1 = 'B' if winner_r1 == 'A' else 'A'
                
                for unit in week_data.get(winner_r1, set()):
                    records.append([week_num, unit, self.team_names[winner_r1].get(), 1, 0])
                
                for unit in week_data.get(loser_r1, set()):
                    records.append([week_num, unit, self.team_names[loser_r1].get(), 1, 1])

            # --- Round 2 ---
            winner_r2 = week_data.get("round2_winner")
            if winner_r2 and winner_r2 != "None":
                loser_r2 = 'B' if winner_r2 == 'A' else 'A'

                for unit in week_data.get(winner_r2, set()):
                    records.append([week_num, unit, self.team_names[winner_r2].get(), 2, 0])

                for unit in week_data.get(loser_r2, set()):
                    records.append([week_num, unit, self.team_names[loser_r2].get(), 2, 1])

        # Now, calculate the total losses per unit from the records
        losses_per_unit = Counter()
        for record in records:
            if record[4] == 1: # if loss is 1
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
                } for i, wk in enumerate(self.season)
            ],
            "team_names": {k: v.get() for k, v in self.team_names.items()},
            "point_system_values": {k: v.get() for k, v in self.point_system_values.items()}, # Save all point values
            "unit_player_counts": self.unit_player_counts,
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
                    "r2_casualties_B": wk_data.get("r2_casualties_B", 0)
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

            self.unit_player_counts = defaultdict(lambda: {"min": "0", "max": "100"})
            self.unit_player_counts.update(data.get("unit_player_counts", {}))

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

        # Populate unit counts
        all_units_for_counts = sorted(list(self.units))
        for unit in all_units_for_counts:
            counts = self.unit_player_counts[unit]
            unit_counts_tree.insert("", "end", values=(unit, counts["min"], counts["max"]))

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

        close_button = tk.Button(bottom_frame, text="Close", command=lambda: (save_unit_counts(), balancer_window.destroy()))
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

        # --- Save on Close ---
        def save_unit_counts():
            """Saves the current values from the treeview to the main app's dictionary."""
            for item_id in unit_counts_tree.get_children():
                values = unit_counts_tree.item(item_id, "values")
                if values:
                    unit, min_val, max_val = values
                    self.unit_player_counts[unit] = {"min": min_val, "max": max_val}

        balancer_window.protocol("WM_DELETE_WINDOW", lambda: (save_unit_counts(), balancer_window.destroy()))


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
                    teammate_score += teammate_history[u1][u2]
                for u1, u2 in itertools.combinations(team_B, 2):
                    teammate_score += teammate_history[u1][u2]

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
            save_counts_func() # Save the counts before applying
            self.current_week["A"] = set(team_A)
            self.current_week["B"] = set(team_B)
            self.refresh_team_lists()
            self.refresh_units_list()
            results_window.destroy()
            parent_window.destroy()

        button_frame = tk.Frame(main_frame)
        button_frame.grid(row=2, column=0, columnspan=2, pady=(10,0))
        tk.Button(button_frame, text="Apply to Week", command=apply_and_close).pack(side=tk.LEFT, padx=5)
        tk.Button(button_frame, text="Close", command=results_window.destroy).pack(side=tk.LEFT, padx=5)


if __name__ == "__main__":
    root = tk.Tk()
    SeasonTrackerGUI(root)
    root.mainloop()