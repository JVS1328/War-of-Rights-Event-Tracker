#!/usr/bin/env python3
"""
War of Rights Map Rangefinder Tool
A lightweight utility to measure distances on War of Rights maps.
Scale: 1 pixel = 1 yard in-game
"""

import sys
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from PIL import Image, ImageTk
import math


class MapRangefinder:
    """Modern GUI map viewer with rangefinding capabilities."""

    def __init__(self, root, image_path=None):
        self.root = root
        self.root.title("War of Rights - Map Rangefinder")
        self.root.geometry("1200x800")

        # State
        self.image = None
        self.photo = None
        self.image_path = image_path
        self.zoom_level = 1.0
        self.ruler_points = []
        self.ruler_items = []

        # Pan state
        self.pan_start_x = 0
        self.pan_start_y = 0

        # Canvas offset for zoom positioning
        self.canvas_offset_x = 0
        self.canvas_offset_y = 0

        self._setup_ui()

        if image_path:
            self.load_image(image_path)

    def _setup_ui(self):
        """Create the user interface."""
        # Toolbar
        toolbar = ttk.Frame(self.root, padding="5")
        toolbar.pack(side=tk.TOP, fill=tk.X)

        ttk.Button(toolbar, text="Open Map", command=self.open_file).pack(side=tk.LEFT, padx=2)
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=5)

        ttk.Button(toolbar, text="Zoom In", command=self.zoom_in).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="Zoom Out", command=self.zoom_out).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="Reset Zoom", command=self.reset_zoom).pack(side=tk.LEFT, padx=2)
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=5)

        ttk.Button(toolbar, text="Clear Ruler", command=self.clear_ruler).pack(side=tk.LEFT, padx=2)

        # Canvas for map display
        canvas_frame = ttk.Frame(self.root)
        canvas_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        self.canvas = tk.Canvas(canvas_frame, bg="#2b2b2b", highlightthickness=0)
        self.canvas.pack(fill=tk.BOTH, expand=True)

        # Status bar
        self.status_bar = ttk.Label(self.root, text="Load a map to begin",
                                     relief=tk.SUNKEN, anchor=tk.W, padding="5")
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)

        # Bind events
        self.canvas.bind("<Button-1>", self.on_click)
        self.canvas.bind("<Button-2>", self.start_pan)
        self.canvas.bind("<B2-Motion>", self.pan_move)
        self.canvas.bind("<ButtonRelease-2>", self.end_pan)
        self.canvas.bind("<MouseWheel>", self.on_mousewheel)
        self.canvas.bind("<Button-4>", self.on_mousewheel)  # Linux scroll up
        self.canvas.bind("<Button-5>", self.on_mousewheel)  # Linux scroll down

        # Keyboard shortcuts
        self.root.bind("<Control-o>", lambda e: self.open_file())
        self.root.bind("<Control-c>", lambda e: self.clear_ruler())
        self.root.bind("<Escape>", lambda e: self.clear_ruler())

    def open_file(self):
        """Open a map image file."""
        filename = filedialog.askopenfilename(
            title="Select Map Image",
            filetypes=[
                ("Image files", "*.png *.jpg *.jpeg *.bmp *.gif"),
                ("All files", "*.*")
            ]
        )
        if filename:
            self.load_image(filename)

    def load_image(self, path):
        """Load and display a map image."""
        try:
            self.image = Image.open(path)
            self.image_path = path
            self.zoom_level = 1.0
            self.canvas_offset_x = 0
            self.canvas_offset_y = 0
            self.ruler_points = []
            self.clear_ruler()
            self._display_image()
            self.status_bar.config(text=f"Loaded: {path} | Click two points to measure distance")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to load image: {e}")

    def _display_image(self, focal_x=None, focal_y=None, old_zoom=None):
        """Render the image on canvas at current zoom level.

        Args:
            focal_x, focal_y: Image coordinates to keep centered during zoom
            old_zoom: Previous zoom level for repositioning
        """
        if not self.image:
            return

        # Calculate new size based on zoom
        new_width = int(self.image.width * self.zoom_level)
        new_height = int(self.image.height * self.zoom_level)

        # Use faster resampling for better performance
        # BILINEAR is much faster than LANCZOS and still looks good
        resample_method = Image.Resampling.BILINEAR if self.zoom_level > 0.5 else Image.Resampling.LANCZOS
        resized = self.image.resize((new_width, new_height), resample_method)
        self.photo = ImageTk.PhotoImage(resized)

        # Save current canvas view position
        if focal_x is not None and focal_y is not None and old_zoom is not None:
            # Calculate where the focal point should be after zoom
            new_focal_canvas_x = focal_x * self.zoom_level
            new_focal_canvas_y = focal_y * self.zoom_level

            old_focal_canvas_x = focal_x * old_zoom
            old_focal_canvas_y = focal_y * old_zoom

            # Calculate offset adjustment
            dx = new_focal_canvas_x - old_focal_canvas_x
            dy = new_focal_canvas_y - old_focal_canvas_y

            self.canvas_offset_x += dx
            self.canvas_offset_y += dy

        # Clear and redraw
        self.canvas.delete("all")
        self.canvas.create_image(self.canvas_offset_x, self.canvas_offset_y,
                                anchor=tk.NW, image=self.photo, tags="map")

        # Update scroll region
        self.canvas.config(scrollregion=(self.canvas_offset_x, self.canvas_offset_y,
                                        self.canvas_offset_x + new_width,
                                        self.canvas_offset_y + new_height))

        # Redraw ruler if exists
        self._redraw_ruler()

    def zoom_in(self):
        """Increase zoom level (zooms to canvas center)."""
        if not self.image:
            return

        old_zoom = self.zoom_level
        self.zoom_level *= 1.2

        # Get canvas center
        canvas_center_x = self.canvas.winfo_width() / 2
        canvas_center_y = self.canvas.winfo_height() / 2

        # Convert to image coordinates
        focal_x = (self.canvas.canvasx(canvas_center_x) - self.canvas_offset_x) / old_zoom
        focal_y = (self.canvas.canvasy(canvas_center_y) - self.canvas_offset_y) / old_zoom

        self._display_image(focal_x, focal_y, old_zoom)
        self.status_bar.config(text=f"Zoom: {self.zoom_level:.1f}x")

    def zoom_out(self):
        """Decrease zoom level (zooms from canvas center)."""
        if not self.image:
            return

        old_zoom = self.zoom_level
        self.zoom_level /= 1.2

        # Get canvas center
        canvas_center_x = self.canvas.winfo_width() / 2
        canvas_center_y = self.canvas.winfo_height() / 2

        # Convert to image coordinates
        focal_x = (self.canvas.canvasx(canvas_center_x) - self.canvas_offset_x) / old_zoom
        focal_y = (self.canvas.canvasy(canvas_center_y) - self.canvas_offset_y) / old_zoom

        self._display_image(focal_x, focal_y, old_zoom)
        self.status_bar.config(text=f"Zoom: {self.zoom_level:.1f}x")

    def reset_zoom(self):
        """Reset zoom to 100%."""
        self.zoom_level = 1.0
        self.canvas_offset_x = 0
        self.canvas_offset_y = 0
        self._display_image()
        self.status_bar.config(text="Zoom reset to 100%")

    def on_mousewheel(self, event):
        """Handle mouse wheel zoom (zooms to cursor position)."""
        if not self.image:
            return

        old_zoom = self.zoom_level

        # Determine scroll direction
        if event.num == 5 or event.delta < 0:
            self.zoom_level /= 1.1
        elif event.num == 4 or event.delta > 0:
            self.zoom_level *= 1.1

        # Get mouse position in canvas coordinates
        canvas_x = self.canvas.canvasx(event.x)
        canvas_y = self.canvas.canvasy(event.y)

        # Convert to image coordinates (position in original image)
        focal_x = (canvas_x - self.canvas_offset_x) / old_zoom
        focal_y = (canvas_y - self.canvas_offset_y) / old_zoom

        # Adjust offset so the point under mouse stays in same place
        new_canvas_x = focal_x * self.zoom_level + self.canvas_offset_x
        new_canvas_y = focal_y * self.zoom_level + self.canvas_offset_y

        # Calculate how much to shift
        shift_x = canvas_x - new_canvas_x
        shift_y = canvas_y - new_canvas_y

        self.canvas_offset_x += shift_x
        self.canvas_offset_y += shift_y

        self._display_image()

    def start_pan(self, event):
        """Start panning with middle mouse button."""
        self.pan_start_x = event.x
        self.pan_start_y = event.y
        self.canvas.config(cursor="fleur")

    def pan_move(self, event):
        """Pan the image."""
        dx = event.x - self.pan_start_x
        dy = event.y - self.pan_start_y
        self.canvas.move("all", dx, dy)
        self.canvas_offset_x += dx
        self.canvas_offset_y += dy
        self.pan_start_x = event.x
        self.pan_start_y = event.y

    def end_pan(self, event):
        """End panning."""
        self.canvas.config(cursor="")

    def on_click(self, event):
        """Handle left click for ruler tool."""
        if not self.image:
            return

        # Convert canvas coords to image coords
        canvas_x = self.canvas.canvasx(event.x)
        canvas_y = self.canvas.canvasy(event.y)

        # Account for zoom and offset
        img_x = (canvas_x - self.canvas_offset_x) / self.zoom_level
        img_y = (canvas_y - self.canvas_offset_y) / self.zoom_level

        self.ruler_points.append((canvas_x, canvas_y, img_x, img_y))

        # Draw point
        r = 4
        point = self.canvas.create_oval(
            canvas_x - r, canvas_y - r, canvas_x + r, canvas_y + r,
            fill="#ff4444", outline="#ffffff", width=2, tags="ruler"
        )
        self.ruler_items.append(point)

        if len(self.ruler_points) == 2:
            self._draw_ruler()

    def _draw_ruler(self):
        """Draw ruler line and show distance."""
        if len(self.ruler_points) != 2:
            return

        # Get canvas and image coordinates
        cx1, cy1, ix1, iy1 = self.ruler_points[0]
        cx2, cy2, ix2, iy2 = self.ruler_points[1]

        # Calculate distance in yards (based on original image pixels)
        distance = math.sqrt((ix2 - ix1)**2 + (iy2 - iy1)**2)

        # Draw line on canvas
        line = self.canvas.create_line(
            cx1, cy1, cx2, cy2,
            fill="#ff4444", width=3, tags="ruler"
        )
        self.ruler_items.append(line)

        # Draw text label
        mid_x = (cx1 + cx2) / 2
        mid_y = (cy1 + cy2) / 2

        text_bg = self.canvas.create_rectangle(
            mid_x - 60, mid_y - 15, mid_x + 60, mid_y + 15,
            fill="#ffeb3b", outline="#333333", width=2, tags="ruler"
        )
        text = self.canvas.create_text(
            mid_x, mid_y,
            text=f"{distance:.1f} yards",
            font=("Arial", 12, "bold"),
            fill="#000000", tags="ruler"
        )
        self.ruler_items.extend([text_bg, text])

        # Update status
        self.status_bar.config(text=f"Distance: {distance:.1f} yards | Click to measure again or press Clear")

        # Reset for next measurement
        self.ruler_points = []

    def _redraw_ruler(self):
        """Redraw ruler items after zoom/pan."""
        # Clear existing ruler graphics
        for item in self.ruler_items:
            self.canvas.delete(item)
        self.ruler_items = []

    def clear_ruler(self):
        """Clear current ruler measurement."""
        self.canvas.delete("ruler")
        self.ruler_items = []
        self.ruler_points = []
        self.status_bar.config(text="Ruler cleared | Click two points to measure distance")

    def run(self):
        """Start the application."""
        self.root.mainloop()


def main():
    """Main entry point."""
    root = tk.Tk()

    # Set modern theme if available
    try:
        style = ttk.Style()
        style.theme_use('clam')
    except:
        pass

    image_path = sys.argv[1] if len(sys.argv) > 1 else None

    app = MapRangefinder(root, image_path)
    app.run()


if __name__ == '__main__':
    main()
