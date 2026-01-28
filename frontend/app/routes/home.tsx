// app/routes/home.tsx
// Complete candidate page with multi-format resume upload support

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

interface AnalysisResult {
  atsScore: number;
  strengths: string[];
  improvements: string[];
  skills: string[];
  keywords: string[];
}

interface MyResume {
  id: string;
  filename: string;
  jobTitle: string;
  uploadedAt: string;
  analysis?: AnalysisResult;
}

export default function Home() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [myResumes, setMyResumes] = useState<MyResume[]>([]);
  const [selectedResume, setSelectedResume] = useState<MyResume | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/auth/check', {
        credentials: 'include'
      });
      const data = await res.json();
      
      if (!data.authenticated) {
        navigate('/login');
        return;
      }
      
      if (data.role === 'recruiter') {
        navigate('/recruiter');
        return;
      }
      
      setUsername(data.username);
      await fetchMyResumes();
      setLoading(false);
    } catch (error) {
      console.error('Auth check failed:', error);
      navigate('/login');
    }
  };

  const fetchMyResumes = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/candidate/resumes', {
        credentials: 'include'
      });
      const data = await res.json();
      setMyResumes(data);
    } catch (error) {
      console.error('Failed to fetch resumes:', error);
    }
  };

  const analyzeResume = async (resumeId: string) => {
    setAnalyzing(true);
    try {
      const res = await fetch(`http://localhost:5000/api/candidate/analyze/${resumeId}`, {
        credentials: 'include'
      });
      const data = await res.json();
      
      if (res.ok) {
        setSelectedResume({
          ...myResumes.find(r => r.id === resumeId)!,
          analysis: data.analysis
        });
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Analysis failed. Make sure resume text was extracted properly.');
    }
    setAnalyzing(false);
  };

  const handleLogout = async () => {
    await fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    localStorage.clear();
    navigate('/login');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('Uploading...');
    setUploading(true);

    // Updated validation - accept PDF, Word docs, and images
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      setUploadStatus('❌ Error: Please upload PDF, Word (.doc/.docx), or Image (.jpg/.png) files only');
      setUploading(false);
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      setUploadStatus('❌ Error: File too large (max 16MB)');
      setUploading(false);
      return;
    }

    // Show special message for images (OCR takes time)
    if (fileExtension === '.jpg' || fileExtension === '.jpeg' || fileExtension === '.png') {
      setUploadStatus('⏳ Uploading image... OCR text extraction may take 30-60 seconds');
    }

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('jobTitle', 'Software Engineer');

    try {
      const res = await fetch('http://localhost:5000/api/candidate/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await res.json();
      
      if (res.ok) {
        setUploadStatus(`✅ Resume uploaded successfully! (${data.fileType})`);
        await fetchMyResumes();
        e.target.value = '';
      } else {
        setUploadStatus('❌ Upload failed: ' + data.error);
      }
    } catch (error) {
      setUploadStatus('❌ Network error!');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-700">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-xl font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700">
      {/* Header */}
      <header className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              🎯 AI Resume Analyzer
            </h1>
            <p className="text-sm text-gray-600 mt-1">Candidate Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">Welcome back,</p>
              <p className="font-semibold text-gray-700">{username}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-semibold"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Upload & My Resumes */}
        <div className="space-y-6">
          {/* Upload Section */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              📄 Upload Your Resume
            </h2>
            
            {uploadStatus && (
              <div className={`mb-4 p-4 rounded-lg ${
                uploadStatus.includes('✅') 
                  ? 'bg-green-50 border-2 border-green-200 text-green-700' 
                  : uploadStatus.includes('❌')
                  ? 'bg-red-50 border-2 border-red-200 text-red-700'
                  : 'bg-blue-50 border-2 border-blue-200 text-blue-700'
              }`}>
                <p className="font-semibold whitespace-pre-line">{uploadStatus}</p>
              </div>
            )}
            
            <div className="border-2 border-dashed border-purple-300 rounded-xl p-8 text-center hover:border-purple-500 transition">
              <svg className="w-12 h-12 text-purple-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Upload Resume
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                PDF, Word (.doc/.docx), or Images (.jpg/.png)
              </p>
              
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/jpg,image/png"
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
                id="fileInput"
              />
              <label
                htmlFor="fileInput"
                className={`inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold cursor-pointer hover:opacity-90 transition ${
                  uploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {uploading ? '⏳ Uploading...' : '📁 Choose File'}
              </label>
              
              <div className="mt-4 text-xs text-gray-400">
                <p>✅ PDF files (recommended)</p>
                <p>✅ Word documents (.doc, .docx)</p>
                <p>✅ Images (.jpg, .png) - OCR enabled</p>
                <p className="mt-2 text-gray-500">Max size: 16MB</p>
              </div>
            </div>
          </div>

          {/* My Resumes Section */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              📋 My Uploaded Resumes ({myResumes.length})
            </h2>
            
            {myResumes.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No resumes uploaded yet. Upload one to get started!
              </p>
            ) : (
              <div className="space-y-3">
                {myResumes.map((resume) => (
                  <div
                    key={resume.id}
                    className="border-2 border-gray-200 rounded-lg p-4 hover:border-purple-400 transition cursor-pointer"
                    onClick={() => analyzeResume(resume.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-800">{resume.filename}</h3>
                        <p className="text-sm text-gray-500">Job: {resume.jobTitle}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(resume.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-200">
                        Analyze
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Analysis Results */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            🤖 AI Resume Analysis
          </h2>

          {analyzing ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Analyzing your resume...</p>
            </div>
          ) : !selectedResume ? (
            <div className="text-center py-12">
              <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500">
                Click "Analyze" on any resume to see detailed feedback
              </p>
            </div>
          ) : selectedResume.analysis ? (
            <div className="space-y-6">
              {/* ATS Score */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border-2 border-purple-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">ATS Score</h3>
                <div className="flex items-center gap-4">
                  <div className="text-5xl font-bold text-purple-600">
                    {selectedResume.analysis.atsScore}%
                  </div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 h-4 rounded-full transition-all"
                        style={{ width: `${selectedResume.analysis.atsScore}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      {selectedResume.analysis.atsScore >= 80 ? 'Excellent!' :
                       selectedResume.analysis.atsScore >= 60 ? 'Good' : 'Needs Improvement'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Strengths */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span>✅</span> Strengths
                </h3>
                <ul className="space-y-2">
                  {selectedResume.analysis.strengths.map((strength, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-green-500 mt-0.5">•</span>
                      {strength}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Improvements */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <span>💡</span> Suggestions for Improvement
                </h3>
                <ul className="space-y-2">
                  {selectedResume.analysis.improvements.map((improvement, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-orange-500 mt-0.5">•</span>
                      {improvement}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Skills & Keywords */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  🔑 Detected Skills & Keywords
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[...selectedResume.analysis.skills, ...selectedResume.analysis.keywords].map((skill, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-red-500">
                ❌ Could not analyze this resume. Text extraction may have failed.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Try uploading a text-based PDF or Word document (not scanned).
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}