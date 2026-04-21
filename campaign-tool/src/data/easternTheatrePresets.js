/**
 * Historical preset data for the Eastern Theatre Grand Campaign map.
 *
 * All coordinates are real lat/lon for historical sites; at load time
 * they're projected through the same bounds transform MapView uses to
 * draw the counties, so everything lines up geographically.
 *
 * Capitals (3 per side):
 *   - USA: Washington, Philadelphia, Northern Approaches
 *   - CSA: Richmond, Petersburg, Southern Approaches
 * The "Approaches" capitals sit at the map edge as immersive stand-ins
 * for the off-map capitals named in the GC rules doc (NY/Cleveland for
 * USA, Wilmington/Atlanta for CSA). They're still real capital-VP
 * targets on the board.
 *
 * Cities / forts weight toward Union simply because the historical 1861-62
 * map did — the Ohio-facing counties of (West) Virginia, the B&O corridor,
 * and central Pennsylvania were Union infrastructure. CSA strength
 * concentrates in the Shenandoah Valley and the tidewater approaches to
 * Richmond.
 *
 * Overlap rule: forts are never placed inside a city's label box. Where
 * history put a fort inside a city (Fort McHenry in Baltimore, Fort
 * Norfolk in Norfolk) we either moved it to a real nearby fortification
 * (Fort Carroll for Baltimore's outer-harbor ring) or dropped the
 * duplicate in favor of a geographically distinct one.
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
    // USA — eastern seaboard / Maryland (5)
    { name: 'Baltimore',  side: 'USA', lat: 39.2904, lon: -76.6122 },
    { name: 'Harrisburg', side: 'USA', lat: 40.2732, lon: -76.8867 },
    { name: 'Frederick',  side: 'USA', lat: 39.4143, lon: -77.4105 },
    { name: 'Lancaster',  side: 'USA', lat: 40.0379, lon: -76.3055 },
    { name: 'Pittsburgh', side: 'USA', lat: 40.4406, lon: -79.9959 },

    // USA — central Pennsylvania (2) — PRR / CVRR corridor
    { name: 'Chambersburg', side: 'USA', lat: 39.9378, lon: -77.6614 },
    { name: 'Altoona',      side: 'USA', lat: 40.5187, lon: -78.3947 },

    // USA — Union-loyal (West) Virginia (5)
    { name: 'Wheeling',     side: 'USA', lat: 40.0640, lon: -80.7209 }, // seat of Restored Gov't
    { name: 'Parkersburg',  side: 'USA', lat: 39.2667, lon: -81.5615 }, // B&O western terminus
    { name: 'Charleston',   side: 'USA', lat: 38.3498, lon: -81.6326 }, // Kanawha — Union after Jul '61
    { name: 'Clarksburg',   side: 'USA', lat: 39.2806, lon: -80.3445 }, // McClellan's '61 base
    { name: 'Grafton',      side: 'USA', lat: 39.3406, lon: -80.0192 }, // B&O junction

    // CSA — tidewater & piedmont (6)
    { name: 'Norfolk',          side: 'CSA', lat: 36.8508, lon: -76.2859 },
    { name: 'Fredericksburg',   side: 'CSA', lat: 38.3032, lon: -77.4605 },
    { name: 'Lynchburg',        side: 'CSA', lat: 37.4138, lon: -79.1422 },
    { name: 'Winchester',       side: 'CSA', lat: 39.1857, lon: -78.1633 },
    { name: 'Staunton',         side: 'CSA', lat: 38.1496, lon: -79.0717 },
    { name: 'Charlottesville',  side: 'CSA', lat: 38.0293, lon: -78.4767 }, // Piedmont factories & hospitals

    // CSA — Shenandoah Valley & western CSA holdouts (5)
    { name: 'Harrisonburg', side: 'CSA', lat: 38.4496, lon: -78.8689 },
    { name: 'Strasburg',    side: 'CSA', lat: 38.9895, lon: -78.3589 },
    { name: 'Lewisburg',    side: 'CSA', lat: 37.8015, lon: -80.4464 }, // Greenbrier Valley
    { name: 'Covington',    side: 'CSA', lat: 37.7935, lon: -79.9942 }, // V&T approach
    { name: 'Wytheville',   side: 'CSA', lat: 36.9481, lon: -81.0848 }, // SW of Lewisburg — V&T junction & lead mines

    // NEUTRAL / contested border towns (2)
    { name: 'Harpers Ferry', side: 'NEUTRAL', lat: 39.3259, lon: -77.7394 },
    { name: 'Cumberland',    side: 'NEUTRAL', lat: 39.6529, lon: -78.7625 },
    // Romney is CSA: Stonewall Jackson held it throughout early '62 — the
    // town changed hands many times but spent most of 1861-62 in CSA hands.
    { name: 'Romney',        side: 'CSA', lat: 39.3440, lon: -78.7528 },
  ],

  forts: [
    // USA (3) — Chesapeake ring, DC approaches, WV mountains
    { name: 'Fort Carroll',    side: 'USA', lat: 39.2171, lon: -76.5138 }, // outer Patapsco (replaces overlapping Fort McHenry)
    { name: 'Fort Washington', side: 'USA', lat: 38.7119, lon: -77.0274 }, // Potomac approach to DC
    { name: 'Fort Milroy',     side: 'USA', lat: 38.6050, lon: -79.8686 }, // Cheat Summit — Union WV mountain fort

    // CSA (5) — spread: Hampton Roads, James River ring, Alleghenies
    { name: 'Fort Monroe',     side: 'CSA', lat: 37.0019, lon: -76.3093 }, // Hampton Roads (historically held by USA; kept in preset for board balance)
    { name: 'Fort Boykin',     side: 'CSA', lat: 36.9670, lon: -76.6185 }, // Isle of Wight, James River mouth
    { name: 'Fort Powhatan',   side: 'CSA', lat: 37.2130, lon: -77.1400 }, // mid-James River obstruction
    { name: "Drewry's Bluff",  side: 'CSA', lat: 37.4184, lon: -77.4197 }, // Fort Darling — Richmond's river shield
    { name: 'Camp Allegheny',  side: 'CSA', lat: 38.4667, lon: -79.8667 }, // Pocahontas Co — CSA WV mountain fort
  ],

  // Stations have no side — rail hubs are neutral infrastructure.
  stations: [
    { name: 'Martinsburg',       lat: 39.4562, lon: -77.9636 },
    { name: 'Manassas Junction', lat: 38.7509, lon: -77.4753 },
    { name: 'Culpeper',          lat: 38.4729, lon: -77.9966 },
    { name: 'Gordonsville',      lat: 38.1373, lon: -78.1872 },
    { name: 'York',              lat: 39.9626, lon: -76.7277 },
    { name: 'Aquia Landing',     lat: 38.4144, lon: -77.3884 },
    { name: 'Lewistown',         lat: 40.5953, lon: -77.5714 }, // PRR mid-state
    { name: 'Salem',             lat: 37.2929, lon: -80.0548 }, // V&T approach to Christiansburg
  ],

  // Railways — each is an ordered list of lat/lon stops. Historically
  // significant 1861-65 lines; many of these existed before the war and
  // were contested throughout it.
  railways: [
    {
      // Full B&O main line: Baltimore → Wheeling via Grafton. In 1861-62 this
      // was THE strategic artery — Stonewall Jackson raided it repeatedly and
      // McClellan's western-Virginia campaign pivoted on keeping it open.
      name: 'Baltimore & Ohio',
      points: [
        { lat: 39.2904, lon: -76.6122 }, // Baltimore
        { lat: 39.4143, lon: -77.4105 }, // Frederick
        { lat: 39.3259, lon: -77.7394 }, // Harpers Ferry
        { lat: 39.4562, lon: -77.9636 }, // Martinsburg
        { lat: 39.6529, lon: -78.7625 }, // Cumberland
        { lat: 39.3406, lon: -80.0192 }, // Grafton
        { lat: 40.0640, lon: -80.7209 }, // Wheeling
      ],
    },
    {
      // B&O Parkersburg Branch — connected Grafton to the Ohio River at
      // Parkersburg; critical Union supply spur into the Kanawha Valley.
      name: 'B&O Parkersburg Branch',
      points: [
        { lat: 39.3406, lon: -80.0192 }, // Grafton
        { lat: 39.2806, lon: -80.3445 }, // Clarksburg
        { lat: 39.2667, lon: -81.5615 }, // Parkersburg
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
      // Virginia & Tennessee — the south-western CSA trunk. Ran Lynchburg
      // to Bristol historically; we truncate at Christiansburg since the
      // map's western edge stops shortly after.
      name: 'Virginia & Tennessee',
      points: [
        { lat: 37.4138, lon: -79.1422 }, // Lynchburg
        { lat: 37.7935, lon: -79.9942 }, // Covington (loop north through the AM&O junction area)
        { lat: 37.2929, lon: -80.0548 }, // Salem
        { lat: 37.1299, lon: -80.4089 }, // Christiansburg
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
    {
      // Cumberland Valley Railroad — Harrisburg's southward tendril into
      // the Shenandoah approaches. Critical for Union troop movements
      // during the Gettysburg & Chambersburg raids.
      name: 'Cumberland Valley',
      points: [
        { lat: 40.2732, lon: -76.8867 }, // Harrisburg
        { lat: 40.2015, lon: -77.2008 }, // Carlisle
        { lat: 39.9378, lon: -77.6614 }, // Chambersburg
      ],
    },
    {
      // Pennsylvania Railroad main line — Harrisburg → Altoona → Pittsburgh
      // via the Horseshoe Curve. The Union's east-west industrial artery.
      name: 'Pennsylvania Railroad',
      points: [
        { lat: 40.2732, lon: -76.8867 }, // Harrisburg
        { lat: 40.5953, lon: -77.5714 }, // Lewistown
        { lat: 40.5187, lon: -78.3947 }, // Altoona
        { lat: 40.4406, lon: -79.9959 }, // Pittsburgh
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
    {
      // Kanawha — the strategic Union-held artery through Charleston,
      // connecting the Ohio River to the New/Gauley confluence.
      name: 'Kanawha',
      points: [
        { lat: 38.8440, lon: -82.1370 }, // Point Pleasant (confluence with Ohio)
        { lat: 38.6000, lon: -81.9000 },
        { lat: 38.3498, lon: -81.6326 }, // Charleston
        { lat: 38.2400, lon: -81.3800 },
        { lat: 38.1650, lon: -81.2200 }, // Gauley Bridge (confluence with Gauley & New)
      ],
    },
    {
      // New River — flows north through southern WV into the Kanawha.
      // The V&T Railroad parallels it at the Narrows.
      name: 'New River',
      points: [
        { lat: 37.1299, lon: -80.4089 }, // Christiansburg area (tributary headwaters)
        { lat: 37.3270, lon: -80.8150 }, // Narrows
        { lat: 37.6730, lon: -80.8910 }, // Hinton
        { lat: 38.0540, lon: -81.1050 }, // Fayetteville
        { lat: 38.1650, lon: -81.2200 }, // Gauley Bridge
      ],
    },
    {
      // Monongahela — flows north out of WV into Pittsburgh, joining the
      // Allegheny to form the Ohio. Key Union coal & supply route.
      name: 'Monongahela',
      points: [
        { lat: 39.2900, lon: -80.2200 }, // Fairmont WV tributary branch
        { lat: 39.4850, lon: -80.1430 }, // Fairmont
        { lat: 39.6300, lon: -79.9560 }, // Morgantown
        { lat: 40.0500, lon: -79.8900 },
        { lat: 40.4406, lon: -79.9959 }, // Pittsburgh (confluence)
      ],
    },
  ],
};
