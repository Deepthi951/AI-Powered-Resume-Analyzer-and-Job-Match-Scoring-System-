// ==================== IMPORTS ====================
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const mongoose = require('mongoose');
const pdfParse = require('pdf-parse');
const natural = require('natural');
const MongoStore = require('connect-mongo');

// NEW: Multi-format support
const mammoth = require('mammoth'); // For Word documents
const Tesseract = require('tesseract.js'); // For OCR on images

// ==================== APP SETUP ====================
const app = express();
const PORT = 5000;

// ==================== MONGODB CONNECTION ====================
mongoose.connect('mongodb://localhost:27017/resume_analyzer', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// ==================== MIDDLEWARE ====================
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Configuration
app.use(session({
  secret: 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: 'mongodb://localhost:27017/resume_analyzer',
    touchAfter: 24 * 3600
  }),
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ==================== MULTER CONFIGURATION (UPDATED) ====================
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 16 * 1024 * 1024 }, // 16MB
  fileFilter: (req, file, cb) => {
    // Accept PDF, DOC, DOCX, and images
    const allowedTypes = [
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff',
      'image/bmp'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, and image files (JPG, PNG) are allowed'));
    }
  }
});

// ==================== MONGOOSE SCHEMAS ====================
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['candidate', 'recruiter'], required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const resumeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filename: { type: String, required: true },
  pdfData: { type: Buffer, required: true },
  extractedText: { type: String, required: true },
  jobTitle: { type: String, default: 'Not Specified' },
  uploadedAt: { type: Date, default: Date.now }
});

const Resume = mongoose.model('Resume', resumeSchema);

// ==================== TEXT EXTRACTION HELPER FUNCTIONS ====================

// Extract text from Word documents
async function extractTextFromWord(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer: buffer });
    return result.value;
  } catch (error) {
    console.error('Word extraction error:', error);
    throw new Error('Failed to extract text from Word document');
  }
}

// Extract text from images using OCR
async function extractTextFromImage(buffer) {
  try {
    console.log('🔍 Starting OCR text extraction from image...');
    console.log('⏳ This may take 30-60 seconds...');
    
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log('OCR Progress:', Math.round(m.progress * 100) + '%');
        }
      }
    });
    
    console.log('✅ OCR completed');
    return text;
  } catch (error) {
    console.error('OCR error:', error);
    throw new Error('Failed to extract text from image using OCR');
  }
}

// Universal text extractor based on file type
async function extractTextFromFile(buffer, mimetype, filename) {
  console.log(`📄 Extracting text from: ${filename} (${mimetype})`);
  
  try {
    // PDF files
    if (mimetype === 'application/pdf') {
      const pdfData = await pdfParse(buffer);
      return pdfData.text;
    }
    
    // Word documents (.doc, .docx)
    else if (mimetype === 'application/msword' || 
             mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await extractTextFromWord(buffer);
    }
    
    // Images (JPG, PNG, etc.) - Use OCR
    else if (mimetype.startsWith('image/')) {
      return await extractTextFromImage(buffer);
    }
    
    else {
      throw new Error('Unsupported file type');
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    throw error;
  }
}

// ==================== OTHER HELPER FUNCTIONS ====================

function extractContactInfo(text) {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const phoneRegex = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  
  const emails = text.match(emailRegex) || [];
  const phones = text.match(phoneRegex) || [];
  
  return {
    email: emails[0] || 'N/A',
    phone: phones[0] || 'N/A'
  };
}

function extractSkills(text) {
  const commonSkills = [
    'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'ruby', 'php', 'swift', 'kotlin',
    'react', 'angular', 'vue', 'svelte', 'nextjs', 'gatsby', 'redux',
    'nodejs', 'node.js', 'express', 'nestjs', 'django', 'flask', 'spring', 'laravel',
    'mongodb', 'mysql', 'postgresql', 'redis', 'dynamodb', 'cassandra', 'sql', 'nosql',
    'aws', 'azure', 'gcp', 'google cloud', 'heroku', 'digitalocean',
    'docker', 'kubernetes', 'jenkins', 'gitlab ci', 'github actions', 'terraform', 'ansible',
    'git', 'github', 'bitbucket', 'jira', 'confluence',
    'html', 'css', 'sass', 'less', 'bootstrap', 'tailwind', 'material-ui',
    'rest api', 'graphql', 'grpc', 'soap', 'websocket',
    'microservices', 'serverless', 'devops', 'ci/cd', 'agile', 'scrum', 'kanban',
    'machine learning', 'deep learning', 'ai', 'data science', 'tensorflow', 'pytorch', 'keras',
    'pandas', 'numpy', 'scikit-learn', 'opencv',
    'testing', 'jest', 'mocha', 'pytest', 'junit', 'selenium', 'cypress',
    'linux', 'unix', 'bash', 'shell scripting', 'windows', 'macos'
  ];
  
  const textLower = text.toLowerCase();
  const foundSkills = commonSkills.filter(skill => textLower.includes(skill));
  
  return [...new Set(foundSkills)].slice(0, 12);
}

function calculateMatchScore(resumeText, jobDescription) {
  try {
    if (!resumeText || !jobDescription) return 0;

    const tfidf = new natural.TfIdf();
    tfidf.addDocument(resumeText.toLowerCase());
    tfidf.addDocument(jobDescription.toLowerCase());

    const terms1 = [];
    const terms2 = [];
    
    tfidf.listTerms(0).forEach(item => {
      terms1.push({ term: item.term, tfidf: item.tfidf });
    });
    
    tfidf.listTerms(1).forEach(item => {
      terms2.push({ term: item.term, tfidf: item.tfidf });
    });

    const allTerms = [...new Set([
      ...terms1.map(t => t.term),
      ...terms2.map(t => t.term)
    ])];

    const vector1 = allTerms.map(term => {
      const found = terms1.find(t => t.term === term);
      return found ? found.tfidf : 0;
    });

    const vector2 = allTerms.map(term => {
      const found = terms2.find(t => t.term === term);
      return found ? found.tfidf : 0;
    });

    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    const similarity = dotProduct / (magnitude1 * magnitude2);
    return Math.round(similarity * 100 * 100) / 100;
  } catch (error) {
    console.error('Error calculating match score:', error);
    return 0;
  }
}

// ==================== AUTHENTICATION MIDDLEWARE ====================

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized - Please login' });
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.session.role !== role) {
      return res.status(403).json({ error: 'Access denied - Insufficient permissions' });
    }
    next();
  };
}

