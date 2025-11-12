
# War of Rights Campaign Tracker - Technical Specification

## Executive Summary

A React-based campaign tracking tool for War of Rights that adapts the RS2: Vietnam territory control system. The application will feature an interactive USA map, turn-based campaign progression, battle recording, and territory management with a consistent UI/UX matching the existing LogAnalyzer and SeasonTracker tools.

---

## 1. Core Requirements

### 1.1 Functional Requirements
- **Interactive Map Visualization**: Display USA territories with clear boundaries
- **Territory Management**: Track ownership (USA vs CSA) for each territory
- **Campaign State**: Manage campaign start date, current turn, and victory points
- **Battle Recording**: Log battles with map, winner, and casualty data
- **Campaign Progression**: Turn-based system where battles determine territory control
- **Data Persistence**: localStorage for campaign state preservation
- **Export/Import**: JSON export/import for campaign data

### 1.2 Non-Functional Requirements
- **Performance**: Smooth rendering of map interactions (<100ms response)
- **Usability**: Intuitive UI matching existing tools' patterns
- **Maintainability**: SOLID principles, DRY code, clear component separation
- **Accessibility**: Keyboard navigation, clear visual feedback
- **Responsiveness**: Functional on screens 1280px+ wide

---

## 2. Data Models & State Structure

### 2.1 Campaign State
```javascript
{
  id: string,                    // Unique campaign identifier
  name: string,                  // Campaign name
  startDate: string,             // ISO date string
  currentTurn: number,           // Current turn number (1-based)
  victoryPointsUSA: number,      // USA victory points
  victoryPointsCSA: number,      // CSA victory points
  victoryPointTarget: number,    // Points needed to win (default: 100)
  territories: Territory[],      // Array of territory objects
  battles: Battle[],             // Battle history
  settings: CampaignSettings     // Campaign configuration
}
```

### 2.2 Territory Model
```javascript
{
  id: string,                    // Unique territory ID (e.g., "maryland", "virginia")
  name: string,                  // Display name
  owner: 'USA' | 'CSA' | 'NEUTRAL', // Current owner
  victoryPoints: number,         // VP value of territory
  mapName: string,               // Associated WoR map name
  coordinates: {                 // SVG path or polygon coordinates
    type: 'polygon' | 'path',
    data: string                 // SVG path data or polygon points
  },
  adjacentTerritories: string[], // IDs of bordering territories
  isCapital: boolean,            // Special territory flag
  captureHistory: {              // Ownership history
    turn: number,
    owner: string,
    battleId: string
  }[]
}
```

### 2.3 Battle Model
```javascript
{
  id: string,                    // Unique battle ID
  turn: number,                  // Turn when battle occurred
  date: string,                  // ISO date string
  territoryId: string,           // Territory being contested
  mapName: string,               // WoR map played
  attacker: 'USA' | 'CSA',       // Attacking side
  winner: 'USA' | 'CSA',         // Battle winner
  casualties: {
    USA: number,
    CSA: number
  },
  victoryPointsAwarded: number,  // VPs awarded for this battle
  notes: string                  // Optional battle notes
}
```

### 2.4 Campaign Settings
```javascript
{
  victoryPointsPerTerritory: number,     // Default: 10
  victoryPointsPerBattle: number,        // Default: 5
  allowTerritoryRecapture: boolean,      // Can territories change hands?
  requireAdjacentAttack: boolean,        // Must attack adjacent territories only?
  capitalBonusMultiplier: number,        // VP multiplier for capitals (default: 2)
  casualtyTracking: boolean              // Track casualties?
}
```

---

## 3. Component Architecture

### 3.1 Component Hierarchy

```
CampaignTracker (Main Component)
├── CampaignHeader
│   ├── CampaignInfo (name, turn, date)
│   ├── VictoryPointsDisplay
│   └── ActionButtons (new campaign, export, import, settings)
├── MapView
│   ├── USAMap (SVG-based interactive map)
│   ├── TerritoryLayer (clickable territories)
│   ├── BorderLayer (territory boundaries)
│   └── LegendPanel (color coding explanation)
├── ControlPanel
│   ├── TerritoryList (scrollable list with filters)
│   ├── BattleRecorder
│   │   ├── MapSelector
│   │   ├── WinnerSelector
│   │   ├── CasualtyInputs
│   │   └── RecordBattleButton
│   └── TurnControls (advance turn, undo)
└── BattleHistory
    ├── BattleList (chronological or by territory)
    ├── BattleDetails (expandable)
    └── BattleFilters (by side, territory, turn range)
```

