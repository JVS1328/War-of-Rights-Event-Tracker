import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Plus, Trash2, GripVertical, MapPin, Map } from 'lucide-react';
import { usaStates, getStatesByAbbrs, calculateGroupCenter, combineStatePaths } from '../data/usaStates';
import { getCountiesForStates, calculateCountyGroupCenter, combineCountyPaths, getAvailableStates, getCountyCount } from '../data/countyData';

const MapEditor = ({ isOpen, onClose, onSave, existingCampaign = null }) => {
  const [selectedStates, setSelectedStates] = useState(new Set());
  const [territories, setTerritories] = useState([]);
  const [hoveredState, setHoveredState] = useState(null);
  const [editingTerritory, setEditingTerritory] = useState(null);
  const [draggedTerritory, setDraggedTerritory] = useState(null);
  const [multiSelectStates, setMultiSelectStates] = useState(new Set());
  const [mapMode, setMapMode] = useState('states'); // 'states' or 'counties'
  const [showStateSelector, setShowStateSelector] = useState(false);
  const [selectedStatesForCounties, setSelectedStatesForCounties] = useState(new Set());
  const [countyData, setCountyData] = useState(null);
  const [isCountyMode, setIsCountyMode] = useState(false);
  // County-specific state
  const [selectedCounties, setSelectedCounties] = useState(new Set());
  const [hoveredCounty, setHoveredCounty] = useState(null);
  const [multiSelectCounties, setMultiSelectCounties] = useState(new Set());

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Drag selection state
  const [isDraggingSelect, setIsDraggingSelect] = useState(false);
  const [isDraggingMerge, setIsDraggingMerge] = useState(false);
  const [draggedItems, setDraggedItems] = useState(new Set());
  const [justDragged, setJustDragged] = useState(false);

  // Available War of Rights maps organized by mapset
  const mapsByMapset = {
    'Antietam': [
      "East Woods Skirmish",
      "Hooker's Push",
      "Hagerstown Turnpike",
      "Miller's Cornfield",
      "East Woods",
      "Nicodemus Hill",
      "Bloody Lane",
      "Pry Ford",
      "Pry Grist Mill",
      "Pry House",
      "West Woods",
      "Dunker Church",
      "Burnside's Bridge",
      "Cooke's Countercharge",
      "Otto and Sherrick Farms",
      "Roulette Lane",
      "Piper Farm",
      "Hill's Counterattack"
    ],
    'Harpers Ferry': [
      "Maryland Heights",
      "River Crossing",
      "Downtown",
      "School House Ridge",
      "Bolivar Heights Camp",
      "High Street",
      "Shenandoah Street",
      "Harpers Ferry Graveyard",
      "Washington Street",
      "Bolivar Heights Redoubt"
    ],
    'South Mountain': [
      "Garland's Stand",
      "Cox's Push",
      "Hatch's Attack",
      "Anderson's Counterattack",
      "Reno's Fall",
      "Colquitt's Defense"
    ],
    'Drill Camp': [
      "Alexander Farm",
      "Crossroads",
      "Smith Field",
      "Crecy's Cornfield",
      "Crossley Creek",
      "Larsen Homestead",
      "South Woodlot",
      "Flemming's Meadow",
      "Wagon Road",
      "Union Camp",
      "Pat's Turnpike",
      "Stefan's Lot",
      "Confederate Encampment"
    ]
  };

  // Flatten all maps for the select dropdown
  const allMaps = Object.entries(mapsByMapset).flatMap(([mapset, maps]) => 
    maps.map(map => ({ name: map, mapset }))
  );

  useEffect(() => {
    if (existingCampaign?.customMap) {
      // Load existing custom map
      setTerritories(existingCampaign.customMap.territories);
      const allStates = new Set();
      existingCampaign.customMap.territories.forEach(t => {
        if (t.states) {
          t.states.forEach(s => allStates.add(s));
        }
      });
      setSelectedStates(allStates);
    } else if (existingCampaign?.territories) {
      // Load existing campaign territories
      // Map each territory to find its state abbreviation from the SVG path
      const loadedTerritories = existingCampaign.territories.map(t => {
        // Find matching state by comparing SVG paths or by ID
        const matchingState = usaStates.find(s =>
          s.abbreviation === t.id?.toUpperCase() ||
          s.name === t.name ||
          s.svgPath === t.svgPath
        );
        
        return {
          id: t.id || `territory-${Date.now()}-${Math.random()}`,
          name: t.name,
          victoryPoints: t.victoryPoints || t.pointValue || 1,
          owner: t.owner,
          initialOwner: t.owner,
          maps: t.maps || [],
          states: matchingState ? [matchingState.abbreviation] : (t.states || []),
          svgPath: t.svgPath || '',
          center: t.center || { x: 0, y: 0 }
        };
      });
      setTerritories(loadedTerritories);
      
      // Select all states that are part of territories
      const allStates = new Set();
      loadedTerritories.forEach(t => {
        if (t.states && t.states.length > 0) {
          t.states.forEach(s => allStates.add(s));
        }
      });
      setSelectedStates(allStates);
    }
  }, [existingCampaign]);

  const handleStateClick = (stateAbbr, ctrlKey = false) => {
    // Ignore clicks right after a drag
    if (justDragged) return;

    if (ctrlKey) {
      // Find territory containing this state
      const territory = territories.find(t => t.states && t.states.includes(stateAbbr));
      
      if (territory && territory.states.length > 1) {
        // Ctrl+Click on merged territory: Split it
        splitTerritory(territory);
        setMultiSelectStates(new Set());
      } else if (!territory) {
        // Ctrl+Click on non-selected state: Select it first, then add to multi-select
        const newSelected = new Set(selectedStates);
        newSelected.add(stateAbbr);

        const state = usaStates.find(s => s.abbreviation === stateAbbr);
        const newTerritory = {
          id: `territory-${Date.now()}`,
          name: state.name,
          states: [stateAbbr],
          victoryPoints: 1,
          maps: [],
          owner: 'NEUTRAL',
          initialOwner: 'NEUTRAL',
          svgPath: state.svgPath,
          center: state.center
        };
        setTerritories([...territories, newTerritory]);
        setSelectedStates(newSelected);
        
        // Add to multi-select
        const newMultiSelect = new Set(multiSelectStates);
        newMultiSelect.add(stateAbbr);
        setMultiSelectStates(newMultiSelect);
        
        // If we have 2+ states selected, merge them (but keep multi-select active)
        if (newMultiSelect.size >= 2) {
          mergeSelectedStates(newMultiSelect);
          // Don't clear multi-select - keep it for adding more states
        }
      } else {
        // Ctrl+Click on single state territory: Add to multi-select for merging
        const newMultiSelect = new Set(multiSelectStates);
        
        if (newMultiSelect.has(stateAbbr)) {
          // Already selected, remove it
          newMultiSelect.delete(stateAbbr);
        } else {
          // Add to multi-select
          newMultiSelect.add(stateAbbr);
        }
        
        setMultiSelectStates(newMultiSelect);
        
        // If we have 2+ states selected, merge them (but keep multi-select active)
        if (newMultiSelect.size >= 2) {
          mergeSelectedStates(newMultiSelect);
          // Don't clear multi-select - keep it for adding more states
        }
      }
    } else {
      // Normal click: toggle state selection
      const newSelected = new Set(selectedStates);
      
      if (newSelected.has(stateAbbr)) {
        // Remove state from selection and any territories
        newSelected.delete(stateAbbr);
        setTerritories(territories.filter(t => !t.states.includes(stateAbbr)));
      } else {
        // Add state to selection
        newSelected.add(stateAbbr);
        
        // Create a new territory for this state
        const state = usaStates.find(s => s.abbreviation === stateAbbr);
        const newTerritory = {
          id: `territory-${Date.now()}`,
          name: state.name,
          states: [stateAbbr],
          victoryPoints: 1,
          maps: [],
          owner: 'NEUTRAL',
          initialOwner: 'NEUTRAL',
          svgPath: state.svgPath,
          center: state.center
        };
        setTerritories([...territories, newTerritory]);
      }
      
      setSelectedStates(newSelected);
      setMultiSelectStates(new Set()); // Clear multi-select on normal click
    }
  };

  const mergeSelectedStates = (statesToMerge) => {
    const stateArray = Array.from(statesToMerge);

    // Use callback to work with latest state
    setTerritories(prev => {
      // Find all territories that contain these states
      const affectedTerritories = prev.filter(t =>
        t.states && t.states.some(s => stateArray.includes(s))
      );

      if (affectedTerritories.length === 0) return prev;

      // Collect all states from affected territories
      const allStates = [...new Set(affectedTerritories.flatMap(t => t.states))];

      // Create merged territory
      const mergedName = affectedTerritories.map(t => t.name).join(' & ');
      const mergedTerritory = {
        id: `territory-${Date.now()}`,
        name: mergedName,
        states: allStates,
        victoryPoints: Math.max(...affectedTerritories.map(t => t.victoryPoints)),
        maps: [...new Set(affectedTerritories.flatMap(t => t.maps || []))],
        owner: affectedTerritories[0].owner || affectedTerritories[0].initialOwner,
        initialOwner: affectedTerritories[0].owner || affectedTerritories[0].initialOwner,
        svgPath: combineStatePaths(allStates),
        center: calculateGroupCenter(allStates)
      };

      // Remove old territories and add merged one
      const remainingTerritories = prev.filter(t => !affectedTerritories.includes(t));
      return [...remainingTerritories, mergedTerritory];
    });
  };

  const splitTerritory = (territory) => {
    // Remove the merged territory
    const remainingTerritories = territories.filter(t => t.id !== territory.id);
    
    // Create individual territories for each state
    const newTerritories = territory.states.map(stateAbbr => {
      const state = usaStates.find(s => s.abbreviation === stateAbbr);
      return {
        id: `territory-${Date.now()}-${stateAbbr}`,
        name: state.name,
        states: [stateAbbr],
        victoryPoints: 1,
        maps: [],
        owner: territory.owner || territory.initialOwner,
        initialOwner: territory.owner || territory.initialOwner,
        svgPath: state.svgPath,
        center: state.center
      };
    });
    
    setTerritories([...remainingTerritories, ...newTerritories]);
  };

  const handleTerritoryUpdate = (territoryId, field, value) => {
    setTerritories(territories.map(t => 
      t.id === territoryId ? { ...t, [field]: value } : t
    ));
  };

  const handleMergeStates = (territoryIds) => {
    if (territoryIds.length < 2) return;

    const territoriesToMerge = territories.filter(t => territoryIds.includes(t.id));
    const allStates = territoriesToMerge.flatMap(t => t.states);
    const mergedName = territoriesToMerge.map(t => t.name).join(' & ');

    const mergedTerritory = {
      id: `territory-${Date.now()}`,
      name: mergedName,
      states: allStates,
      victoryPoints: Math.max(...territoriesToMerge.map(t => t.victoryPoints)),
      maps: [...new Set(territoriesToMerge.flatMap(t => t.maps))],
      initialOwner: territoriesToMerge[0].initialOwner,
      isCapital: territoriesToMerge.some(t => t.isCapital),
      svgPath: combineStatePaths(allStates),
      center: calculateGroupCenter(allStates)
    };

    setTerritories([
      ...territories.filter(t => !territoryIds.includes(t.id)),
      mergedTerritory
    ]);
  };

  const handleDeleteTerritory = (territoryId) => {
    const territory = territories.find(t => t.id === territoryId);
    if (territory) {
      const newSelected = new Set(selectedStates);
      territory.states.forEach(s => newSelected.delete(s));
      setSelectedStates(newSelected);
      setTerritories(territories.filter(t => t.id !== territoryId));
    }
  };

  const handleReset = () => {
    setSelectedStates(new Set());
    setSelectedCounties(new Set());
    setTerritories([]);
    setEditingTerritory(null);
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  const handleCountyClick = (county, ctrlKey = false) => {
    // Ignore clicks right after a drag
    if (justDragged) return;

    if (ctrlKey) {
      // Find territory containing this county
      const territory = territories.find(t => t.counties && t.counties.includes(county.id));

      if (territory && territory.counties.length > 1) {
        // Ctrl+Click on merged territory: Split it
        splitCountyTerritory(territory);
        setMultiSelectCounties(new Set());
      } else if (!territory) {
        // Ctrl+Click on non-selected county: Select it first, then add to multi-select
        const newSelected = new Set(selectedCounties);
        newSelected.add(county.id);

        const newTerritory = {
          id: `territory-${Date.now()}`,
          name: county.name,
          counties: [county.id],
          victoryPoints: 1,
          maps: [],
          owner: 'NEUTRAL',
          initialOwner: 'NEUTRAL',
          isCountyBased: true
        };
        setTerritories([...territories, newTerritory]);
        setSelectedCounties(newSelected);

        // Add to multi-select
        const newMultiSelect = new Set(multiSelectCounties);
        newMultiSelect.add(county.id);
        setMultiSelectCounties(newMultiSelect);

        // If we have 2+ counties selected, merge them
        if (newMultiSelect.size >= 2) {
          mergeSelectedCounties(newMultiSelect);
        }
      } else {
        // Ctrl+Click on single county territory: Add to multi-select for merging
        const newMultiSelect = new Set(multiSelectCounties);

        if (newMultiSelect.has(county.id)) {
          newMultiSelect.delete(county.id);
        } else {
          newMultiSelect.add(county.id);
        }

        setMultiSelectCounties(newMultiSelect);

        // If we have 2+ counties selected, merge them
        if (newMultiSelect.size >= 2) {
          mergeSelectedCounties(newMultiSelect);
        }
      }
    } else {
      // Normal click: toggle county selection
      const newSelected = new Set(selectedCounties);

      if (newSelected.has(county.id)) {
        // Deselect county
        newSelected.delete(county.id);
        // Remove from territories
        setTerritories(territories.filter(t => !t.counties || !t.counties.includes(county.id)));
      } else {
        // Select county
        newSelected.add(county.id);

        // Create a new territory for this county
        const newTerritory = {
          id: `territory-${Date.now()}`,
          name: county.name,
          counties: [county.id],
          victoryPoints: 1,
          maps: [],
          owner: 'NEUTRAL',
          initialOwner: 'NEUTRAL',
          isCountyBased: true
        };
        setTerritories([...territories, newTerritory]);
      }

      setSelectedCounties(newSelected);
      setMultiSelectCounties(new Set()); // Clear multi-select on normal click
    }
  };

  const mergeSelectedCounties = (countiesToMerge) => {
    const countyArray = Array.from(countiesToMerge);

    // Use callback to work with latest state
    setTerritories(prev => {
      // Find all territories that contain these counties
      const affectedTerritories = prev.filter(t =>
        t.counties && t.counties.some(c => countyArray.includes(c))
      );

      if (affectedTerritories.length === 0) return prev;

      // Collect all counties from affected territories
      const allCounties = [...new Set(affectedTerritories.flatMap(t => t.counties))];

      // Create merged territory
      const mergedName = affectedTerritories.map(t => t.name).join(' & ');
      const mergedTerritory = {
        id: `territory-${Date.now()}`,
        name: mergedName,
        counties: allCounties,
        victoryPoints: Math.max(...affectedTerritories.map(t => t.victoryPoints)),
        maps: [...new Set(affectedTerritories.flatMap(t => t.maps || []))],
        owner: affectedTerritories[0].owner || affectedTerritories[0].initialOwner,
        initialOwner: affectedTerritories[0].owner || affectedTerritories[0].initialOwner,
        isCountyBased: true
      };

      // Remove old territories and add merged one
      const remainingTerritories = prev.filter(t => !affectedTerritories.includes(t));
      return [...remainingTerritories, mergedTerritory];
    });
  };

  const splitCountyTerritory = (territory) => {
    // Remove the merged territory
    const remainingTerritories = territories.filter(t => t.id !== territory.id);

    // Create individual territories for each county
    const countyObjects = countyData.counties.filter(c => territory.counties.includes(c.id));
    const newTerritories = countyObjects.map(county => ({
      id: `territory-${Date.now()}-${county.id}`,
      name: county.name,
      counties: [county.id],
      victoryPoints: 1,
      maps: [],
      owner: territory.owner || territory.initialOwner,
      initialOwner: territory.owner || territory.initialOwner,
      isCountyBased: true
    }));

    setTerritories([...remainingTerritories, ...newTerritories]);
  };

  const handleSave = () => {
    if (territories.length < 2) {
      alert('Please create at least 2 territories for your campaign.');
      return;
    }

    // Filter territories based on current mode and update SVG paths and centers
    const modifiedTerritories = territories
      .filter(t => {
        // In county mode, only save county-based territories
        if (isCountyMode) {
          return t.isCountyBased && t.counties && t.counties.length > 0;
        }
        // In state mode, only save state-based territories
        return !t.isCountyBased && t.states && t.states.length > 0;
      })
      .map(t => {
        // Update SVG path and center for state-based territories
        if (t.states && t.states.length > 0) {
          return {
            ...t,
            svgPath: combineStatePaths(t.states),
            center: calculateGroupCenter(t.states)
          };
        }
        // Update SVG path and center for county-based territories
        if (t.counties && t.counties.length > 0 && countyData) {
          const countyObjects = countyData.counties.filter(c => t.counties.includes(c.id));
          return {
            ...t,
            svgPath: combineCountyPaths(countyObjects),
            center: calculateCountyGroupCenter(countyObjects),
            // Store individual county paths for rendering each county separately on the map
            countyPaths: countyObjects.map(c => ({
              id: c.id,
              name: c.name,
              svgPath: c.svgPath
            }))
          };
        }
        // Otherwise preserve existing SVG path and center
        return { ...t };
      });

    if (modifiedTerritories.length < 2) {
      alert('Please create at least 2 territories for your campaign.');
      return;
    }

    onSave(modifiedTerritories);
  };

  const handleDragStart = (e, territoryId) => {
    setDraggedTerritory(territoryId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, territoryId) => {
    e.preventDefault();
    if (draggedTerritory && draggedTerritory !== territoryId) {
      const draggedIdx = territories.findIndex(t => t.id === draggedTerritory);
      const targetIdx = territories.findIndex(t => t.id === territoryId);
      
      if (draggedIdx !== -1 && targetIdx !== -1) {
        const newTerritories = [...territories];
        const [removed] = newTerritories.splice(draggedIdx, 1);
        newTerritories.splice(targetIdx, 0, removed);
        setTerritories(newTerritories);
      }
    }
  };

  const handleDragEnd = () => {
    setDraggedTerritory(null);
  };

  const handleMapModeToggle = () => {
    const newMode = mapMode === 'states' ? 'counties' : 'states';
    setMapMode(newMode);

    if (newMode === 'counties') {
      // Show state selector modal
      setShowStateSelector(true);
    } else {
      // Switch back to states mode - clear all territories and selections
      setIsCountyMode(false);
      setCountyData(null);
      setSelectedStatesForCounties(new Set());
      setTerritories([]);
      setSelectedStates(new Set());
      setSelectedCounties(new Set());
    }
  };

  const handleStateSelectionConfirm = async () => {
    if (selectedStatesForCounties.size === 0) {
      alert('Please select at least one state.');
      return;
    }

    try {
      // Load county data for selected states
      const stateAbbrs = Array.from(selectedStatesForCounties);
      const countyDataForStates = await getCountiesForStates(stateAbbrs);

      setCountyData(countyDataForStates);
      setIsCountyMode(true);
      setShowStateSelector(false);

      // Clear existing territories and reset selection
      setTerritories([]);
      setSelectedStates(new Set());
    } catch (error) {
      console.error('Error loading county data:', error);
      alert('Failed to load county data. Please try again.');
    }
  };

  const handleStateSelectionCancel = () => {
    setShowStateSelector(false);
    setMapMode('states'); // Reset back to states mode
    setSelectedStatesForCounties(new Set());
  };

  const toggleStateForCounties = (stateAbbr) => {
    const newSelection = new Set(selectedStatesForCounties);
    if (newSelection.has(stateAbbr)) {
      newSelection.delete(stateAbbr);
    } else {
      newSelection.add(stateAbbr);
    }
    setSelectedStatesForCounties(newSelection);
  };

  // Zoom and pan handlers
  const handleWheel = (e) => {
    // Only zoom if shift is held
    if (e.shiftKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.5, Math.min(5, zoom * delta));
      setZoom(newZoom);
    }
  };

  const handleMouseDown = (e) => {
    // Pan with middle mouse button or shift + left click
    const shouldPan = e.button === 1 || (e.button === 0 && e.shiftKey);
    if (shouldPan) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
      return;
    }

    // Start drag selection with left click
    if (e.button === 0) {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+drag for merging
        setIsDraggingMerge(true);
      } else {
        // Normal drag for selecting
        setIsDraggingSelect(true);
      }
      setDraggedItems(new Set());
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPanX(e.clientX - panStart.x);
      setPanY(e.clientY - panStart.y);
    }
    // Drag selection is handled in individual state/county mouseEnter handlers
  };

  const handleMouseUp = () => {
    setIsPanning(false);

    // Finalize drag selection or merge
    if ((isDraggingSelect || isDraggingMerge) && draggedItems.size > 0) {
      finalizeDragSelection();
      setJustDragged(true);
      // Clear the flag after a short delay to allow click events to be ignored
      setTimeout(() => setJustDragged(false), 100);
    }
    setIsDraggingSelect(false);
    setIsDraggingMerge(false);
    setDraggedItems(new Set());
  };

  const finalizeDragSelection = () => {
    const itemsArray = Array.from(draggedItems);

    if (isCountyMode) {
      // Handle county drag selection
      if (isDraggingMerge && itemsArray.length > 1) {
        // Ctrl+drag: Create a single merged territory directly
        const newCounties = [];
        const countyObjects = [];

        itemsArray.forEach(countyId => {
          const county = countyData.counties.find(c => c.id === countyId);
          if (county && !selectedCounties.has(countyId)) {
            newCounties.push(countyId);
            countyObjects.push(county);
          }
        });

        if (newCounties.length > 1) {
          // Create a single merged territory
          const mergedName = countyObjects.map(c => c.name).join(' & ');
          const mergedTerritory = {
            id: `territory-${Date.now()}-merged`,
            name: mergedName,
            counties: newCounties,
            victoryPoints: 1,
            maps: [],
            owner: 'NEUTRAL',
            initialOwner: 'NEUTRAL',
            isCountyBased: true
          };

          // Update selected counties
          setSelectedCounties(prev => {
            const updated = new Set(prev);
            newCounties.forEach(id => updated.add(id));
            return updated;
          });

          // Use callback to work with latest state
          setTerritories(prev => {
            // Find any existing territories that contain these counties
            const affectedTerritories = prev.filter(t =>
              t.counties && t.counties.some(c => newCounties.includes(c))
            );

            // Collect all counties from affected territories plus new ones
            const allCounties = [...new Set([
              ...affectedTerritories.flatMap(t => t.counties),
              ...newCounties
            ])];

            // If there are existing territories, merge with them
            if (affectedTerritories.length > 0) {
              const allCountyObjects = countyData.counties.filter(c => allCounties.includes(c.id));
              const finalMergedName = allCountyObjects.map(c => c.name).join(' & ');
              const finalMergedTerritory = {
                id: `territory-${Date.now()}-merged`,
                name: finalMergedName,
                counties: allCounties,
                victoryPoints: Math.max(...affectedTerritories.map(t => t.victoryPoints), 1),
                maps: [...new Set(affectedTerritories.flatMap(t => t.maps || []))],
                owner: affectedTerritories[0].owner || 'NEUTRAL',
                initialOwner: affectedTerritories[0].initialOwner || 'NEUTRAL',
                isCountyBased: true
              };

              // Remove affected territories and add the merged one
              return [...prev.filter(t => !affectedTerritories.includes(t)), finalMergedTerritory];
            } else {
              // No existing territories, just add the new merged one
              return [...prev, mergedTerritory];
            }
          });

          setMultiSelectCounties(new Set(newCounties));
        }
      } else {
        // Normal drag: Create individual territories
        const newCounties = [];
        const newTerritories = [];

        itemsArray.forEach(countyId => {
          const county = countyData.counties.find(c => c.id === countyId);
          if (county && !selectedCounties.has(countyId)) {
            newCounties.push(countyId);

            const newTerritory = {
              id: `territory-${Date.now()}-${Math.random()}-${countyId}`,
              name: county.name,
              counties: [countyId],
              victoryPoints: 1,
              maps: [],
              owner: 'NEUTRAL',
              initialOwner: 'NEUTRAL',
              isCountyBased: true
            };
            newTerritories.push(newTerritory);
          }
        });

        if (newCounties.length > 0) {
          setSelectedCounties(prev => {
            const updated = new Set(prev);
            newCounties.forEach(id => updated.add(id));
            return updated;
          });
          setTerritories(prev => [...prev, ...newTerritories]);
        }
      }
    } else {
      // Handle state drag selection
      if (isDraggingMerge && itemsArray.length > 1) {
        // Ctrl+drag: Create a single merged territory directly
        const newStates = [];
        const stateObjects = [];

        itemsArray.forEach(stateAbbr => {
          if (!selectedStates.has(stateAbbr)) {
            const state = usaStates.find(s => s.abbreviation === stateAbbr);
            if (state) {
              newStates.push(stateAbbr);
              stateObjects.push(state);
            }
          }
        });

        if (newStates.length > 1) {
          // Create a single merged territory
          const mergedName = stateObjects.map(s => s.name).join(' & ');
          const mergedTerritory = {
            id: `territory-${Date.now()}-merged`,
            name: mergedName,
            states: newStates,
            victoryPoints: 1,
            maps: [],
            owner: 'NEUTRAL',
            initialOwner: 'NEUTRAL',
            svgPath: combineStatePaths(newStates),
            center: calculateGroupCenter(newStates)
          };

          // Update selected states
          setSelectedStates(prev => {
            const updated = new Set(prev);
            newStates.forEach(abbr => updated.add(abbr));
            return updated;
          });

          // Use callback to work with latest state
          setTerritories(prev => {
            // Find any existing territories that contain these states
            const affectedTerritories = prev.filter(t =>
              t.states && t.states.some(s => newStates.includes(s))
            );

            // Collect all states from affected territories plus new ones
            const allStates = [...new Set([
              ...affectedTerritories.flatMap(t => t.states),
              ...newStates
            ])];

            // If there are existing territories, merge with them
            if (affectedTerritories.length > 0) {
              const allStateObjects = getStatesByAbbrs(allStates);
              const finalMergedName = allStateObjects.map(s => s.name).join(' & ');
              const finalMergedTerritory = {
                id: `territory-${Date.now()}-merged`,
                name: finalMergedName,
                states: allStates,
                victoryPoints: Math.max(...affectedTerritories.map(t => t.victoryPoints), 1),
                maps: [...new Set(affectedTerritories.flatMap(t => t.maps || []))],
                owner: affectedTerritories[0].owner || 'NEUTRAL',
                initialOwner: affectedTerritories[0].initialOwner || 'NEUTRAL',
                svgPath: combineStatePaths(allStates),
                center: calculateGroupCenter(allStates)
              };

              // Remove affected territories and add the merged one
              return [...prev.filter(t => !affectedTerritories.includes(t)), finalMergedTerritory];
            } else {
              // No existing territories, just add the new merged one
              return [...prev, mergedTerritory];
            }
          });

          setMultiSelectStates(new Set(newStates));
        }
      } else {
        // Normal drag: Create individual territories
        const newStates = [];
        const newTerritories = [];

        itemsArray.forEach(stateAbbr => {
          if (!selectedStates.has(stateAbbr)) {
            const state = usaStates.find(s => s.abbreviation === stateAbbr);
            if (state) {
              newStates.push(stateAbbr);

              const newTerritory = {
                id: `territory-${Date.now()}-${Math.random()}-${stateAbbr}`,
                name: state.name,
                states: [stateAbbr],
                victoryPoints: 1,
                maps: [],
                owner: 'NEUTRAL',
                initialOwner: 'NEUTRAL',
                svgPath: state.svgPath,
                center: state.center
              };
              newTerritories.push(newTerritory);
            }
          }
        });

        if (newStates.length > 0) {
          setSelectedStates(prev => {
            const updated = new Set(prev);
            newStates.forEach(abbr => updated.add(abbr));
            return updated;
          });
          setTerritories(prev => [...prev, ...newTerritories]);
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-amber-400">Custom Campaign Map Editor</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Map View */}
          <div className="flex-1 p-4 overflow-auto">
            <div className="bg-slate-800 rounded-lg p-4 h-full flex items-center justify-center">
              <svg
                viewBox={isCountyMode && countyData ? countyData.viewBox : "0 0 1000 589"}
                className="w-full h-full"
                style={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  cursor: isPanning ? 'grabbing' : (isDraggingSelect || isDraggingMerge) ? 'crosshair' : 'default'
                }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
                  {/* Render counties or states based on mode */}
                  {isCountyMode && countyData ? (
                  <>
                    {/* Render county paths */}
                    {countyData.counties.length > 0 ? (
                      <>
                        {countyData.counties.map(county => {
                          const isSelected = selectedCounties.has(county.id);
                          const isHovered = hoveredCounty === county.id;
                          const isMultiSelected = multiSelectCounties.has(county.id);

                          // Find territory that owns this county
                          const owningTerritory = territories.find(t =>
                            t.counties && t.counties.includes(county.id)
                          );
                          const owner = owningTerritory?.owner || owningTerritory?.initialOwner;

                          // Determine fill color based on owner/selection
                          let fillColor = '#64748b'; // Default gray
                          if (isSelected) {
                            if (owner === 'USA') fillColor = '#3b82f6'; // Blue
                            else if (owner === 'CSA') fillColor = '#ef4444'; // Red
                            else if (owner === 'NEUTRAL') fillColor = '#f59e0b'; // Orange
                            else fillColor = '#fbbf24'; // Amber (unassigned)
                          }

                          // Highlight multi-selected counties with black border
                          const strokeColor = isMultiSelected ? '#000000' : '#94a3b8';
                          const strokeWidth = isMultiSelected ? '3' : '0.2';

                          return (
                            <path
                              key={county.id}
                              d={county.svgPath}
                              fill={fillColor}
                              fillOpacity={isSelected ? 0.6 : 0.3}
                              stroke={strokeColor}
                              strokeWidth={strokeWidth}
                              className="cursor-pointer transition-all duration-200"
                              style={{
                                filter: isHovered ? 'brightness(1.3)' : 'none'
                              }}
                              onClick={(e) => handleCountyClick(county, e.ctrlKey || e.metaKey)}
                              onMouseEnter={() => {
                                setHoveredCounty(county.id);
                                // Add to drag selection if dragging
                                if (isDraggingSelect || isDraggingMerge) {
                                  setDraggedItems(prev => new Set([...prev, county.id]));
                                }
                              }}
                              onMouseLeave={() => setHoveredCounty(null)}
                            />
                          );
                        })}
                      </>
                    ) : (
                      <text x="500" y="300" textAnchor="middle" fill="#fff" fontSize="20">
                        No county data available for selected states
                      </text>
                    )}
                  </>
                ) : (
                  /* Render all states */
                  usaStates.map(state => {
                  const isSelected = selectedStates.has(state.abbreviation);
                  const isHovered = hoveredState === state.abbreviation;
                  const isMultiSelected = multiSelectStates.has(state.abbreviation);
                  
                  // Find territory that owns this state to determine color
                  const owningTerritory = territories.find(t =>
                    t.states && t.states.includes(state.abbreviation)
                  );
                  const owner = owningTerritory?.owner || owningTerritory?.initialOwner;
                  
                  // Determine fill color based on owner
                  let fillColor = '#64748b'; // Default gray
                  if (isSelected) {
                    if (owner === 'USA') fillColor = '#3b82f6'; // Blue
                    else if (owner === 'CSA') fillColor = '#ef4444'; // Red
                    else if (owner === 'NEUTRAL') fillColor = '#f59e0b'; // Orange
                    else fillColor = '#fbbf24'; // Amber (unassigned)
                  }
                  
                  // Highlight multi-selected states with black border
                  const strokeColor = isMultiSelected ? '#000000' : '#ffffff';
                  const strokeWidth = isMultiSelected ? '3' : '1';
                  
                  return (
                    <path
                      key={state.abbreviation}
                      d={state.svgPath}
                      fill={fillColor}
                      fillOpacity={isSelected ? 0.6 : 0.3}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      className="cursor-pointer transition-all duration-200"
                      style={{
                        filter: isHovered ? 'brightness(1.3)' : 'none'
                      }}
                      onClick={(e) => handleStateClick(state.abbreviation, e.ctrlKey || e.metaKey)}
                      onMouseEnter={() => {
                        setHoveredState(state.abbreviation);
                        // Add to drag selection if dragging
                        if (isDraggingSelect || isDraggingMerge) {
                          setDraggedItems(prev => new Set([...prev, state.abbreviation]));
                        }
                      }}
                      onMouseLeave={() => setHoveredState(null)}
                    />
                  );
                  })
                )}
                </g>
              </svg>
            </div>
            
            {/* Instructions */}
            <div className="mt-4 p-3 bg-slate-800 rounded-lg text-sm text-slate-300">
              <p className="font-semibold text-amber-400 mb-2">Instructions:</p>
              {isCountyMode ? (
                <ul className="space-y-1 list-disc list-inside">
                  <li>Click counties to select/deselect them</li>
                  <li><strong>Click+Drag</strong> to select multiple counties at once</li>
                  <li><strong>Ctrl+Click+Drag</strong> to select and merge counties into one territory</li>
                  <li>Ctrl+Click on counties to merge them into one territory (2+ counties)</li>
                  <li>Ctrl+Click on a merged territory to split it back into individual counties</li>
                  <li>Selected counties are colored by owner (Blue=USA, Red=CSA, Orange=Neutral)</li>
                  <li><strong>Shift+Scroll</strong> to zoom in/out, <strong>Shift+Drag</strong> to pan</li>
                  <li>Configure territories in the right panel</li>
                </ul>
              ) : (
                <ul className="space-y-1 list-disc list-inside">
                  <li>Click states to select/deselect them for your campaign</li>
                  <li><strong>Click+Drag</strong> to select multiple states at once</li>
                  <li><strong>Ctrl+Click+Drag</strong> to select and merge states into one territory</li>
                  <li>Ctrl+Click on states to merge them into one territory (2+ states)</li>
                  <li>Ctrl+Click on a merged territory to split it back into individual states</li>
                  <li>Selected states are colored by owner (Blue=USA, Red=CSA, Orange=Neutral)</li>
                  <li><strong>Shift+Scroll</strong> to zoom in/out, <strong>Shift+Drag</strong> to pan</li>
                  <li>Configure each territory in the right panel</li>
                </ul>
              )}
            </div>
          </div>

          {/* Territory Configuration Panel */}
          <div className="w-96 border-l border-slate-700 flex flex-col">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-amber-400 mb-2">
                Territories ({territories.length})
              </h3>
              <p className="text-sm text-slate-400">
                {isCountyMode
                  ? `${selectedCounties.size} counties selected (${Array.from(selectedStatesForCounties).join(', ')})`
                  : `${selectedStates.size} states selected`
                }
              </p>
            </div>

            {/* Territory List */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {territories.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No territories yet</p>
                  <p className="text-sm mt-1">Click states on the map to begin</p>
                </div>
              ) : (
                territories.map((territory, index) => (
                  <div
                    key={territory.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, territory.id)}
                    onDragOver={(e) => handleDragOver(e, territory.id)}
                    onDragEnd={handleDragEnd}
                    className={`bg-slate-800 rounded-lg p-3 cursor-move ${
                      draggedTerritory === territory.id ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Territory Header */}
                    <div className="flex items-start gap-2 mb-3">
                      <GripVertical className="w-5 h-5 text-slate-500 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={territory.name}
                          onChange={(e) => handleTerritoryUpdate(territory.id, 'name', e.target.value)}
                          className="w-full bg-slate-700 text-white px-2 py-1 rounded text-sm font-semibold"
                          placeholder="Territory Name"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                          {territory.isCountyBased
                            ? (() => {
                                const countyNames = territory.counties
                                  ?.map(cId => countyData?.counties.find(c => c.id === cId)?.name)
                                  .filter(Boolean) || [];
                                return `Counties (${countyNames.length}): ${countyNames.join(', ')}`;
                              })()
                            : `States (${territory.states?.length || 0}): ${territory.states ? territory.states.join(', ') : 'N/A'}`
                          }
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteTerritory(territory.id)}
                        className="p-1 hover:bg-slate-700 rounded transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>

                    {/* Victory Points */}
                    <div className="mb-3">
                      <label className="text-xs text-slate-400 block mb-1">
                        Victory Points: {territory.victoryPoints}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        value={territory.victoryPoints}
                        onChange={(e) => handleTerritoryUpdate(territory.id, 'victoryPoints', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    {/* Current Owner */}
                    <div className="mb-3">
                      <label className="text-xs text-slate-400 block mb-1">Current Owner</label>
                      <select
                        value={territory.owner || territory.initialOwner}
                        onChange={(e) => {
                          // Update both owner and initialOwner in one operation
                          setTerritories(territories.map(t =>
                            t.id === territory.id
                              ? { ...t, owner: e.target.value, initialOwner: e.target.value }
                              : t
                          ));
                        }}
                        className="w-full bg-slate-700 text-white px-2 py-1 rounded text-sm"
                      >
                        <option value="USA">USA</option>
                        <option value="CSA">CSA</option>
                        <option value="NEUTRAL">Neutral</option>
                      </select>
                    </div>

                    {/* Assigned Maps */}
                    <div className="mb-3">
                      <label className="text-xs text-slate-400 block mb-1">Assigned Maps</label>
                      <select
                        multiple
                        value={territory.maps}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, option => option.value);
                          handleTerritoryUpdate(territory.id, 'maps', selected);
                        }}
                        className="w-full bg-slate-700 text-white px-2 py-1 rounded text-sm h-32"
                      >
                        {Object.entries(mapsByMapset).map(([mapset, maps]) => (
                          <optgroup key={mapset} label={mapset}>
                            {maps.map(map => (
                              <option key={map} value={map}>{map}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-1">
                        Hold Ctrl/Cmd to select multiple
                      </p>
                    </div>

                  </div>
                ))
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-4 border-t border-slate-700 space-y-2">
              {/* Map Mode Toggle */}
              <div className="bg-slate-800 rounded-lg p-3 border border-slate-600">
                <label className="text-xs text-slate-400 block mb-2">Map Display Mode</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMapModeToggle}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors font-semibold ${
                      mapMode === 'states'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                  >
                    <Map className="w-4 h-4" />
                    {mapMode === 'states' ? 'States' : 'Counties'}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2 text-center">
                  {mapMode === 'states' ? 'Click to switch to county view' : 'Click to switch to state view'}
                </p>
              </div>

              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset All
              </button>
              <button
                onClick={handleSave}
                disabled={territories.length < 2}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg transition-colors font-semibold"
              >
                <Save className="w-4 h-4" />
                Save Custom Map
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* State Selection Modal for County Mode */}
      {showStateSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-xl font-bold text-amber-400">Select States for County Map</h3>
              <button
                onClick={handleStateSelectionCancel}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              <p className="text-slate-300 mb-4">
                Select one or more states to load their county boundaries. Counties from selected states will be merged into a single editable map.
              </p>

              {/* State Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {usaStates.map(state => (
                  <button
                    key={state.abbreviation}
                    onClick={() => toggleStateForCounties(state.abbreviation)}
                    className={`p-3 rounded-lg text-left transition-colors ${
                      selectedStatesForCounties.has(state.abbreviation)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-sm">{state.abbreviation}</div>
                    <div className="text-xs opacity-75">{state.name}</div>
                  </button>
                ))}
              </div>

              {/* Selection Summary */}
              {selectedStatesForCounties.size > 0 && (
                <div className="mt-4 p-3 bg-slate-700 rounded-lg">
                  <p className="text-sm text-slate-300">
                    <span className="font-semibold text-amber-400">
                      {selectedStatesForCounties.size}
                    </span>{' '}
                    {selectedStatesForCounties.size === 1 ? 'state' : 'states'} selected:{' '}
                    <span className="text-blue-400">
                      {Array.from(selectedStatesForCounties).join(', ')}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700 flex gap-2">
              <button
                onClick={handleStateSelectionCancel}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleStateSelectionConfirm}
                disabled={selectedStatesForCounties.size === 0}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold"
              >
                Load Counties ({selectedStatesForCounties.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapEditor;