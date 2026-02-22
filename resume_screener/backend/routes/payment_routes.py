import os
import hmac
import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from database import get_db
from models import User, Transaction
from schemas import PlanInfo, OrderCreate, PaymentVerify
from auth import get_current_user

router = APIRouter(prefix="/api", tags=["payments"])

# ── Plan Definitions ──────────────────────
PLANS = {
    "basic": PlanInfo(id="basic", name="Basic", credits=3, price=99, duration_days=0),
    "starter": PlanInfo(id="starter", name="Starter", credits=10, price=299, duration_days=0, popular=True),
    "pro": PlanInfo(id="pro", name="Pro", credits=100, price=1999, duration_days=0),
    "unlimited": PlanInfo(id="unlimited", name="Unlimited", credits=-1, price=4999, duration_days=30),
}


@router.get("/plans", response_model=list[PlanInfo])
def get_plans():
    """Return available pricing plans."""
    return list(PLANS.values())


@router.post("/create-order")
def create_order(
    data: OrderCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Razorpay order for the selected plan."""
    plan = PLANS.get(data.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan")

    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")

    if not key_id or not key_secret:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")

    try:
        import razorpay
        client = razorpay.Client(auth=(key_id, key_secret))

        order = client.order.create({
            "amount": plan.price * 100,  # Razorpay expects paise
            "currency": "INR",
            "receipt": f"asr_{user.id}_{plan.id}",
            "notes": {
                "user_id": str(user.id),
                "plan_id": plan.id,
            },
        })

        # Record transaction as pending
        txn = Transaction(
            user_id=user.id,
            plan_bought=plan.id,
            amount=plan.price,
            razorpay_order_id=order["id"],
            payment_status="pending",
            credits_added=plan.credits if plan.credits > 0 else 0,
        )
        db.add(txn)
        db.commit()

        return {
            "order_id": order["id"],
            "amount": plan.price * 100,
            "currency": "INR",
            "key_id": key_id,
            "plan": plan.model_dump(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Payment error: {str(e)}")


@router.post("/verify-payment")
def verify_payment(
    data: PaymentVerify,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify Razorpay payment signature and add credits."""
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")

    # Verify signature
    message = f"{data.razorpay_order_id}|{data.razorpay_payment_id}"
    expected_signature = hmac.new(
        key_secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, data.razorpay_signature):
        raise HTTPException(status_code=400, detail="Payment verification failed")

    # Find the pending transaction
    txn = (
        db.query(Transaction)
        .filter(
            Transaction.razorpay_order_id == data.razorpay_order_id,
            Transaction.user_id == user.id,
        )
        .first()
    )

    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if txn.payment_status == "success":
        return {"message": "Payment already processed", "credits": user.resume_credits}

    # Update transaction
    txn.razorpay_payment_id = data.razorpay_payment_id
    txn.razorpay_signature = data.razorpay_signature
    txn.payment_status = "success"

    # Add credits to user
    plan = PLANS.get(txn.plan_bought)
    if plan:
        if plan.id == "unlimited":
            user.plan_type = "unlimited"
            user.plan_expiry = datetime.now(timezone.utc) + timedelta(days=30)
        else:
            user.plan_type = plan.id
            user.resume_credits += plan.credits
            txn.credits_added = plan.credits

    db.commit()
    db.refresh(user)

    return {
        "message": "Payment successful! Credits added.",
        "credits": user.resume_credits,
        "plan_type": user.plan_type,
    }


@router.post("/razorpay-webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Razorpay server-to-server webhook for async payment confirmation.
    This is a backup — primary verification happens in /verify-payment.
    """
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    expected = hmac.new(
        key_secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    import json
    payload = json.loads(body)
    event = payload.get("event", "")

    if event == "payment.captured":
        payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = payment.get("order_id")

        txn = db.query(Transaction).filter(Transaction.razorpay_order_id == order_id).first()
        if txn and txn.payment_status != "success":
            txn.razorpay_payment_id = payment.get("id")
            txn.payment_status = "success"

            user = db.query(User).filter(User.id == txn.user_id).first()
            plan = PLANS.get(txn.plan_bought)
            if user and plan:
                if plan.id == "unlimited":
                    user.plan_type = "unlimited"
                    user.plan_expiry = datetime.now(timezone.utc) + timedelta(days=30)
                else:
                    user.plan_type = plan.id
                    user.resume_credits += plan.credits
                    txn.credits_added = plan.credits
            db.commit()

    return {"status": "ok"}
