/**
 * Historical preset data for the Eastern Theatre Grand Campaign map.
 *
 * All coordinates are real lat/lon for historical sites; at load time
 * they're projected through the same bounds transform MapView uses to
 * draw the counties, so everything lines up geographically.
 *
 * Balance: same count per side for capitals, cities, forts.
 *
 * Capitals (3 per side):
 *   - USA: Washington, Philadelphia, Northern Approaches
 *   - CSA: Richmond, Petersburg, Southern Approaches
 * The "Approaches" capitals sit at the map edge as immersive stand-ins
 * for the off-map capitals named in the GC rules doc (NY/Cleveland for
 * USA, Wilmington/Atlanta for CSA). They're still real capital-VP
 * targets on the board.
 */

export const EASTERN_THEATRE_PRESET = {
  capitals: [
    // USA (3)
    { name: 'Washington',          side: 'USA', lat: 38.9072, lon: -77.0369 },
    { name: 'Philadelphia',        side: 'USA', lat: 39.9526, lon: -75.1652 },
    { name: 'Northern Approaches', side: 'USA', lat: 41.8000, lon: -77.0000 }, // central-northern PA
    // CSA (3)
    { name: 'Richmond',            side: 'CSA', lat: 37.5407, lon: -77.4360 },
    { name: 'Petersburg',          side: 'CSA', lat: 37.2279, lon: -77.4019 },
    { name: 'Southern Approaches', side: 'CSA', lat: 36.6000, lon: -77.5000 }, // southern VA near NC border
  ],

  cities: [
    // USA (5)
    { name: 'Baltimore',  side: 'USA', lat: 39.2904, lon: -76.6122 },
    { name: 'Harrisburg', side: 'USA', lat: 40.2732, lon: -76.8867 },
    { name: 'Frederick',  side: 'USA', lat: 39.4143, lon: -77.4105 },
    { name: 'Lancaster',  side: 'USA', lat: 40.0379, lon: -76.3055 },
    { name: 'Pittsburgh', side: 'USA', lat: 40.4406, lon: -79.9959 },
    // CSA (5)
    { name: 'Norfolk',        side: 'CSA', lat: 36.8508, lon: -76.2859 },
    { name: 'Fredericksburg', side: 'CSA', lat: 38.3032, lon: -77.4605 },
    { name: 'Lynchburg',      side: 'CSA', lat: 37.4138, lon: -79.1422 },
    { name: 'Winchester',     side: 'CSA', lat: 39.1857, lon: -78.1633 },
    { name: 'Staunton',       side: 'CSA', lat: 38.1496, lon: -79.0717 },
    // NEUTRAL (2)
    { name: 'Harpers Ferry', side: 'NEUTRAL', lat: 39.3259, lon: -77.7394 },
    { name: 'Cumberland',    side: 'NEUTRAL', lat: 39.6529, lon: -78.7625 },
  ],

  forts: [
    // USA (3)
    { name: 'Fort McHenry',    side: 'USA', lat: 39.2636, lon: -76.5800 },
    { name: 'Fort Washington', side: 'USA', lat: 38.7119, lon: -77.0274 },
    { name: 'Fort Mifflin',    side: 'USA', lat: 39.8753, lon: -75.2121 },
    // CSA (3)
    { name: 'Fort Monroe',    side: 'CSA', lat: 37.0019, lon: -76.3093 },
    { name: 'Fort Norfolk',   side: 'CSA', lat: 36.8542, lon: -76.2997 },
    { name: 'Drewry\'s Bluff', side: 'CSA', lat: 37.4184, lon: -77.4197 }, // Fort Darling
  ],

  // Stations have no side — rail hubs are neutral infrastructure.
  stations: [
    { name: 'Martinsburg',       lat: 39.4562, lon: -77.9636 },
    { name: 'Manassas Junction', lat: 38.7509, lon: -77.4753 },
    { name: 'Culpeper',          lat: 38.4729, lon: -77.9966 },
    { name: 'Gordonsville',      lat: 38.1373, lon: -78.1872 },
    { name: 'York',              lat: 39.9626, lon: -76.7277 },
    { name: 'Aquia Landing',     lat: 38.4144, lon: -77.3884 },
  ],

  // Railways — each is an ordered list of lat/lon stops. Historically
  // significant 1861-65 lines; many of these existed before the war and
  // were contested throughout it.
  railways: [
    {
      name: 'Baltimore & Ohio',
      points: [
        { lat: 39.2904, lon: -76.6122 }, // Baltimore
        { lat: 39.4143, lon: -77.4105 }, // Frederick
        { lat: 39.3259, lon: -77.7394 }, // Harpers Ferry
        { lat: 39.4562, lon: -77.9636 }, // Martinsburg
        { lat: 39.6529, lon: -78.7625 }, // Cumberland
      ],
    },
    {
      name: 'Orange & Alexandria',
      points: [
        { lat: 38.8048, lon: -77.0469 }, // Alexandria
        { lat: 38.7509, lon: -77.4753 }, // Manassas Junction
        { lat: 38.4729, lon: -77.9966 }, // Culpeper
        { lat: 38.1373, lon: -78.1872 }, // Gordonsville
      ],
    },
    {
      name: 'Virginia Central',
      points: [
        { lat: 37.5407, lon: -77.4360 }, // Richmond
        { lat: 38.1373, lon: -78.1872 }, // Gordonsville
        { lat: 38.1496, lon: -79.0717 }, // Staunton
      ],
    },
    {
      name: 'Richmond, Fredericksburg & Potomac',
      points: [
        { lat: 37.5407, lon: -77.4360 }, // Richmond
        { lat: 38.3032, lon: -77.4605 }, // Fredericksburg
        { lat: 38.4144, lon: -77.3884 }, // Aquia Landing
      ],
    },
    {
      name: 'Philadelphia–Wilmington–Baltimore',
      points: [
        { lat: 39.9526, lon: -75.1652 }, // Philadelphia
        { lat: 39.7447, lon: -75.5484 }, // Wilmington, DE (projects to edge)
        { lat: 39.2904, lon: -76.6122 }, // Baltimore
      ],
    },
    {
      name: 'Northern Central',
      points: [
        { lat: 39.2904, lon: -76.6122 }, // Baltimore
        { lat: 39.9626, lon: -76.7277 }, // York
        { lat: 40.2732, lon: -76.8867 }, // Harrisburg
      ],
    },
  ],

  // Rivers — polylines follow the historical watercourse. Point density
  // is a compromise between visual fidelity and file size.
  rivers: [
    {
      name: 'Potomac',
      points: [
        { lat: 38.0700, lon: -76.3300 }, // mouth at Point Lookout
        { lat: 38.3500, lon: -76.9700 },
        { lat: 38.6800, lon: -77.0800 }, // Mount Vernon
        { lat: 38.9072, lon: -77.0369 }, // Washington
        { lat: 39.1050, lon: -77.5500 },
        { lat: 39.3259, lon: -77.7394 }, // Harpers Ferry
        { lat: 39.4562, lon: -77.9636 }, // Martinsburg
        { lat: 39.6100, lon: -78.4300 },
        { lat: 39.6529, lon: -78.7625 }, // Cumberland
        { lat: 39.3500, lon: -79.4700 }, // approaching Fairfax Stone
      ],
    },
    {
      name: 'James',
      points: [
        { lat: 37.8000, lon: -80.2000 }, // headwaters
        { lat: 37.5500, lon: -79.6500 },
        { lat: 37.4138, lon: -79.1422 }, // Lynchburg
        { lat: 37.6000, lon: -78.5000 },
        { lat: 37.6500, lon: -78.0000 },
        { lat: 37.5407, lon: -77.4360 }, // Richmond
        { lat: 37.3400, lon: -77.0000 },
        { lat: 37.2100, lon: -76.7700 },
        { lat: 37.0600, lon: -76.4800 }, // Hampton Roads
      ],
    },
    {
      name: 'Rappahannock',
      points: [
        { lat: 38.1200, lon: -78.3200 }, // headwaters (Blue Ridge)
        { lat: 38.3032, lon: -77.4605 }, // Fredericksburg
        { lat: 37.9800, lon: -76.7400 }, // mouth
      ],
    },
    {
      name: 'Shenandoah',
      points: [
        { lat: 38.1496, lon: -79.0717 }, // Staunton area (south fork)
        { lat: 38.5000, lon: -78.6300 },
        { lat: 39.0000, lon: -78.1000 }, // near Winchester
        { lat: 39.3259, lon: -77.7394 }, // confluence with Potomac at Harpers Ferry
      ],
    },
    {
      name: 'Susquehanna',
      points: [
        { lat: 41.9000, lon: -76.4000 }, // upper PA
        { lat: 41.2500, lon: -76.9500 },
        { lat: 40.9000, lon: -76.7500 },
        { lat: 40.2732, lon: -76.8867 }, // Harrisburg
        { lat: 39.9000, lon: -76.5000 },
        { lat: 39.5500, lon: -76.0700 }, // Chesapeake Bay mouth
      ],
    },
    {
      name: 'York',
      points: [
        { lat: 37.7200, lon: -76.7500 }, // confluence
        { lat: 37.4000, lon: -76.7000 },
        { lat: 37.2500, lon: -76.5000 }, // mouth into Chesapeake
      ],
    },
  ],
};
