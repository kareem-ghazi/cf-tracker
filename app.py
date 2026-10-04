"""Main Flask application for Codeforces Tracker."""
import csv
import io
import json
import re
import unicodedata
from datetime import datetime, timezone, date
from flask import Flask, render_template, request, jsonify, Response
from config import Config
from models.database import db, init_db, Group, Contest, CachedResult, FetchHistory, Spreadsheet
from api.codeforces import cf_api

app = Flask(__name__)
app.config.from_object(Config)

# Initialize database
init_db(app)


# ============================================================================
# Page Routes
# ============================================================================

@app.route('/')
def dashboard():
    """Render the analytics dashboard."""
    return render_template('dashboard.html')


@app.route('/groups')
def groups_page():
    """Render the groups management page."""
    return render_template('groups.html')


@app.route('/contest/<int:contest_id>')
def contest_page(contest_id):
    """Render the contest tracking page."""
    contest = Contest.query.get_or_404(contest_id)
    return render_template('contest.html', contest=contest)


@app.route('/spreadsheets')
def spreadsheets_page():
    """Render the spreadsheets management page."""
    return render_template('spreadsheets.html')


# ============================================================================
# API Routes - Groups
# ============================================================================

def normalize_identity_value(value):
    """Normalize names, handles, and other identity values for CSV matching."""
    value = unicodedata.normalize('NFKC', str(value or '')).strip().casefold()
    return re.sub(r'\s+', ' ', re.sub(r'[^\w]+', ' ', value, flags=re.UNICODE)).strip()


def get_group_attendance_lookup(group):
    """Map participant handles to attendance sheets using any shared identity field."""
    identity_to_handles = {}
    if group.spreadsheet:
        participant_data = group.spreadsheet.get_data()
        handle_column = group.spreadsheet.handle_column
        for row in participant_data.get('rows', []):
            handle = normalize_identity_value(row.get(handle_column, ''))
            if not handle:
                continue
            for value in row.values():
                identity = normalize_identity_value(value)
                if identity:
                    identity_to_handles.setdefault(identity, set()).add(handle)

    attendance_lookup = {}
    for sheet in group.attendance_spreadsheets:
        sheet_data = sheet.get_data()
        seen_in_sheet = set()
        for row in sheet_data.get('rows', []):
            matched_handles = set()
            for value in row.values():
                identity = normalize_identity_value(value)
                if identity in identity_to_handles:
                    matched_handles.update(identity_to_handles[identity])
            if len(matched_handles) == 1:
                seen_in_sheet.update(matched_handles)
        for handle in seen_in_sheet:
            attendance_lookup[handle] = attendance_lookup.get(handle, 0) + 1
    return attendance_lookup


def compute_contest_scores(contest_type, participants_data, total_problems):
    """Calculate scores according to scoring.ipynb.
    
    participants_data: list of dicts with:
      - handle
      - solved_count
      - first_solves
      - participated (bool)
      - rank (int, 0 if unranked)
    
    Returns:
      dict mapping handle.lower() -> points (float)
    """
    scores = {}
    ctype = (contest_type or 'contest').lower()
    
    if ctype == 'sheet':
        for p in participants_data:
            if not p.get('participated') or total_problems <= 0:
                scores[p['handle'].lower()] = 0.0
                continue
            ratio = p.get('solved_count', 0) / total_problems
            if 0.5 <= ratio < 0.75:
                scores[p['handle'].lower()] = 150.0
            elif 0.75 <= ratio < 1.0:
                scores[p['handle'].lower()] = 300.0
            elif ratio >= 1.0:
                scores[p['handle'].lower()] = 400.0
            else:
                scores[p['handle'].lower()] = 0.0
        return scores

    # contest or offline_contest
    mult_solved = 70.0 if ctype == 'offline_contest' else 50.0
    mult_fastest = 50.0 if ctype == 'offline_contest' else 20.0
    
    for p in participants_data:
        if p.get('participated'):
            scores[p['handle'].lower()] = (p.get('solved_count', 0) * mult_solved) + (p.get('first_solves', 0) * mult_fastest)
        else:
            scores[p['handle'].lower()] = 0.0
            
    # Top 3 Rank Bonuses
    participating = [p for p in participants_data if p.get('participated') and p.get('rank', 0) > 0]
    participating.sort(key=lambda x: (x['rank'], -x.get('solved_count', 0)))
    
    if len(participating) >= 1:
        scores[participating[0]['handle'].lower()] += 300.0
    if len(participating) >= 2:
        scores[participating[1]['handle'].lower()] += 200.0
    if len(participating) >= 3:
        scores[participating[2]['handle'].lower()] += 100.0
        
    return scores


