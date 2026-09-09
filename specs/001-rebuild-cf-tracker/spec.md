# Feature Specification: CF Tracker Rebuild

**Feature Branch**: `001-rebuild-cf-tracker`

**Created**: 2026-09-09

**Status**: Draft

**Input**: User description: "Create a feature specification for rebuilding CF Tracker by analyzing the current repository: Source Inspection (models/, app.py, api/, templates/, static/), Functional Requirements (Dashboard & Analytics, Group & Spreadsheet Management, Contest Tracking & Criteria, Overview Matrix Table)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Group Overview Matrix & Performance Tracking (Priority: P1)

As a competitive programming coach or team leader, I want a comprehensive overview matrix that displays all participants across all contests in a training group, so that I can monitor student consistency, identify top performers, filter specific contests, view attendance and points, and access participant contact details directly.

**Why this priority**: The overview matrix is the primary tool used by coaches to make cohort progression decisions. It aggregates all contest results, attendance sheets, and scoring formulas into a single operational interface.

**Independent Test**: Can be fully tested by creating a training group with contests and participants, loading the overview matrix, and verifying that sticky handle columns, visual pass/fail/not-participated statuses, points calculations, column toggles, and participant drawer details function interactively.

**Acceptance Scenarios**:

1. **Given** a training group with multiple contests and standings data, **When** the coach opens the Overview tab, **Then** all participants are listed in rank order with sticky handle columns, showing total passes, total solved problems, attendance score, total points calculated as `(Passes * 5) + (Solved * 1) + (Attendance * 1)`, and individual contest status cells (✅ Passed with count, ❌ Failed with count, ⚪ Not Entered).
2. **Given** an overview matrix, **When** the coach clicks contest filter chips to select/deselect specific contests, **Then** the table immediately recalculates and displays participant passes, solved totals, and points restricted only to the selected contests.
3. **Given** an overview matrix, **When** the coach toggles column visibility options (Passes, Solved, Attendance, Points), **Then** the table dynamically shows or hides those summary columns while preserving table alignment and sticky handle positioning.
4. **Given** a participant row linked to an uploaded participant spreadsheet, **When** the coach clicks the spreadsheet details icon (`📋`), **Then** a modal drawer opens displaying all spreadsheet metadata (name, university, phone, etc.) along with a direct link to their Codeforces profile.
5. **Given** a participant row with an associated phone number, **When** the coach clicks on the participant's handle, **Then** the system opens a direct WhatsApp chat window formatted with the Egypt international country code (`+20`), or falls back to their Codeforces profile if no phone is linked.

---

### User Story 2 - Contest Management & Results Tracking (Priority: P2)

As a coach, I want to add Codeforces contests to a training group, configure passing criteria (by minimum solved problems or percentage of contest problems), and synchronize standings, so that I can automatically evaluate which participants passed or failed.

**Why this priority**: Contest tracking is the engine that generates performance data for groups and standings. Without contest ingestion and pass thresholding, no metrics exist.

**Independent Test**: Can be fully tested by adding a contest by Codeforces ID, configuring a pass threshold (e.g., 3 problems or 50%), triggering a results refresh, and verifying that participants are correctly categorized into Passed, Failed, and Not Entered in Results and Standings views.

**Acceptance Scenarios**:

1. **Given** a training group, **When** the coach enters a Codeforces contest ID and configures passing criteria (absolute problem count or percentage threshold), **Then** the system fetches contest metadata (name, total problems, start time) and registers the contest in the group.
2. **Given** a registered contest with "Lock Participants" unchecked, **When** results are refreshed from Codeforces, **Then** all participants who entered the contest on Codeforces are automatically merged into the contest roster, and pass/fail statuses are evaluated against the required solved threshold.
3. **Given** a registered contest with "Lock Participants" checked, **When** results are refreshed, **Then** standings are computed only for existing registered participants, ignoring unlisted competitors.
4. **Given** refreshed contest results, **When** the coach opens the Results view, **Then** they can filter by status (All, Passed Only, Did Not Pass, Participated Only, Not Entered) and click export buttons to copy filtered handle lists directly to the clipboard.
5. **Given** refreshed contest results, **When** the coach opens the Standings view, **Then** contestants are displayed ordered by official contest rank, with top 3 ranks highlighted (gold, silver, bronze).
6. **Given** a contest refreshed across multiple distinct dates, **When** the coach opens the Progress view, **Then** historical pass rate trends are displayed as a chronological timeline chart based on daily snapshots.

---

### User Story 3 - Training Group & Spreadsheet Roster Management (Priority: P3)

As a training coordinator, I want to create training groups, define default participant rosters, and upload CSV spreadsheets for participant metadata and attendance, so that I can organize student cohorts and correlate platform handles with real-world identities.