// ==================== AUTHENTICATION ROUTES ====================

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['candidate', 'recruiter'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role
    });

    await newUser.save();

    res.status(201).json({ 
      message: 'Registration successful! Please login.',
      success: true 
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    req.session.userId = user._id;
    req.session.role = user.role;
    req.session.username = user.username;

    res.json({
      message: 'Login successful',
      role: user.role,
      username: user.username,
      userId: user._id
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

app.get('/api/auth/check', (req, res) => {
  if (req.session.userId) {
    res.json({
      authenticated: true,
      role: req.session.role,
      username: req.session.username,
      userId: req.session.userId
    });
  } else {
    res.json({ authenticated: false });
  }
});

// ==================== CANDIDATE ROUTES ====================

// Upload Resume (UPDATED - Multi-format support)
app.post('/api/candidate/upload', requireAuth, requireRole('candidate'), upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { jobTitle } = req.body;

    console.log('📤 File upload started');
    console.log('📋 Filename:', req.file.originalname);
    console.log('📊 File size:', req.file.size, 'bytes');
    console.log('📝 File type:', req.file.mimetype);

    // Extract text from file (supports PDF, DOC, DOCX, Images)
    let extractedText = '';
    
    try {
      extractedText = await extractTextFromFile(
        req.file.buffer, 
        req.file.mimetype, 
        req.file.originalname
      );
      
      console.log('✅ Text extracted successfully');
      console.log('📝 Text length:', extractedText.length, 'characters');
      
      // Show preview
      if (extractedText.length > 0) {
        console.log('📄 Text preview:', extractedText.substring(0, 200) + '...');
      }
      
    } catch (extractError) {
      console.error('❌ Text extraction failed:', extractError.message);
      
      // Special message for images
      if (req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ 
          error: 'OCR text extraction failed. Please ensure:\n' +
                 '1. Image is clear and readable\n' +
                 '2. Text is not too small\n' +
                 '3. Image is not rotated\n' +
                 'Or try uploading a PDF or Word document instead.'
        });
      } else {
        return res.status(400).json({ 
          error: `Failed to extract text: ${extractError.message}` 
        });
      }
    }

    // Validate extracted text
    if (!extractedText || extractedText.trim().length < 50) {
      console.log('⚠️ Warning: Very little text extracted');
      return res.status(400).json({ 
        error: 'Could not extract sufficient text from file.\n' +
               'Extracted: ' + (extractedText?.length || 0) + ' characters\n\n' +
               'Tips:\n' +
               '• Use text-based PDF (not scanned)\n' +
               '• Ensure Word document contains text\n' +
               '• For images, ensure text is clear and readable'
      });
    }

    console.log('💾 Saving to MongoDB...');

    // Save to MongoDB
    const newResume = new Resume({
      userId: req.session.userId,
      filename: req.file.originalname,
      pdfData: req.file.buffer,
      extractedText: extractedText,
      jobTitle: jobTitle || 'Not Specified'
    });

    await newResume.save();

    console.log('✅ Resume saved successfully with ID:', newResume._id);

    res.status(201).json({
      message: 'Resume uploaded successfully',
      resumeId: newResume._id,
      filename: newResume.filename,
      fileType: req.file.mimetype,
      textLength: extractedText.length,
      success: true
    });
    
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload resume: ' + error.message 
    });
  }
});