def get_contest_rank_changes(contest):
    """Calculate rank change for each participant in a contest compared to prior group contests (add_scores.ipynb)."""
    if not contest.group_id:
        return {}
    
    group_contests = Contest.query.filter_by(group_id=contest.group_id).order_by(
        Contest.start_date.asc().nullslast(), Contest.id.asc()
    ).all()
    
    contest_ids = [c.id for c in group_contests]
    if contest.id not in contest_ids:
        return {}
    
    curr_idx = contest_ids.index(contest.id)
    if curr_idx == 0:
        return {}
    
    prior_contests = group_contests[:curr_idx]
    current_and_prior = group_contests[:curr_idx + 1]
    
    # Cumulative scores from prior contests
    prior_scores = {}
    for c in prior_contests:
        for r in c.results:
            if r.participated:
                h = r.handle.lower()
                prior_scores[h] = prior_scores.get(h, 0.0) + (r.points or 0.0)
                
    prior_sorted = sorted(prior_scores.items(), key=lambda x: -x[1])
    old_ranks = {h: idx + 1 for idx, (h, _) in enumerate(prior_sorted)}
    
    # Cumulative scores including current contest
    new_scores = {}
    for c in current_and_prior:
        for r in c.results:
            if r.participated:
                h = r.handle.lower()
                new_scores[h] = new_scores.get(h, 0.0) + (r.points or 0.0)
                
    new_sorted = sorted(new_scores.items(), key=lambda x: -x[1])
    new_ranks = {h: idx + 1 for idx, (h, _) in enumerate(new_sorted)}
    
    rank_changes = {}
    for h, new_r in new_ranks.items():
        if h in old_ranks:
            diff = old_ranks[h] - new_r
            rank_changes[h] = f"+{diff}" if diff > 0 else str(diff)
        else:
            rank_changes[h] = "NEW"
            
    return rank_changes


@app.route('/api/groups', methods=['GET'])
def get_groups():
    """Get all groups."""
    groups = Group.query.order_by(Group.created_at.desc()).all()
    return jsonify([g.to_dict() for g in groups])


@app.route('/api/groups', methods=['POST'])
def create_group():
    """Create a new group."""
    data = request.get_json()
    
    if not data or not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400
    
    group = Group(
        name=data['name'],
        description=data.get('description', '')
    )
    db.session.add(group)
    db.session.commit()
    
    return jsonify(group.to_dict()), 201


@app.route('/api/groups/<int:group_id>', methods=['GET'])
def get_group(group_id):
    """Get a specific group."""
    group = Group.query.get_or_404(group_id)
    return jsonify(group.to_dict())


@app.route('/api/groups/<int:group_id>', methods=['PUT'])
def update_group(group_id):
    """Update a group."""
    group = Group.query.get_or_404(group_id)
    data = request.get_json()
    
    if data.get('name'):
        group.name = data['name']
    if 'description' in data:
        group.description = data['description']
    if 'default_participants' in data:
        if isinstance(data['default_participants'], list):
            group.set_default_participants_list(data['default_participants'])
        else:
            group.default_participants = data['default_participants']
    if 'spreadsheet_id' in data:
        group.spreadsheet_id = data['spreadsheet_id'] if data['spreadsheet_id'] else None
    if 'attendance_spreadsheet_ids' in data:
        # Update attendance spreadsheets (many-to-many)
        group.attendance_spreadsheets.clear()
        for sheet_id in data['attendance_spreadsheet_ids']:
            sheet = Spreadsheet.query.get(sheet_id)
            if sheet:
                group.attendance_spreadsheets.append(sheet)
    
    db.session.commit()
    return jsonify(group.to_dict())


@app.route('/api/groups/<int:group_id>', methods=['DELETE'])
def delete_group(group_id):
    """Delete a group and all its contests."""
    group = Group.query.get_or_404(group_id)
    db.session.delete(group)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/groups/<int:group_id>/apply-participants', methods=['POST'])
def apply_group_participants(group_id):
    """Apply group's default participants to all contests in the group."""
    group = Group.query.get_or_404(group_id)
    default_participants = group.get_default_participants_list()
    
    if not default_participants:
        return jsonify({'error': 'No default participants set for this group'}), 400
    
    contests = Contest.query.filter_by(group_id=group_id).all()
    updated_count = 0
    
    for contest in contests:
        # Replace with default participants
        contest.set_participants_list(default_participants)
        updated_count += 1
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'contests_updated': updated_count,
        'participants_applied': len(default_participants)
    })


# ============================================================================
# API Routes - Spreadsheets
# ============================================================================

@app.route('/api/spreadsheets', methods=['GET'])
def get_spreadsheets():
    """Get all spreadsheets, optionally filtered by type."""
    spreadsheet_type = request.args.get('type')  # Optional filter by type
    query = Spreadsheet.query
    if spreadsheet_type:
        query = query.filter_by(spreadsheet_type=spreadsheet_type)
    spreadsheets = query.order_by(Spreadsheet.created_at.desc()).all()
    return jsonify([s.to_dict() for s in spreadsheets])


@app.route('/api/spreadsheets', methods=['POST'])
def create_spreadsheet():
    """Create a new spreadsheet from uploaded file."""
    import csv
    import io
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    name = request.form.get('name', file.filename)
    handle_column = request.form.get('handle_column', 'Codeforces Handle')
    phone_column = request.form.get('phone_column', '')
    spreadsheet_type = request.form.get('spreadsheet_type', 'participants')
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Parse CSV file
    try:
        content = file.read().decode('utf-8')
        reader = csv.DictReader(io.StringIO(content))
        columns = reader.fieldnames or []
        rows = list(reader)
        
        spreadsheet = Spreadsheet(
            name=name,
            filename=file.filename,
            handle_column=handle_column,
            phone_column=phone_column,
            spreadsheet_type=spreadsheet_type
        )
        spreadsheet.set_data({'columns': columns, 'rows': rows})
        db.session.add(spreadsheet)
        db.session.commit()
        
        return jsonify(spreadsheet.to_dict()), 201
        
    except Exception as e:
        return jsonify({'error': f'Failed to parse file: {str(e)}'}), 400


