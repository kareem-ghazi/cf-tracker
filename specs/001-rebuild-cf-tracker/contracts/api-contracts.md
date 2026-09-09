# API Contracts: CF Tracker REST API (v1)

**Base URL**: `/api/v1`  
**Protocol**: REST / JSON over HTTP/HTTPS  
**Date**: 2026-09-09

All endpoints return JSON. Error responses follow the standard format:
```json
{
  "detail": "Descriptive error message"
}
```

---

## 1. Analytics & Dashboard

### `GET /api/v1/analytics`
Retrieve aggregate program metrics and group summary cards for the main dashboard.

**Response `200 OK`**:
```json
{
  "summary": {
    "total_groups": 4,
    "total_contests": 18,
    "total_participants": 142,
    "total_results": 520,
    "overall_pass_rate": 64.2
  },
  "groups": [
    {
      "id": 1,
      "name": "Level 1 - Fall 2024",
      "contest_count": 8,
      "participant_count": 45,
      "pass_rate": 71.4
    }
  ]
}
```

---

## 2. Training Groups

### `GET /api/v1/groups`
List all training groups ordered by creation date descending.

**Response `200 OK`**:
```json
[
  {
    "id": 1,
    "name": "Level 1 - Fall 2024",
    "description": "Beginner training track",
    "default_participants": ["tourist", "Petr", "Radewoosh"],
    "spreadsheet_id": 2,
    "spreadsheet": {
      "id": 2,
      "name": "Level 1 Students",
      "filename": "l1_roster.csv",
      "spreadsheet_type": "participants",
      "handle_column": "Codeforces Handle",
      "phone_column": "WhatsApp Number",
      "row_count": 45
    },
    "attendance_spreadsheets": [
      {
        "id": 5,
        "name": "Session 1 Attendance",
        "spreadsheet_type": "attendance"
      }
    ],
    "created_at": "2026-09-09T12:00:00Z",
    "contest_count": 8
  }
]
```

### `POST /api/v1/groups`
Create a new training group.

**Request Body**:
```json
{
  "name": "Level 2 - Advanced",
  "description": "Graph theory and DP track",
  "default_participants": ["tourist", "ecnerwala"],
  "spreadsheet_id": null
}
```
**Response `201 Created`**: Returns created Group object.

### `GET /api/v1/groups/{id}`
Retrieve a single group by ID.

### `PUT /api/v1/groups/{id}`
Update group details, linked spreadsheets, and default participants.

**Request Body**:
```json
{
  "name": "Level 2 - Advanced (Updated)",
  "description": "Updated description",
  "default_participants": ["tourist", "Benq"],
  "spreadsheet_id": 3,
  "attendance_spreadsheet_ids": [5, 6]
}
```

### `DELETE /api/v1/groups/{id}`
Delete a group and cascade delete all its contests and results.

### `POST /api/v1/groups/{id}/apply-participants`
Apply the group's default participant list across all contests in the group.

**Response `200 OK`**:
```json
{
  "success": true,
  "contests_updated": 8,
  "participant_count": 45
}
```

### `GET /api/v1/groups/{id}/overview`
Retrieve full matrix table data across all contests in the group.

**Response `200 OK`**:
```json
{
  "group": { "id": 1, "name": "Level 1" },
  "contests": [
    {
      "id": 10,
      "cf_contest_id": 1980,
      "name": "Codeforces Round 950 (Div. 3)",
      "total_problems": 7,
      "min_solved": 3,
      "min_solved_is_percent": false,
      "required_solved": 3
    }
  ],
  "participants": [
    {
      "handle": "tourist",
      "results": {
        "10": {
          "solved_count": 6,
          "passed": true,
          "participated": true,
          "rank": 1
        }
      },
      "in_spreadsheet": true,
      "attendance": 3,
      "total_attendance_sheets": 3,
      "total_passes": 1,
      "total_solved": 6,
      "points": 14
    }
  ],
  "total_attendance_sheets": 3
}
```

---

## 3. Contests

### `POST /api/v1/contests`
Add a single contest or batch add contests to a group.

**Request Body (Single)**:
```json
{
  "group_id": 1,
  "cf_contest_id": 1980,
  "name": "Codeforces Round 950 (Div. 3)",
  "min_solved": 3,
  "min_solved_is_percent": false,
  "participants": ["tourist", "Petr"],
  "lock_participants": false
}
```

**Request Body (Batch)**:
```json
{
  "group_id": 1,
  "contest_ids": [1980, 1981, 1982],
  "min_solved": 50,
  "min_solved_is_percent": true
}
```

### `POST /api/v1/contests/{id}/refresh`
Trigger asynchronous refresh of contest standings from Codeforces.

**Response `202 Accepted`**:
```json
{
  "status": "QUEUED",
  "task_id": "c62b9a71-8842-4dc9-9831-c4beec2b1234",
  "message": "Contest refresh job submitted to worker queue"
}
```

### `GET /api/v1/contests/{id}/results?status={filter}`
Retrieve contest results filtered by status (`all`, `passed`, `failed`, `participated`, `not_participated`).

**Response `200 OK`**:
```json
{
  "contest_id": 10,
  "total": 45,
  "passed": 32,
  "failed": 8,
  "not_participated": 5,
  "results": [
    {
      "id": 101,
      "handle": "tourist",
      "solved_count": 6,
      "passed": true,
      "participated": true,
      "rank": 1
    }
  ]
}
```

### `GET /api/v1/contests/{id}/standings`
Retrieve contest leaderboard ordered by official contest rank.

### `GET /api/v1/contests/{id}/progress`
Retrieve chronological pass rate history snapshots (`fetch_history`).

---

## 4. Spreadsheets

### `GET /api/v1/spreadsheets?type={participants|attendance}`
List uploaded spreadsheets.

### `POST /api/v1/spreadsheets/upload`
Upload a CSV spreadsheet (Multipart form data).

**Form Parameters**:
- `file`: CSV file binary
- `name`: string
- `spreadsheet_type`: `'participants'` or `'attendance'`
- `handle_column`: string (default `'Codeforces Handle'`)
- `phone_column`: string (default `'WhatsApp Number'`)

### `GET /api/v1/spreadsheets/{id}/participant/{handle}`
Lookup participant record by case-insensitive handle.

**Response `200 OK`**:
```json
{
  "Full Name": "Ahmed Mostafa",
  "University": "NMU",
  "Codeforces Handle": "tourist_egypt",
  "WhatsApp Number": "01012345678"
}
```

---

## 5. Background Tasks

### `GET /api/v1/tasks/{task_id}`
Check status of an asynchronous background job (e.g., contest standings refresh).

**Response `200 OK`**:
```json
{
  "task_id": "c62b9a71-8842-4dc9-9831-c4beec2b1234",
  "status": "SUCCESS",
  "progress": 100,
  "result": {
    "contest_id": 10,
    "participants_processed": 45,
    "passed_count": 32,
    "failed_count": 8
  },
  "error": null
}
```
Possible statuses: `PENDING`, `STARTED`, `PROGRESS`, `SUCCESS`, `FAILURE`, `RETRY`.

---

## 6. Codeforces Utilities

### `GET /api/v1/codeforces/search?q={query}`
Search Codeforces finished contests for auto-completion.
