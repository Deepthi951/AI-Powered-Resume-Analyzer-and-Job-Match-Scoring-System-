// ==================== API CONFIGURATION ====================

// API Base URL - Change this for production
const API_BASE_URL = 'http://localhost:5000';

// ==================== TYPE DEFINITIONS ====================

export interface AuthResponse {
  message: string;
  role?: string;
  username?: string;
  userId?: string;
  success?: boolean;
}

export interface ResumeUploadResponse {
  message: string;
  resumeId: string;
  filename: string;
  success: boolean;
}

export interface Resume {
  id: string;
  filename: string;
  candidateName?: string;
  candidateEmail?: string;
  jobTitle: string;
  matchScore?: number;
  uploadedAt: string;
  email?: string;
  phone?: string;
  skills?: string[];
}

export interface RankedResumesResponse {
  rankedResumes: Resume[];
  totalResumes: number;
}

export interface CheckAuthResponse {
  authenticated: boolean;
  role?: string;
  username?: string;
  userId?: string;
}

// ==================== CUSTOM ERROR CLASS ====================

export class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

// ==================== GENERIC FETCH WRAPPER ====================

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    credentials: 'include', // CRITICAL: Required for session cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);
    
    // Try to parse JSON response
    let data;
    try {
      data = await response.json();
    } catch (e) {
      // If response is not JSON, throw error
      throw new APIError(response.status, 'Invalid server response');
    }

    if (!response.ok) {
      throw new APIError(response.status, data.error || 'Request failed');
    }

    return data;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    // Network error or other issues
    console.error('API Error:', error);
    throw new APIError(0, 'Network error. Please check your connection and ensure backend is running.');
  }
}

// ==================== AUTHENTICATION API ====================

export const authAPI = {
  /**
   * Sign up a new user
   * @param username - User's username
   * @param email - User's email
   * @param password - User's password
   * @param role - User role ('candidate' or 'recruiter')
   */
  signup: async (
    username: string,
    email: string,
    password: string,
    role: 'candidate' | 'recruiter'
  ): Promise<AuthResponse> => {
    return fetchAPI<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, role }),
    });
  },

  /**
   * Login user
   * @param email - User's email
   * @param password - User's password
   */
  login: async (email: string, password: string): Promise<AuthResponse> => {
    return fetchAPI<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  /**
   * Logout current user
   */
  logout: async (): Promise<{ message: string }> => {
    return fetchAPI<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    });
  },

  /**
   * Check if user is authenticated
   */
  checkAuth: async (): Promise<CheckAuthResponse> => {
    return fetchAPI<CheckAuthResponse>('/api/auth/check');
  },
};

// ==================== CANDIDATE API ====================