### 3.2 Component Specifications

#### CampaignTracker (Root Component)
**Purpose**: Main container managing global state and localStorage persistence

**State**:
- `campaign`: Current campaign object
- `selectedTerritory`: Currently selected territory
- `showSettings`: Settings modal visibility
- `showBattleRecorder`: Battle recorder modal visibility

**Key Methods**:
- `loadCampaign()`: Load from localStorage
- `saveCampaign()`: Save to localStorage
- `recordBattle()`: Add battle and update territory
- `advanceTurn()`: Increment turn counter
- `calculateVictoryPoints()`: Recalculate VP totals

#### MapView Component
**Purpose**: Interactive SVG map visualization

**Props**:
- `territories`: Territory array
- `selectedTerritory`: Currently selected territory ID
- `onTerritoryClick`: Territory selection handler
- `highlightMode`: 'owner' | 'vp' | 'recent'

**Features**:
- SVG-based USA map with state boundaries
- Color-coded territories (blue=USA, red=CSA, gray=neutral)
- Hover tooltips showing territory info
- Click to select territory for battle recording
- Visual indicators for recent captures

#### BattleRecorder Component
**Purpose**: Modal for recording new battles

**Props**:
- `territories`: Available territories
- `onRecordBattle`: Battle submission handler
- `currentTurn`: Current campaign turn

**Features**:
- Territory/map selection dropdown
- Attacker/defender selection
- Winner selection
- Casualty input fields (optional)
- Validation before submission
- Auto-calculate VP awards

#### BattleHistory Component
**Purpose**: Display and filter battle history

**Props**:
- `battles`: Battle array
- `territories`: Territory lookup

**Features**:
- Chronological battle list
- Expandable battle details
- Filter by: side, territory, turn range
- Export battle log to CSV
- Visual timeline view

---

## 4. Map Implementation Approach

### 4.1 Recommended Solution: SVG with Pre-defined State Boundaries

**Rationale**:
- Scalable and crisp at any zoom level
- Easy to style and animate
- Lightweight (no external dependencies)
- Precise click detection
- Consistent with existing tools' approach

### 4.2 Map Structure

```javascript
// territories.js - Territory definitions
export const TERRITORIES = [
  {
    id: 'maryland',
    name: 'Maryland',
    mapName: 'Antietam',
    victoryPoints: 15,
    isCapital: false,
    coordinates: {
      type: 'polygon',
      data: 'M 100,50 L 150,50 L 150,100 L 100,100 Z' // Simplified
    },
    adjacentTerritories: ['virginia', 'pennsylvania', 'west-virginia']
  },
  // ... more territories
];

// Map regions for War of Rights theater
export const REGIONS = {
  MARYLAND: ['maryland', 'harpers-ferry'],
  VIRGINIA: ['virginia', 'shenandoah-valley', 'richmond'],
  PENNSYLVANIA: ['gettysburg', 'south-mountain'],
  WEST_VIRGINIA: ['west-virginia']
};
```

### 4.3 SVG Map Component

```jsx
const USAMap = ({ territories, selectedTerritory, onTerritoryClick }) => {
  const getTerritorColor = (territory) => {
    if (territory.owner === 'USA') return '#3b82f6'; // Blue
    if (territory.owner === 'CSA') return '#ef4444'; // Red
    return '#64748b'; // Gray (neutral)
  };

  return (
    <svg viewBox="0 0 800 600" className="w-full h-full">
      {territories.map(territory => (
        <g key={territory.id}>
          <path
            d={territory.coordinates.data}
            fill={getTerritorColor(territory)}
            stroke="#1e293b"
            strokeWidth="2"
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onTerritoryClick(territory)}
          />
          <text
            x={territory.labelPosition.x}
            y={territory.labelPosition.y}
            className="text-xs fill-white pointer-events-none"
            textAnchor="middle"
          >
            {territory.name}
          </text>
        </g>
      ))}
    </svg>
  );
};
```

