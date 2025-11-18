#!/usr/bin/env python3
"""
War of Rights Map Rangefinder Tool
A simple utility to measure distances on War of Rights maps.
Scale: 1 pixel = 1 yard in-game
"""

import sys
import matplotlib.pyplot as plt
import matplotlib.image as mpimg
from matplotlib.backend_bases import MouseButton
import numpy as np


class MapRangefinder:
    """Interactive map viewer with rangefinding capabilities."""

    def __init__(self, image_path):
        self.image_path = image_path
        self.image = None
        self.fig = None
        self.ax = None
        self.ruler_points = []
        self.ruler_line = None
        self.ruler_text = None

    def load_image(self):
        """Load the map image."""
        try:
            self.image = mpimg.imread(self.image_path)
            return True
        except Exception as e:
            print(f"Error loading image: {e}")
            return False

    def on_click(self, event):
        """Handle mouse click events for ruler tool."""
        if event.inaxes != self.ax or event.button != MouseButton.LEFT:
            return

        # Add point to ruler
        self.ruler_points.append((event.xdata, event.ydata))

        # Draw ruler when we have 2 points
        if len(self.ruler_points) == 2:
            self._draw_ruler()
            self.ruler_points = []  # Reset for next measurement

    def on_key(self, event):
        """Handle keyboard events."""
        if event.key == 'c':
            # Clear ruler
            self._clear_ruler()
        elif event.key == 'q':
            # Quit
            plt.close(self.fig)

    def _draw_ruler(self):
        """Draw ruler line and display distance."""
        self._clear_ruler()

        x1, y1 = self.ruler_points[0]
        x2, y2 = self.ruler_points[1]

        # Calculate distance in yards (1 pixel = 1 yard)
        distance = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)

        # Draw line
        self.ruler_line, = self.ax.plot([x1, x2], [y1, y2],
                                         'r-', linewidth=2,
                                         marker='o', markersize=8)

        # Add text label with distance
        mid_x, mid_y = (x1 + x2) / 2, (y1 + y2) / 2
        self.ruler_text = self.ax.text(mid_x, mid_y,
                                        f'{distance:.1f} yards',
                                        bbox=dict(boxstyle='round',
                                                 facecolor='yellow',
                                                 alpha=0.8),
                                        fontsize=10,
                                        ha='center')

        self.fig.canvas.draw()

    def _clear_ruler(self):
        """Clear existing ruler from display."""
        if self.ruler_line:
            self.ruler_line.remove()
            self.ruler_line = None
        if self.ruler_text:
            self.ruler_text.remove()
            self.ruler_text = None
        self.fig.canvas.draw()

    def run(self):
        """Start the interactive map viewer."""
        if not self.load_image():
            return

        # Create figure and axis
        self.fig, self.ax = plt.subplots(figsize=(12, 8))
        self.ax.imshow(self.image)
        self.ax.set_title('War of Rights Map Rangefinder\n'
                         'Click two points to measure distance | '
                         'C: Clear ruler | Q: Quit | '
                         'Toolbar: Zoom/Pan',
                         fontsize=12)

        # Connect event handlers
        self.fig.canvas.mpl_connect('button_press_event', self.on_click)
        self.fig.canvas.mpl_connect('key_press_event', self.on_key)

        plt.tight_layout()
        plt.show()


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python map_rangefinder.py <map_image_path>")
        print("\nExample: python map_rangefinder.py maps/antietam.png")
        print("\nControls:")
        print("  - Click two points to measure distance in yards")
        print("  - Use toolbar to zoom and pan")
        print("  - Press 'C' to clear current ruler")
        print("  - Press 'Q' to quit")
        sys.exit(1)

    rangefinder = MapRangefinder(sys.argv[1])
    rangefinder.run()


if __name__ == '__main__':
    main()