// Get Candidate's Resumes
app.get('/api/candidate/resumes', requireAuth, requireRole('candidate'), async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.session.userId })
      .select('filename jobTitle uploadedAt')
      .sort({ uploadedAt: -1 });

    res.json(resumes.map(r => ({
      id: r._id,
      filename: r.filename,
      jobTitle: r.jobTitle,
      uploadedAt: r.uploadedAt
    })));
  } catch (error) {
    console.error('Fetch resumes error:', error);
    res.status(500).json({ error: 'Failed to fetch resumes' });
  }
});

// Analyze Resume (NEW - AI Analysis)
app.get('/api/candidate/analyze/:id', requireAuth, requireRole('candidate'), async (req, res) => {
  try {
    const resume = await Resume.findOne({
      _id: req.params.id,
      userId: req.session.userId
    });

    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    const text = resume.extractedText;

    if (!text || text.length < 100) {
      return res.status(400).json({ 
        error: 'Cannot analyze: Resume text not extracted properly' 
      });
    }

    // Calculate ATS Score
    let atsScore = 50;

    const hasEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i.test(text);
    const hasPhone = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(text);
    if (hasEmail) atsScore += 5;
    if (hasPhone) atsScore += 5;

    const hasSummary = /summary|objective|about|profile/i.test(text);
    const hasExperience = /experience|employment|work history/i.test(text);
    const hasEducation = /education|degree|university|college/i.test(text);
    const hasSkills = /skills|technical|technologies|tools/i.test(text);

    if (hasSummary) atsScore += 5;
    if (hasExperience) atsScore += 10;
    if (hasEducation) atsScore += 5;
    if (hasSkills) atsScore += 10;

    const actionVerbs = ['developed', 'created', 'managed', 'led', 'implemented', 'designed', 'built', 'improved', 'increased', 'reduced'];
    const actionVerbCount = actionVerbs.filter(verb => new RegExp(verb, 'i').test(text)).length;
    atsScore += Math.min(actionVerbCount * 2, 10);

    const hasNumbers = /\d+%|\d+\+|\$\d+|[0-9]+/.test(text);
    if (hasNumbers) atsScore += 5;

    atsScore = Math.min(atsScore, 100);

    const skills = extractSkills(text);

    // Generate strengths
    const strengths = [];
    if (hasEmail && hasPhone) strengths.push('Complete contact information provided');
    if (hasExperience) strengths.push('Work experience section is present');
    if (hasSkills) strengths.push('Technical skills are clearly listed');
    if (skills.length >= 5) strengths.push(`Strong technical profile with ${skills.length} identified skills`);
    if (actionVerbCount >= 3) strengths.push('Uses strong action verbs');
    if (hasNumbers) strengths.push('Includes quantifiable achievements');

    // Generate improvements
    const improvements = [];
    if (!hasEmail || !hasPhone) improvements.push('Add complete contact information');
    if (!hasSummary) improvements.push('Include a professional summary');
    if (!hasExperience) improvements.push('Add work experience section');
    if (!hasEducation) improvements.push('Include education background');
    if (!hasSkills) improvements.push('Create a dedicated skills section');
    if (skills.length < 5) improvements.push('List more relevant technical skills');
    if (actionVerbCount < 3) improvements.push('Use more action verbs');
    if (!hasNumbers) improvements.push('Add quantifiable achievements');
    
    if (improvements.length === 0) {
      improvements.push('Tailor resume for specific job descriptions');
      improvements.push('Keep skills section updated');
    }

    // Extract keywords
    const words = text.toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const wordFreq = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    const stopWords = ['this', 'that', 'with', 'from', 'have', 'been', 'were', 'they', 'your', 'will'];
    const keywords = Object.entries(wordFreq)
      .filter(([word]) => !stopWords.includes(word))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);

    const analysis = {
      atsScore: atsScore,
      strengths: strengths.slice(0, 5),
      improvements: improvements.slice(0, 5),
      skills: skills,
      keywords: keywords
    };

    res.json({ analysis });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze resume' });
  }
});