**Why this priority**: Provides the organizational grouping and roster synchronization layer needed to manage large training programs across multiple university cohorts.

**Independent Test**: Can be fully tested by creating a new group, adding default handles, uploading a CSV spreadsheet with custom handle/phone columns, linking it to the group, and applying default handles to contests.

**Acceptance Scenarios**:

1. **Given** a training coordinator, **When** they create a new group with a name and description, **Then** the group is established and accessible from the groups list.
2. **Given** a group with default participants configured, **When** the coordinator clicks "Apply Participants to All Contests", **Then** the system replaces the participant roster across all contests in that group with the default list after confirmation.
3. **Given** a CSV file containing participant records or attendance records, **When** the coordinator uploads the file and selects the handle and phone column headers, **Then** the spreadsheet is saved as either a "Participants" or "Attendance" dataset and can be linked to groups.
4. **Given** a group linked to multiple attendance spreadsheets, **When** attendance is evaluated, **Then** each participant's attendance score reflects the count of attendance sheets in which their handle appears.

---

### User Story 4 - High-Level Dashboard & Analytics (Priority: P4)

As a program director or coach, I want an analytics dashboard summarizing total groups, active contests, total unique participants, and overall pass rates, so that I can quickly assess the overall engagement and success rate of the training program.

**Why this priority**: Delivers executive-level visibility and fast navigation across multiple training groups from a single entry point.

**Independent Test**: Can be fully tested by navigating to the dashboard route and verifying that summary metric cards and the group breakdown table accurately aggregate data across all groups.

**Acceptance Scenarios**:

1. **Given** existing training groups and contest results in the system, **When** the user navigates to the dashboard, **Then** summary cards display Total Training Groups, Tracked Contests, Total Distinct Participants, and Overall Pass Rate.
2. **Given** the dashboard groups table, **When** reviewing group entries, **Then** each group displays its contest count, participant count, and pass rate badge, along with a direct navigation link to the group.

---

### Edge Cases

- **Handle Case Variations**: Codeforces handles entered with varying capitalization across spreadsheets, contest results, and user inputs (e.g., `tourist`, `Tourist`, `TOURIST`) MUST be matched case-insensitively without creating duplicate records or failing lookups.
- **Percentage Threshold Rounding**: When a contest has an odd number of problems (e.g., 5 problems) and a percentage threshold is set (e.g., 50%), the required solved threshold MUST calculate using standard rounding (`max(1, int(total_problems * percent / 100))`) to prevent fractional requirements.
- **Contests with Zero Problems / Unrated Gyms**: If a Codeforces contest has 0 problems reported or unpublished problems, the system MUST default required problems to 1 and prevent division-by-zero errors.
- **Codeforces API Outages & Rate Limits**: When Codeforces API requests fail due to network timeouts, HTTP 429 rate limits, or server errors, the system MUST retain existing cached results and report user-friendly error notifications without corrupting contest state.
- **Participants Not in Linked Spreadsheet**: When viewing the overview matrix or results for a participant whose handle does not exist in the linked spreadsheet, the row MUST render normally with the spreadsheet details button omitted or disabled.
- **Phone Number Format Normalization**: Egyptian phone numbers provided in various formats (`010...`, `+2010...`, `002010...`, or spaces/dashes) MUST be normalized to standard international format (`20...`) when generating WhatsApp links.
- **Large Dataset Virtualization**: For training groups containing 300+ participants and 40+ contests, rendering MUST not cause browser UI freeze, scrolling stutter, or memory exhaustion.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow coaches to create, read, update, and delete Training Groups with a unique name, optional description, and default participant handles.
- **FR-002**: System MUST allow coaches to upload CSV files categorized as either "Participants" (student directory) or "Attendance" (session attendance rosters).
- **FR-003**: System MUST allow users to designate specific CSV columns as the Codeforces Handle column and WhatsApp Phone Number column during or after spreadsheet upload.
- **FR-004**: System MUST allow linking exactly one Participant metadata spreadsheet and multiple Attendance spreadsheets to a Training Group.
- **FR-005**: System MUST enforce case-insensitive matching for all Codeforces handles across default participant lists, spreadsheet rows, contest rosters, and cached results.
- **FR-006**: System MUST allow adding contests to a group by Codeforces contest ID, retrieving contest name, total problems, and start date.
- **FR-007**: System MUST allow batch adding multiple contests to a group simultaneously by providing a list of Codeforces contest IDs.
- **FR-008**: System MUST support defining contest passing criteria either as an absolute number of solved problems or as a percentage of total contest problems.
- **FR-009**: System MUST support an optional "Lock Participants" setting per contest to prevent automated addition of unlisted handles during standings refreshes.
- **FR-010**: System MUST classify each participant's contest outcome into one of three distinct statuses:
  - **Passed**: Participant entered the contest and solved at least the required problem threshold.
  - **Failed (Did Not Pass)**: Participant entered the contest and solved fewer problems than the required threshold.
  - **Not Entered**: Participant did not participate or submit in the contest.