@app.route('/api/spreadsheets/<int:spreadsheet_id>', methods=['GET'])
def get_spreadsheet(spreadsheet_id):
    """Get a specific spreadsheet."""
    spreadsheet = Spreadsheet.query.get_or_404(spreadsheet_id)
    return jsonify(spreadsheet.to_dict())


@app.route('/api/spreadsheets/<int:spreadsheet_id>/data', methods=['GET'])
def get_spreadsheet_data(spreadsheet_id):
    """Get full spreadsheet data including rows."""
    spreadsheet = Spreadsheet.query.get_or_404(spreadsheet_id)
    data = spreadsheet.get_data()
    rows = data.get('rows', [])
    
    # Hide duplicates: deduplicate by handle column
    hide_duplicates = request.args.get('hide_duplicates', 'false').lower() == 'true'
    if hide_duplicates and spreadsheet.handle_column:
        seen_handles = set()
        unique_rows = []
        for row in rows:
            handle = row.get(spreadsheet.handle_column, '').strip().lower()
            if handle and handle not in seen_handles:
                seen_handles.add(handle)
                unique_rows.append(row)
            elif not handle:
                unique_rows.append(row)
        rows = unique_rows
    
    return jsonify({
        'id': spreadsheet.id,
        'name': spreadsheet.name,
        'handle_column': spreadsheet.handle_column,
        'columns': data.get('columns', []),
        'rows': rows,
        'total_rows': len(data.get('rows', [])),
        'displayed_rows': len(rows)
    })


@app.route('/api/spreadsheets/<int:spreadsheet_id>/participant/<handle>', methods=['GET'])
def get_participant_data(spreadsheet_id, handle):
    """Get participant row data from spreadsheet."""
    spreadsheet = Spreadsheet.query.get_or_404(spreadsheet_id)
    row = spreadsheet.get_participant_row(handle)
    if row:
        return jsonify(row)
    return jsonify({'error': 'Participant not found'}), 404


@app.route('/api/spreadsheets/<int:spreadsheet_id>', methods=['PUT'])
def update_spreadsheet(spreadsheet_id):
    """Update a spreadsheet."""
    spreadsheet = Spreadsheet.query.get_or_404(spreadsheet_id)
    
    # Handle JSON update
    if request.is_json:
        data = request.get_json()
        if data.get('name'):
            spreadsheet.name = data['name']
        if data.get('handle_column'):
            spreadsheet.handle_column = data['handle_column']
        if 'phone_column' in data:
            spreadsheet.phone_column = data['phone_column']
    # Handle file re-upload
    elif 'file' in request.files:
        import csv
        import io
        
        file = request.files['file']
        handle_column = request.form.get('handle_column', spreadsheet.handle_column)
        phone_column = request.form.get('phone_column', spreadsheet.phone_column)
        
        try:
            content = file.read().decode('utf-8')
            reader = csv.DictReader(io.StringIO(content))
            columns = reader.fieldnames or []
            rows = list(reader)
            
            spreadsheet.filename = file.filename
            spreadsheet.handle_column = handle_column
            spreadsheet.phone_column = phone_column
            spreadsheet.set_data({'columns': columns, 'rows': rows})
        except Exception as e:
            return jsonify({'error': f'Failed to parse file: {str(e)}'}), 400
    
    db.session.commit()
    return jsonify(spreadsheet.to_dict())


@app.route('/api/spreadsheets/<int:spreadsheet_id>', methods=['DELETE'])
def delete_spreadsheet(spreadsheet_id):
    """Delete a spreadsheet."""
    spreadsheet = Spreadsheet.query.get_or_404(spreadsheet_id)
    
    # Unlink any groups using this spreadsheet
    for group in spreadsheet.groups:
        group.spreadsheet_id = None
    
    db.session.delete(spreadsheet)
    db.session.commit()
    return jsonify({'success': True})