export const candidateAPI = {
  /**
   * Upload resume (PDF file)
   * @param file - PDF file to upload
   * @param jobTitle - Job title for the resume
   */
  uploadResume: async (
    file: File,
    jobTitle: string
  ): Promise<ResumeUploadResponse> => {
    const formData = new FormData();
    formData.append('resume', file);
    formData.append('jobTitle', jobTitle || 'Not Specified');

    try {
      const response = await fetch(`${API_BASE_URL}/api/candidate/upload`, {
        method: 'POST',
        credentials: 'include', // CRITICAL: Required for session
        body: formData, // Don't set Content-Type header for FormData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new APIError(response.status, data.error || 'Upload failed');
      }

      return data;
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error('Upload error:', error);
      throw new APIError(0, 'Network error during upload');
    }
  },

  /**
   * Get candidate's own resumes
   */
  getMyResumes: async (): Promise<Resume[]> => {
    return fetchAPI<Resume[]>('/api/candidate/resumes');
  },

  /**
   * Delete own resume
   * @param resumeId - ID of resume to delete
   */
  deleteResume: async (resumeId: string): Promise<{ message: string }> => {
    return fetchAPI<{ message: string }>(`/api/candidate/resume/${resumeId}`, {
      method: 'DELETE',
    });
  },
};

// ==================== RECRUITER API ====================

export const recruiterAPI = {
  /**
   * Get all resumes from all candidates
   */
  getAllResumes: async (): Promise<Resume[]> => {
    return fetchAPI<Resume[]>('/api/recruiter/resumes');
  },

  /**
   * Rank resumes by job description using AI
   * @param jobDescription - Job description to match against
   */
  rankResumes: async (
    jobDescription: string
  ): Promise<RankedResumesResponse> => {
    return fetchAPI<RankedResumesResponse>('/api/recruiter/rank', {
      method: 'POST',
      body: JSON.stringify({ jobDescription }),
    });
  },
};

// ==================== RESUME API ====================

export const resumeAPI = {
  /**
   * Download resume as PDF file
   * @param resumeId - ID of resume to download
   */
  downloadResume: (resumeId: string): void => {
    window.open(`${API_BASE_URL}/api/resume/${resumeId}/download`, '_blank');
  },

  /**
   * Get resume as base64 string
   * @param resumeId - ID of resume to view
   */
  viewResume: async (
    resumeId: string
  ): Promise<{ filename: string; pdfData: string }> => {
    return fetchAPI<{ filename: string; pdfData: string }>(
      `/api/resume/${resumeId}/view`
    );
  },
};

// ==================== HEALTH CHECK API ====================

export const healthAPI = {
  /**
   * Check if backend server is running
   */
  check: async (): Promise<{
    status: string;
    message: string;
    mongodb: string;
  }> => {
    return fetchAPI('/api/health');
  },
};

// ==================== DEFAULT EXPORT ====================

/**
 * Main API object containing all API methods
 * 
 * Usage:
 * import api from './lib/api';
 * 
 * // Login
 * const result = await api.auth.login(email, password);
 * 
 * // Upload resume
 * const upload = await api.candidate.uploadResume(file, jobTitle);
 * 
 * // Rank resumes
 * const ranked = await api.recruiter.rankResumes(jobDescription);
 */
const api = {
  auth: authAPI,
  candidate: candidateAPI,
  recruiter: recruiterAPI,
  resume: resumeAPI,
  health: healthAPI,
};

export default api;

// ==================== USAGE EXAMPLES ====================

/*
EXAMPLE 1: Login
-----------------
import api from './lib/api';

try {
  const response = await api.auth.login('user@example.com', 'password123');
  console.log('Logged in as:', response.username);
  console.log('Role:', response.role);
} catch (error) {
  if (error instanceof APIError) {
    console.error('Login failed:', error.message);
  }
}

EXAMPLE 2: Upload Resume
------------------------
import api from './lib/api';

try {
  const file = document.getElementById('fileInput').files[0];
  const result = await api.candidate.uploadResume(file, 'Software Engineer');
  console.log('Resume uploaded:', result.filename);
} catch (error) {
  console.error('Upload failed:', error.message);
}

EXAMPLE 3: Rank Resumes
-----------------------
import api from './lib/api';

try {
  const jobDescription = 'Looking for Full Stack Developer with React and Node.js';
  const result = await api.recruiter.rankResumes(jobDescription);
  
  result.rankedResumes.forEach((resume, index) => {
    console.log(`${index + 1}. ${resume.candidateName} - Score: ${resume.matchScore}%`);
  });
} catch (error) {
  console.error('Ranking failed:', error.message);
}

EXAMPLE 4: Check Authentication
-------------------------------
import api from './lib/api';

const checkAuth = async () => {
  try {
    const result = await api.auth.checkAuth();
    
    if (result.authenticated) {
      console.log('User is logged in');
      console.log('Username:', result.username);
      console.log('Role:', result.role);
    } else {
      console.log('User is not logged in');
      // Redirect to login page
    }
  } catch (error) {
    console.error('Auth check failed:', error);
  }
};

EXAMPLE 5: Download Resume
--------------------------
import api from './lib/api';

// Simple download
api.resume.downloadResume('resume-id-here');

// Or with button click
<button onClick={() => api.resume.downloadResume(resumeId)}>
  Download Resume
</button>
*/