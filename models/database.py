"""SQLAlchemy database models for Codeforces Tracker."""
from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def utc_now():
    """Get current UTC time."""
    return datetime.now(timezone.utc)


class Spreadsheet(db.Model):
    """A training spreadsheet containing participant details."""
    __tablename__ = 'spreadsheets'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    filename = db.Column(db.String(255), default='')  # Original filename
    handle_column = db.Column(db.String(50), default='Codeforces Handle')  # Column name for CF handles
    data = db.Column(db.Text, default='{}')  # JSON-stored spreadsheet data
    created_at = db.Column(db.DateTime, default=utc_now)
    
    # Relationships
    groups = db.relationship('Group', backref='spreadsheet', lazy=True)
    
    def get_data(self):
        """Get spreadsheet data as dict."""
        import json
        try:
            return json.loads(self.data) if self.data else {}
        except:
            return {}
    
    def set_data(self, data_dict):
        """Set spreadsheet data from dict."""
        import json
        self.data = json.dumps(data_dict)
    
    def get_participant_row(self, handle):
        """Get the row data for a participant by handle."""
        data = self.get_data()
        rows = data.get('rows', [])
        handle_col = self.handle_column
        for row in rows:
            if row.get(handle_col, '').lower() == handle.lower():
                return row
        return None
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization."""
        data = self.get_data()
        return {
            'id': self.id,
            'name': self.name,
            'filename': self.filename,
            'handle_column': self.handle_column,
            'columns': data.get('columns', []),
            'row_count': len(data.get('rows', [])),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'group_count': len(self.groups)
        }


class Group(db.Model):
    """A training group that contains multiple contests."""
    __tablename__ = 'groups'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, default='')
    default_participants = db.Column(db.Text, default='')  # Group-wide participant list
    spreadsheet_id = db.Column(db.Integer, db.ForeignKey('spreadsheets.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=utc_now)
    
    # Relationships
    contests = db.relationship('Contest', backref='group', lazy=True, cascade='all, delete-orphan')
    
    def get_default_participants_list(self):
        """Get default participants as a list."""
        if not self.default_participants:
            return []
        return [h.strip() for h in self.default_participants.split(',') if h.strip()]
    
    def set_default_participants_list(self, handles):
        """Set default participants from a list."""
        self.default_participants = ','.join(handles)
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'default_participants': self.get_default_participants_list(),
            'spreadsheet_id': self.spreadsheet_id,
            'spreadsheet': self.spreadsheet.to_dict() if self.spreadsheet else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'contest_count': len(self.contests)
        }


class Contest(db.Model):
    """A Codeforces contest being tracked within a group."""
    __tablename__ = 'contests'
    
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    cf_contest_id = db.Column(db.Integer, nullable=False)  # Codeforces contest ID
    name = db.Column(db.String(200), nullable=False)
    min_solved = db.Column(db.Integer, default=1)  # Minimum problems to pass (or percentage if is_percent)
    min_solved_is_percent = db.Column(db.Boolean, default=False)  # If True, min_solved is a percentage
    participants = db.Column(db.Text, default='')  # Comma-separated handles
    added_at = db.Column(db.DateTime, default=utc_now)
    total_problems = db.Column(db.Integer, default=0)  # Total problems in contest (for percentage calc)
    start_date = db.Column(db.DateTime, nullable=True)  # When the contest started on Codeforces
    last_refreshed = db.Column(db.DateTime, nullable=True)  # Last time results were fetched
    
    # Relationships
    results = db.relationship('CachedResult', backref='contest', lazy=True, cascade='all, delete-orphan')
    fetch_history = db.relationship('FetchHistory', backref='contest', lazy=True, cascade='all, delete-orphan')
    
    def get_participants_list(self):
        """Get participants as a list."""
        if not self.participants:
            return []
        return [h.strip() for h in self.participants.split(',') if h.strip()]
    
    def set_participants_list(self, handles):
        """Set participants from a list."""
        self.participants = ','.join(handles)
    
    def get_required_solved(self):
        """Calculate the required number of problems to pass."""
        if self.min_solved_is_percent and self.total_problems > 0:
            return max(1, int(self.total_problems * self.min_solved / 100))
        return self.min_solved
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'group_id': self.group_id,
            'cf_contest_id': self.cf_contest_id,
            'name': self.name,
            'min_solved': self.min_solved,
            'min_solved_is_percent': self.min_solved_is_percent,
            'total_problems': self.total_problems,
            'required_solved': self.get_required_solved(),
            'participants': self.get_participants_list(),
            'added_at': self.added_at.isoformat() if self.added_at else None,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'last_refreshed': self.last_refreshed.isoformat() if self.last_refreshed else None,
            'result_count': len(self.results)
        }


class CachedResult(db.Model):
    """Cached result for a participant in a contest."""
    __tablename__ = 'cached_results'
    
    id = db.Column(db.Integer, primary_key=True)
    contest_id = db.Column(db.Integer, db.ForeignKey('contests.id'), nullable=False)
    handle = db.Column(db.String(50), nullable=False)
    solved_count = db.Column(db.Integer, default=0)
    passed = db.Column(db.Boolean, default=False)
    participated = db.Column(db.Boolean, default=True)  # False if never entered contest
    rank = db.Column(db.Integer, default=0)  # Contest rank (0 if not participated)
    cached_at = db.Column(db.DateTime, default=utc_now)
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'contest_id': self.contest_id,
            'handle': self.handle,
            'solved_count': self.solved_count,
            'passed': self.passed,
            'participated': self.participated,
            'rank': self.rank,
            'cached_at': self.cached_at.isoformat() if self.cached_at else utc_now().isoformat()
        }


class FetchHistory(db.Model):
    """Historical fetch data for progress tracking."""
    __tablename__ = 'fetch_history'
    
    id = db.Column(db.Integer, primary_key=True)
    contest_id = db.Column(db.Integer, db.ForeignKey('contests.id'), nullable=False)
    fetch_date = db.Column(db.Date, nullable=False)  # Date of fetch (one per day)
    passed_count = db.Column(db.Integer, default=0)
    failed_count = db.Column(db.Integer, default=0)
    not_participated_count = db.Column(db.Integer, default=0)
    total_count = db.Column(db.Integer, default=0)
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'contest_id': self.contest_id,
            'fetch_date': self.fetch_date.isoformat() if self.fetch_date else None,
            'passed_count': self.passed_count,
            'failed_count': self.failed_count,
            'not_participated_count': self.not_participated_count,
            'total_count': self.total_count
        }


def init_db(app):
    """Initialize the database with the Flask app."""
    db.init_app(app)
    with app.app_context():
        db.create_all()