@app.route('/api/groups/<int:group_id>/overview', methods=['GET'])
def get_group_overview(group_id):
    """Get overview of all participants across all contests in a group."""
    group = Group.query.get_or_404(group_id)
    contests = Contest.query.filter_by(group_id=group_id).order_by(Contest.start_date.asc().nullslast()).all()
    
    if not contests:
        return jsonify({
            'group': group.to_dict(),
            'contests': [],
            'participants': [],
            'total_attendance_sheets': len(group.attendance_spreadsheets)
        })
    
    # Build attendance lookup from shared handles or participant identity fields.
    attendance_lookup = get_group_attendance_lookup(group)
    total_attendance_sheets = len(group.attendance_spreadsheets)
    
    # Build set of all handles in participants spreadsheet (for 📋 button)
    spreadsheet_handles = set()
    if group.spreadsheet:
        data = group.spreadsheet.get_data()
        rows = data.get('rows', [])
        handle_col = group.spreadsheet.handle_column
        for row in rows:
            handle = row.get(handle_col, '').strip().lower()
            if handle:
                spreadsheet_handles.add(handle)
    
    # Collect all unique participants across all contests
    all_handles = set()
    for contest in contests:
        results = CachedResult.query.filter_by(contest_id=contest.id).all()
        for r in results:
            all_handles.add(r.handle.lower())
    
    # Build participant data with results for each contest
    participants = []
    for handle in sorted(all_handles, key=str.lower):
        total_passes = 0
        total_solved = 0
        total_first_solves = 0
        total_points = 0.0
        participant_data = {
            'handle': handle,
            'results': {},
            'in_spreadsheet': handle.lower() in spreadsheet_handles
        }
        
        for contest in contests:
            result = CachedResult.query.filter_by(
                contest_id=contest.id
            ).filter(db.func.lower(CachedResult.handle) == handle.lower()).first()
            
            if result:
                pt = result.points or 0.0
                fs = result.first_solves or 0
                participant_data['results'][contest.id] = {
                    'solved_count': result.solved_count,
                    'passed': result.passed,
                    'participated': result.participated,
                    'rank': result.rank,
                    'first_solves': fs,
                    'points': int(pt) if pt == int(pt) else pt
                }
                if result.passed:
                    total_passes += 1
                total_solved += result.solved_count
                total_first_solves += fs
                total_points += pt
        
        # Add attendance tracking
        attendance = attendance_lookup.get(normalize_identity_value(handle), 0)
        participant_data['attendance'] = attendance
        participant_data['total_attendance_sheets'] = total_attendance_sheets
        
        # Calculate points: exact sum of contest points according to add_scores.ipynb
        pt_val = int(total_points) if total_points == int(total_points) else total_points
        participant_data['points'] = pt_val
        participant_data['total_first_solves'] = total_first_solves
        participant_data['total_passes'] = total_passes
        participant_data['total_solved'] = total_solved
        
        participants.append(participant_data)
    
    # Build contest data with min solved info & contest_type
    contest_data = []
    for contest in contests:
        contest_data.append({
            'id': contest.id,
            'name': contest.name,
            'contest_type': contest.contest_type or 'contest',
            'total_problems': contest.total_problems,
            'min_solved': contest.min_solved,
            'min_solved_is_percent': contest.min_solved_is_percent,
            'required_solved': contest.get_required_solved()
        })
    
    return jsonify({
        'group': group.to_dict(),
        'contests': contest_data,
        'participants': participants,
        'total_attendance_sheets': total_attendance_sheets
    })


# ============================================================================
# API Routes - Contests
# ============================================================================

@app.route('/api/groups/<int:group_id>/contests', methods=['GET'])
def get_contests(group_id):
    """Get all contests in a group, sorted by start date."""
    group = Group.query.get_or_404(group_id)
    contests = Contest.query.filter_by(group_id=group_id).order_by(Contest.start_date.asc().nullslast()).all()
    return jsonify([c.to_dict() for c in contests])


@app.route('/api/groups/<int:group_id>/contests', methods=['POST'])
def add_contest(group_id):
    """Add a contest to a group."""
    group = Group.query.get_or_404(group_id)
    data = request.get_json()
    
    if not data or not data.get('cf_contest_id'):
        return jsonify({'error': 'Codeforces contest ID is required'}), 400
    
    cf_contest_id = data['cf_contest_id']
    
    # Check for duplicate contest in this group
    existing = Contest.query.filter_by(group_id=group_id, cf_contest_id=cf_contest_id).first()
    if existing:
        return jsonify({'error': f'Contest {cf_contest_id} already exists in this group'}), 400
    
    # Fetch contest info and all participants from Codeforces
    standings = cf_api.get_contest_standings(cf_contest_id)
    
    if not standings.get('success'):
        return jsonify({'error': f"Failed to fetch contest: {standings.get('error')}"}), 400
    
    result = standings.get('result', {})
    contest_info = result.get('contest', {})
    problems = result.get('problems', [])
    rows = result.get('rows', [])
    
    contest_name = data.get('name') or contest_info.get('name', f'Contest {cf_contest_id}')
    total_problems = len(problems)
    
    # Auto-fetch all participants from contest standings if not provided
    provided_participants = data.get('participants', [])
    if provided_participants:
        # Use provided participants
        participants = provided_participants
    else:
        # Extract all participants from standings
        participants = []
        for row in rows:
            party = row.get('party', {})
            members = party.get('members', [])
            for member in members:
                handle = member.get('handle')
                if handle and handle not in participants:
                    participants.append(handle)
    
    # Get contest start time from CF API
    start_time_seconds = contest_info.get('startTimeSeconds')
    start_date = None
    if start_time_seconds:
        start_date = datetime.fromtimestamp(start_time_seconds, tz=timezone.utc)
    
    # Determine contest type
    contest_type = data.get('contest_type')
    if not contest_type:
        c_low = contest_name.lower()
        if 'offline' in c_low:
            contest_type = 'offline_contest'
        elif 'sheet' in c_low:
            contest_type = 'sheet'
        else:
            contest_type = 'contest'
    
    contest = Contest(
        group_id=group_id,
        cf_contest_id=cf_contest_id,
        name=contest_name,
        contest_type=contest_type,
        min_solved=data.get('min_solved', 1),
        min_solved_is_percent=data.get('min_solved_is_percent', False),
        total_problems=total_problems,
        participants=','.join(participants),
        start_date=start_date
    )
    db.session.add(contest)
    db.session.commit()
    
    return jsonify(contest.to_dict()), 201


@app.route('/api/contests/<int:contest_id>', methods=['GET'])
def get_contest(contest_id):
    """Get a specific contest."""
    contest = Contest.query.get_or_404(contest_id)
    return jsonify(contest.to_dict())


