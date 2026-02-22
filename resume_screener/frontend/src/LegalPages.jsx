import React from 'react';
import './index.css';

const LegalPages = ({ page, onClose }) => {

    const content = {
        privacy: {
            title: "Privacy Policy",
            body: (
                <>
                    <h3>1. Information Collection</h3>
                    <p>We collect information you provide directly to us when you create an account, use the services, or communicate with us. This includes your name, email address, and uploaded resumes/job descriptions for analysis.</p>

                    <h3>2. Use of Information</h3>
                    <p>We use the information to provide, maintain, and improve our services, process transactions, and send you related information. Your resumes are processed temporarily for analysis and are not shared with third parties for marketing purposes.</p>

                    <h3>3. Data Security</h3>
                    <p>We implement appropriate technical measures to protect your personal information. Authentication is securely handled by Clerk.</p>
                </>
            )
        },
        terms: {
            title: "Terms & Conditions",
            body: (
                <>
                    <h3>1. Acceptance of Terms</h3>
                    <p>By accessing or using our services, you agree to be bound by these Terms. If you disagree, you may not access the service.</p>

                    <h3>2. Use License</h3>
                    <p>Permission is granted to temporarily use the Service for personal or internal business purposes. You must not use the service for any illegal or unauthorized purpose.</p>

                    <h3>3. Credits and Payments</h3>
                    <p>Credits purchased via our payment gateway (Razorpay) are non-transferable. The unlimited plan is active for 30 days from the date of purchase.</p>
                </>
            )
        },
        refund: {
            title: "Refund & Cancellation Policy",
            body: (
                <>
                    <h3>1. Refunds</h3>
                    <p>Since our services involve digital credits that are consumed upon usage, we generally do not offer refunds once credits are purchased. However, if you experience technical issues preventing you from using your credits, please contact our support team within 7 days of purchase.</p>

                    <h3>2. Cancellations</h3>
                    <p>You may cancel your account at any time. Unused credits will be forfeited upon cancellation.</p>
                </>
            )
        },
        contact: {
            title: "Contact Us",
            body: (
                <>
                    <p>If you have any questions about our services, policies, or need technical support, please reach out to us:</p>
                    <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
                        <li style={{ marginBottom: '0.5rem' }}><strong>Email:</strong> support@quantumbits.com</li>
                        <li style={{ marginBottom: '0.5rem' }}><strong>Address:</strong> Quantum Bits HQ, Tech Park, India</li>
                    </ul>
                </>
            )
        }
    };

    const selected = content[page] || content.privacy;

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', background: '#1e293b', borderRadius: '12px', marginTop: '2rem', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
                <h2 style={{ margin: 0 }}>{selected.title}</h2>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                    Back
                </button>
            </div>
            <div className="legal-content" style={{ lineHeight: '1.6' }}>
                {selected.body}
            </div>
        </div>
    );
};

export default LegalPages;
