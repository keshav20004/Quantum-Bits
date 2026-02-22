from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
import re


# ── Disposable Email Domains (top 50 most common) ──
DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "guerrillamail.de", "grr.la",
    "guerrillamailblock.com", "sharklasers.com", "guerrillamail.net",
    "tempmail.com", "throwaway.email", "temp-mail.org", "fakeinbox.com",
    "yopmail.com", "10minutemail.com", "trashmail.com", "trashmail.net",
    "dispostable.com", "maildrop.cc", "mailnesia.com", "guerrillamail.info",
    "tempail.com", "tempr.email", "discard.email", "discardmail.com",
    "mailcatch.com", "emkei.cz", "getairmail.com", "meltmail.com",
    "getnada.com", "mintemail.com", "mohmal.com", "burnermail.io",
    "mailsac.com", "inboxkitten.com", "mailgw.com", "harakirimail.com",
    "33mail.com", "maildrop.cc", "spamgourmet.com", "mytemp.email",
    "tempinbox.com", "emailondeck.com", "crazymailing.com", "mailnull.com",
    "spamfree24.org", "binkmail.com", "spaml.com", "mailforspam.com",
    "safetymail.info", "trashymail.com", "tempmailaddress.com",
}


# ── Auth Schemas ──────────────────────────
class UserRegister(BaseModel):
    name: str
    email: str
    password: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters")
        if len(v) > 100:
            raise ValueError("Name must be at most 100 characters")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        v = v.strip().lower()
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("Enter a valid email address")
        domain = v.split("@")[1]
        if domain in DISPOSABLE_DOMAINS:
            raise ValueError("Disposable/temporary emails are not allowed. Please use a real email.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        return v.strip().lower()


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    plan_type: str
    resume_credits: int
    plan_expiry: Optional[datetime] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Plans & Payments ──────────────────────
class PlanInfo(BaseModel):
    id: str
    name: str
    credits: int  # -1 for unlimited
    price: int  # in INR
    duration_days: int  # 0 for credit-based, 30 for unlimited
    popular: bool = False


class OrderCreate(BaseModel):
    plan_id: str


class PaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