@app.route('/api/contests/<int:contest_id>', methods=['PUT'])
def update_contest(contest_id):
    """Update a contest."""
    contest = Contest.query.get_or_404(contest_id)
    data = request.get_json()
    
    if data.get('name'):
        contest.name = data['name']
    if 'contest_type' in data and data['contest_type']:
        old_type = contest.contest_type
        contest.contest_type = data['contest_type']
        if old_type != contest.contest_type:
            # Recompute points for all cached results
            results = CachedResult.query.filter_by(contest_id=contest_id).all()
            participants_info = [{
                'handle': r.handle,
                'solved_count': r.solved_count,
                'first_solves': r.first_solves or 0,
                'participated': r.participated,
                'rank': r.rank
            } for r in results]
            scores = compute_contest_scores(contest.contest_type, participants_info, contest.total_problems)
            for r in results:
                r.points = scores.get(r.handle.lower(), 0.0)
    if 'min_solved' in data:
        contest.min_solved = data['min_solved']
    if 'min_solved_is_percent' in data:
        contest.min_solved_is_percent = data['min_solved_is_percent']
    if 'lock_participants' in data:
        contest.lock_participants = data['lock_participants']
    if 'participants' in data:
        if isinstance(data['participants'], list):
            contest.set_participants_list(data['participants'])
        else:
            contest.participants = data['participants']
    
    db.session.commit()
    return jsonify(contest.to_dict())


@app.route('/api/contests/<int:contest_id>', methods=['DELETE'])
def delete_contest(contest_id):
    """Delete a contest."""
    contest = Contest.query.get_or_404(contest_id)
    db.session.delete(contest)
    db.session.commit()
    return jsonify({'success': True})


# ============================================================================
# API Routes - Results & Refresh
# ============================================================================

@app.route('/api/contests/<int:contest_id>/refresh', methods=['POST'])
def refresh_contest_results(contest_id):
    """Refresh contest results from Codeforces API."""
    contest = Contest.query.get_or_404(contest_id)
    
    # Fetch standings from Codeforces first (get full standings for all participants)
    standings = cf_api.get_contest_standings(contest.cf_contest_id)
    
    if not standings.get('success'):
        return jsonify({'error': f"Failed to fetch standings: {standings.get('error')}"}), 400
    
    # Auto-update participants from Codeforces if not locked
    if not contest.lock_participants:
        # Get all handles from the contest standings
        rows = standings.get('result', {}).get('rows', [])
        cf_handles = set()
        for row in rows:
            party = row.get('party', {})
            members = party.get('members', [])
            for member in members:
                handle = member.get('handle', '')
                if handle:
                    cf_handles.add(handle)
        
        # Merge with existing participants (add new ones from CF)
        existing = set(contest.get_participants_list())
        new_participants = list(existing.union(cf_handles))
        if len(new_participants) > len(existing):
            contest.set_participants_list(new_participants)
    
    participants = contest.get_participants_list()
    
    if not participants:
        return jsonify({'error': 'No participants added to this contest'}), 400
    
    # Clear old results
    CachedResult.query.filter_by(contest_id=contest_id).delete()
    db.session.commit()
    
    # Update total problems count
    problems = standings.get('result', {}).get('problems', [])
    contest.total_problems = len(problems)
    
    # Get required solved count (handles percentage)
    required_solved = contest.get_required_solved()
    
    # Fetch first solvers if contest or offline_contest
    first_solvers = {}
    ctype = contest.contest_type or 'contest'
    if ctype in ['contest', 'offline_contest']:
        try:
            status_res = cf_api.get_contest_status(contest.cf_contest_id)
            first_solvers = cf_api.get_first_solvers(status_res, problems)
        except Exception as e:
            app.logger.warning(f"Error fetching status for contest {contest.cf_contest_id}: {e}")
            first_solvers = {}
            
    first_solve_counts = {}
    for prob_idx, solver in first_solvers.items():
        if solver:
            h_low = solver.lower()
            first_solve_counts[h_low] = first_solve_counts.get(h_low, 0) + 1
            
    # Collect participant info for score calculation
    participants_info = []
    for handle in participants:
        participant_data = cf_api.get_participant_data(standings, handle)
        solved_count = participant_data['solved_count']
        participated = participant_data['participated']
        rank = participant_data['rank']
        fs = first_solve_counts.get(handle.lower(), 0) if ctype in ['contest', 'offline_contest'] else 0
        participants_info.append({
            'handle': handle,
            'solved_count': solved_count,
            'participated': participated,
            'rank': rank,
            'first_solves': fs
        })
        
    scores = compute_contest_scores(contest.contest_type, participants_info, contest.total_problems)
    
    # Process results for each participant
    results = []
    now = datetime.now(timezone.utc)
    passed_count = 0
    failed_count = 0
    not_participated_count = 0
    
    for p in participants_info:
        handle = p['handle']
        solved_count = p['solved_count']
        participated = p['participated']
        rank = p['rank']
        fs = p['first_solves']
        pt = scores.get(handle.lower(), 0.0)
        
        # Determine pass/fail (only if participated)
        if participated:
            passed = solved_count >= required_solved
            if passed:
                passed_count += 1
            else:
                failed_count += 1
        else:
            passed = False
            not_participated_count += 1
        
        result = CachedResult(
            contest_id=contest_id,
            handle=handle,
            solved_count=solved_count,
            passed=passed,
            participated=participated,
            rank=rank,
            first_solves=fs,
            points=pt,
            cached_at=now
        )
        db.session.add(result)
        results.append(result.to_dict())
    
    # Save to fetch history (one entry per day)
    today = date.today()
    existing_history = FetchHistory.query.filter_by(
        contest_id=contest_id,
        fetch_date=today
    ).first()
    
    if existing_history:
        # Update existing entry for today
        existing_history.passed_count = passed_count
        existing_history.failed_count = failed_count
        existing_history.not_participated_count = not_participated_count
        existing_history.total_count = len(participants)
    else:
        # Create new entry
        history_entry = FetchHistory(
            contest_id=contest_id,
            fetch_date=today,
            passed_count=passed_count,
            failed_count=failed_count,
            not_participated_count=not_participated_count,
            total_count=len(participants)
        )
        db.session.add(history_entry)
    
    # Update last_refreshed timestamp
    contest.last_refreshed = now
    db.session.commit()
    return jsonify({
        'success': True,
        'results': results,
        'required_solved': required_solved,
        'total_problems': len(problems)
    })


