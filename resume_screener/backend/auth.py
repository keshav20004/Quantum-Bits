import os
import logging
from datetime import datetime, timezone
import json
import urllib.request
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt.algorithms import RSAAlgorithm
from sqlalchemy.orm import Session

from database import get_db
from models import User

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
CLERK_FRONTEND_API = os.getenv("CLERK_FRONTEND_API", "clerk.your-domain.com") 

# Cache the JWKS to avoid redundant external network calls per request
JWKS_CACHE = None

def get_clerk_jwks():
    global JWKS_CACHE
    if JWKS_CACHE is not None:
        return JWKS_CACHE

    try:
        # First, try to get JWKS from the secret key (Backend API) if available
        if CLERK_SECRET_KEY:
            request = urllib.request.Request(
                "https://api.clerk.com/v1/jwks",
                headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"}
            )
            with urllib.request.urlopen(request) as response:
                JWKS_CACHE = json.loads(response.read().decode())
                return JWKS_CACHE
    except Exception as e:
        logger.warning(f"Failed to fetch JWKS via Secret Key: {e}")

    # Fallback to Frontend API URL (Frontend API)
    try:
        clerk_frontend = CLERK_FRONTEND_API.replace("https://", "").replace("http://", "")
        # Remove any trailing slash
        if clerk_frontend.endswith("/"):
             clerk_frontend = clerk_frontend[:-1]

        url = f"https://{clerk_frontend}/.well-known/jwks.json"
        
        with urllib.request.urlopen(url) as response:
            JWKS_CACHE = json.loads(response.read().decode())
            return JWKS_CACHE
    except Exception as e:
        logger.warning(f"Failed to fetch JWKS via Frontend API: {e}")

    return None

def verify_clerk_token(token: str) -> Optional[dict]:
    jwks = get_clerk_jwks()
    if not jwks:
        logger.error("Could not fetch Clerk JWKS for token verification")
        return None

    try:
        unverified_header = jwt.get_unverified_header(token)
        rsa_key = {}
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                # Convert JWK to PEM format string
                rsa_key = RSAAlgorithm.from_jwk(json.dumps(key))
                break

        if rsa_key:
            payload = jwt.decode(
                token,
                key=rsa_key,
                algorithms=["RS256"],
                options={"verify_aud": False} # Frontend handles audience
            )
            return payload
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
    return None


# ── FastAPI Dependency ────────────────────
security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Extract and validate Clerk JWT → return or create User object."""
    payload = verify_clerk_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    
    clerk_id = payload.get("sub")
    if not clerk_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject ID",
        )

    # 1. Try to find by Clerk ID first
    user = db.query(User).filter(User.clerk_id == clerk_id).first()
    
    # 2. Extract email info if available in token or handle graceful degradation 
    # (Often email is stored in an 'email' claim, but this isn't guaranteed depending on Clerk config)
    # So if user not found, we create a stub user.
    if user is None:
        # Optional: We can pull email from claims if we passed them from the frontend, 
        # but the simplest robust method is just stubbing the DB row.
        email = payload.get("email") or f"{clerk_id}@clerk_user.local"
        
        # In case the user signed up *before* clerk integration via old auth,
        # they might have their email in our DB but no clerk_id. Try linking:
        existing_user_by_email = None
        if email and email != f"{clerk_id}@clerk_user.local":
            existing_user_by_email = db.query(User).filter(User.email == email).first()

        if existing_user_by_email:
            existing_user_by_email.clerk_id = clerk_id
            db.commit()
            db.refresh(existing_user_by_email)
            return existing_user_by_email
        else:
            # Create a brand new user
            new_user = User(
                clerk_id=clerk_id,
                email=email,
                name=payload.get("name") or "New User",
                password_hash="clerk_oauth_user", # Dummy string to satisfy old SQLite NOT NULL constraint
                resume_credits=3, # Starter credits
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            return new_user

    return user


# ── Credit Check ──────────────────────────
def check_credits(user: User, required: int = 1):
    """
    Raises 403 if user doesn't have enough credits.
    Unlimited plan users bypass credit check if plan hasn't expired.
    """
    if user.plan_type == "unlimited":
        if user.plan_expiry and user.plan_expiry.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc):
            return  # Unlimited and not expired

    if user.resume_credits < required:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "Insufficient credits. Please upgrade your plan.",
                "credits_remaining": user.resume_credits,
                "required": required,
            },
        )


def deduct_credits(db: Session, user: User, count: int = 1):
    """Deduct credits from user account."""
    if user.plan_type == "unlimited":
        if user.plan_expiry and user.plan_expiry.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc):
            return  # Don't deduct for active unlimited plan
    user.resume_credits = max(0, user.resume_credits - count)
    db.commit()
    db.refresh(user)
