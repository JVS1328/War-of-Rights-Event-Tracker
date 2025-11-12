# War of Rights Campaign Tracker

A React-based campaign tracking tool for War of Rights that adapts the RS2: Vietnam territory control system. Track territory ownership, record battles, and manage turn-based campaign progression with an interactive USA map.

## Features

- **Interactive Map Visualization**: Display USA territories with clear boundaries and ownership
- **Territory Management**: Track ownership (USA vs CSA) for each territory
- **Campaign State**: Manage campaign start date, current turn, and victory points
- **Battle Recording**: Log battles with map, winner, and casualty data
- **Campaign Progression**: Turn-based system where battles determine territory control
- **Data Persistence**: Automatic saving to browser localStorage
- **Import/Export**: Save and load campaign data as JSON files

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Navigate to the campaign-tool directory:
```bash
cd campaign-tool
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to the URL shown (typically http://localhost:5173)

## Usage

### Basic Workflow

1. **Create Campaign**: Start a new campaign with custom settings
2. **Record Battles**: Select a map, record the winner and casualties
3. **Track Territory**: Territories change ownership based on battle results
4. **Monitor Victory Points**: Track VP accumulation for both sides
5. **Advance Turns**: Progress through the campaign turn by turn
6. **Export/Import**: Save campaign progress for later

### Victory Conditions

- **Victory Points**: First side to reach the VP target wins
- **Territorial Dominance**: Control 75% of all territories
- **Capital Control**: Capture all capital territories

### Campaign Settings

Configure your campaign with:
- **Victory Point Target**: Points needed to win (default: 100)
- **VP Per Territory**: Points awarded for territory capture
- **VP Per Battle**: Points awarded for battle victory
- **Capital Bonus Multiplier**: VP multiplier for capital territories
- **Adjacent Attack Requirement**: Restrict attacks to adjacent territories
- **Casualty Tracking**: Enable/disable casualty recording

## Design Philosophy

This application follows the KISS (Keep It Simple, Stupid), DRY (Don't Repeat Yourself), SOLID, and YAGNI (You Aren't Gonna Need It) principles, matching the design patterns used in the Log Analyzer and Season Tracker tools.

## Technology Stack

- **React 19**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS 4**: Styling with dark theme (slate-900/800 background, amber-400 accents)
- **Lucide React**: Icons
- **localStorage**: Data persistence

## Project Structure

```
campaign-tool/
├── public/              # Static assets
├── src/
│   ├── components/      # React components (to be implemented)
│   ├── data/           # Territory definitions and mappings (to be implemented)
│   ├── hooks/          # Custom React hooks (to be implemented)
│   ├── utils/          # Helper functions and logic (to be implemented)
│   ├── App.jsx         # App wrapper
│   ├── CampaignTracker.jsx  # Main component
│   ├── main.jsx        # Entry point
│   └── index.css       # Global styles
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Development Status

This is the initial project scaffold. The following features are planned for implementation:

- [ ] Interactive SVG map with state boundaries
- [ ] Territory data models and definitions
- [ ] Battle recording system
- [ ] Campaign state management
- [ ] Victory condition checking
- [ ] Turn advancement logic
- [ ] Data export/import functionality
- [ ] Settings configuration
- [ ] Battle history display

See [`TECHNICAL_SPECIFICATION.md`](TECHNICAL_SPECIFICATION.md) for detailed implementation plans.

## License

This project is part of the War of Rights Event Tracker suite.