// Delete Resume
app.delete('/api/candidate/resume/:id', requireAuth, requireRole('candidate'), async (req, res) => {
  try {
    const resume = await Resume.findOne({ 
      _id: req.params.id, 
      userId: req.session.userId 
    });

    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    await Resume.deleteOne({ _id: req.params.id });
    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete resume' });
  }
});

// ==================== RECRUITER ROUTES ====================

app.get('/api/recruiter/resumes', requireAuth, requireRole('recruiter'), async (req, res) => {
  try {
    const resumes = await Resume.find()
      .populate('userId', 'username email')
      .sort({ uploadedAt: -1 });

    const formattedResumes = resumes.map(r => {
      const contactInfo = extractContactInfo(r.extractedText);
      const skills = extractSkills(r.extractedText);

      return {
        id: r._id,
        filename: r.filename,
        candidateName: r.userId.username,
        candidateEmail: r.userId.email,
        jobTitle: r.jobTitle,
        uploadedAt: r.uploadedAt,
        email: contactInfo.email,
        phone: contactInfo.phone,
        skills: skills
      };
    });

    res.json(formattedResumes);
  } catch (error) {
    console.error('Fetch all resumes error:', error);
    res.status(500).json({ error: 'Failed to fetch resumes' });
  }
});

app.post('/api/recruiter/rank', requireAuth, requireRole('recruiter'), async (req, res) => {
  try {
    const { jobDescription } = req.body;

    if (!jobDescription || jobDescription.trim().length === 0) {
      return res.status(400).json({ error: 'Job description is required' });
    }

    const resumes = await Resume.find().populate('userId', 'username email');

    const rankedResumes = resumes.map(r => {
      const matchScore = calculateMatchScore(r.extractedText, jobDescription);
      const contactInfo = extractContactInfo(r.extractedText);
      const skills = extractSkills(r.extractedText);

      return {
        id: r._id,
        filename: r.filename,
        candidateName: r.userId.username,
        candidateEmail: r.userId.email,
        jobTitle: r.jobTitle,
        matchScore: matchScore,
        uploadedAt: r.uploadedAt,
        email: contactInfo.email,
        phone: contactInfo.phone,
        skills: skills
      };
    });

    rankedResumes.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      rankedResumes: rankedResumes,
      totalResumes: rankedResumes.length
    });
  } catch (error) {
    console.error('Rank resumes error:', error);
    res.status(500).json({ error: 'Failed to rank resumes' });
  }
});

// ==================== COMMON ROUTES ====================

app.get('/api/resume/:id/download', requireAuth, async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);

    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    if (req.session.role === 'candidate' && resume.userId.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${resume.filename}"`);
    res.send(resume.pdfData);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download resume' });
  }
});

app.get('/api/resume/:id/view', requireAuth, async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);

    if (!resume) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    if (req.session.role === 'candidate' && resume.userId.toString() !== req.session.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      filename: resume.filename,
      pdfData: resume.pdfData.toString('base64')
    });
  } catch (error) {
    console.error('View error:', error);
    res.status(500).json({ error: 'Failed to view resume' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Disconnected ❌'}`);
  console.log(`\n📋 Supported File Formats:`);
  console.log(`   ✅ PDF files (.pdf)`);
  console.log(`   ✅ Word documents (.doc, .docx)`);
  console.log(`   ✅ Images (.jpg, .png) with OCR`);
  console.log(`\n📋 Available Endpoints:`);
  console.log(`   POST   /api/auth/signup`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   POST   /api/auth/logout`);
  console.log(`   GET    /api/auth/check`);
  console.log(`   POST   /api/candidate/upload`);
  console.log(`   GET    /api/candidate/resumes`);
  console.log(`   GET    /api/candidate/analyze/:id`);
  console.log(`   GET    /api/recruiter/resumes`);
  console.log(`   POST   /api/recruiter/rank`);
  console.log(`   GET    /api/resume/:id/download`);
  console.log(`   GET    /api/health\n`);
});