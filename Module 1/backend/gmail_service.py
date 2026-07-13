import os
import json
import logging
import urllib.parse
from typing import List, Dict, Any, Optional
import httpx

# Gmail API imports
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

from config import GMAIL_CREDENTIALS_PATH, GMAIL_TOKEN_PATH

logger = logging.getLogger(__name__)

# Gmail scopes required
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def load_client_secrets() -> Optional[Dict[str, Any]]:
    """Loads client ID and client secret from credentials.json."""
    if not os.path.exists(GMAIL_CREDENTIALS_PATH):
        logger.warning(f"Gmail credentials.json not found at {GMAIL_CREDENTIALS_PATH}.")
        return None
    try:
        with open(GMAIL_CREDENTIALS_PATH, 'r') as f:
            data = json.load(f)
            # Support both 'web' and 'installed' OAuth client types
            if 'web' in data:
                return data['web']
            elif 'installed' in data:
                return data['installed']
            return data
    except Exception as e:
        logger.error(f"Error reading credentials.json: {e}")
        return None

def is_gmail_connected() -> bool:
    """Checks if there are valid saved OAuth credentials."""
    if not os.path.exists(GMAIL_TOKEN_PATH):
        return False
    try:
        creds = Credentials.from_authorized_user_file(GMAIL_TOKEN_PATH, SCOPES)
        if creds and creds.valid:
            return True
        elif creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(GMAIL_TOKEN_PATH, 'w') as token:
                token.write(creds.to_json())
            return True
    except Exception as e:
        logger.error(f"Error checking Gmail connection status: {e}")
        
    return False

def get_gmail_auth_url(redirect_uri: str) -> Optional[str]:
    """Generates the Google OAuth 2.0 authorization URL manually."""
    secrets = load_client_secrets()
    if not secrets:
        return None
        
    client_id = secrets.get("client_id")
    if not client_id:
        return None
        
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent"
    }
    
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return auth_url

def save_token_from_code(code: str, redirect_uri: str) -> bool:
    """Exchanges auth code for credentials token manually via HTTP POST and saves it."""
    secrets = load_client_secrets()
    if not secrets:
        return False
        
    client_id = secrets.get("client_id")
    client_secret = secrets.get("client_secret")
    token_uri = secrets.get("token_uri", "https://oauth2.googleapis.com/token")
    
    if not client_id or not client_secret:
        return False
        
    # Standard form urlencoded data for OAuth token endpoint
    data = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }
    
    try:
        response = httpx.post(token_uri, data=data)
        if response.status_code != 200:
            logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
            return False
            
        token_data = response.json()
        
        # Build authorized user format dictionary for google-auth compatibility
        authorized_user_creds = {
            "token": token_data.get("access_token"),
            "refresh_token": token_data.get("refresh_token"),
            "token_uri": token_uri,
            "client_id": client_id,
            "client_secret": client_secret,
            "scopes": SCOPES
        }
        
        with open(GMAIL_TOKEN_PATH, 'w') as token_file:
            json.dump(authorized_user_creds, token_file, indent=2)
            
        logger.info("Gmail OAuth token saved successfully.")
        return True
    except Exception as e:
        logger.error(f"Error exchanging OAuth code: {e}")
        return False

def disconnect_gmail():
    """Removes stored tokens to disconnect Gmail integration."""
    if os.path.exists(GMAIL_TOKEN_PATH):
        os.remove(GMAIL_TOKEN_PATH)
        logger.info("Gmail OAuth token disconnected.")

def fetch_gmail_emails(max_results: int = 5, query: str = "label:INBOX") -> List[Dict[str, Any]]:
    """
    Connects to Gmail API using stored credentials and fetches
    the body, headers, and metadata of recent emails.
    """
    if not is_gmail_connected():
        logger.warning("Gmail not connected. Cannot fetch emails.")
        return []
        
    emails = []
    try:
        creds = Credentials.from_authorized_user_file(GMAIL_TOKEN_PATH, SCOPES)
        service = build('gmail', 'v1', credentials=creds)
        
        # Call the Gmail API
        results = service.users().messages().list(userId='me', q=query, maxResults=max_results).execute()
        messages = results.get('messages', [])
        
        for msg in messages:
            msg_id = msg['id']
            msg_detail = service.users().messages().get(userId='me', id=msg_id, format='full').execute()
            
            payload = msg_detail.get('payload', {})
            headers = payload.get('headers', [])
            
            # Extract header values
            subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), '(No Subject)')
            sender = next((h['value'] for h in headers if h['name'].lower() == 'from'), 'Unknown')
            date_sent = next((h['value'] for h in headers if h['name'].lower() == 'date'), '')
            
            # Extract body
            body = ""
            if 'parts' in payload:
                # Multipart emails
                for part in payload['parts']:
                    mime_type = part.get('mimeType', '')
                    if mime_type == 'text/plain' and 'data' in part.get('body', {}):
                        import base64
                        body_data = part['body']['data']
                        body += base64.urlsafe_b64decode(body_data.encode('ASCII')).decode('UTF-8')
            else:
                # Single part emails
                body_data = payload.get('body', {}).get('data', '')
                if body_data:
                    import base64
                    body = base64.urlsafe_b64decode(body_data.encode('ASCII')).decode('UTF-8')
            
            emails.append({
                "id": msg_id,
                "sender": sender,
                "subject": subject,
                "date": date_sent,
                "body": body.strip(),
                "snippet": msg_detail.get('snippet', '')
            })
            
    except Exception as e:
        logger.error(f"Error fetching emails from Gmail API: {e}")
        
    return emails

def get_default_mock_emails() -> List[Dict[str, Any]]:
    """Returns static mock emails to allow verification without OAuth setup."""
    return [
        {
            "id": "gmail_mock_101",
            "sender": "maintenance-supervisor@refinery.com",
            "subject": "Work Order WO-9942 - Emergency pump inspection",
            "date": "2026-07-10T14:30:00Z",
            "body": (
                "Hi Team,\n\n"
                "We need to execute an emergency safety inspection on Pump P-204 due to high vibration alarms. "
                "The vibration levels hit 8.5 mm/s, exceeding our operating limit of 5.0 mm/s. "
                "Please assign Engineer John Doe to perform the vibration analysis and report back as per standard API-610 regulations.\n\n"
                "Thanks,\n"
                "Dave Miller\n"
                "Maintenance Supervisor"
            ),
            "snippet": "We need to execute an emergency safety inspection on Pump P-204..."
        },
        {
            "id": "gmail_mock_102",
            "sender": "safety-officer@refinery.com",
            "subject": "Regulatory compliance alert for P-204",
            "date": "2026-07-12T09:15:00Z",
            "body": (
                "Hello,\n\n"
                "This is a reminder that Pump P-204 is overdue for its annual pressure safety calibration. "
                "Under standard OSHA-1910.119 process safety management rules, all core equipment must be "
                "calibrated and logged. Let's make sure we log this under the equipment tags correctly.\n\n"
                "Regards,\n"
                "Sarah Connor\n"
                "Lead Safety Officer"
            ),
            "snippet": "This is a reminder that Pump P-204 is overdue for safety calibration..."
        }
    ]
