"""Configuration management for Codeforces Tracker."""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """Application configuration."""
    
    # Flask settings
    SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')
    
    # Database settings
    SQLALCHEMY_DATABASE_URI = 'sqlite:///cf_tracker.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Codeforces API settings (optional)
    CF_API_KEY = os.getenv('CF_API_KEY', '')
    CF_API_SECRET = os.getenv('CF_API_SECRET', '')
    
    # API rate limiting (Codeforces allows ~5 requests per second for authenticated users)
    CF_REQUEST_DELAY = 0.5  # seconds between API calls
