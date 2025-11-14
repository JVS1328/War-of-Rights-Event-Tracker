# Map Selection & Cooldown System - Test Scenarios

## Implementation Summary

### Features Implemented:
1. **Map Filtering by Territory**: Maps shown in BattleRecorder are filtered based on:
   - If territory has assigned maps → show only those maps
   - If territory has NO assigned maps → show ALL maps

2. **Map Cooldown System**: Once a map is played in a territory:
   - Turn X: Map is played
   - Turns X+1, X+2: Map is on cooldown (unavailable)
   - Turn X+3 onwards: Map is available again

3. **UI Enhancements**:
   - Dropdown shows number of available maps
   - Cooldown panel shows maps on cooldown with turn info
   - Info text explains if showing assigned maps or all maps

## Test Scenarios

### Scenario 1: Territory with Specific Maps
**Setup:**
- Territory: "Antietam (MD)"
- Assigned Maps: ["East Woods", "Miller's Cornfield", "Nicodemus Hill"]
- Current Turn: 1

**Test Steps:**
1. Open Battle Recorder
2. Select "Antietam (MD)" territory
3. **Expected**: Dropdown shows "Select map... (3 available)" and only the 3 assigned maps
4. Select and play "East Woods"
5. Record battle
6. Advance to Turn 2
7. Open Battle Recorder, select same territory
8. **Expected**: Dropdown shows "Select map... (2 available)", cooldown panel shows "East Woods (Turn 1, available in 2 turns)"
9. Advance to Turn 3
10. **Expected**: Dropdown still shows 2 available maps, cooldown shows "available in 1 turn"
11. Advance to Turn 4
12. **Expected**: Dropdown shows "Select map... (3 available)", no cooldown panel (or empty)

### Scenario 2: Territory with No Assigned Maps
**Setup:**
- Territory: "New Custom Territory"
- Assigned Maps: [] (none)
- Current Turn: 1

**Test Steps:**
1. Open Battle Recorder
2. Select custom territory
3. **Expected**: Dropdown shows "Select map... (50+ available)" with ALL_MAPS
4. Info text says "No specific maps assigned - showing all available maps"
5. Select and play any map
6. Record battle
7. Advance turn
8. **Expected**: That one map is on cooldown, rest of ALL_MAPS are available

### Scenario 3: Multiple Maps on Cooldown
**Setup:**
- Territory with 5 assigned maps
- Current Turn: 1

**Test Steps:**
1. Turn 1: Play "Map A" → Record battle
2. Turn 2: Play "Map B" → Record battle
3. Turn 3:
   - **Expected**: "Map A" and "Map B" both on cooldown
   - Available maps: 3
   - Cooldown panel shows both maps with different turn numbers
4. Turn 4:
   - **Expected**: "Map A" available (3 turns since play)
   - "Map B" still on cooldown (2 turns since play)
   - Available maps: 4
5. Turn 5:
   - **Expected**: Both maps available
   - Available maps: 5

### Scenario 4: Map Dropdown Disabled Without Territory
**Test Steps:**
1. Open Battle Recorder
2. **Expected**: Map dropdown is disabled with text "Select a territory first..."
3. Select a territory
4. **Expected**: Map dropdown becomes enabled and shows available maps

### Scenario 5: Same Map Played in Different Territories
**Setup:**
- Territory A and Territory B both have "East Woods" in their map lists
- Current Turn: 1

**Test Steps:**
1. Turn 1: Play "East Woods" in Territory A
2. Open Battle Recorder, select Territory B
3. **Expected**: "East Woods" is AVAILABLE for Territory B (cooldown is per-territory)
4. Play "East Woods" in Territory B
5. Turn 2:
   - Territory A: "East Woods" on cooldown
   - Territory B: "East Woods" on cooldown
6. Turn 4:
   - Both territories: "East Woods" available again

## Edge Cases Handled

1. **Territory with no battles**: All assigned maps (or all maps) are available
2. **Territory.maps is undefined**: Defaults to showing ALL_MAPS
3. **Territory.maps is empty array**: Defaults to showing ALL_MAPS
4. **Multiple battles on same map in same territory**: Uses most recent turn for cooldown calculation
5. **Map selection cleared when territory changes**: Selected map is reset when switching territories

## Files Modified

1. `/campaign-tool/src/utils/mapSelection.js` (NEW)
   - `getAvailableMapsForTerritory()` - Core logic for filtering maps
   - `getMapCooldownMessage()` - UI helper for cooldown display

2. `/campaign-tool/src/components/BattleRecorder.jsx`
   - Added map filtering state and useEffect
   - Updated map dropdown to show only available maps
   - Added cooldown panel UI
   - Moved territory selection above map selection for better UX
   - Added disabled state for map dropdown when no territory selected

## Code Quality

- **DRY**: Cooldown logic centralized in utility function, reused across components
- **KISS**: Simple boolean filtering, straightforward turn counting
- **SOLID**:
  - Single Responsibility: mapSelection.js handles only map filtering logic
  - Open/Closed: Easy to extend with new filtering rules
  - Dependency Inversion: BattleRecorder depends on abstract map filtering function