### 4.4 Territory Coordinate Generation

**Initial Approach**: Hand-drawn simplified state boundaries
- Focus on Maryland, Virginia, Pennsylvania, West Virginia
- Simplified polygons (not exact state boundaries)
- Emphasis on playability over geographic accuracy

**Future Enhancement**: Import actual state boundary data from GeoJSON

---

## 5. Campaign Mechanics Design

### 5.1 Turn-Based Progression

```javascript
// Turn flow
1. Select territory to attack (must be adjacent if setting enabled)
2. Record battle (map, winner, casualties)
3. Update territory ownership based on winner
4. Award victory points
5. Check victory conditions
6. Advance to next turn
```

### 5.2 Territory Capture Rules

```javascript
const processBattleResult = (battle, territory, settings) => {
  // Winner captures the territory
  territory.owner = battle.winner;
  
  // Award victory points
  let vpAwarded = settings.victoryPointsPerBattle;
  
  // Bonus for capturing territory
  vpAwarded += territory.victoryPoints;
  
  // Capital bonus
  if (territory.isCapital) {
    vpAwarded *= settings.capitalBonusMultiplier;
  }
  
  // Update campaign VP totals
  if (battle.winner === 'USA') {
    campaign.victoryPointsUSA += vpAwarded;
  } else {
    campaign.victoryPointsCSA += vpAwarded;
  }
  
  return vpAwarded;
};
```

### 5.3 Victory Conditions

```javascript
const checkVictoryConditions = (campaign) => {
  // VP Victory
  if (campaign.victoryPointsUSA >= campaign.victoryPointTarget) {
    return { winner: 'USA', type: 'Victory Points' };
  }
  if (campaign.victoryPointsCSA >= campaign.victoryPointTarget) {
    return { winner: 'CSA', type: 'Victory Points' };
  }
  
  // Territory Control Victory (optional)
  const usaTerritories = campaign.territories.filter(t => t.owner === 'USA').length;
  const csaTerritories = campaign.territories.filter(t => t.owner === 'CSA').length;
  const totalTerritories = campaign.territories.length;
  
  if (usaTerritories / totalTerritories >= 0.75) {
    return { winner: 'USA', type: 'Territorial Dominance' };
  }
  if (csaTerritories / totalTerritories >= 0.75) {
    return { winner: 'CSA', type: 'Territorial Dominance' };
  }
  
  return null; // Campaign continues
};
```

### 5.4 Map-to-Territory Mapping

```javascript
// mapTerritoryMapping.js
export const MAP_TERRITORY_MAPPING = {
  // Antietam maps -> Maryland
  "East Woods Skirmish": "maryland",
  "Hooker's Push": "maryland",
  "Miller's Cornfield": "maryland",
  "Bloody Lane": "maryland",
  "Burnside's Bridge": "maryland",
  // ... more mappings
  
  // Harpers Ferry maps -> West Virginia/Maryland border
  "Maryland Heights": "harpers-ferry",
  "River Crossing": "harpers-ferry",
  // ... more mappings
  
  // South Mountain maps -> Maryland/Pennsylvania
  "Garland's Stand": "south-mountain",
  "Cox's Push": "south-mountain",
  // ... more mappings
};

// Helper function
export const getTerritoryForMap = (mapName) => {
  return MAP_TERRITORY_MAPPING[mapName] || null;
};
```

---

## 6. File Structure

