import React, { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, CheckCircle, XCircle, Brain, Loader2 } from 'lucide-react';
import './index.css';

const App = () => {
  const [file, setFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [jdMode, setJdMode] = useState('text'); // 'text' or 'file'
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

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
    if (!file) {
      setError('Please select a resume.');
      return;
    }

    if (jdMode === 'text' && !jobDescription) {
      setError('Please enter a job description.');
      return;
    }

    if (jdMode === 'file' && !jdFile) {
      setError('Please upload a job description PDF.');
      return;
    }

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

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    try {
      const response = await axios.post(`${apiUrl}/analyze`, formData);
      setResult(response.data);
    } catch (err) {
      setError('Error analyzing resume. Please check if the backend is running and your API key is configured.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1>Quantum Bits - Resume vs JD Analyzer</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem', marginLeft: '275px', fontWeight: 'bold' }}>
          Instantly match resumes with job descriptions using AI        </p>
      </motion.div>

      <div className="glass-card">
        <label className="upload-area">
          <input type="file" onChange={handleFileUpload} accept=".pdf" style={{ display: 'none' }} />
          <Upload size={48} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
          <h3>{file ? file.name : 'Upload PDF Resume'}</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Click to browse or drag and drop</p>
        </label>

        <div className="jd-toggle" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', justifyContent: 'center' }}>
          <button
            className={`btn-toggle ${jdMode === 'text' ? 'active' : ''}`}
            onClick={() => setJdMode('text')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--primary-color)',
              background: jdMode === 'text' ? 'var(--primary-color)' : 'transparent',
              color: jdMode === 'text' ? 'white' : 'var(--primary-color)',
              cursor: 'pointer'
            }}
          >
            JD Text
          </button>
          <button
            className={`btn-toggle ${jdMode === 'file' ? 'active' : ''}`}
            onClick={() => setJdMode('file')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--primary-color)',
              background: jdMode === 'file' ? 'var(--primary-color)' : 'transparent',
              color: jdMode === 'file' ? 'white' : 'var(--primary-color)',
              cursor: 'pointer'
            }}
          >
            JD PDF
          </button>
        </div>

        {jdMode === 'text' ? (
          <textarea
            className="text-area"
            placeholder="Paste Job Description here..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        ) : (
          <label className="upload-area" style={{ height: '150px' }}>
            <input type="file" onChange={handleJdFileUpload} accept=".pdf" style={{ display: 'none' }} />
            <Upload size={32} color="var(--primary-color)" style={{ marginBottom: '0.5rem' }} />
            <h4>{jdFile ? jdFile.name : 'Upload JD PDF'}</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Click to browse</p>
          </label>
        )}

        {error && <p style={{ color: '#f87171', marginTop: '1rem', textAlign: 'center' }}>{error}</p>}

        <button
          className="btn-primary"
          onClick={handleAnalyze}
          disabled={loading}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Loader2 className="animate-spin" /> Analyzing...
            </span>
          ) : (
            'Match & Score'
          )}
        </button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card animate-fade"
          >
            <div className="score-badge">
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1 }}
              >
                {result.score}%
              </motion.span>
              <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>Match Score</div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <Brain size={20} color="var(--primary-color)" /> Summary
              </h3>
              <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>{result.summary}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80' }}>
                  <CheckCircle size={18} /> Matching Skills
                </h4>
                <div className="skills-list">
                  {result.matching_skills.map((skill, i) => (
                    <span key={i} className="skill-tag skill-match">{skill}</span>
                  ))}
                </div>
              </div>
              <div>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171' }}>
                  <XCircle size={18} /> Missing Skills
                </h4>
                <div className="skills-list">
                  {result.missing_skills.map((skill, i) => (
                    <span key={i} className="skill-tag skill-missing">{skill}</span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
