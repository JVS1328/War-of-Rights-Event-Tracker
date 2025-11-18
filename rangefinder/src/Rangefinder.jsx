import { useState, useRef, useEffect } from 'react';
import { Map, ZoomIn, ZoomOut, RotateCcw, Trash2, ArrowLeft, Ruler } from 'lucide-react';

// Map definitions
const MAPS = [
  { id: 'antietam', name: 'Antietam', file: 'antietam.png' },
  { id: 'harpers-ferry', name: "Harper's Ferry", file: 'finishedferry.png' },
  { id: 'south-mountain', name: 'South Mountain', file: 'completemountain.png' },
  { id: 'drill-camp', name: 'Drill Camp', file: 'drillcamp.png' },
];

// Scale: 1 pixel = 1 yard in-game
const PIXELS_TO_YARDS = 1;

const Rangefinder = () => {
  // State
  const [selectedMap, setSelectedMap] = useState(null);
  const [mapImage, setMapImage] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [measurements, setMeasurements] = useState([]);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [annotations, setAnnotations] = useState([]);

  // Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Load selected map
  useEffect(() => {
    if (selectedMap) {
      const img = new Image();
      img.src = `/src/assets/maps/${selectedMap.file}`;
      img.onload = () => {
        setMapImage(img);
        // Reset state when loading new map
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setMeasurements([]);
        setCurrentPoints([]);
        setAnnotations([]);
      };
      img.onerror = () => {
        console.error('Failed to load map:', selectedMap.file);
        alert(`Failed to load map: ${selectedMap.name}. Please check if the image file exists.`);
      };
    }
  }, [selectedMap]);

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

    // Draw measurements
    measurements.forEach((measurement) => {
      drawMeasurement(ctx, measurement, canvas.width, canvas.height);
    });

    // Draw current points
    if (currentPoints.length > 0) {
      currentPoints.forEach((point) => {
        drawPoint(ctx, point, canvas.width, canvas.height);
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

    // Draw annotations
    annotations.forEach((annotation) => {
      const screenPos = imageToScreen(annotation.position, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 2;
      ctx.font = 'bold 14px Arial';

      const metrics = ctx.measureText(annotation.text);
      const padding = 6;
      const width = metrics.width + padding * 2;
      const height = 20 + padding * 2;

      ctx.fillRect(screenPos.x - width / 2, screenPos.y - height / 2, width, height);
      ctx.strokeRect(screenPos.x - width / 2, screenPos.y - height / 2, width, height);

      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(annotation.text, screenPos.x, screenPos.y);
    });
  }, [mapImage, zoom, pan, measurements, currentPoints, annotations]);

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

  // Helper: Draw a point
  const drawPoint = (ctx, point, canvasWidth, canvasHeight) => {
    const screenPoint = imageToScreen(point, canvasWidth, canvasHeight);

    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screenPoint.x, screenPoint.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  // Helper: Draw a measurement
  const drawMeasurement = (ctx, measurement, canvasWidth, canvasHeight) => {
    const screenPoint1 = imageToScreen(measurement.point1, canvasWidth, canvasHeight);
    const screenPoint2 = imageToScreen(measurement.point2, canvasWidth, canvasHeight);

    // Draw line
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(screenPoint1.x, screenPoint1.y);
    ctx.lineTo(screenPoint2.x, screenPoint2.y);
    ctx.stroke();

    // Draw points
    [screenPoint1, screenPoint2].forEach((point) => {
      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Draw distance label
    const midX = (screenPoint1.x + screenPoint2.x) / 2;
    const midY = (screenPoint1.y + screenPoint2.y) / 2;

    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2;
    ctx.font = 'bold 16px Arial';

    const text = `${measurement.distance.toFixed(1)} yards`;
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

  // Calculate distance in yards
  const calculateDistance = (point1, point2) => {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy) * PIXELS_TO_YARDS;
  };

  // Handle canvas click
  const handleCanvasClick = (e) => {
    if (!mapImage || isPanning) return;

    const imagePoint = screenToImage(e.clientX, e.clientY);
    if (!imagePoint) return;

    // Check if click is within image bounds
    if (
      imagePoint.x < 0 ||
      imagePoint.x > mapImage.width ||
      imagePoint.y < 0 ||
      imagePoint.y > mapImage.height
    ) {
      return;
    }

    if (currentPoints.length === 0) {
      // First point
      setCurrentPoints([imagePoint]);
    } else if (currentPoints.length === 1) {
      // Second point - complete measurement
      const newMeasurement = {
        point1: currentPoints[0],
        point2: imagePoint,
        distance: calculateDistance(currentPoints[0], imagePoint),
      };
      setMeasurements([...measurements, newMeasurement]);
      setCurrentPoints([]);
    }
  };

  // Handle mouse down for panning
  const handleMouseDown = (e) => {
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.shiftKey)) {
      // Middle mouse button or right click or shift+left click
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  // Handle mouse move for panning
  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsPanning(false);
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

  // Clear current measurement
  const handleClearCurrent = () => {
    setCurrentPoints([]);
  };

  // Clear all measurements
  const handleClearAll = () => {
    setMeasurements([]);
    setCurrentPoints([]);
    setAnnotations([]);
  };

  // Go back to map selection
  const handleBackToSelection = () => {
    if (measurements.length > 0 || annotations.length > 0) {
      if (!confirm('Go back to map selection? All measurements and annotations will be lost.')) {
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
                  Measure distances on War of Rights maps (1 pixel = 1 yard)
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
            <ul className="text-slate-300 space-y-2 text-sm">
              <li>• <strong>Measure:</strong> Click two points to measure distance</li>
              <li>• <strong>Zoom:</strong> Use mouse wheel or zoom buttons</li>
              <li>• <strong>Pan:</strong> Middle click (or Shift+Click) and drag</li>
              <li>• <strong>Clear:</strong> Remove current or all measurements</li>
              <li>• <strong>Scale:</strong> 1 pixel = 1 yard in-game</li>
            </ul>
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
                  {currentPoints.length === 0 && 'Click two points to measure distance'}
                  {currentPoints.length === 1 && 'Click second point to complete measurement'}
                  {currentPoints.length === 2 && 'Measurement complete'}
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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm mr-2">Zoom:</span>
              <button
                onClick={handleZoomIn}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 transition"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
                In
              </button>
              <button
                onClick={handleZoomOut}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 transition"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
                Out
              </button>
              <button
                onClick={handleResetZoom}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-1 transition"
                title="Reset Zoom"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <span className="text-amber-400 font-semibold ml-2">{(zoom * 100).toFixed(0)}%</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm mr-2">Clear:</span>
              {currentPoints.length > 0 && (
                <button
                  onClick={handleClearCurrent}
                  className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-1 transition"
                  title="Clear Current Measurement"
                >
                  <Trash2 className="w-4 h-4" />
                  Current
                </button>
              )}
              <button
                onClick={handleClearAll}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-1 transition"
                title="Clear All Measurements"
              >
                <Trash2 className="w-4 h-4" />
                All
              </button>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 overflow-hidden"
          style={{ height: 'calc(100vh - 280px)' }}
        >
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
            className="cursor-crosshair"
            style={{ display: 'block', width: '100%', height: '100%' }}
          />
        </div>

        {/* Info Panel */}
        {measurements.length > 0 && (
          <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 p-4 mt-4">
            <h3 className="text-lg font-bold text-amber-400 mb-3">
              Measurements ({measurements.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {measurements.map((measurement, index) => (
                <div
                  key={index}
                  className="bg-slate-700 rounded px-3 py-2 text-sm"
                >
                  <span className="text-slate-400">Measurement {index + 1}:</span>{' '}
                  <span className="text-green-400 font-bold">
                    {measurement.distance.toFixed(1)} yards
                  </span>
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