```
campaign-tool/
├── public/
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── CampaignHeader.jsx          # Header with campaign info
│   │   ├── VictoryPointsDisplay.jsx    # VP scoreboard
│   │   ├── MapView.jsx                 # Main map container
│   │   ├── USAMap.jsx                  # SVG map component
│   │   ├── TerritoryTooltip.jsx        # Hover tooltip
│   │   ├── TerritoryList.jsx           # Sidebar territory list
│   │   ├── BattleRecorder.jsx          # Battle input modal
│   │   ├── BattleHistory.jsx           # Battle log display
│   │   ├── BattleCard.jsx              # Individual battle display
│   │   ├── TurnControls.jsx            # Turn advancement UI
│   │   ├── SettingsModal.jsx           # Campaign settings
│   │   └── VictoryModal.jsx            # Victory screen
│   ├── data/
│   │   ├── territories.js              # Territory definitions
│   │   ├── mapTerritoryMapping.js      # Map-to-territory mapping
│   │   └── defaultCampaign.js          # Default campaign template
│   ├── hooks/
│   │   ├── useCampaign.js              # Campaign state management
│   │   ├── useLocalStorage.js          # localStorage hook
│   │   └── useBattleRecording.js       # Battle recording logic
│   ├── utils/
│   │   ├── campaignLogic.js            # Core campaign mechanics
│   │   ├── victoryConditions.js        # Victory checking
│   │   ├── territoryUtils.js           # Territory helpers
│   │   └── exportImport.js             # Data export/import
│   ├── CampaignTracker.jsx             # Main component
│   ├── App.jsx                         # App wrapper
│   ├── main.jsx                        # Entry point
│   └── index.css                       # Global styles
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
├── README.md
└── TECHNICAL_SPECIFICATION.md          # This document
```

---

## 7. Component Implementation Details

### 7.1 CampaignTracker (Main Component)

```jsx
import React, { useState, useEffect } from 'react';
import { Map, Trophy, Calendar, Plus, Download, Upload, Settings } from 'lucide-react';

const STORAGE_KEY = 'WarOfRightsCampaignTracker';

const CampaignTracker = () => {
  // State management
  const [campaign, setCampaign] = useState(null);
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [showBattleRecorder, setShowBattleRecorder] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVictory, setShowVictory] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setCampaign(JSON.parse(saved));
    } else {
      // Initialize new campaign
      setCampaign(createDefaultCampaign());
    }
  }, []);

  // Save to localStorage on campaign changes
  useEffect(() => {
    if (campaign) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign));
      
      // Check victory conditions
      const victory = checkVictoryConditions(campaign);
      if (victory) {
        setShowVictory(victory);
      }
    }
  }, [campaign]);

  // Core methods
  const recordBattle = (battleData) => {
    const battle = {
      id: Date.now().toString(),
      turn: campaign.currentTurn,
      date: new Date().toISOString(),
      ...battleData
    };

    // Process battle result
    const updatedCampaign = processBattleResult(campaign, battle);
    setCampaign(updatedCampaign);
    setShowBattleRecorder(false);
  };

  const advanceTurn = () => {
    setCampaign({
      ...campaign,
      currentTurn: campaign.currentTurn + 1
    });
  };

  // ... more methods

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Component JSX */}
    </div>
  );
};
```

### 7.2 MapView Component

```jsx
const MapView = ({ territories, selectedTerritory, onTerritoryClick, highlightMode }) => {
  const [hoveredTerritory, setHoveredTerritory] = useState(null);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
          <Map className="w-6 h-6" />
          Campaign Map
        </h2>
        <div className="flex gap-2">
          {/* Legend */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-slate-300">USA</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-slate-300">CSA</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-slate-500 rounded"></div>
              <span className="text-slate-300">Neutral</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="relative bg-slate-900 rounded-lg p-4">
        <USAMap
          territories={territories}
          selectedTerritory={selectedTerritory}
          hoveredTerritory={hoveredTerritory}
          onTerritoryClick={onTerritoryClick}
          onTerritoryHover={setHoveredTerritory}
        />
        
        {hoveredTerritory && (
          <TerritoryTooltip territory={hoveredTerritory} />
        )}
      </div>
    </div>
  );
};
```

### 7.3 BattleRecorder Component