@app.route('/api/contests/<int:contest_id>/results', methods=['GET'])
def get_contest_results(contest_id):
    """Get cached results for a contest."""
    contest = Contest.query.get_or_404(contest_id)
    results = CachedResult.query.filter_by(contest_id=contest_id).all()
    rank_changes = get_contest_rank_changes(contest)
    
    # Calculate summary
    participated_results = [r for r in results if r.participated]
    passed_count = sum(1 for r in results if r.passed)
    not_participated_count = sum(1 for r in results if not r.participated)
    failed_count = len(participated_results) - passed_count
    
    formatted_results = []
    for r in results:
        d = r.to_dict()
        d['rank_change'] = rank_changes.get(r.handle.lower(), 'NEW' if r.participated else '-')
        formatted_results.append(d)
    
    return jsonify({
        'contest': contest.to_dict(),
        'results': formatted_results,
        'summary': {
            'total': len(results),
            'passed': passed_count,
            'failed': failed_count,
            'not_participated': not_participated_count,
            'pass_rate': round(passed_count / len(participated_results) * 100, 1) if participated_results else 0
        }
    })


@app.route('/api/contests/<int:contest_id>/export', methods=['GET'])
def export_contest_results(contest_id):
    """Export contest results as a handle list, JSON, or CSV."""
    contest = Contest.query.get_or_404(contest_id)
    filter_type = request.args.get('filter', 'all')  # all, passed, failed
    export_format = request.args.get('format', 'handles')
    
    results = CachedResult.query.filter_by(contest_id=contest_id).all()
    rank_changes = get_contest_rank_changes(contest)
    
    if filter_type == 'passed':
        handles = [r.handle for r in results if r.passed]
    elif filter_type == 'failed':
        handles = [r.handle for r in results if not r.passed]
    else:
        handles = [r.handle for r in results]

    if export_format == 'json':
        formatted_results = []
        for r in results:
            if r.handle in handles:
                d = r.to_dict()
                d['rank_change'] = rank_changes.get(r.handle.lower(), 'NEW' if r.participated else '-')
                formatted_results.append(d)
        payload = {
            'contest': contest.to_dict(),
            'filter': filter_type,
            'results': formatted_results
        }
        return Response(
            json.dumps(payload, indent=2),
            mimetype='application/json',
            headers={'Content-Disposition': f'attachment; filename="{contest.name}_results.json"'}
        )

    if export_format == 'csv':
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Rank', 'Rank Change', 'Handle', 'Points', 'First Solves', 'Solved', 'Passed'])
        for result in results:
            if result.handle in handles:
                rc = rank_changes.get(result.handle.lower(), 'NEW' if result.participated else '-')
                pt = int(result.points) if result.points == int(result.points) else (result.points or 0)
                writer.writerow([
                    result.rank if result.participated and result.rank > 0 else '-',
                    rc,
                    result.handle,
                    pt,
                    result.first_solves or 0,
                    result.solved_count if result.participated else '-',
                    'Passed' if result.passed else ('Failed' if result.participated else 'Not Entered')
                ])
        csv_content = output.getvalue()
        output.close()
        return Response(
            csv_content,
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename="{contest.name}_results.csv"'}
        )
    
    return jsonify({
        'contest_name': contest.name,
        'filter': filter_type,
        'count': len(handles),
        'handles': ','.join(handles)
    })


# ============================================================================
# API Routes - History & Standings
# ============================================================================

@app.route('/api/contests/<int:contest_id>/history', methods=['GET'])
def get_contest_history(contest_id):
    """Get historical fetch data for progress tracking."""
    contest = Contest.query.get_or_404(contest_id)
    history = FetchHistory.query.filter_by(contest_id=contest_id).order_by(FetchHistory.fetch_date).all()
    
    return jsonify({
        'contest': contest.to_dict(),
        'history': [h.to_dict() for h in history]
    })