- **FR-011**: System MUST capture daily snapshots of contest outcomes (`FetchHistory` with passed, failed, not entered, and total counts) upon each standings refresh.
- **FR-012**: System MUST provide a Contest Results view with real-time status filtering (All, Passed, Failed, Participated, Not Entered) and one-click clipboard export for filtered handles.
- **FR-013**: System MUST provide a Contest Standings view showing participants ordered by official contest rank, highlighting top 3 ranks (gold, silver, bronze).
- **FR-014**: System MUST provide a Contest Progress view rendering a chronological historical chart of pass rate and participation trends over time.
- **FR-015**: System MUST provide a Group Overview matrix view displaying participants as rows and contests as columns, with sticky handle columns.
- **FR-016**: System MUST calculate aggregate performance metrics in the overview matrix: Total Passes, Total Problems Solved, Total Attendance Sheets attended, and Total Points calculated as:
  $$\text{Points} = (\text{Passes} \times 5) + (\text{Solved} \times 1) + (\text{Attendance} \times 1)$$
- **FR-017**: System MUST allow coaches to filter visible contests in the overview matrix via interactive chips (All, None, individual toggle) and recompute totals dynamically.
- **FR-018**: System MUST allow coaches to toggle visibility of summary columns (Passes, Solved, Attendance, Points) in the overview matrix.
- **FR-019**: System MUST allow coaches to inspect full participant metadata from linked spreadsheets via a dedicated details popup/drawer.
- **FR-020**: System MUST generate direct WhatsApp chat links for participants with valid Egyptian phone numbers (`20...`), falling back to Codeforces profile links.
- **FR-021**: System MUST provide an Analytics Dashboard displaying overall metrics (Total Groups, Tracked Contests, Unique Participants, Overall Pass Rate) and individual group summary statistics.
- **FR-022**: System MUST provide a Codeforces contest search tool allowing coaches to search and inspect finished Codeforces contests.

### Key Entities

- **Training Group**: Represents a cohort or training track. Key attributes include name, description, default participants list, linked participant spreadsheet reference, linked attendance spreadsheets references, and creation timestamp.
- **Contest**: Represents a Codeforces contest tracked in a group. Key attributes include group reference, Codeforces contest ID, contest name, start date, total problems count, pass threshold value, percentage threshold flag, participant roster, lock participants flag, and last refreshed timestamp.
- **Cached Result**: Represents a participant's evaluated outcome in a contest. Key attributes include contest reference, normalized handle, solved problems count, pass/fail status, participation status, official contest rank, and cache timestamp.
- **Fetch History**: Represents a daily historical record of contest performance. Key attributes include contest reference, snapshot date, passed count, failed count, not entered count, and total count.
- **Spreadsheet**: Represents an uploaded CSV dataset. Key attributes include name, original filename, spreadsheet type (participants vs attendance), handle column mapping, phone column mapping, raw column and row data, and creation timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Overview matrix tables supporting 300+ participants and 40+ contests render and respond to column/contest toggles within 200 milliseconds without browser stutter.
- **SC-002**: Coaches can add a contest, configure pass criteria, and review categorized standings in under 15 seconds.
- **SC-003**: 100% of participant handle lookups between uploaded spreadsheets, contest rosters, and Codeforces standings succeed regardless of character casing differences.
- **SC-004**: Coaches can copy filtered participant handle lists (e.g., all passed students) to the system clipboard in a single click.
- **SC-005**: 100% of attendance calculations and points formulas match legacy scoring rules: `(Passes * 5) + (Solved * 1) + (Attendance * 1)`.
- **SC-006**: Coaches can inspect student contact information and initiate WhatsApp communication in under 5 seconds from the overview matrix.
- **SC-007**: Dashboard analytics and group summary statistics load and display in under 500 milliseconds.

## Assumptions

- Coaches and administrators access the application using standard modern web browsers on desktop or laptop devices.
- Codeforces API is accessible and returns standard API response formats for public contests and standings.
- Uploaded roster and attendance spreadsheets are provided in CSV format with UTF-8 encoding.
- Egyptian phone numbers follow standard Egyptian telecommunication numbering conventions (10 or 11 digits) and are converted to standard WhatsApp international format (`20...`).
- Historical contest results are immutable once a contest has finished, except when coaches explicitly trigger a manual refresh.
