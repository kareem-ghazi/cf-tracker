<div align="center">
  <img src="assets/cf-tracker.svg" alt="CF Tracker Logo" width="400"/>
  
  ---
  A web application to track Codeforces progress and contest performance for competitive programming training groups.
  
  [![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://python.org)
  [![Flask](https://img.shields.io/badge/Flask-2.0+-green.svg)](https://flask.palletsprojects.com/)
  [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
</div>

## Overview

**CF Tracker** is a comprehensive web application designed to help competitive programming coaches and team leaders track participant performance across multiple Codeforces contests. Originally built for ICPC NMU training management, it provides real-time standings, progress analytics, and participant management features.

## Features

### 📊 Dashboard Analytics
- Overview statistics across all training groups
- Pass rate tracking and performance metrics
- Quick access to all groups and recent activity

### 👥 Training Group Management
- Create and organize multiple training groups
- Set default participants for bulk contest management
- Link groups to participant spreadsheets for detailed member info
- Apply default participants across all contests in a group

### 🏆 Contest Tracking
- Add contests by Codeforces contest ID (auto-fetches contest details)
- Batch add multiple contests at once
- Configure pass/fail thresholds (absolute count or percentage)
- Auto-import all participants from contest standings
- Track who passed, failed, or didn't participate

### 📋 Results & Standings
- **Results View**: Filter participants by status (passed/failed/not entered)
- **Standings View**: Rank-ordered leaderboard with top 3 highlighting
- **Progress View**: Historical charts showing pass rate trends over time
- Export participant handles for easy copying

### 📊 Group Overview
- Cross-contest comparison table
- See each participant's performance across all contests
- Toggle column visibility for Passes and Solved counts
- Filter which contests to display
- Visual indicators (✅ passed, ❌ failed, ⚪ not entered)

### 📑 Spreadsheet Integration
- Upload CSV spreadsheets with participant information
- Link spreadsheets to groups for quick participant data lookup
- View participant details directly from contest results

## Getting Started

### Prerequisites
- Python 3.8 or higher
- pip (Python package manager)

### Quick Start (Windows)

1. **Clone or download** this repository
2. **Double-click `run_app.bat`**
   - This script will automatically:
     - Create a virtual environment
     - Install all dependencies
     - Prompt for Codeforces API credentials (optional)
     - Start the application

3. **Open your browser** and navigate to `http://localhost:5000`

### Manual Installation

```bash
# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Create .env file (copy from example)
cp .env.example .env
# Edit .env with your Codeforces API credentials

# Run the application
python app.py
```

### Configuration

Create a `.env` file based on `.env.example`:

```env
# Codeforces API credentials (optional but recommended for better rate limits)
CF_API_KEY=your_api_key_here
CF_API_SECRET=your_api_secret_here

# Flask configuration
FLASK_SECRET_KEY=your-secret-key-change-in-production
```

You can obtain Codeforces API credentials at: https://codeforces.com/settings/api

## Usage Guide

### Creating a Training Group
1. Navigate to **Groups** page
2. Click **New Group**
3. Enter a name and optional description
4. Optionally set default participants and link a spreadsheet

### Adding Contests
1. Open a group and click **Add Contest**
2. Enter the Codeforces contest ID (found in the contest URL)
3. Set pass requirements (problem count or percentage)
4. Leave participants empty to auto-import from standings

### Tracking Results
1. Click **View** on any contest
2. Click **Refresh Results** to fetch latest data from Codeforces
3. Use the filter dropdown to view specific participant groups
4. Switch to **Standings** for ranked view or **Progress** for historical trends

### Group Overview
1. Open a group and click the **Overview** tab
2. See all participants' performance across all contests
3. Use filters to show/hide specific contests or columns

## Technology Stack

- **Backend**: Python, Flask, SQLAlchemy
- **Database**: SQLite
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Charts**: Chart.js
- **API**: Codeforces API

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