```jsx
const BattleRecorder = ({ territories, currentTurn, onRecordBattle, onClose }) => {
  const [selectedMap, setSelectedMap] = useState('');
  const [attacker, setAttacker] = useState('USA');
  const [winner, setWinner] = useState('');
  const [casualties, setCasualties] = useState({ USA: 0, CSA: 0 });
  const [notes, setNotes] = useState('');

  // Auto-determine territory from map selection
  const selectedTerritory = selectedMap 
    ? territories.find(t => t.mapName === selectedMap)
    : null;

  const handleSubmit = () => {
    if (!selectedMap || !winner) {
      alert('Please select a map and winner');
      return;
    }

    onRecordBattle({
      territoryId: selectedTerritory.id,
      mapName: selectedMap,
      attacker,
      winner,
      casualties,
      notes
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-2xl w-full">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-amber-400 mb-4">
            Record Battle - Turn {currentTurn}
          </h2>
          
          {/* Form fields */}
          <div className="space-y-4">
            {/* Map selection */}
            <div>
              <label className="block text-sm text-slate-300 mb-1">Map</label>
              <select
                value={selectedMap}
                onChange={(e) => setSelectedMap(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              >
                <option value="">Select map...</option>
                {ALL_MAPS.map(map => (
                  <option key={map} value={map}>{map}</option>
                ))}
              </select>
            </div>

            {/* Territory display */}
            {selectedTerritory && (
              <div className="bg-slate-700 rounded p-3">
                <span className="text-slate-400 text-sm">Territory: </span>
                <span className="text-white font-semibold">{selectedTerritory.name}</span>
                <span className="text-slate-400 text-sm ml-3">Current Owner: </span>
                <span className={`font-semibold ${
                  selectedTerritory.owner === 'USA' ? 'text-blue-400' :
                  selectedTerritory.owner === 'CSA' ? 'text-red-400' :
                  'text-slate-400'
                }`}>
                  {selectedTerritory.owner}
                </span>
              </div>
            )}

            {/* Attacker/Winner selection */}
            {/* Casualty inputs */}
            {/* Notes field */}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSubmit}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
            >
              Record Battle
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## 8. Core Logic Implementation

### 8.1 Campaign Logic (utils/campaignLogic.js)

```javascript
export const processBattleResult = (campaign, battle) => {
  const territory = campaign.territories.find(t => t.id === battle.territoryId);
  if (!territory) return campaign;

  // Update territory ownership
  const previousOwner = territory.owner;
  territory.owner = battle.winner;

  // Calculate VP award
  let vpAwarded = campaign.settings.victoryPointsPerBattle;
  
  // Add territory VP value
  vpAwarded += territory.victoryPoints;
  
  // Capital bonus
  if (territory.isCapital) {
    vpAwarded = Math.floor(vpAwarded * campaign.settings.capitalBonusMultiplier);
  }

  // Update battle record
  battle.victoryPointsAwarded = vpAwarded;

  // Update campaign VPs
  const updatedCampaign = { ...campaign };
  if (battle.winner === 'USA') {
    updatedCampaign.victoryPointsUSA += vpAwarded;
  } else {
    updatedCampaign.victoryPointsCSA += vpAwarded;
  }

  // Add to battle history
  updatedCampaign.battles = [...campaign.battles, battle];

  // Update territory capture history
  territory.captureHistory.push({
    turn: battle.turn,
    owner: battle.winner,
    battleId: battle.id
  });

  return updatedCampaign;
};

export const canAttackTerritory = (campaign, territoryId, attacker) => {
  const territory = campaign.territories.find(t => t.id === territoryId);
  if (!territory) return false;

  // Can't attack own territory
  if (territory.owner === attacker) return false;

  // If adjacent attack required, check adjacency
  if (campaign.settings.requireAdjacentAttack) {
    const ownedTerritories = campaign.territories
      .filter(t => t.owner === attacker)
      .map(t => t.id);
    
    // Check if any owned territory is adjacent to target
    return territory.adjacentTerritories.some(adjId => 
      ownedTerritories.includes(adjId)
    );
  }

  return true; // Can attack any territory
};
```

### 8.2 Victory Conditions (utils/victoryConditions.js)

```javascript
export const checkVictoryConditions = (campaign) => {
  const checks = [
    checkVictoryPoints,
    checkTerritorialControl,
    checkCapitalControl
  ];

  for (const check of checks) {
    const result = check(campaign);
    if (result) return result;
  }

  return null;
};

