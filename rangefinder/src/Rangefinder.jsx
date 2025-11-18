import { useState, useRef, useEffect } from 'react';
import { Map, ZoomIn, ZoomOut, RotateCcw, Trash2, ArrowLeft, Ruler, Pencil, Type, Eraser, Circle, Square, Minus, Edit2, Navigation } from 'lucide-react';

// Map definitions
const MAPS = [
  { id: 'antietam', name: 'Antietam', file: 'antietam.png' },
  { id: 'harpers-ferry', name: "Harper's Ferry", file: 'finishedferry.png' },
  { id: 'south-mountain', name: 'South Mountain', file: 'completemountain.png' },
  { id: 'drill-camp', name: 'Drill Camp', file: 'drillcamp.png' },
];

// Scale: 1 pixel = 1 yard in-game
const PIXELS_TO_YARDS = 1;

// Tool types
const TOOLS = {
  MEASURE: 'measure',
  DRAW: 'draw',
  LINE: 'line',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  TEXT: 'text',
  ERASER: 'eraser',
};

// Drawing colors
const COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Yellow', value: '#fbbf24' },
  { name: 'White', value: '#ffffff' },
  { name: 'Black', value: '#000000' },
];

const Rangefinder = () => {
  // State
  const [selectedMap, setSelectedMap] = useState(null);
  const [mapImage, setMapImage] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Measurement state
  const [measurements, setMeasurements] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [draggedMeasurement, setDraggedMeasurement] = useState(null); // { index, point: 'point1' or 'point2' }
  const [editingMeasurementIndex, setEditingMeasurementIndex] = useState(null);
  const [editingMeasurementName, setEditingMeasurementName] = useState('');

  // Drawing state
  const [tool, setTool] = useState(TOOLS.MEASURE);
  const [drawColor, setDrawColor] = useState('#ef4444');
  const [drawSize, setDrawSize] = useState(3);
  const [drawings, setDrawings] = useState([]);
  const [currentDrawing, setCurrentDrawing] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);

  // Text annotation state
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState(null);
  const [showTextInput, setShowTextInput] = useState(false);

  // Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const textInputRef = useRef(null);

  // Load selected map
  useEffect(() => {
    if (selectedMap) {
      const img = new Image();
      img.src = `/src/assets/maps/${selectedMap.file}`;
      img.onload = () => {
        setMapImage(img);
        resetState();
      };
      img.onerror = () => {
        console.error('Failed to load map:', selectedMap.file);
        alert(`Failed to load map: ${selectedMap.name}. Please check if the image file exists.`);
      };
    }
  }, [selectedMap]);

  // Focus text input when shown
  useEffect(() => {
    if (showTextInput && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [showTextInput]);

  // Reset all state when loading new map
  const resetState = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setMeasurements([]);
    setCurrentPoints([]);
    setDrawings([]);
    setTool(TOOLS.MEASURE);
    setDraggedMeasurement(null);
    setEditingMeasurementIndex(null);
    setCurrentDrawing(null);
    setIsDrawing(false);
    setShowTextInput(false);
  };

  // Draw on canvas
  useEffect(() => {
    if (!canvasRef.current || !mapImage) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const container = containerRef.current;

    // Set canvas size to container size
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // Clear canvas
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save context state
    ctx.save();

    // Apply transformations
    ctx.translate(pan.x + canvas.width / 2, pan.y + canvas.height / 2);
    ctx.scale(zoom, zoom);

    // Draw map centered
    ctx.drawImage(
      mapImage,
      -mapImage.width / 2,
      -mapImage.height / 2,
      mapImage.width,
      mapImage.height
    );

    // Restore context for UI elements
    ctx.restore();

    // Draw all drawings
    drawings.forEach((drawing) => {
      drawElement(ctx, drawing, canvas.width, canvas.height);
    });

    // Draw current drawing
    if (currentDrawing) {
      drawElement(ctx, currentDrawing, canvas.width, canvas.height);
    }

    // Draw measurements
    measurements.forEach((measurement, index) => {
      drawMeasurement(ctx, measurement, canvas.width, canvas.height, index === editingMeasurementIndex);
    });

    // Draw current measurement points
    if (currentPoints.length > 0) {
      currentPoints.forEach((point) => {
        drawPoint(ctx, point, canvas.width, canvas.height, '#ef4444');
      });

      // Draw line if two points
      if (currentPoints.length === 2) {
        const screenPoint1 = imageToScreen(currentPoints[0], canvas.width, canvas.height);
        const screenPoint2 = imageToScreen(currentPoints[1], canvas.width, canvas.height);

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(screenPoint1.x, screenPoint1.y);
        ctx.lineTo(screenPoint2.x, screenPoint2.y);
        ctx.stroke();
      }
    }
  }, [mapImage, zoom, pan, measurements, currentPoints, drawings, currentDrawing, editingMeasurementIndex]);

  // Helper: Convert image coordinates to screen coordinates
  const imageToScreen = (imagePoint, canvasWidth, canvasHeight) => {
    return {
      x: (imagePoint.x - mapImage.width / 2) * zoom + pan.x + canvasWidth / 2,
      y: (imagePoint.y - mapImage.height / 2) * zoom + pan.y + canvasHeight / 2,
    };
  };

  // Helper: Convert screen coordinates to image coordinates
  const screenToImage = (screenX, screenY) => {
    if (!canvasRef.current || !mapImage) return null;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;

    const imageX = (canvasX - pan.x - canvas.width / 2) / zoom + mapImage.width / 2;
    const imageY = (canvasY - pan.y - canvas.height / 2) / zoom + mapImage.height / 2;

    return { x: imageX, y: imageY };
  };

  // Helper: Check if point is within image bounds
  const isInBounds = (point) => {
    return (
      point.x >= 0 &&
      point.x <= mapImage.width &&
      point.y >= 0 &&
      point.y <= mapImage.height
    );
  };

  // Helper: Check if clicking near a point
  const isNearPoint = (clickPoint, targetPoint, threshold = 10) => {
    const canvas = canvasRef.current;
    const screenClick = imageToScreen(clickPoint, canvas.width, canvas.height);
    const screenTarget = imageToScreen(targetPoint, canvas.width, canvas.height);
    const dist = Math.sqrt(
      Math.pow(screenClick.x - screenTarget.x, 2) +
      Math.pow(screenClick.y - screenTarget.y, 2)
    );
    return dist < threshold;
  };

  // Helper: Draw a point
  const drawPoint = (ctx, point, canvasWidth, canvasHeight, color = '#10b981') => {
    const screenPoint = imageToScreen(point, canvasWidth, canvasHeight);

    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screenPoint.x, screenPoint.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  // Helper: Draw a measurement
  const drawMeasurement = (ctx, measurement, canvasWidth, canvasHeight, isEditing = false) => {
    const screenPoint1 = imageToScreen(measurement.point1, canvasWidth, canvasHeight);
    const screenPoint2 = imageToScreen(measurement.point2, canvasWidth, canvasHeight);

    // Draw line
    ctx.strokeStyle = isEditing ? '#a855f7' : '#10b981';
    ctx.lineWidth = isEditing ? 4 : 3;
    ctx.beginPath();
    ctx.moveTo(screenPoint1.x, screenPoint1.y);
    ctx.lineTo(screenPoint2.x, screenPoint2.y);
    ctx.stroke();

    // Draw points
    [screenPoint1, screenPoint2].forEach((point) => {
      ctx.fillStyle = isEditing ? '#a855f7' : '#10b981';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, isEditing ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Draw distance label
    const midX = (screenPoint1.x + screenPoint2.x) / 2;
    const midY = (screenPoint1.y + screenPoint2.y) / 2;

    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2;
    ctx.font = 'bold 14px Arial';

    const text = measurement.name
      ? `${measurement.name}: ${measurement.distance.toFixed(1)} yards`
      : `${measurement.distance.toFixed(1)} yards`;

    const metrics = ctx.measureText(text);
    const padding = 8;
    const width = metrics.width + padding * 2;
    const height = 20 + padding * 2;

    ctx.fillRect(midX - width / 2, midY - height / 2, width, height);
    ctx.strokeRect(midX - width / 2, midY - height / 2, width, height);

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, midX, midY);
  };

  // Helper: Draw an element (drawing)
  const drawElement = (ctx, element, canvasWidth, canvasHeight) => {
    if (element.type === 'freehand') {
      if (element.points.length < 2) return;

      ctx.strokeStyle = element.color;
      ctx.lineWidth = element.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      const firstPoint = imageToScreen(element.points[0], canvasWidth, canvasHeight);
      ctx.moveTo(firstPoint.x, firstPoint.y);

      for (let i = 1; i < element.points.length; i++) {
        const point = imageToScreen(element.points[i], canvasWidth, canvasHeight);
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    } else if (element.type === 'line') {
      const start = imageToScreen(element.start, canvasWidth, canvasHeight);
      const end = imageToScreen(element.end, canvasWidth, canvasHeight);

      ctx.strokeStyle = element.color;
      ctx.lineWidth = element.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (element.type === 'rectangle') {
      const start = imageToScreen(element.start, canvasWidth, canvasHeight);
      const end = imageToScreen(element.end, canvasWidth, canvasHeight);

      ctx.strokeStyle = element.color;
      ctx.lineWidth = element.size;
      ctx.strokeRect(
        start.x,
        start.y,
        end.x - start.x,
        end.y - start.y
      );
    } else if (element.type === 'circle') {
      const start = imageToScreen(element.start, canvasWidth, canvasHeight);
      const end = imageToScreen(element.end, canvasWidth, canvasHeight);

      const centerX = (start.x + end.x) / 2;
      const centerY = (start.y + end.y) / 2;
      const radius = Math.sqrt(
        Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
      ) / 2;

      ctx.strokeStyle = element.color;
      ctx.lineWidth = element.size;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (element.type === 'text') {
      const pos = imageToScreen(element.position, canvasWidth, canvasHeight);

      ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 2;
      ctx.font = `bold ${element.size * 4}px Arial`;

      const metrics = ctx.measureText(element.text);
      const padding = 6;
      const width = metrics.width + padding * 2;
      const height = element.size * 4 + padding * 2;

      ctx.fillRect(pos.x - width / 2, pos.y - height / 2, width, height);
      ctx.strokeRect(pos.x - width / 2, pos.y - height / 2, width, height);

      ctx.fillStyle = element.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(element.text, pos.x, pos.y);
    }
  };

  // Calculate distance in yards
  const calculateDistance = (point1, point2) => {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy) * PIXELS_TO_YARDS;
  };

  // Handle canvas mouse down
  const handleMouseDown = (e) => {
    if (!mapImage) return;

    // Check for panning
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    const imagePoint = screenToImage(e.clientX, e.clientY);
    if (!imagePoint || !isInBounds(imagePoint)) return;

    // Handle measurement tool
    if (tool === TOOLS.MEASURE) {
      // Check if clicking on an existing measurement endpoint
      for (let i = 0; i < measurements.length; i++) {
        if (isNearPoint(imagePoint, measurements[i].point1)) {
          setDraggedMeasurement({ index: i, point: 'point1' });
          return;
        }
        if (isNearPoint(imagePoint, measurements[i].point2)) {
          setDraggedMeasurement({ index: i, point: 'point2' });
          return;
        }
      }
      // Otherwise, start new measurement
      if (currentPoints.length === 0) {
        setCurrentPoints([imagePoint]);
      }
    }
    // Handle drawing tools
    else if (tool === TOOLS.DRAW) {
      setIsDrawing(true);
      setCurrentDrawing({
        type: 'freehand',
        points: [imagePoint],
        color: drawColor,
        size: drawSize,
      });
    }
    else if (tool === TOOLS.LINE || tool === TOOLS.RECTANGLE || tool === TOOLS.CIRCLE) {
      setIsDrawing(true);
      setDrawStart(imagePoint);
      setCurrentDrawing({
        type: tool,
        start: imagePoint,
        end: imagePoint,
        color: drawColor,
        size: drawSize,
      });
    }
    else if (tool === TOOLS.TEXT) {
      setTextPosition(imagePoint);
      setShowTextInput(true);
    }
    else if (tool === TOOLS.ERASER) {
      // Find and remove drawing at this point
      const canvas = canvasRef.current;
      const screenPoint = imageToScreen(imagePoint, canvas.width, canvas.height);

      setDrawings(drawings.filter(drawing => {
        if (drawing.type === 'freehand') {
          return !drawing.points.some(p => {
            const sp = imageToScreen(p, canvas.width, canvas.height);
            const dist = Math.sqrt(
              Math.pow(sp.x - screenPoint.x, 2) +
              Math.pow(sp.y - screenPoint.y, 2)
            );
            return dist < drawSize * 2;
          });
        } else if (drawing.type === 'text') {
          const sp = imageToScreen(drawing.position, canvas.width, canvas.height);
          const dist = Math.sqrt(
            Math.pow(sp.x - screenPoint.x, 2) +
            Math.pow(sp.y - screenPoint.y, 2)
          );
          return dist >= 20;
        }
        return true;
      }));
    }
  };

  // Handle canvas mouse move
  const handleMouseMove = (e) => {
    if (!mapImage) return;

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    const imagePoint = screenToImage(e.clientX, e.clientY);
    if (!imagePoint || !isInBounds(imagePoint)) return;

    // Handle dragging measurement endpoint
    if (draggedMeasurement) {
      const newMeasurements = [...measurements];
      newMeasurements[draggedMeasurement.index][draggedMeasurement.point] = imagePoint;
      newMeasurements[draggedMeasurement.index].distance = calculateDistance(
        newMeasurements[draggedMeasurement.index].point1,
        newMeasurements[draggedMeasurement.index].point2
      );
      setMeasurements(newMeasurements);
      return;
    }

    // Handle drawing
    if (isDrawing && currentDrawing) {
      if (tool === TOOLS.DRAW) {
        setCurrentDrawing({
          ...currentDrawing,
          points: [...currentDrawing.points, imagePoint],
        });
      } else if (tool === TOOLS.LINE || tool === TOOLS.RECTANGLE || tool === TOOLS.CIRCLE) {
        setCurrentDrawing({
          ...currentDrawing,
          end: imagePoint,
        });
      }
    }

    // Handle eraser while dragging
    if (tool === TOOLS.ERASER && e.buttons === 1) {
      const canvas = canvasRef.current;
      const screenPoint = imageToScreen(imagePoint, canvas.width, canvas.height);

      setDrawings(drawings.filter(drawing => {
        if (drawing.type === 'freehand') {
          return !drawing.points.some(p => {
            const sp = imageToScreen(p, canvas.width, canvas.height);
            const dist = Math.sqrt(
              Math.pow(sp.x - screenPoint.x, 2) +
              Math.pow(sp.y - screenPoint.y, 2)
            );
            return dist < drawSize * 2;
          });
        } else if (drawing.type === 'text') {
          const sp = imageToScreen(drawing.position, canvas.width, canvas.height);
          const dist = Math.sqrt(
            Math.pow(sp.x - screenPoint.x, 2) +
            Math.pow(sp.y - screenPoint.y, 2)
          );
          return dist >= 20;
        }
        return true;
      }));
    }
  };

  // Handle canvas mouse up
  const handleMouseUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (draggedMeasurement) {
      setDraggedMeasurement(null);
      return;
    }

    if (tool === TOOLS.MEASURE && currentPoints.length === 1 && !draggedMeasurement) {
      const imagePoint = screenToImage(e.clientX, e.clientY);
      if (imagePoint && isInBounds(imagePoint)) {
        // Complete measurement
        const newMeasurement = {
          id: Date.now(),
          point1: currentPoints[0],
          point2: imagePoint,
          distance: calculateDistance(currentPoints[0], imagePoint),
          name: '',
        };
        setMeasurements([...measurements, newMeasurement]);
        setCurrentPoints([]);
      }
    }

    if (isDrawing && currentDrawing) {
      if (currentDrawing.points?.length > 1 || currentDrawing.end) {
        setDrawings([...drawings, currentDrawing]);
      }
      setCurrentDrawing(null);
      setIsDrawing(false);
      setDrawStart(null);
    }
  };

  // Handle mouse wheel for zoom
  const handleWheel = (e) => {
    if (!mapImage) return;

    e.preventDefault();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Get image coordinates of mouse position before zoom
    const beforeZoom = {
      x: (mouseX - pan.x - canvas.width / 2) / zoom,
      y: (mouseY - pan.y - canvas.height / 2) / zoom,
    };

    // Update zoom
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(10, zoom * delta));
    setZoom(newZoom);

    // Adjust pan to keep mouse position fixed
    const afterX = beforeZoom.x * newZoom;
    const afterY = beforeZoom.y * newZoom;

    setPan({
      x: mouseX - afterX - canvas.width / 2,
      y: mouseY - afterY - canvas.height / 2,
    });
  };

  // Zoom controls
  const handleZoomIn = () => {
    setZoom((z) => Math.min(10, z * 1.2));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.1, z / 1.2));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Navigate to measurement
  const handleNavigateToMeasurement = (measurement) => {
    const midX = (measurement.point1.x + measurement.point2.x) / 2;
    const midY = (measurement.point1.y + measurement.point2.y) / 2;

    // Center on measurement
    setPan({ x: 0, y: 0 });

    // Calculate pan to center the measurement
    const canvas = canvasRef.current;
    const targetScreenX = canvas.width / 2;
    const targetScreenY = canvas.height / 2;

    const currentScreenX = (midX - mapImage.width / 2) * zoom + canvas.width / 2;
    const currentScreenY = (midY - mapImage.height / 2) * zoom + canvas.height / 2;

    setPan({
      x: targetScreenX - currentScreenX,
      y: targetScreenY - currentScreenY,
    });
  };

  // Handle text annotation submission
  const handleTextSubmit = () => {
    if (textInput.trim() && textPosition) {
      const newDrawing = {
        type: 'text',
        text: textInput.trim(),
        position: textPosition,
        color: drawColor,
        size: drawSize,
      };
      setDrawings([...drawings, newDrawing]);
      setTextInput('');
      setTextPosition(null);
      setShowTextInput(false);
    }
  };

  // Handle measurement name edit
  const handleStartEditMeasurement = (index) => {
    setEditingMeasurementIndex(index);
    setEditingMeasurementName(measurements[index].name || '');
  };

  const handleSaveMeasurementName = () => {
    if (editingMeasurementIndex !== null) {
      const newMeasurements = [...measurements];
      newMeasurements[editingMeasurementIndex].name = editingMeasurementName;
      setMeasurements(newMeasurements);
      setEditingMeasurementIndex(null);
      setEditingMeasurementName('');
    }
  };

  const handleDeleteMeasurement = (index) => {
    setMeasurements(measurements.filter((_, i) => i !== index));
    if (editingMeasurementIndex === index) {
      setEditingMeasurementIndex(null);
      setEditingMeasurementName('');
    }
  };

  // Clear current measurement
  const handleClearCurrent = () => {
    setCurrentPoints([]);
  };

  // Clear all
  const handleClearAll = () => {
    if (confirm('Clear all measurements and drawings?')) {
      setMeasurements([]);
      setCurrentPoints([]);
      setDrawings([]);
      setCurrentDrawing(null);
      setEditingMeasurementIndex(null);
    }
  };

  // Go back to map selection
  const handleBackToSelection = () => {
    if (measurements.length > 0 || drawings.length > 0) {
      if (!confirm('Go back to map selection? All measurements and drawings will be lost.')) {
        return;
      }
    }
    setSelectedMap(null);
    setMapImage(null);
  };

  // Map selection screen
  if (!selectedMap) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 p-6 mb-6">
            <div className="flex items-center gap-3">
              <Ruler className="w-8 h-8 text-amber-400" />
              <div>
                <h1 className="text-3xl font-bold text-amber-400">
                  War of Rights - Map Rangefinder
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                  Measure distances, draw strategies, and annotate War of Rights maps
                </p>
              </div>
            </div>
          </div>

          {/* Map Selection */}
          <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 p-6">
            <h2 className="text-xl font-bold text-amber-400 mb-4">Select a Map</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MAPS.map((map) => (
                <button
                  key={map.id}
                  onClick={() => setSelectedMap(map)}
                  className="bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-amber-500 rounded-lg p-6 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <Map className="w-8 h-8 text-amber-400 group-hover:text-amber-300" />
                    <div className="text-left">
                      <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition">
                        {map.name}
                      </h3>
                      <p className="text-sm text-slate-400">Click to load map</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 p-6 mt-6">
            <h2 className="text-lg font-bold text-amber-400 mb-3">How to Use</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300 text-sm">
              <div>
                <h3 className="font-semibold text-amber-400 mb-2">Measurement</h3>
                <ul className="space-y-1">
                  <li>• Click two points to measure distance</li>
                  <li>• Drag endpoints to adjust measurements</li>
                  <li>• Name measurements and click to navigate</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-amber-400 mb-2">Drawing</h3>
                <ul className="space-y-1">
                  <li>• Draw freehand, lines, shapes</li>
                  <li>• Add text annotations</li>
                  <li>• Use eraser to remove drawings</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-amber-400 mb-2">Navigation</h3>
                <ul className="space-y-1">
                  <li>• Mouse wheel to zoom in/out</li>
                  <li>• Shift+Click or Middle-click to pan</li>
                  <li>• Scale: 1 pixel = 1 yard in-game</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Map viewer screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Ruler className="w-6 h-6 text-amber-400" />
              <div>
                <h1 className="text-2xl font-bold text-amber-400">{selectedMap.name}</h1>
                <p className="text-slate-400 text-sm">
                  Tool: {tool.charAt(0).toUpperCase() + tool.slice(1)} • Zoom: {(zoom * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleBackToSelection}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-2 transition"
                title="Back to Map Selection"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Tools */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm mr-1">Tools:</span>
              <button
                onClick={() => setTool(TOOLS.MEASURE)}
                className={`px-3 py-2 rounded-lg flex items-center gap-1 transition ${
                  tool === TOOLS.MEASURE ? 'bg-amber-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
                title="Measure"
              >
                <Ruler className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool(TOOLS.DRAW)}
                className={`px-3 py-2 rounded-lg flex items-center gap-1 transition ${
                  tool === TOOLS.DRAW ? 'bg-amber-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
                title="Draw"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool(TOOLS.LINE)}
                className={`px-3 py-2 rounded-lg flex items-center gap-1 transition ${
                  tool === TOOLS.LINE ? 'bg-amber-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
                title="Line"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool(TOOLS.RECTANGLE)}
                className={`px-3 py-2 rounded-lg flex items-center gap-1 transition ${
                  tool === TOOLS.RECTANGLE ? 'bg-amber-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
                title="Rectangle"
              >
                <Square className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool(TOOLS.CIRCLE)}
                className={`px-3 py-2 rounded-lg flex items-center gap-1 transition ${
                  tool === TOOLS.CIRCLE ? 'bg-amber-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
                title="Circle"
              >
                <Circle className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool(TOOLS.TEXT)}
                className={`px-3 py-2 rounded-lg flex items-center gap-1 transition ${
                  tool === TOOLS.TEXT ? 'bg-amber-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
                title="Text"
              >
                <Type className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTool(TOOLS.ERASER)}
                className={`px-3 py-2 rounded-lg flex items-center gap-1 transition ${
                  tool === TOOLS.ERASER ? 'bg-amber-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
                title="Eraser"
              >
                <Eraser className="w-4 h-4" />
              </button>
            </div>

            {/* Color Picker */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Color:</span>
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setDrawColor(color.value)}
                  className={`w-8 h-8 rounded border-2 transition ${
                    drawColor === color.value ? 'border-amber-400 scale-110' : 'border-slate-600'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>

            {/* Size Picker */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Size:</span>
              <input
                type="range"
                min="1"
                max="10"
                value={drawSize}
                onChange={(e) => setDrawSize(parseInt(e.target.value))}
                className="w-24"
              />
              <span className="text-amber-400 font-semibold w-6">{drawSize}</span>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleZoomIn}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 transition"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomOut}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 transition"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetZoom}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-1 transition"
                title="Reset View"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={handleClearAll}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-1 transition"
                title="Clear All"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 overflow-hidden relative"
          style={{ height: 'calc(100vh - 340px)' }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
            className="cursor-crosshair"
            style={{ display: 'block', width: '100%', height: '100%' }}
          />

          {/* Text Input Modal */}
          {showTextInput && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-md w-full">
                <h3 className="text-lg font-bold text-amber-400 mb-4">Add Text Annotation</h3>
                <input
                  ref={textInputRef}
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTextSubmit();
                    if (e.key === 'Escape') {
                      setShowTextInput(false);
                      setTextInput('');
                      setTextPosition(null);
                    }
                  }}
                  placeholder="Enter text..."
                  className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-amber-400 focus:outline-none mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleTextSubmit}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowTextInput(false);
                      setTextInput('');
                      setTextPosition(null);
                    }}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Measurements Panel */}
        {measurements.length > 0 && (
          <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 p-4 mt-4">
            <h3 className="text-lg font-bold text-amber-400 mb-3">
              Measurements ({measurements.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {measurements.map((measurement, index) => (
                <div
                  key={measurement.id}
                  className="bg-slate-700 rounded px-3 py-2 text-sm flex items-center justify-between gap-2"
                >
                  {editingMeasurementIndex === index ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={editingMeasurementName}
                        onChange={(e) => setEditingMeasurementName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveMeasurementName();
                          if (e.key === 'Escape') {
                            setEditingMeasurementIndex(null);
                            setEditingMeasurementName('');
                          }
                        }}
                        placeholder="Name..."
                        className="flex-1 px-2 py-1 bg-slate-800 text-white rounded text-xs border border-slate-600 focus:border-amber-400 focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveMeasurementName}
                        className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleNavigateToMeasurement(measurement)}
                        className="flex-1 text-left hover:text-amber-400 transition"
                        title="Click to navigate to measurement"
                      >
                        <div className="flex items-center gap-1">
                          <Navigation className="w-3 h-3" />
                          <span className="text-slate-400">
                            {measurement.name || `Measurement ${index + 1}`}:
                          </span>
                          <span className="text-green-400 font-bold ml-1">
                            {measurement.distance.toFixed(1)} yds
                          </span>
                        </div>
                      </button>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleStartEditMeasurement(index)}
                          className="p-1 hover:bg-slate-600 rounded transition"
                          title="Edit name"
                        >
                          <Edit2 className="w-3 h-3 text-amber-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteMeasurement(index)}
                          className="p-1 hover:bg-slate-600 rounded transition"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Rangefinder;
