# War of Rights Season Tracker

A React-based web application for tracking regiment performance across a War of Rights competitive season. Built with the same design patterns as the Log Analyzer.

## Features

- **Week Management**: Create and manage weekly matches
- **Unit/Regiment Tracking**: Add and organize participating units
- **Team Rosters**: Assign units to teams for each week
- **Point System**: Configurable point system for wins, losses, and bonuses
- **Standings**: Real-time standings based on performance
- **Data Persistence**: Automatic saving to browser localStorage
- **Import/Export**: Save and load season data as JSON files

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Navigate to the season-tracker directory:
```bash
cd season-tracker
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

1. **Add Units**: Enter regiment names in the Units section
2. **Create Weeks**: Add weeks for your season schedule
3. **Assign Teams**: Select a week and assign units to Team A or Team B
4. **Set Leaders**: Choose lead units for each team
5. **Record Results**: Select round winners (Round 1 and Round 2)
6. **View Standings**: Check the real-time standings based on points

### Point System

Configure the point system in Settings:
- **Win Lead Points**: Points for leading unit on winning team
- **Win Assist Points**: Points for non-lead units on winning team
- **Loss Lead Points**: Points for leading unit on losing team
- **Loss Assist Points**: Points for non-lead units on losing team
- **2-0 Bonus Lead**: Bonus points for lead unit on 2-0 sweep
- **2-0 Bonus Assist**: Bonus points for assist units on 2-0 sweep

### Data Management

- **Export**: Download your season data as a JSON file
- **Import**: Load previously saved season data
- **Auto-Save**: Data automatically saves to browser localStorage

## Design Philosophy

This application follows the KISS (Keep It Simple, Stupid), DRY (Don't Repeat Yourself), SOLID, and YAGNI (You Aren't Gonna Need It) principles, matching the design patterns used in the Log Analyzer component.

## Technology Stack

- **React 19**: UI framework
- **Vite**: Build tool and dev server
- **Tailwind CSS 4**: Styling
- **Lucide React**: Icons
- **localStorage**: Data persistence

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## License

This project is part of the War of Rights Event Tracker suite.