@app.route('/api/contests/<int:contest_id>/standings', methods=['GET'])
def get_contest_standings(contest_id):
    """Get contest results ordered by rank (standings view)."""
    contest = Contest.query.get_or_404(contest_id)
    results = CachedResult.query.filter_by(contest_id=contest_id).all()
    rank_changes = get_contest_rank_changes(contest)
    
    # Separate participated and not participated
    participated = [r for r in results if r.participated]
    not_participated = [r for r in results if not r.participated]

    print(not_participated)
    
    # Sort participated by rank (0 means no rank, put at end), then points desc
    participated.sort(key=lambda r: (r.rank == 0, r.rank, -(r.points or 0.0), -r.solved_count))
    
    # Combine: participated first (sorted by rank), then not participated
    ordered_results = participated + not_participated
    
    standings_list = []
    for r in ordered_results:
        d = r.to_dict()
        d['rank_change'] = rank_changes.get(r.handle.lower(), 'NEW' if r.participated else '-')
        standings_list.append(d)
    
    return jsonify({
        'contest': contest.to_dict(),
        'standings': standings_list,
        'summary': {
            'total': len(results),
            'participated': len(participated),
            'not_participated': len(not_participated)
        }
    })


# ============================================================================
# API Routes - Analytics
# ============================================================================

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    """Get dashboard analytics data."""
    groups = Group.query.all()
    contests = Contest.query.all()
    results = CachedResult.query.all()
    
    # Calculate overall stats
    total_participants = len(set(r.handle for r in results))
    passed_results = [r for r in results if r.passed]
    failed_results = [r for r in results if not r.passed]
    
    # Group stats
    group_stats = []
    for group in groups:
        group_contests = [c for c in contests if c.group_id == group.id]
        group_results = [r for r in results if any(r.contest_id == c.id for c in group_contests)]
        group_passed = sum(1 for r in group_results if r.passed)
        
        group_stats.append({
            'id': group.id,
            'name': group.name,
            'contest_count': len(group_contests),
            'participant_count': len(set(r.handle for r in group_results)),
            'pass_rate': round(group_passed / len(group_results) * 100, 1) if group_results else 0
        })
    
    return jsonify({
        'summary': {
            'total_groups': len(groups),
            'total_contests': len(contests),
            'total_participants': total_participants,
            'total_results': len(results),
            'overall_pass_rate': round(len(passed_results) / len(results) * 100, 1) if results else 0
        },
        'groups': group_stats
    })


@app.route('/api/codeforces/search', methods=['GET'])
def search_codeforces_contests():
    """Search Codeforces contests."""
    contests = cf_api.get_contest_list()
    
    if not contests.get('success'):
        return jsonify({'error': contests.get('error')}), 400
    
    # Return only finished contests, limited to recent ones
    finished = [c for c in contests['result'] if c.get('phase') == 'FINISHED'][:50]
    
    return jsonify([{
        'id': c['id'],
        'name': c['name'],
        'type': c.get('type', 'CF'),
        'startTime': c.get('startTimeSeconds')
    } for c in finished])


# ============================================================================
# API Routes - Group CSV Export
# ============================================================================

@app.route('/api/groups/<int:group_id>/export-csv', methods=['GET'])
def export_group_csv(group_id):
    """Export group data as a CSV file."""
    group = Group.query.get_or_404(group_id)
    contests = Contest.query.filter_by(group_id=group_id).order_by(Contest.start_date.asc().nullslast(), Contest.id.asc()).all()
    
    # Build attendance lookup from shared handles or participant identity fields.
    attendance_lookup = get_group_attendance_lookup(group)
    total_attendance_sheets = len(group.attendance_spreadsheets)
    
    # Collect all unique participants
    all_handles = set()
    for contest in contests:
        results = CachedResult.query.filter_by(contest_id=contest.id).all()
        for r in results:
            all_handles.add(r.handle.lower())
    
    # Calculate old ranks from contests prior to the latest contest (add_scores.ipynb)
    old_ranks = {}
    if len(contests) > 1:
        prior_contests = contests[:-1]
        prior_scores = {}
        for c in prior_contests:
            for r in c.results:
                if r.participated:
                    h = r.handle.lower()
                    prior_scores[h] = prior_scores.get(h, 0.0) + (r.points or 0.0)
        prior_sorted = sorted(prior_scores.items(), key=lambda x: -x[1])
        old_ranks = {h: idx + 1 for idx, (h, _) in enumerate(prior_sorted)}
    
    participant_rows = []
    for handle in all_handles:
        total_passes = 0
        total_solved = 0
        total_first_solves = 0
        total_points = 0.0
        contest_results = []
        actual_handle = handle
        
        for contest in contests:
            result = CachedResult.query.filter_by(
                contest_id=contest.id
            ).filter(db.func.lower(CachedResult.handle) == handle.lower()).first()
            
            if result:
                actual_handle = result.handle
                if result.passed:
                    total_passes += 1
                total_solved += result.solved_count
                total_first_solves += (result.first_solves or 0)
                total_points += (result.points or 0.0)
                if not result.participated:
                    contest_results.append('Not Entered')
                else:
                    pt_str = int(result.points) if result.points == int(result.points) else result.points
                    contest_results.append(f'{pt_str} pts ({result.solved_count} solved)')
            else:
                contest_results.append('-')
                
        attendance = attendance_lookup.get(normalize_identity_value(handle), 0)
        pt_val = int(total_points) if total_points == int(total_points) else total_points
        
        participant_rows.append({
            'handle': actual_handle,
            'points': pt_val,
            'first_solves': total_first_solves,
            'total_solved': total_solved,
            'total_passes': total_passes,
            'attendance': attendance,
            'contest_results': contest_results
        })
        
    # Sort by Points descending, tie break by first_solves, total_solved
    participant_rows.sort(key=lambda x: (-x['points'], -x['first_solves'], -x['total_solved'], x['handle'].lower()))
    
    # Header row
    header = ['Rank', 'Rank Change', 'Handle', 'Points', 'First Solves', 'Total Solved', 'Total Passes', f'Attendance (/{total_attendance_sheets})']
    for contest in contests:
        header.append(contest.name)
        
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(header)
    
    for idx, p in enumerate(participant_rows):
        rank = idx + 1
        h_low = p['handle'].lower()
        if h_low in old_ranks:
            diff = old_ranks[h_low] - rank
            rank_change = f"+{diff}" if diff > 0 else str(diff)
        else:
            rank_change = "NEW"
            
        row = [
            rank,
            rank_change,
            p['handle'],
            p['points'],
            p['first_solves'],
            p['total_solved'],
            p['total_passes'],
            f"{p['attendance']}/{total_attendance_sheets}"
        ]
        row.extend(p['contest_results'])
        writer.writerow(row)
    
    csv_content = output.getvalue()
    output.close()
    
    return Response(
        csv_content,
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename="{group.name}_export.csv"'}
    )


