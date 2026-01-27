"""Main Flask application for Codeforces Tracker."""
from datetime import datetime, timezone, date
from flask import Flask, render_template, request, jsonify
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
        # Merge existing participants with default participants
        existing = set(contest.get_participants_list())
        new_participants = list(existing.union(set(default_participants)))
        contest.set_participants_list(new_participants)
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
    """Get all spreadsheets."""
    spreadsheets = Spreadsheet.query.order_by(Spreadsheet.created_at.desc()).all()
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
            handle_column=handle_column
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
    return jsonify({
        'id': spreadsheet.id,
        'name': spreadsheet.name,
        'handle_column': spreadsheet.handle_column,
        'columns': data.get('columns', []),
        'rows': data.get('rows', [])
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
    # Handle file re-upload
    elif 'file' in request.files:
        import csv
        import io
        
        file = request.files['file']
        handle_column = request.form.get('handle_column', spreadsheet.handle_column)
        
        try:
            content = file.read().decode('utf-8')
            reader = csv.DictReader(io.StringIO(content))
            columns = reader.fieldnames or []
            rows = list(reader)
            
            spreadsheet.filename = file.filename
            spreadsheet.handle_column = handle_column
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
            'participants': []
        })
    
    # Collect all unique participants across all contests
    all_handles = set()
    for contest in contests:
        results = CachedResult.query.filter_by(contest_id=contest.id).all()
        for r in results:
            all_handles.add(r.handle.lower())
    
    # Build participant data with results for each contest
    participants = []
    for handle in sorted(all_handles, key=str.lower):
        participant_data = {
            'handle': handle,
            'results': {}
        }
        
        for contest in contests:
            result = CachedResult.query.filter_by(
                contest_id=contest.id
            ).filter(db.func.lower(CachedResult.handle) == handle.lower()).first()
            
            if result:
                participant_data['results'][contest.id] = {
                    'solved_count': result.solved_count,
                    'passed': result.passed,
                    'participated': result.participated,
                    'rank': result.rank
                }
        
        participants.append(participant_data)
    
    # Build contest data with min solved info
    contest_data = []
    for contest in contests:
        contest_data.append({
            'id': contest.id,
            'name': contest.name,
            'total_problems': contest.total_problems,
            'min_solved': contest.min_solved,
            'min_solved_is_percent': contest.min_solved_is_percent,
            'required_solved': contest.get_required_solved()
        })
    
    return jsonify({
        'group': group.to_dict(),
        'contests': contest_data,
        'participants': participants
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
    
    contest = Contest(
        group_id=group_id,
        cf_contest_id=cf_contest_id,
        name=contest_name,
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
    if 'min_solved' in data:
        contest.min_solved = data['min_solved']
    if 'min_solved_is_percent' in data:
        contest.min_solved_is_percent = data['min_solved_is_percent']
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
    participants = contest.get_participants_list()
    
    if not participants:
        return jsonify({'error': 'No participants added to this contest'}), 400
    
    # Clear old results
    CachedResult.query.filter_by(contest_id=contest_id).delete()
    db.session.commit()
    
    # Fetch standings from Codeforces (get full standings for all participants)
    standings = cf_api.get_contest_standings(contest.cf_contest_id)
    
    if not standings.get('success'):
        return jsonify({'error': f"Failed to fetch standings: {standings.get('error')}"}), 400
    
    # Update total problems count
    problems = standings.get('result', {}).get('problems', [])
    contest.total_problems = len(problems)
    
    # Get required solved count (handles percentage)
    required_solved = contest.get_required_solved()
    
    # Process results for each participant
    results = []
    now = datetime.now(timezone.utc)
    passed_count = 0
    failed_count = 0
    not_participated_count = 0
    
    for handle in participants:
        participant_data = cf_api.get_participant_data(standings, handle)
        solved_count = participant_data['solved_count']
        participated = participant_data['participated']
        rank = participant_data['rank']
        
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
    
    # Calculate summary
    participated_results = [r for r in results if r.participated]
    passed_count = sum(1 for r in results if r.passed)
    not_participated_count = sum(1 for r in results if not r.participated)
    failed_count = len(participated_results) - passed_count
    
    return jsonify({
        'contest': contest.to_dict(),
        'results': [r.to_dict() for r in results],
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
    """Export usernames as comma-separated text."""
    contest = Contest.query.get_or_404(contest_id)
    filter_type = request.args.get('filter', 'all')  # all, passed, failed
    
    results = CachedResult.query.filter_by(contest_id=contest_id).all()
    
    if filter_type == 'passed':
        handles = [r.handle for r in results if r.passed]
    elif filter_type == 'failed':
        handles = [r.handle for r in results if not r.passed]
    else:
        handles = [r.handle for r in results]
    
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
    
    # Separate participated and not participated
    participated = [r for r in results if r.participated]
    not_participated = [r for r in results if not r.participated]
    
    # Sort participated by rank (0 means no rank, put at end)
    participated.sort(key=lambda r: (r.rank == 0, r.rank, -r.solved_count))
    
    # Combine: participated first (sorted by rank), then not participated
    ordered_results = participated + not_participated
    
    return jsonify({
        'contest': contest.to_dict(),
        'standings': [r.to_dict() for r in ordered_results],
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


if __name__ == '__main__':
    app.run(debug=True, port=5000)
