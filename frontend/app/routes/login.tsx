import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'candidate'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    const payload = isLogin 
      ? { email: formData.email, password: formData.password }
      : formData;

    try {
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        if (isLogin) {
          localStorage.setItem('userRole', data.role);
          localStorage.setItem('username', data.username);
          
          if (data.role === 'candidate') {
            navigate('/');
          } else {
            navigate('/recruiter');
          }
        } else {
          setIsLogin(true);
          setError('Registration successful! Please login.');
          setFormData({ ...formData, password: '' });
        }
      } else {
        setError(data.error || 'An error occurred');
      }
    } catch (err) {
      setError('Network error. Please ensure backend server is running.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            🎯 AI Resume Analyzer
          </h1>
          <p className="text-purple-100 text-sm">
            Smart Resume Analysis & Ranking System
          </p>
        </div>

        <div className="p-8">
          {/* Tab Buttons */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-300 ${
                isLogin 
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-300 ${
                !isLogin 
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error/Success Message */}
          {error && (
            <div className={`mb-4 p-3 rounded-lg text-sm animate-fade-in ${
              error.includes('successful') 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required={!isLogin}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition"
                  placeholder="Choose a username"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition"
                placeholder="your.email@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none transition"
                placeholder="Enter your password"
              />
              {!isLogin && (
                <p className="text-xs text-gray-500 mt-1">
                  Minimum 6 characters
                </p>
              )}
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  I am a
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none cursor-pointer transition"
                >
                  <option value="candidate">Candidate - Upload Resume</option>
                  <option value="recruiter">Recruiter - View & Rank Resumes</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Processing...
                </span>
              ) : (
                isLogin ? 'Login to Account' : 'Create Account'
              )}
            </button>
          </form>

          {/* Additional Info */}
          <div className="mt-6 text-center text-sm text-gray-600">
            {isLogin ? (
              <p>
                Don't have an account?{' '}
                <button
                  onClick={() => setIsLogin(false)}
                  className="text-purple-600 font-semibold hover:text-purple-700"
                >
                  Sign up here
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  onClick={() => setIsLogin(true)}
                  className="text-purple-600 font-semibold hover:text-purple-700"
                >
                  Login here
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}