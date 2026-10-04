"""Codeforces API client."""
import hashlib
import time
import random
import string
import requests
from config import Config


class CodeforcesAPI:
    """Client for interacting with the Codeforces API."""
    
    BASE_URL = 'https://codeforces.com/api'
    
    def __init__(self):
        self.api_key = Config.CF_API_KEY
        self.api_secret = Config.CF_API_SECRET
        self.last_request_time = 0
    
    def _generate_api_sig(self, method, params):
        """Generate API signature for authenticated requests."""
        if not self.api_key or not self.api_secret:
            return None
        
        # Generate random 6-character string
        rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        
        # Sort parameters and build query string
        sorted_params = sorted(params.items())
        param_str = '&'.join(f'{k}={v}' for k, v in sorted_params)
        
        # Build signature string
        sig_str = f'{rand}/{method}?{param_str}#{self.api_secret}'
        
        # Generate SHA512 hash
        hash_sig = hashlib.sha512(sig_str.encode()).hexdigest()
        
        return f'{rand}{hash_sig}'
    
    def _rate_limit(self):
        """Ensure we don't exceed API rate limits."""
        elapsed = time.time() - self.last_request_time
        if elapsed < Config.CF_REQUEST_DELAY:
            time.sleep(Config.CF_REQUEST_DELAY - elapsed)
        self.last_request_time = time.time()
    
    def _make_request(self, method, params=None):
        """Make a request to the Codeforces API."""
        self._rate_limit()
        
        if params is None:
            params = {}
        
        # Add authentication if available
        if self.api_key and self.api_secret:
            params['apiKey'] = self.api_key
            params['time'] = int(time.time())
            api_sig = self._generate_api_sig(method, params)
            if api_sig:
                params['apiSig'] = api_sig
        
        url = f'{self.BASE_URL}/{method}'
        
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            if data.get('status') == 'OK':
                return {'success': True, 'result': data.get('result')}
            else:
                return {'success': False, 'error': data.get('comment', 'Unknown error')}
        except requests.exceptions.RequestException as e:
            return {'success': False, 'error': str(e)}
        except ValueError:
            return {'success': False, 'error': 'Invalid JSON response'}
    
    def get_contest_list(self, gym=False):
        """Get list of all contests.
        
        Args:
            gym: If True, return gym contests; otherwise return regular contests.
        
        Returns:
            List of contest objects or error dict.
        """
        params = {'gym': str(gym).lower()}
        return self._make_request('contest.list', params)
    
    def get_contest_standings(self, contest_id, handles=None, show_unofficial=True):
        """Get contest standings for specific handles.
        
        Args:
            contest_id: Codeforces contest ID.
            handles: List of handles to filter (optional).
            show_unofficial: Whether to include unofficial participants.
        
        Returns:
            Contest standings data or error dict.
        """
        params = {
            'contestId': contest_id,
            'showUnofficial': str(show_unofficial).lower()
        }
        
        if handles:
            # Codeforces API accepts semicolon-separated handles
            params['handles'] = ';'.join(handles)
        
        return self._make_request('contest.standings', params)
    
    def get_user_info(self, handles):
        """Get information about users.
        
        Args:
            handles: List of user handles.
        
        Returns:
            List of user info objects or error dict.
        """
        if not handles:
            return {'success': False, 'error': 'No handles provided'}
        
        params = {'handles': ';'.join(handles)}
        return self._make_request('user.info', params)
    
    def get_user_status(self, handle, count=None):
        """Get user's submission history.
        
        Args:
            handle: User handle.
            count: Number of submissions to return (optional).
        
        Returns:
            List of submissions or error dict.
        """
        params = {'handle': handle}
        if count:
            params['count'] = count
        
        return self._make_request('user.status', params)
    
    def calculate_solved_count(self, standings_result, handle):
        """Calculate how many problems a user solved in a contest.
        
        Args:
            standings_result: Result from get_contest_standings.
            handle: User handle to check.
        
        Returns:
            Number of solved problems, or -1 if user not found.
        """
        data = self.get_participant_data(standings_result, handle)
        return data['solved_count'] if data['participated'] else -1
    
    def get_participant_data(self, standings_result, handle):
        """Get comprehensive data for a participant in a contest.
        
        Args:
            standings_result: Result from get_contest_standings.
            handle: User handle to check.
        
        Returns:
            Dict with solved_count, rank, participated status.
        """
        default_result = {
            'solved_count': 0,
            'rank': 0,
            'participated': False
        }
        
        if not standings_result.get('success'):
            return default_result
        
        result = standings_result.get('result', {})
        rows = result.get('rows', [])
        
        for row in rows:
            party = row.get('party', {})
            members = party.get('members', [])
            
            for member in members:
                if member.get('handle', '').lower() == handle.lower():
                    # Count solved problems
                    problem_results = row.get('problemResults', [])
                    solved = sum(1 for pr in problem_results if pr.get('points', 0) > 0)
                    rank = row.get('rank', 0)
                    
                    return {
                        'solved_count': solved,
                        'rank': rank,
                        'participated': True
                    }
        
        return default_result  # User not found in standings


# Singleton instance
cf_api = CodeforcesAPI()
