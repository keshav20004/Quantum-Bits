import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { SignedIn, SignedOut, SignIn, useUser, useAuth, UserButton } from '@clerk/clerk-react';
import './index.css';
import PricingPage from './PricingPage';

const App = () => {
  // ── Clerk Auth hooks ─────────────────────
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { getToken } = useAuth();

  // ── Custom User profile state ─────────────
  const [userProfile, setUserProfile] = useState(null);
  const [credits, setCredits] = useState(0);
  const [showPricing, setShowPricing] = useState(false);

  // Fetch or sync user profile from backend when signed in
  useEffect(() => {
    const syncUser = async () => {
      if (isSignedIn && isLoaded) {
        try {
          const token = await getToken();
          const apiUrl = import.meta.env.VITE_API_URL || '';

          // Endpoint to get/create user profile in backend DB based on Clerk session
          const response = await axios.get(`${apiUrl}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          setUserProfile(response.data);
          setCredits(response.data.resume_credits);
        } catch (error) {
          console.error("Failed to sync user profile", error);
        }
      }
    };

    syncUser();
  }, [isSignedIn, isLoaded, getToken]);

  const handleCreditsUpdate = (newCredits, planType) => {
    setCredits(newCredits);
    if (userProfile) {
      setUserProfile(prev => ({ ...prev, resume_credits: newCredits, plan_type: planType || prev.plan_type }));
    }
  };

  // ── Mode ──────────────────────────
  const [mode, setMode] = useState('bulk'); // 'single' | 'bulk'

  // ── Single mode state ─────────────
  const [file, setFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [jdMode, setJdMode] = useState('text');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // ── Bulk mode state ───────────────
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkJdFile, setBulkJdFile] = useState(null);
  const [bulkJd, setBulkJd] = useState('');
  const [bulkJdMode, setBulkJdMode] = useState('text');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkError, setBulkError] = useState('');
  const [bulkProgress, setBulkProgress] = useState({ total: 0, processed: 0 });
  const [bulkComplete, setBulkComplete] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [threshold, setThreshold] = useState(60);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'shortlisted'
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'
  const [expandedRow, setExpandedRow] = useState(null); // index of expanded row

  const timerRef = useRef(null);

  // ── Single mode handlers ──────────
  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Please upload a valid PDF resume.');
    }
  };

  const handleJdFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setJdFile(selectedFile);
      setError('');
    } else {
      setError('Please upload a valid PDF job description.');
    }
  };

  const handleAnalyze = async () => {
    if (!file) { setError('Please select a resume.'); return; }
    if (jdMode === 'text' && !jobDescription) { setError('Please enter a job description.'); return; }
    if (jdMode === 'file' && !jdFile) { setError('Please upload a job description PDF.'); return; }

    setLoading(true);
    setResult(null);
    setError('');

    const formData = new FormData();
    formData.append('resume', file);
    if (jdMode === 'text') {
      formData.append('job_description', jobDescription);
    } else {
      formData.append('job_description_file', jdFile);
    }

    const apiUrl = import.meta.env.VITE_API_URL || '';
    try {
      const currentToken = await getToken();
      const response = await axios.post(`${apiUrl}/analyze`, formData, {
        headers: { 'Authorization': `Bearer ${currentToken}` },
      });
      setResult(response.data);
      if (response.data.credits_remaining !== undefined) {
        handleCreditsUpdate(response.data.credits_remaining);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Insufficient credits! Please upgrade your plan.');
        setShowPricing(true);
      } else {
        setError('Something went wrong. Please try again.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 75) return '#10b981';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreClass = (score) => {
    if (score >= 75) return 'high';
    if (score >= 50) return 'mid';
    return 'low';
  };

  // ── Bulk mode handlers ────────────
  const handleBulkFilesUpload = (e) => {
    const files = Array.from(e.target.files);
    const valid = files.filter(
      f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.zip')
    );
    if (valid.length === 0) {
      setBulkError('Please upload PDF or ZIP files.');
      return;
    }
    setBulkFiles(prev => [...prev, ...valid]);
    setBulkError('');
  };

  const removeBulkFile = (index) => {
    setBulkFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleBulkJdFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setBulkJdFile(selectedFile);
      setBulkError('');
    } else {
      setBulkError('Please upload a valid PDF job description.');
    }
  };

  const handleBulkAnalyze = useCallback(async () => {
    if (bulkFiles.length === 0) { setBulkError('Please upload resume files.'); return; }
    if (bulkJdMode === 'text' && !bulkJd) { setBulkError('Please enter a job description.'); return; }
    if (bulkJdMode === 'file' && !bulkJdFile) { setBulkError('Please upload a job description PDF.'); return; }

    setBulkLoading(true);
    setBulkResults([]);
    setBulkError('');
    setBulkComplete(null);
    setSessionId(null);
    setBulkProgress({ total: 0, processed: 0 });
    setElapsedTime(0);

    // Start timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const formData = new FormData();
    bulkFiles.forEach(f => formData.append('resumes', f));
    if (bulkJdMode === 'text') {
      formData.append('job_description', bulkJd);
    } else {
      formData.append('job_description_file', bulkJdFile);
    }

    const apiUrl = import.meta.env.VITE_API_URL || '';
    try {
      const currentToken = await getToken();
      const response = await fetch(`${apiUrl}/bulk-analyze`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${currentToken}` },
        body: formData,
      });

      if (response.status === 403) {
        setBulkError('Insufficient credits! Please upgrade your plan.');
        setShowPricing(true);
        setBulkLoading(false);
        clearInterval(timerRef.current);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'start') {
                setBulkProgress({ total: data.total, processed: 0 });
              } else if (data.type === 'result') {
                setBulkResults(prev => [...prev, data]);
                setBulkProgress(prev => ({ ...prev, processed: data.index }));
              } else if (data.type === 'complete') {
                setBulkComplete(data);
                setSessionId(data.session_id);
                if (data.credits_remaining !== undefined) {
                  handleCreditsUpdate(data.credits_remaining);
                }
              }
            } catch (parseErr) {
              // Skip malformed SSE data
            }
          }
        }
      }
    } catch (err) {
      setBulkError('Something went wrong during bulk analysis. Please try again.');
      console.error(err);
    } finally {
      setBulkLoading(false);
      clearInterval(timerRef.current);
    }
  }, [bulkFiles, bulkJd, bulkJdFile, bulkJdMode]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleDownloadCSV = () => {
    if (!sessionId) return;
    const apiUrl = import.meta.env.VITE_API_URL || '';
    window.open(`${apiUrl}/download-results/${sessionId}`, '_blank');
  };

  const resetBulk = () => {
    setBulkFiles([]);
    setBulkResults([]);
    setBulkComplete(null);
    setBulkProgress({ total: 0, processed: 0 });
    setElapsedTime(0);
    setSessionId(null);
    setBulkError('');
  };

  // ── Sorted & filtered results ─────
  const processedResults = bulkResults
    .filter(r => filterMode === 'all' || r.score >= threshold)
    .sort((a, b) => sortDir === 'desc' ? b.score - a.score : a.score - b.score);

  const shortlistedCount = bulkResults.filter(r => r.score >= threshold).length;
  const avgScore = bulkResults.length > 0
    ? Math.round(bulkResults.reduce((s, r) => s + (r.score || 0), 0) / bulkResults.length)
    : 0;


  // ── Upload icon SVG ───────────────
  const UploadIcon = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );

  // ── Show pricing page ──────────────
  if (showPricing) {
    return (
      <div className="app">
        <PricingPage
          user={userProfile}
          onCreditsUpdate={handleCreditsUpdate}
          onClose={() => setShowPricing(false)}
        />
      </div>
    );
  }

  // Don't render main app until clerk finishes loading
  if (!isLoaded) return <div className="appLoading">Loading...</div>;

  return (
    <>
      <SignedOut>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--slate-50)' }}>
          <SignIn routing="hash" />
        </div>
      </SignedOut>
      <SignedIn>
        <div className="app">
          {/* Navbar */}
          <nav className="navbar">
            <div className="nav-inner">
              <div className="logo">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                <span>ASR Services</span>
              </div>
              <div className="nav-actions">
                <button className="credit-badge" onClick={() => setShowPricing(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></svg>
                  {credits} Credits
                </button>
                <UserButton />
              </div>
            </div>
          </nav>

          {/* Hero */}
          <section className="hero">
            <h1>{mode === 'single' ? 'Resume ↔ JD Analyzer' : 'Bulk Resume Screening'}</h1>
            <p>
              {mode === 'single'
                ? 'Upload a resume and a job description. Get an instant match score with skill gap analysis.'
                : 'Upload hundreds of resumes + a job description. Get a ranked shortlist in minutes.'}
            </p>
            <div style={{ marginTop: '1rem' }}>
              <div className="mode-toggle">
                <button className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>Single Resume</button>
                <button className={mode === 'bulk' ? 'active' : ''} onClick={() => setMode('bulk')}>Bulk Screening</button>
              </div>
            </div>
          </section>

          {/* ── SINGLE MODE ─────────────────── */}
          {mode === 'single' && (
            <main className="main single-mode">
              <div className="panel">
                {/* Resume Upload */}
                <div className="field-group">
                  <label className="field-label">Resume (PDF)</label>
                  <label className="dropzone">
                    <input type="file" onChange={handleFileUpload} accept=".pdf" />
                    <div className="dropzone-content">
                      <UploadIcon />
                      <span>{file ? file.name : 'Click to upload or drag a PDF here'}</span>
                    </div>
                  </label>
                </div>

                {/* JD Input */}
                <div className="field-group">
                  <label className="field-label">Job Description</label>
                  <div className="toggle-bar">
                    <button className={jdMode === 'text' ? 'active' : ''} onClick={() => setJdMode('text')}>Paste text</button>
                    <button className={jdMode === 'file' ? 'active' : ''} onClick={() => setJdMode('file')}>Upload PDF</button>
                  </div>

                  {jdMode === 'text' ? (
                    <textarea
                      placeholder="Paste the job description here…"
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                    />
                  ) : (
                    <label className="dropzone compact">
                      <input type="file" onChange={handleJdFileUpload} accept=".pdf" />
                      <div className="dropzone-content">
                        <UploadIcon size={20} />
                        <span>{jdFile ? jdFile.name : 'Upload JD as PDF'}</span>
                      </div>
                    </label>
                  )}
                </div>

                {error && <div className="error-banner">{error}</div>}

                <button className="cta" onClick={handleAnalyze} disabled={loading}>
                  {loading ? (
                    <span className="loading-state">
                      <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" /></svg>
                      Analyzing…
                    </span>
                  ) : 'Analyze Match'}
                </button>
              </div>

              {/* Single Results */}
              {result && (
                <div className="panel results-panel">
                  <div className="score-ring">
                    <svg viewBox="0 0 120 120" className="ring-svg">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                      <circle
                        cx="60" cy="60" r="52" fill="none"
                        stroke={getScoreColor(result.score)}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${(result.score / 100) * 327} 327`}
                        transform="rotate(-90 60 60)"
                        className="ring-progress"
                      />
                    </svg>
                    <div className="score-text">
                      <span className="score-number">{result.score}<small>%</small></span>
                      <span className="score-caption">match</span>
                    </div>
                  </div>

                  <div className="summary-block">
                    <h2>Summary</h2>
                    <p>{result.summary}</p>
                  </div>

                  <div className="skills-columns">
                    <div className="skills-col">
                      <h3><span className="dot green"></span>Matching Skills</h3>
                      <div className="tags">
                        {result.matching_skills.map((s, i) => (
                          <span key={i} className="tag green">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div className="skills-col">
                      <h3><span className="dot red"></span>Missing Skills</h3>
                      <div className="tags">
                        {result.missing_skills.map((s, i) => (
                          <span key={i} className="tag red">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </main>
          )}

          {/* ── BULK MODE ───────────────────── */}
          {mode === 'bulk' && (
            <main className="main">
              {/* Upload Panel */}
              {!bulkLoading && !bulkComplete && (
                <div className="panel">
                  {/* Multi-file Upload */}
                  <div className="field-group">
                    <label className="field-label">Resumes (PDF or ZIP)</label>
                    <label className="dropzone bulk">
                      <input type="file" onChange={handleBulkFilesUpload} accept=".pdf,.zip" multiple />
                      <div className="dropzone-content">
                        <div className="upload-icon">
                          <UploadIcon size={24} />
                        </div>
                        <span className="upload-title">Drop resumes here or click to browse</span>
                        <span className="upload-hint">Supports multiple PDFs or a single ZIP file containing PDFs</span>
                      </div>
                    </label>

                    {bulkFiles.length > 0 && (
                      <>
                        <div className="file-count-badge">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                          {bulkFiles.length} file{bulkFiles.length > 1 ? 's' : ''} selected
                        </div>
                        <div className="file-list">
                          {bulkFiles.map((f, i) => (
                            <div key={i} className="file-list-item">
                              <span className="file-name">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                {f.name}
                              </span>
                              <button className="remove-btn" onClick={() => removeBulkFile(i)} title="Remove">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* JD Input */}
                  <div className="field-group">
                    <label className="field-label">Job Description</label>
                    <div className="toggle-bar">
                      <button className={bulkJdMode === 'text' ? 'active' : ''} onClick={() => setBulkJdMode('text')}>Paste text</button>
                      <button className={bulkJdMode === 'file' ? 'active' : ''} onClick={() => setBulkJdMode('file')}>Upload PDF</button>
                    </div>

                    {bulkJdMode === 'text' ? (
                      <textarea
                        placeholder="Paste the job description here…"
                        value={bulkJd}
                        onChange={(e) => setBulkJd(e.target.value)}
                      />
                    ) : (
                      <label className="dropzone compact">
                        <input type="file" onChange={handleBulkJdFileUpload} accept=".pdf" />
                        <div className="dropzone-content">
                          <UploadIcon size={20} />
                          <span>{bulkJdFile ? bulkJdFile.name : 'Upload JD as PDF'}</span>
                        </div>
                      </label>
                    )}
                  </div>

                  {bulkError && <div className="error-banner">{bulkError}</div>}

                  <button className="cta bulk-cta" onClick={handleBulkAnalyze} disabled={bulkLoading}>
                    <span className="loading-state">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                      Screen All Resumes
                    </span>
                  </button>
                </div>
              )}

              {/* Progress Panel */}
              {bulkLoading && (
                <div className="panel progress-section">
                  <div className="progress-header">
                    <span className="progress-title">Screening in progress…</span>
                    <span className="progress-count">{bulkProgress.processed} / {bulkProgress.total}</span>
                  </div>
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${bulkProgress.total > 0 ? (bulkProgress.processed / bulkProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="progress-meta">
                    <span className="elapsed">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                      {formatTime(elapsedTime)}
                    </span>
                    <span>
                      {bulkProgress.processed > 0 && bulkProgress.total > 0
                        ? `~${formatTime(Math.round(((bulkProgress.total - bulkProgress.processed) / bulkProgress.processed) * elapsedTime))} remaining`
                        : 'Calculating…'}
                    </span>
                  </div>
                </div>
              )}

              {/* Stats Cards */}
              {bulkResults.length > 0 && !bulkLoading && (
                <div className="stats-row">
                  <div className="stat-card">
                    <div className="stat-value">{bulkResults.length}</div>
                    <div className="stat-label">Total Processed</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value green">{shortlistedCount}</div>
                    <div className="stat-label">Shortlisted (≥{threshold}%)</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value red">{bulkResults.length - shortlistedCount}</div>
                    <div className="stat-label">Rejected</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value blue">{avgScore}%</div>
                    <div className="stat-label">Avg Score</div>
                  </div>
                </div>
              )}

              {/* Results Table */}
              {bulkResults.length > 0 && !bulkLoading && (
                <div className="panel">
                  <div className="results-toolbar">
                    <div className="toolbar-left">
                      <div className="filter-toggle">
                        <button className={filterMode === 'all' ? 'active' : ''} onClick={() => setFilterMode('all')}>All ({bulkResults.length})</button>
                        <button className={filterMode === 'shortlisted' ? 'active' : ''} onClick={() => setFilterMode('shortlisted')}>Shortlisted ({shortlistedCount})</button>
                      </div>
                      <div className="threshold-control">
                        <span>Threshold:</span>
                        <input
                          type="range"
                          min="0" max="100"
                          value={threshold}
                          onChange={(e) => setThreshold(Number(e.target.value))}
                        />
                        <span className="threshold-value">{threshold}%</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {sessionId && (
                        <button className="download-btn" onClick={handleDownloadCSV}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                          Download CSV
                        </button>
                      )}
                      <button className="download-btn" onClick={resetBulk}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                        New Screening
                      </button>
                    </div>
                  </div>

                  <div className="results-table-wrapper" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th style={{ width: '50px' }}>#</th>
                          <th>Candidate</th>
                          <th
                            className={`sorted`}
                            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                            style={{ width: '140px' }}
                          >
                            Score <span className="sort-arrow">{sortDir === 'desc' ? '▼' : '▲'}</span>
                          </th>
                          <th style={{ width: '110px' }}>Verdict</th>
                          <th>Reason</th>
                          <th style={{ width: '28px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {processedResults.map((r, i) => (
                          <React.Fragment key={i}>
                            <tr
                              onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                              style={{ cursor: 'pointer' }}
                              title="Click to see skill details"
                            >
                              <td className="rank-cell">{i + 1}</td>
                              <td className="filename-cell" title={r.filename}>{r.filename}</td>
                              <td className="score-cell">
                                <div className="score-bar-wrapper">
                                  <div className="score-bar">
                                    <div
                                      className={`score-bar-inner ${getScoreClass(r.score)}`}
                                      style={{ width: `${r.score}%` }}
                                    />
                                  </div>
                                  <span className={`score-value ${getScoreClass(r.score)}`}>{r.score}</span>
                                </div>
                              </td>
                              <td>
                                <span className={`verdict-badge ${(r.verdict || (r.score >= 70 ? 'Shortlisted' : r.score >= 50 ? 'Maybe' : 'Rejected')).toLowerCase()}`}>
                                  {r.verdict || (r.score >= 70 ? 'Shortlisted' : r.score >= 50 ? 'Maybe' : 'Rejected')}
                                </span>
                              </td>
                              <td className="reason-cell">
                                {r.reason || r.summary || '—'}
                              </td>
                              <td style={{ textAlign: 'center', color: 'var(--slate-400)', fontSize: '0.75rem' }}>
                                {expandedRow === i ? '▲' : '▼'}
                              </td>
                            </tr>
                            {expandedRow === i && (
                              <tr className="expanded-reason-row">
                                <td colSpan="6">
                                  <div className="reason-box">
                                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                                      <div style={{ flex: 1, minWidth: '200px' }}>
                                        <div className="reason-label" style={{ color: 'var(--green-600)' }}>
                                          ✅ Matching Skills
                                        </div>
                                        <div className="table-tags" style={{ marginTop: '0.4rem' }}>
                                          {(r.matching_skills || []).length > 0
                                            ? (r.matching_skills || []).map((s, j) => (
                                              <span key={j} className="tag green">{s}</span>
                                            ))
                                            : <span style={{ color: 'var(--slate-400)', fontSize: '0.8rem' }}>None found</span>
                                          }
                                        </div>
                                      </div>
                                      <div style={{ flex: 1, minWidth: '200px' }}>
                                        <div className="reason-label" style={{ color: 'var(--red-600, #dc2626)' }}>
                                          ❌ Missing Skills
                                        </div>
                                        <div className="table-tags" style={{ marginTop: '0.4rem' }}>
                                          {(r.missing_skills || []).length > 0
                                            ? (r.missing_skills || []).map((s, j) => (
                                              <span key={j} className="tag red">{s}</span>
                                            ))
                                            : <span style={{ color: 'var(--slate-400)', fontSize: '0.8rem' }}>None</span>
                                          }
                                        </div>
                                      </div>
                                    </div>
                                    {r.summary && (
                                      <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--slate-200)', paddingTop: '0.5rem' }}>
                                        <div className="reason-label">
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                          Summary
                                        </div>
                                        <p className="reason-text">{r.summary}</p>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {bulkComplete && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--green-50)', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--green-700)' }}>
                      ✅ Screening complete — {bulkComplete.processed} resumes processed in {formatTime(elapsedTime)}
                    </div>
                  )}
                </div>
              )}
            </main>
          )}

          <footer className="footer">
            <p>ASR Services</p>
          </footer>
        </div>
      </SignedIn>
    </>
  );
};

export default App;
