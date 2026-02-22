import React from 'react';
import { SignInButton } from '@clerk/clerk-react';
import './LandingPage.css';

const LandingPage = () => {
    return (
        <div className="landing-page">
            <nav className="landing-nav">
                <div className="landing-logo">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                    <span>ASR Services</span>
                </div>
                <div className="landing-nav-actions">
                    <SignInButton mode="modal">
                        <button className="login-btn">Log in</button>
                    </SignInButton>
                    <SignInButton mode="modal">
                        <button className="signup-btn">Get Started</button>
                    </SignInButton>
                </div>
            </nav>

            <main className="landing-main">
                <div className="hero-section">
                    <div className="badge">✨ The Future of Hiring</div>
                    <h1 className="hero-title">
                        Screen Resumes <br /> <span className="highlight">10x Faster</span> with AI
                    </h1>
                    <p className="hero-subtitle">
                        Upload hundreds of resumes, paste your job description, and incredibly accurate AI matching will instantly highlight your top candidates. Stop reading every PDF.
                    </p>
                    <div className="hero-cta-group">
                        <SignInButton mode="modal">
                            <button className="primary-cta">Start Free Trial</button>
                        </SignInButton>
                        <span className="no-cc">No credit card required.</span>
                    </div>
                </div>

                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                        <h3>Skill Gap Analysis</h3>
                        <p>Instantly see exactly what skills a candidate matches, and what they are missing compared to your JD.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        </div>
                        <h3>Smart Ranking</h3>
                        <p>Sort candidates by a 0-100 compatibility score. Know immediately who you should interview first.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                        </div>
                        <h3>Bulk Operations</h3>
                        <p>Upload a single ZIP file with 500 resumes. Let our infrastructure handle the massive parallel processing.</p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default LandingPage;
