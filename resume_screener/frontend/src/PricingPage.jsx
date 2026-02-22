import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';

const PLANS = [
    {
        id: 'basic',
        name: 'Basic',
        credits: 3,
        price: 99,
        duration: null,
        features: ['3 Resume Analyses', 'Single + Bulk Mode', 'CSV Export', 'Skill Matching']
    },
    {
        id: 'starter',
        name: 'Starter',
        credits: 10,
        price: 299,
        duration: null,
        popular: true,
        features: ['10 Resume Analyses', 'Single + Bulk Mode', 'CSV Export', 'Skill Matching', 'Priority Processing']
    },
    {
        id: 'pro',
        name: 'Pro',
        credits: 100,
        price: 1999,
        duration: null,
        features: ['100 Resume Analyses', 'Single + Bulk Mode', 'CSV Export', 'Skill Matching', 'Priority Processing', 'Dedicated Support']
    },
    {
        id: 'unlimited',
        name: 'Unlimited',
        credits: -1,
        price: 4999,
        duration: 30,
        features: ['Unlimited Analyses', '30 Days Access', 'Everything in Pro', 'Bulk ZIP Upload', 'API Access']
    },
];

const PricingPage = ({ user, onCreditsUpdate, onClose }) => {
    const [loading, setLoading] = useState(null);
    const [error, setError] = useState('');
    const { getToken } = useAuth();

    const apiUrl = import.meta.env.VITE_API_URL || '';

    const handleBuyPlan = async (plan) => {
        setError('');
        setLoading(plan.id);

        try {
            // 1. Create Razorpay order
            const currentToken = await getToken();

            console.log("Attempting fetch to:", `${apiUrl}/api/create-order`);
            console.log("Token starts with:", currentToken ? currentToken.substring(0, 10) : "null");

            const orderRes = await fetch(`${apiUrl}/api/create-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`,
                },
                body: JSON.stringify({ plan_id: plan.id }),
            });

            const orderData = await orderRes.json();
            if (!orderRes.ok) throw new Error(orderData.detail || 'Failed to create order');

            // 2. Open Razorpay checkout
            const options = {
                key: orderData.key_id,
                amount: orderData.amount,
                currency: orderData.currency,
                name: 'ASR Services',
                description: `${plan.name} Plan — ${plan.credits > 0 ? plan.credits + ' Credits' : '30 Days Unlimited'}`,
                order_id: orderData.order_id,
                handler: async function (response) {
                    // 3. Verify payment
                    try {
                        const currentToken = await getToken();
                        const verifyRes = await fetch(`${apiUrl}/api/verify-payment`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${currentToken}`,
                            },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                            }),
                        });

                        const verifyData = await verifyRes.json();
                        if (!verifyRes.ok) throw new Error(verifyData.detail || 'Verification failed');

                        // Update credits in parent
                        onCreditsUpdate(verifyData.credits, verifyData.plan_type);
                        alert(`🎉 Payment successful! ${plan.credits > 0 ? plan.credits + ' credits added.' : 'Unlimited access activated for 30 days.'}`);
                    } catch (err) {
                        setError('Payment received but verification failed. Contact support.');
                    }
                },
                prefill: {
                    name: user?.name || '',
                    email: user?.email || '',
                },
                theme: {
                    color: '#6366f1',
                },
                modal: {
                    ondismiss: () => setLoading(null),
                },
            };

            const razorpay = new window.Razorpay(options);
            razorpay.open();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="pricing-page">
            <div className="pricing-header">
                <div className="pricing-badge">Simple Pricing</div>
                <h2>Choose Your Plan</h2>
                <p>Instant activation via UPI, Cards, and Netbanking</p>
                {onClose && (
                    <button className="pricing-close" onClick={onClose}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                        Back to Dashboard
                    </button>
                )}
            </div>

            {error && <div className="auth-error" style={{ maxWidth: '600px', margin: '0 auto 1.5rem' }}>{error}</div>}

            <div className="pricing-grid">
                {PLANS.map((plan) => (
                    <div key={plan.id} className={`pricing-card ${plan.popular ? 'popular' : ''}`}>
                        {plan.popular && <div className="popular-badge">Most Popular</div>}
                        <div className="card-top">
                            <h3>{plan.name}</h3>
                            <div className="pricing-amount">
                                <span className="currency">₹</span>
                                <span className="price">{plan.price}</span>
                                {plan.duration ? <span className="period">/mo</span> : ''}
                            </div>
                            <div className="pricing-credits">
                                {plan.credits > 0 ? `${plan.credits} resume credits` : 'Unlimited analyses'}
                            </div>
                        </div>

                        <ul className="pricing-features">
                            {plan.features.map((f, i) => (
                                <li key={i}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="4">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    {f}
                                </li>
                            ))}
                        </ul>

                        <button
                            className={`pricing-buy ${plan.popular ? 'popular' : ''}`}
                            onClick={() => handleBuyPlan(plan)}
                            disabled={loading === plan.id}
                        >
                            {loading === plan.id ? (
                                <span className="auth-spinner"></span>
                            ) : (
                                `Get ${plan.name}`
                            )}
                        </button>
                    </div>
                ))}
            </div>

            <div className="pricing-footer-note">
                <div className="support-card">
                    <div className="support-icon">💡</div>
                    <div className="support-text">
                        <h4>Need a custom plan or bulk credits?</h4>
                        <p>Contact us at <strong>srijanbajpai24@ybl</strong> for custom requirements & enterprise support.</p>
                    </div>
                    <a href="mailto:srijanbajpai24@ybl" className="support-btn">Contact Support</a>
                </div>

                <div className="payment-security">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    <span>Secure 256-bit SSL Encrypted Payments via Razorpay</span>
                </div>
            </div>
        </div>
    );
};

export default PricingPage;