# ============================================================================
# API Routes - Spreadsheet Statistics Export
# ============================================================================

@app.route('/api/spreadsheets/<int:spreadsheet_id>/statistics', methods=['GET'])
def get_spreadsheet_statistics(spreadsheet_id):
    """Get spreadsheet statistics, exportable as JSON or CSV."""
    spreadsheet = Spreadsheet.query.get_or_404(spreadsheet_id)
    data = spreadsheet.get_data()
    rows = data.get('rows', [])
    columns = data.get('columns', [])
    export_format = request.args.get('format', 'json')  # 'json' or 'csv'
    
    # Build statistics
    stats = {
        'name': spreadsheet.name,
        'filename': spreadsheet.filename,
        'type': spreadsheet.spreadsheet_type,
        'handle_column': spreadsheet.handle_column,
        'total_rows': len(rows),
        'total_columns': len(columns),
        'columns': columns,
    }
    
    # Column-level stats
    col_stats = {}
    for col in columns:
        values = [row.get(col, '') for row in rows]
        non_empty = [v for v in values if v and str(v).strip()]
        unique_vals = set(str(v).strip().lower() for v in non_empty)
        col_stats[col] = {
            'total': len(values),
            'non_empty': len(non_empty),
            'empty': len(values) - len(non_empty),
            'unique': len(unique_vals),
            'duplicates': len(non_empty) - len(unique_vals),
            'fill_rate': round(len(non_empty) / len(values) * 100, 1) if values else 0
        }
    stats['column_statistics'] = col_stats
    
    # Handle-specific stats
    handle_col = spreadsheet.handle_column
    handles = [row.get(handle_col, '').strip().lower() for row in rows if row.get(handle_col, '').strip()]
    stats['handle_statistics'] = {
        'total_handles': len(handles),
        'unique_handles': len(set(handles)),
        'duplicate_handles': len(handles) - len(set(handles))
    }
    
    # Find duplicate handles
    handle_counts = {}
    for h in handles:
        handle_counts[h] = handle_counts.get(h, 0) + 1
    stats['handle_statistics']['duplicated_entries'] = [
        {'handle': h, 'count': c} for h, c in handle_counts.items() if c > 1
    ]
    
    # Usage info: which groups use this spreadsheet
    if spreadsheet.spreadsheet_type == 'participants':
        linked_groups = [{'id': g.id, 'name': g.name} for g in spreadsheet.groups]
    else:
        linked_groups = [{'id': g.id, 'name': g.name} for g in spreadsheet.attendance_groups]
    stats['linked_groups'] = linked_groups
    
    # Include raw rows data for analysis
    stats['rows'] = rows
    
    if export_format == 'csv':
        # Export calculated statistics in a tabular format for analysis.
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['section', 'name', 'total', 'non_empty', 'empty', 'unique', 'duplicates', 'fill_rate', 'count'])
        writer.writerow(['summary', 'total_rows', stats['total_rows'], '', '', '', '', '', ''])
        writer.writerow(['summary', 'total_columns', stats['total_columns'], '', '', '', '', '', ''])
        writer.writerow(['handles', 'total_handles', stats['handle_statistics']['total_handles'], '', '', '', '', '', ''])
        writer.writerow(['handles', 'unique_handles', stats['handle_statistics']['unique_handles'], '', '', '', '', '', ''])
        writer.writerow(['handles', 'duplicate_handles', stats['handle_statistics']['duplicate_handles'], '', '', '', '', '', ''])
        for column, column_stat in col_stats.items():
            writer.writerow([
                'column', column, column_stat['total'], column_stat['non_empty'],
                column_stat['empty'], column_stat['unique'], column_stat['duplicates'],
                column_stat['fill_rate'], ''
            ])
        for duplicate in stats['handle_statistics']['duplicated_entries']:
            writer.writerow(['duplicate_handle', duplicate['handle'], '', '', '', '', '', '', duplicate['count']])
        csv_content = output.getvalue()
        output.close()
        return Response(
            csv_content,
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename="{spreadsheet.name}_statistics.csv"'}
        )
    
    # Default: return JSON
    return jsonify(stats)


if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')