const checkVictoryPoints = (campaign) => {
  if (campaign.victoryPointsUSA >= campaign.victoryPointTarget) {
    return {
      winner: 'USA',
      type: 'Victory Points',
      description: `USA reached ${campaign.victoryPointTarget} victory points`
    };
  }
  if (campaign.victoryPointsCSA >= campaign.victoryPointTarget) {
    return {
      winner: 'CSA',
      type: 'Victory Points',
      description: `CSA reached ${campaign.victoryPointTarget} victory points`
    };
  }
  return null;
};

const checkTerritorialControl = (campaign) => {
  const usaTerritories = campaign.territories.filter(t => t.owner === 'USA');
  const csaTerritories = campaign.territories.filter(t => t.owner === 'CSA');
  const total = campaign.territories.length;

  if (usaTerritories.length / total >= 0.75) {
    return {
      winner: 'USA',
      type: 'Territorial Dominance',
      description: `USA controls ${usaTerritories.length}/${total} territories`
    };
  }
  if (csaTerritories.length / total >= 0.75) {
    return {
      winner: 'CSA',
      type: 'Territorial Dominance',
      description: `CSA controls ${csaTerritories.length}/${total} territories`
    };
  }
  return null;
};

const checkCapitalControl = (campaign) => {
  const capitals = campaign.territories.filter(t => t.isCapital);
  const usaCapitals = capitals.filter(t => t.owner === 'USA');
  const csaCapitals = capitals.filter(t => t.owner === 'CSA');

  if (usaCapitals.length === capitals.length) {
    return {
      winner: 'USA',
      type: 'Capital Control',
      description: 'USA controls all capital territories'
    };
  }
  if (csaCapitals.length === capitals.length) {
    return {
      winner: 'CSA',
      type: 'Capital Control',
      description: 'CSA controls all capital territories'
    };
  }
  return null;
};
```

---

## 9. Territory Definitions

### 9.1 Initial Territory Set

```javascript
// src/data/territories.js
export const INITIAL_TERRITORIES = [
  {
    id: 'maryland-antietam',
    name: 'Antietam (MD)',
    mapName: 'Antietam',
    owner: 'NEUTRAL',
    victoryPoints: 15,
    isCapital: false,
    coordinates: {
      type: 'polygon',
      data: 'M 200,150 L 280,150 L 280,220 L 200,220 Z'
    },
    labelPosition: { x: 240, y: 185 },
    adjacentTerritories: ['harpers-ferry', 'south-mountain', 'virginia-north']
  },
  {
    id: 'harpers-ferry',
    name: "Harper's Ferry (WV)",
    mapName: 'Harpers Ferry',
    owner: 'NEUTRAL',
    victoryPoints: 20,
    isCapital: false,
    coordinates: {
      type: 'polygon',
      data: 'M 180,220 L 220,220 L 220,270 L 180,270 Z'
    },
    labelPosition: { x: 200, y: 245 },
    adjacentTerritories: ['maryland-antietam', 'virginia-north', 'virginia-shenandoah']
  },
  {
    id: 'south-mountain',
    name: 'South Mountain (MD)',
    mapName: 'South Mountain',
    owner: 'NEUTRAL',
    victoryPoints: 10,
    isCapital: false,
    coordinates: {
      type: 'polygon',
      data: 'M 280,120 L 340,120 L 340,180 L 280,180 Z'
    },
    labelPosition: { x: 310, y: 150 },
    adjacentTerritories: ['maryland-antietam', 'pennsylvania-gettysburg']
  },
  {
    id: 'virginia-north',
    name: 'Northern Virginia',
    mapName: 'Drill Camp', // Generic battles
    owner: 'CSA',
    victoryPoints: 15,
    isCapital: false,
    coordinates: {
      type: 'polygon',
      data: 'M 180,270 L 280,270 L 280,350 L 180,350 Z'
    },
    labelPosition: { x: 230, y: 310 },
    adjacentTerritories: ['harpers-ferry', 'maryland-antietam', 'virginia-richmond']
  },
  {
    id: 'virginia-richmond',
    name: 'Richmond (VA)',
    mapName: 'Drill Camp',
    owner: 'CSA',
    victoryPoints: 30,
    isCapital: true, // CSA Capital
    coordinates: {
      type: 'polygon',
      data: 'M 200,350 L 300,350 L 300,430 L 200,430