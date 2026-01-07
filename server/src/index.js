require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');

const app = express();

// =================== ENHANCED CORS CONFIGURATION ===================
const allowedOrigins = [
  'https://fipay.onrender.com',
  'https://fipaybank.onrender.com',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:3000',
  'https://admin.fipay.onrender.com',
  'https://*.render.com',
  'http://localhost:*'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      console.log('[CORS] No origin - allowing');
      return callback(null, true);
    }
    
    if (
      origin.includes('render.com') || 
      origin.includes('localhost') || 
      origin.includes('127.0.0.1')
    ) {
      console.log('[CORS] Allowing development origin:', origin);
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      console.log('[CORS] Allowed origin:', origin);
      return callback(null, true);
    }
    
    console.error('[CORS] Blocked origin:', origin);
    return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'x-user-id', 
    'user-id', 
    'X-Requested-With', 
    'Accept',
    'Origin',
    'Cache-Control'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'Content-Length'],
  optionsSuccessStatus: 200,
  maxAge: 86400,
  preflightContinue: false
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// =================== LOGGING MIDDLEWARE ===================
app.use((req, res, next) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('  Origin:', req.headers.origin);
  console.log('  x-user-id:', req.headers['x-user-id']);
  console.log('  user-id:', req.headers['user-id']);
  next();
});

// =================== SECURITY MIDDLEWARE ===================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  }
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/api/public/test'
});

app.use('/api/', apiLimiter);

// =================== BODY PARSING ===================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =================== PUBLIC ENDPOINTS ===================
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    cors: 'enabled',
    environment: process.env.NODE_ENV || 'development',
    websocket: wss ? 'enabled' : 'disabled'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Fipay Wallet API',
    version: '2.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    cors: 'enabled',
    realtime: 'enabled',
    admin: 'javonmorgan796@gmail.com'
  });
});

app.get('/api/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS is working correctly!',
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/public/test', (req, res) => {
  res.json({
    success: true,
    message: 'Public test endpoint is working!',
    serverTime: new Date().toISOString()
  });
});

app.get('/api/debug/auth', (req, res) => {
  res.json({
    success: true,
    message: 'Debug endpoint - no auth required',
    headers: {
      origin: req.headers.origin,
      'x-user-id': req.headers['x-user-id'],
      'user-id': req.headers['user-id'],
      authorization: req.headers.authorization
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/endpoints', (req, res) => {
  const endpoints = [
    { method: 'GET', path: '/health', auth: false },
    { method: 'GET', path: '/api/public/test', auth: false },
    { method: 'GET', path: '/api/debug/auth', auth: false },
    { method: 'GET', path: '/api/endpoints', auth: false },
    { method: 'GET', path: '/api/users/:id/balance', auth: false },
    { method: 'GET', path: '/api/users/:id/suspension', auth: false },
    { method: 'GET', path: '/api/users/me/balance', auth: false },
    { method: 'GET', path: '/api/users/me/suspension', auth: false },
    { method: 'POST', path: '/api/auth/login', auth: false },
    { method: 'POST', path: '/api/auth/signup', auth: false },
    { method: 'GET', path: '/api/auth/test', auth: true },
    { method: 'GET', path: '/api/deposits', auth: true },
    { method: 'POST', path: '/api/deposits', auth: true },
    { method: 'GET', path: '/api/transactions', auth: true },
    { method: 'POST', path: '/api/transactions/send', auth: true },
    { method: 'GET', path: '/api/users', auth: true },
    { method: 'GET', path: '/api/users/:id', auth: true },
    { method: 'GET', path: '/api/users/by-email', auth: true },
    { method: 'GET', path: '/api/user-summary', auth: true },
    { method: 'GET', path: '/api/pending', auth: true },
    { method: 'POST', path: '/api/pending', auth: true },
    { method: 'GET', path: '/api/admin/users', auth: true, admin: true },
    { method: 'GET', path: '/api/admin/deposits', auth: true, admin: true },
    { method: 'GET', path: '/api/admin/pending-transactions', auth: true, admin: true },
    { method: 'GET', path: '/api/admin/stats', auth: true, admin: true },
    { method: 'PUT', path: '/api/admin/users/:id/suspend', auth: true, admin: true },
    { method: 'PUT', path: '/api/deposits/:id/approve', auth: true, admin: true },
    { method: 'PUT', path: '/api/deposits/:id/reject', auth: true, admin: true },
    { method: 'PUT', path: '/api/admin/pending/:id/approve', auth: true, admin: true },
    { method: 'PUT', path: '/api/admin/pending/:id/cancel', auth: true, admin: true }
  ];
  
  res.json({
    success: true,
    endpoints,
    instructions: 'Use x-user-id header for authentication'
  });
});

const PORT = process.env.PORT || 5000;

// =================== MONGOOSE SCHEMAS ===================
const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  phone: { type: String, default: '' },
  countryCode: { type: String, default: '' },
  countryName: { type: String, default: '' },
  countryFlag: { type: String, default: '' },
  dialCode: { type: String, default: '' },
  avatar: { type: String, default: '' },
  balance: { type: Number, default: 0.0, min: 0 },
  suspended: { type: Boolean, default: false },
  suspensionReason: { type: String, default: '' },
  suspensionDate: { type: Date },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  lastLogin: { type: Date },
  emailVerified: { type: Boolean, default: false }
}, { 
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.__v;
      return ret;
    }
  }
});

userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.model('User', userSchema);

const depositSchema = new Schema({
  userId: { type: String, required: true, index: true },
  userEmail: { type: String, required: true, index: true },
  userName: { type: String, required: true },
  crypto: { type: String, required: true },
  symbol: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  cryptoAmount: { type: String, default: '' },
  address: { type: String, default: '' },
  transactionHash: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'failed'], 
    default: 'pending' 
  },
  notes: { type: String, default: '' }
}, { 
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

depositSchema.index({ userId: 1, status: 1 });
depositSchema.index({ createdAt: -1 });
depositSchema.index({ userEmail: 1 });

const Deposit = mongoose.model('Deposit', depositSchema);

const transactionSchema = new Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['send', 'receive', 'deposit', 'withdrawal'], required: true },
  amount: { type: Number, required: true },
  counterpartyId: { type: String, default: '' },
  counterpartyName: { type: String, default: '' },
  counterpartyEmail: { type: String, default: '' },
  counterpartyDetails: { type: Schema.Types.Mixed, default: {} },
  recipientName: { type: String, default: '' },
  recipientEmail: { type: String, default: '' },
  recipientType: { type: String, enum: ['email','crypto','bank','internal',''], default: '' },
  crypto: { type: String, default: '' },
  symbol: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'cancelled'], default: 'completed' },
  reference: { type: String, default: '' },
  description: { type: String, default: '' },
  depositId: { type: String, default: '' }
}, { 
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ status: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

const pendingTransactionSchema = new Schema({
  senderId: { type: String, required: true, index: true },
  senderEmail: { type: String, required: true },
  recipientType: { type: String, enum: ['email','crypto','bank'], default: 'email' },
  recipientEmail: { type: String, index: true },
  recipientName: { type: String, default: '' },
  recipientDetails: { type: Schema.Types.Mixed, default: {} },
  amount: { type: Number, required: true, min: 0 },
  crypto: { type: String, default: '' },
  symbol: { type: String, default: '' },
  paymentMethod: { type: String, enum: ['balance','card','bank'], default: 'balance' },
  cardId: { type: String, default: '' },
  message: { type: String, default: '' },
  status: { type: String, enum: ['pending','claimed','cancelled','expired'], default: 'pending' },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  approvedBy: { type: String, default: '' },
  approvedAt: { type: Date }
}, { 
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

pendingTransactionSchema.index({ recipientEmail: 1, status: 1 });
pendingTransactionSchema.index({ senderId: 1, status: 1 });
pendingTransactionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PendingTransaction = mongoose.model('PendingTransaction', pendingTransactionSchema);

const pendingRecipientSchema = new Schema({
  email: { type: String, required: true, index: true },
  name: { type: String, default: '' },
  createdBy: { type: String, default: '' },
  status: { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  approvedBy: { type: String, default: '' },
  approvedAt: { type: Date },
  notes: { type: String, default: '' }
}, { 
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

const PendingRecipient = mongoose.model('PendingRecipient', pendingRecipientSchema);

const recipientHistorySchema = new Schema({
  email: { type: String, required: true, index: true },
  name: { type: String, default: '' },
  action: { type: String, enum: ['approve','reject','delete'], required: true },
  performedBy: { type: String, default: '' },
  performedAt: { type: Date, default: Date.now },
  recipientId: { type: String, default: '' },
  userId: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { 
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

const RecipientHistory = mongoose.model('RecipientHistory', recipientHistorySchema);

// =================== HELPER FUNCTIONS ===================
const errorResponse = (res, status, message, error = null) => {
  console.error(`[ERROR] ${status}: ${message}`, error?.message || '');
  return res.status(status).json({
    success: false,
    error: message,
    ...(error && process.env.NODE_ENV === 'development' && { details: error.message })
  });
};

const successResponse = (res, data = {}, status = 200) => {
  return res.status(status).json({
    success: true,
    ...data
  });
};

// =================== AUTHENTICATION MIDDLEWARE ===================
const authenticateUser = async (req, res, next) => {
  try {
    console.log('[AUTH] Authenticating request for:', req.method, req.path);
    
    let userId = req.headers['x-user-id'] || 
                 req.headers['user-id'] ||
                 req.query.userId || 
                 req.body.userId;
    
    if (!userId && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      console.log('[AUTH] Authorization header:', authHeader);
      
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        if (mongoose.Types.ObjectId.isValid(token)) {
          userId = token;
        }
      } else if (mongoose.Types.ObjectId.isValid(authHeader)) {
        userId = authHeader;
      }
    }

    const publicEndpoints = [
      '/health',
      '/api/public/test',
      '/api/debug/auth',
      '/api/endpoints',
      '/api/test-cors',
      '/api/auth/login',
      '/api/auth/signup',
      '/api/users/me/balance',
      '/api/users/me/suspension',
      '/api/users/:id/balance',
      '/api/users/:id/suspension'
    ];
    
    if (publicEndpoints.includes(req.path) || publicEndpoints.some(ep => {
      if (ep.includes(':id')) {
        const basePath = ep.split('/:id')[0];
        return req.path.startsWith(basePath + '/');
      }
      return req.path.startsWith(ep);
    })) {
      console.log('[AUTH] Public endpoint, skipping auth');
      return next();
    }

    if (!userId) {
      console.log('[AUTH] No user ID found for protected endpoint:', req.path);
      return errorResponse(res, 401, 'Authentication required. Please provide user ID in x-user-id header.');
    }

    userId = userId.toString().trim();
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log('[AUTH] Invalid user ID format:', userId);
      return errorResponse(res, 401, 'Invalid user ID format. Must be a valid MongoDB ObjectId.');
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log('[AUTH] User not found with ID:', userId);
      return errorResponse(res, 404, 'User not found');
    }

    console.log('[AUTH] User authenticated:', user.email, `(Role: ${user.role})`);
    req.user = user;
    req.userId = userId;
    next();
  } catch (error) {
    console.error('[AUTH] Error:', error);
    return errorResponse(res, 500, 'Authentication error', error);
  }
};

const restrictSuspendedUsers = (req, res, next) => {
  if (req.user.suspended) {
    return errorResponse(res, 403, 
      `Account suspended. ${req.user.suspensionReason ? 'Reason: ' + req.user.suspensionReason : 'Contact support for assistance.'}`
    );
  }
  next();
};

// =================== ADMIN MIDDLEWARE ===================
const requireAdmin = async (req, res, next) => {
  try {
    console.log('[ADMIN] Checking admin access for:', req.method, req.path);
    
    await authenticateUser(req, res, () => {});
    
    if (!req.user) {
      console.log('[ADMIN] No user found for admin endpoint');
      return errorResponse(res, 401, 'Authentication required for admin access');
    }
    
    if (req.user.role !== 'admin') {
      console.log('[ADMIN] Non-admin attempt by:', req.user.email);
      return errorResponse(res, 403, 'Admin access required. User is not an admin.');
    }
    
    console.log('[ADMIN] Admin access granted to:', req.user.email);
    next();
  } catch (error) {
    console.error('[ADMIN] Error:', error);
    return errorResponse(res, 500, 'Admin authentication error', error);
  }
};

// =================== REAL-TIME ENDPOINTS ===================
// Fast endpoint to check only balance (for real-time checking)
app.get('/api/users/:id/balance', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('[BALANCE] Checking balance for user:', id);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid user id');
    }
    
    const user = await User.findById(id).select('balance suspended');
    
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    
    return successResponse(res, {
      id: user._id,
      balance: user.balance || 0,
      suspended: user.suspended || false,
      checkedAt: new Date()
    });
  } catch (err) {
    console.error('[BALANCE] Error:', err);
    return errorResponse(res, 500, 'Failed to check balance', err);
  }
});

// Fast endpoint to check only suspension status
app.get('/api/users/:id/suspension', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('[SUSPENSION] Checking suspension status for user:', id);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid user id');
    }
    
    const user = await User.findById(id).select('suspended suspensionReason suspensionDate');
    
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    
    console.log(`[SUSPENSION] Status for ${id}: ${user.suspended ? 'Suspended' : 'Active'}`);
    
    return successResponse(res, {
      id: user._id,
      suspended: user.suspended || false,
      suspensionReason: user.suspensionReason || '',
      suspensionDate: user.suspensionDate,
      checkedAt: new Date()
    });
  } catch (err) {
    console.error('[SUSPENSION] Error:', err);
    return errorResponse(res, 500, 'Failed to check suspension status', err);
  }
});

// Public endpoints for frontend self-check
app.get('/api/users/me/balance', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 
                  req.headers['user-id'] ||
                  req.query.userId;
    
    if (!userId) {
      return errorResponse(res, 400, 'User ID required');
    }
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return errorResponse(res, 400, 'Invalid user id format');
    }
    
    console.log('[BALANCE-ME] Checking balance for user:', userId.substring(0, 8) + '...');
    
    const user = await User.findById(userId).select('balance suspended email');
    
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    
    return successResponse(res, {
      id: user._id,
      email: user.email,
      balance: user.balance || 0,
      suspended: user.suspended || false,
      checkedAt: new Date()
    });
  } catch (err) {
    console.error('[BALANCE-ME] Error:', err);
    return errorResponse(res, 500, 'Failed to check balance', err);
  }
});

app.get('/api/users/me/suspension', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 
                  req.headers['user-id'] ||
                  req.query.userId;
    
    if (!userId) {
      return errorResponse(res, 400, 'User ID required');
    }
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return errorResponse(res, 400, 'Invalid user id format');
    }
    
    console.log('[SUSPENSION-ME] Checking suspension status for user:', userId.substring(0, 8) + '...');
    
    const user = await User.findById(userId).select('suspended suspensionReason suspensionDate email');
    
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    
    return successResponse(res, {
      id: user._id,
      email: user.email,
      suspended: user.suspended || false,
      suspensionReason: user.suspensionReason || '',
      suspensionDate: user.suspensionDate,
      checkedAt: new Date()
    });
  } catch (err) {
    console.error('[SUSPENSION-ME] Error:', err);
    return errorResponse(res, 500, 'Failed to check suspension status', err);
  }
});

// =================== AUTHENTICATION ENDPOINTS ===================
app.post('/api/auth/signup', async (req, res) => {
  try {
    let { email, password, name, phone, countryCode, countryName, countryFlag, dialCode } = req.body;
    
    console.log('[SIGNUP] Attempt for', email);
    
    if (!email || !password || !name) {
      console.log('[SIGNUP] Missing required fields');
      return errorResponse(res, 400, 'Missing required fields: email, password, name');
    }

    email = String(email).toLowerCase().trim();

    const existing = await User.findOne({ email });
    if (existing) {
      console.log('[SIGNUP] User already exists:', email);
      return errorResponse(res, 409, 'User already exists');
    }

    const hashed = await bcrypt.hash(password, 10);
    
    const isAdmin = email === 'javonmorgan796@gmail.com';
    
    const user = new User({ 
      email, 
      password: hashed, 
      name, 
      phone, 
      countryCode, 
      countryName, 
      countryFlag, 
      dialCode,
      role: isAdmin ? 'admin' : 'user'
    });
    
    await user.save();
    console.log('[SIGNUP] User created:', user.email, isAdmin ? '(ADMIN)' : '');

    const userObj = user.toObject();
    delete userObj.password;

    return successResponse(res, { user: userObj }, 201);
  } catch (err) {
    console.error('[SIGNUP] Error', err);
    return errorResponse(res, 500, 'Failed to create account', err);
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return errorResponse(res, 400, 'Missing email or password');
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return errorResponse(res, 401, 'Invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return errorResponse(res, 401, 'Invalid credentials');
    }

    user.lastLogin = new Date();
    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    return successResponse(res, { 
      user: userObj,
      userId: user._id.toString(),
      token: user._id.toString(),
      message: `Login successful ${user.role === 'admin' ? '(ADMIN)' : ''}`
    });
  } catch (err) {
    console.error('[LOGIN] Error', err);
    return errorResponse(res, 500, 'Failed to login', err);
  }
});

app.get('/api/auth/test', authenticateUser, async (req, res) => {
  return successResponse(res, {
    message: 'Authentication successful!',
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      balance: req.user.balance,
      role: req.user.role,
      suspended: req.user.suspended,
      suspensionReason: req.user.suspensionReason
    }
  });
});

// =================== USER ENDPOINTS ===================
app.get('/api/deposits', authenticateUser, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { userId: req.userId };
    
    if (status) query.status = status;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    const [deposits, total] = await Promise.all([
      Deposit.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Deposit.countDocuments(query)
    ]);
    
    return successResponse(res, { 
      deposits, 
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('[DEPOSITS] Error:', err);
    return errorResponse(res, 500, 'Failed to fetch deposits', err);
  }
});

app.post('/api/deposits', authenticateUser, restrictSuspendedUsers, async (req, res) => {
  try {
    const { crypto, symbol, amount, cryptoAmount, address, notes } = req.body;
    
    if (!crypto || !symbol || !amount) {
      return errorResponse(res, 400, 'Missing required fields: crypto, symbol, amount');
    }

    const deposit = new Deposit({ 
      userId: req.userId, 
      userEmail: req.user.email.toLowerCase(), 
      userName: req.user.name, 
      crypto, 
      symbol, 
      amount: Number(amount), 
      cryptoAmount, 
      address, 
      notes
    });
    
    await deposit.save();
    
    const transaction = new Transaction({
      userId: req.userId,
      type: 'deposit',
      amount: Number(amount),
      status: 'pending',
      crypto,
      symbol,
      description: `Deposit ${crypto} ${amount}`,
      reference: deposit._id.toString(),
      depositId: deposit._id.toString()
    });
    
    await transaction.save();
    
    return successResponse(res, { deposit, transaction }, 201);
  } catch (err) {
    console.error('[DEPOSITS CREATE] Error:', err);
    return errorResponse(res, 500, 'Failed to create deposit', err);
  }
});

app.get('/api/transactions', authenticateUser, async (req, res) => {
  try {
    const { type, status, page = 1, limit = 50 } = req.query;
    const query = { userId: req.userId };
    
    if (type) query.type = type;
    if (status) query.status = status;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Transaction.countDocuments(query)
    ]);
    
    return successResponse(res, { 
      transactions, 
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('[TRANSACTIONS] Error:', err);
    return errorResponse(res, 500, 'Failed to fetch transactions', err);
  }
});

app.post('/api/transactions/send', authenticateUser, restrictSuspendedUsers, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      console.log('[TRANSACTIONS:SEND] Starting send transaction', req.body);
      
      let { recipientType, recipientEmail, recipientDetails, amount, crypto, symbol, paymentMethod, cardId, message } = req.body;
      
      const senderId = req.userId;
      
      if (recipientType === 'bank' && (!recipientDetails || Object.keys(recipientDetails || {}).length === 0)) {
        const potential = {};
        const t = req.body || {};
        
        if (t.accountNumber || t.account_number || t.accountNo || t.account_no) {
          potential.accountNumber = t.accountNumber || t.account_number || t.accountNo || t.account_no;
        }
        
        if (t.accountName || t.account_name) potential.accountName = t.accountName || t.account_name;
        if (t.username) potential.username = t.username;
        if (t.bankName) potential.bankName = t.bankName;
        
        if (t.account && (t.account.number || t.account.name)) {
          potential.accountNumber = t.account.number || potential.accountNumber;
          potential.accountName = t.account.name || potential.accountName;
        }
        
        if (Object.keys(potential).length > 0) {
          recipientDetails = potential;
        }
      }

      const missing = [];
      if (!recipientType) missing.push('recipientType');
      if (amount === undefined || amount === null) missing.push('amount');
      
      if (missing.length > 0) {
        const resp = { 
          error: 'Missing required fields', 
          missing, 
          received: { senderId, recipientType, amount, recipientDetails } 
        };
        console.log('[TRANSACTIONS:SEND] Missing fields', resp);
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      amount = Number(amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount');
      }

      recipientType = String(recipientType || 'email');

      if (recipientEmail) {
        recipientEmail = String(recipientEmail).toLowerCase().trim();
      }

      recipientDetails = recipientDetails || {};
      crypto = String(crypto || '').trim();
      symbol = String(symbol || '').trim();
      paymentMethod = String(paymentMethod || 'balance');
      cardId = String(cardId || '');

      console.log('[TRANSACTIONS:SEND] Processed data:', { 
        senderId, 
        recipientType, 
        recipientEmail, 
        amount, 
        crypto, 
        symbol, 
        paymentMethod, 
        cardId 
      });

      if (recipientType === 'email') {
        if (!recipientEmail) {
          throw new Error('Missing recipientEmail for recipientType=email');
        }
      } else if (recipientType === 'crypto') {
        if (!recipientDetails || !recipientDetails.address) {
          throw new Error('Missing wallet address for crypto recipient');
        }
      } else if (recipientType === 'bank') {
        const d = recipientDetails || {};
        const bankFields = [
          'accountNumber','account_number','accountNo','account_no','account',
          'accountName','account_name','username'
        ];
        
        const hasBankField = bankFields.some(k => (d[k] !== undefined && String(d[k] || '').trim() !== '')) || 
                            (d?.account && (d.account.number || d.account.name));
        
        if (!hasBankField) {
          throw new Error('Missing bank account details (accountNumber or accountName/username)');
        }
      }

      const sender = await User.findById(senderId).session(session);
      if (!sender) {
        throw new Error('Sender not found');
      }

      if ((sender.balance || 0) < amount) {
        throw new Error('Insufficient balance');
      }

      if (recipientType === 'bank') {
        recipientDetails = recipientDetails || {};
        if (!recipientDetails.senderEmail) {
          recipientDetails.senderEmail = sender.email;
        }
      }

      const pendingPayload = {
        senderId: sender.id,
        senderEmail: sender.email,
        recipientType,
        recipientEmail: recipientEmail || '',
        recipientName: recipientDetails?.name || '',
        recipientDetails: recipientDetails || {},
        amount,
        crypto,
        symbol,
        paymentMethod,
        cardId,
        message: String(message || '')
      };

      const pending = new PendingTransaction(pendingPayload);
      await pending.save({ session });
      
      console.log(`[TRANSACTIONS:SEND] Pending transaction created: ${pending._id}`);
      
      return successResponse(res, { 
        success: true, 
        status: 'pending', 
        pending,
        message: 'Transaction created and pending admin approval'
      });
    });
  } catch (err) {
    console.error('[TRANSACTIONS:SEND] Error', err);
    return errorResponse(res, 500, `Failed to send money: ${err.message}`, err);
  } finally {
    await session.endSession();
  }
});

app.get('/api/user-summary', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    
    const [transactionsCount, depositsCount, pendingDeposits, user] = await Promise.all([
      Transaction.countDocuments({ userId }),
      Deposit.countDocuments({ userId }),
      Deposit.countDocuments({ userId, status: 'pending' }),
      User.findById(userId).select('balance name email suspended suspensionReason role')
    ]);
    
    return successResponse(res, {
      summary: {
        userId,
        name: user.name,
        email: user.email,
        role: user.role,
        balance: user.balance || 0,
        totalTransactions: transactionsCount,
        totalDeposits: depositsCount,
        pendingDeposits: pendingDeposits,
        accountStatus: user.suspended ? 'suspended' : 'active',
        suspensionReason: user.suspensionReason
      }
    });
  } catch (err) {
    console.error('[USER-SUMMARY] Error:', err);
    return errorResponse(res, 500, 'Failed to fetch user summary', err);
  }
});

app.get('/api/users', authenticateUser, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const { search, page = 1, limit = 20 } = req.query;
      const query = {};
      
      if (search) {
        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } }
        ];
      }
      
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;
      
      const [users, total] = await Promise.all([
        User.find(query)
          .select('-password -__v')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        User.countDocuments(query)
      ]);
      
      return successResponse(res, { 
        users, 
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } else {
      const user = await User.findById(req.userId).select('-password -__v');
      return successResponse(res, { users: [user] });
    }
  } catch (err) {
    console.error('[USERS] Error:', err);
    return errorResponse(res, 500, 'Failed to fetch users', err);
  }
});

app.get('/api/users/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const targetId = id === 'me' ? req.userId : id;
    
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return errorResponse(res, 400, 'Invalid user id');
    }
    
    if (targetId !== req.userId && req.user.role !== 'admin') {
      return errorResponse(res, 403, 'You can only view your own profile');
    }
    
    const user = await User.findById(targetId).select('-password -__v');
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    
    return successResponse(res, { user });
  } catch (err) {
    console.error('[USER BY ID] Error:', err);
    return errorResponse(res, 500, 'Failed to fetch user', err);
  }
});

app.get('/api/users/by-email', authenticateUser, async (req, res) => {
  try {
    let { email } = req.query;
    email = String(email || '').toLowerCase().trim();
    
    if (!email) {
      return errorResponse(res, 400, 'Missing email');
    }
    
    const user = await User.findOne({ email }).select('-password -__v');
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    
    return successResponse(res, { user });
  } catch (err) {
    console.error('[USER BY EMAIL] Error:', err);
    return errorResponse(res, 500, 'Failed to fetch user', err);
  }
});

// =================== PENDING TRANSACTION ENDPOINTS ===================
app.post('/api/pending', authenticateUser, restrictSuspendedUsers, async (req, res) => {
  try {
    let { recipientEmail, amount, message } = req.body;
    
    if (!recipientEmail || amount === undefined || amount === null) {
      return errorResponse(res, 400, 'Missing required fields: recipientEmail, amount');
    }
    
    amount = Number(amount);
    if (isNaN(amount) || amount <= 0) {
      return errorResponse(res, 400, 'Invalid amount');
    }
    
    const pending = new PendingTransaction({ 
      senderId: req.userId, 
      senderEmail: req.user.email, 
      recipientEmail: recipientEmail.toLowerCase().trim(), 
      amount, 
      message 
    });
    
    await pending.save();
    return successResponse(res, { pending }, 201);
  } catch (err) {
    console.error('[PENDING CREATE] Error:', err);
    return errorResponse(res, 500, 'Failed to create pending transaction', err);
  }
});

app.get('/api/pending', authenticateUser, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { senderId: req.userId };
    
    if (status) query.status = status;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    const [pendings, total] = await Promise.all([
      PendingTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      PendingTransaction.countDocuments(query)
    ]);
    
    return successResponse(res, { 
      pendings, 
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('[PENDING GET] Error:', err);
    return errorResponse(res, 500, 'Failed to fetch pending transactions', err);
  }
});

// =================== ADMIN ENDPOINTS ===================
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const query = {};
    
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query)
    ]);
    
    console.log(`[ADMIN] Fetched ${users.length} users for admin: ${req.user.email}`);
    
    return successResponse(res, { 
      users, 
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('[ADMIN USERS] Error:', err);
    return errorResponse(res, 500, 'Failed to fetch users', err);
  }
});

app.get('/api/admin/deposits', requireAdmin, async (req, res) => {
  try {
    const { status, userId, page = 1, limit = 50 } = req.query;
    const query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    if (userId) {
      query.userId = userId;
    }
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    const [deposits, total] = await Promise.all([
      Deposit.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Deposit.countDocuments(query)
    ]);
    
    console.log(`[ADMIN] Fetched ${deposits.length} deposits`);
    
    return successResponse(res, { 
      deposits, 
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('[ADMIN DEPOSITS] Error:', err);
    return errorResponse(res, 500, 'Failed to fetch deposits', err);
  }
});

app.put('/api/deposits/:id/approve', requireAdmin, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { id } = req.params;
      const { notes } = req.body;
      
      const deposit = await Deposit.findById(id).session(session);
      if (!deposit) {
        throw new Error('Deposit not found');
      }
      
      if (deposit.status === 'approved') {
        throw new Error('Deposit already approved');
      }

      deposit.status = 'approved';
      deposit.notes = notes || deposit.notes;
      await deposit.save({ session });

      const user = await User.findOne({ email: deposit.userEmail }).session(session);
      if (user) {
        const oldBalance = user.balance || 0;
        user.balance = (user.balance || 0) + deposit.amount;
        await user.save({ session });
        
        console.log(`💰 User ${user.email} balance updated: $${oldBalance} → $${user.balance}`);
        
        // Broadcast balance update via WebSocket
        if (typeof broadcastBalanceUpdate === 'function') {
          broadcastBalanceUpdate(user._id, user.balance, deposit.amount);
        }
      }

      await Transaction.findOneAndUpdate(
        { depositId: id, type: 'deposit' },
        { 
          status: 'completed',
          description: `Deposit ${deposit.crypto} ${deposit.amount} approved`
        },
        { session }
      );

      console.log(`[ADMIN] Deposit ${id} approved by ${req.user.email}`);

      return successResponse(res, { 
        deposit, 
        user: user ? { 
          _id: user._id, 
          email: user.email, 
          name: user.name, 
          balance: user.balance 
        } : null 
      });
    });
  } catch (err) {
    console.error('[ADMIN APPROVE DEPOSIT] Error:', err);
    return errorResponse(res, 500, 'Failed to approve deposit', err);
  } finally {
    await session.endSession();
  }
});

app.put('/api/deposits/:id/reject', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    const deposit = await Deposit.findById(id);
    if (!deposit) {
      return errorResponse(res, 404, 'Deposit not found');
    }
    
    if (deposit.status === 'rejected') {
      return errorResponse(res, 400, 'Deposit already rejected');
    }

    deposit.status = 'rejected';
    deposit.notes = notes || deposit.notes;
    await deposit.save();

    await Transaction.findOneAndUpdate(
      { depositId: id, type: 'deposit' },
      { 
        status: 'failed',
        description: `Deposit ${deposit.crypto} ${deposit.amount} rejected`
      }
    );

    console.log(`[ADMIN] Deposit ${id} rejected by ${req.user.email}`);

    return successResponse(res, { deposit });
  } catch (err) {
    console.error('[ADMIN REJECT DEPOSIT] Error:', err);
    return errorResponse(res, 500, 'Failed to reject deposit', err);
  }
});

app.get('/api/admin/pending-transactions', requireAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    } else {
      query.status = 'pending';
    }
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    const [transactions, total] = await Promise.all([
      PendingTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      PendingTransaction.countDocuments(query)
    ]);
    
    console.log(`[ADMIN] Fetched ${transactions.length} pending transactions`);
    
    return successResponse(res, { 
      transactions, 
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('[ADMIN PENDING TRANSACTIONS] Error:', err);
    return errorResponse(res, 500, 'Failed to fetch pending transactions', err);
  }
});

app.put('/api/admin/pending/:id/approve', requireAdmin, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { id } = req.params;
      const { notes } = req.body;
      const adminId = req.user?._id || 'admin';
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid pending id');
      }

      const p = await PendingTransaction.findById(id).session(session);
      if (!p) {
        throw new Error('Pending transaction not found');
      }
      
      if (!mongoose.Types.ObjectId.isValid(String(p.senderId))) {
        throw new Error('Invalid sender id on pending transaction');
      }
      
      if (p.status !== 'pending') {
        await PendingTransaction.deleteOne({ _id: p._id }).session(session);
        return successResponse(res, { 
          success: true, 
          removed: true, 
          reason: 'not_pending', 
          status: p.status 
        });
      }

      let sender = await User.findById(p.senderId).session(session);
      if (!sender) {
        throw new Error('Sender not found');
      }

      let recipient = null;
      if (p.recipientType === 'email' && p.recipientEmail) {
        const recEmail = String(p.recipientEmail).toLowerCase().trim();
        recipient = await User.findOne({ email: recEmail }).session(session);
        
        if (!recipient) {
          let pendingRecipient = await PendingRecipient.findOne({ email: recEmail }).session(session);
          if (!pendingRecipient) {
            pendingRecipient = new PendingRecipient({ 
              email: recEmail, 
              name: p.recipientName || '' 
            });
          }
          
          if (pendingRecipient.status !== 'approved') {
            pendingRecipient.status = 'approved';
            pendingRecipient.approvedBy = adminId;
            pendingRecipient.approvedAt = new Date();
            pendingRecipient.notes = notes || 'Auto-approved via transaction';
            await pendingRecipient.save({ session });
          }
          
          const defaultName = pendingRecipient.name && pendingRecipient.name.length ? 
            pendingRecipient.name : 
            (pendingRecipient.email.split('@')[0] || 'Recipient');
          
          const randomPassword = crypto.randomBytes(12).toString('hex');
          const hashed = await bcrypt.hash(randomPassword, 10);
          
          await User.updateOne(
            { email: pendingRecipient.email },
            { 
              $setOnInsert: { 
                email: pendingRecipient.email, 
                password: hashed, 
                name: defaultName,
                emailVerified: true
              } 
            },
            { upsert: true, session }
          );
          
          recipient = await User.findOne({ email: pendingRecipient.email }).session(session);
        }
      }

      const amt = Math.abs(Number(p.amount));
      if (!isFinite(amt) || amt <= 0) {
        throw new Error('Invalid amount for approval');
      }
      
      if ((sender.balance || 0) < amt) {
        throw new Error('Sender has insufficient balance');
      }

      await User.updateOne({ _id: sender._id }, { $inc: { balance: -amt } }, { session });
      sender = await User.findById(sender._id).session(session);

      let senderTx = null;
      let recipientTx = null;

      if (recipient) {
        await User.updateOne({ _id: recipient._id }, { $inc: { balance: amt } }, { session });
        recipient = await User.findById(recipient._id).session(session);

        senderTx = new Transaction({
          userId: sender.id,
          type: 'send',
          amount: -amt,
          counterpartyId: recipient.id,
          counterpartyName: recipient.name,
          counterpartyEmail: recipient.email,
          recipientName: recipient.name,
          recipientEmail: recipient.email,
          recipientType: 'email',
          counterpartyDetails: {},
          crypto: p.crypto,
          symbol: p.symbol,
          status: 'completed',
          description: p.message || `Transfer to ${recipient.email}`,
          reference: p._id.toString()
        });

        recipientTx = new Transaction({
          userId: recipient.id,
          type: 'receive',
          amount: amt,
          counterpartyId: sender.id,
          counterpartyName: sender.name,
          counterpartyEmail: sender.email,
          recipientName: sender.name,
          recipientEmail: sender.email,
          recipientType: 'email',
          counterpartyDetails: {},
          crypto: p.crypto,
          symbol: p.symbol,
          status: 'completed',
          description: p.message || `Transfer from ${sender.email}`,
          reference: p._id.toString()
        });

        await senderTx.save({ session });
        await recipientTx.save({ session });
        
        // Broadcast balance updates via WebSocket
        if (typeof broadcastBalanceUpdate === 'function') {
          broadcastBalanceUpdate(sender._id, sender.balance, -amt);
          broadcastBalanceUpdate(recipient._id, recipient.balance, amt);
        }
      } else {
        const resolvedName = p.recipientName || 
          (p.recipientDetails?.accountName || 
           p.recipientDetails?.username || 
           (p.recipientDetails?.account?.name || ''));
        
        senderTx = new Transaction({
          userId: sender.id,
          type: 'send',
          amount: -amt,
          counterpartyId: '',
          counterpartyName: resolvedName || '',
          counterpartyEmail: p.recipientEmail || '',
          recipientName: resolvedName || '',
          recipientEmail: p.recipientEmail || '',
          recipientType: p.recipientType || '',
          counterpartyDetails: p.recipientDetails || {},
          crypto: p.crypto,
          symbol: p.symbol,
          status: 'completed',
          description: p.message || `${p.recipientType} transfer`,
          reference: p._id.toString()
        });

        await senderTx.save({ session });
        
        // Broadcast sender balance update via WebSocket
        if (typeof broadcastBalanceUpdate === 'function') {
          broadcastBalanceUpdate(sender._id, sender.balance, -amt);
        }
      }

      p.status = 'claimed';
      p.approvedBy = adminId;
      p.approvedAt = new Date();
      p.notes = notes;
      await p.save({ session });

      const freshSender = await User.findById(sender._id).select('-password -__v').lean();
      const freshRecipient = recipient ? 
        await User.findById(recipient._id).select('-password -__v').lean() : 
        null;
      
      console.log(`[ADMIN] Pending transaction ${id} approved by ${req.user.email}`);
      
      return successResponse(res, {
        success: true,
        senderTx,
        recipientTx,
        pending: p,
        sender: freshSender,
        recipient: freshRecipient,
        updatedSenderBalance: freshSender ? freshSender.balance : null,
        updatedRecipientBalance: freshRecipient ? freshRecipient.balance : null
      });
    });
  } catch (err) {
    console.error('[ADMIN APPROVE PENDING] Error:', err);
    return errorResponse(res, 500, 'Failed to approve pending transaction', err);
  } finally {
    await session.endSession();
  }
});

app.put('/api/admin/pending/:id/cancel', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    const p = await PendingTransaction.findById(id);
    if (!p) {
      return errorResponse(res, 404, 'Pending transaction not found');
    }
    
    if (p.status !== 'pending') {
      await PendingTransaction.deleteOne({ _id: p._id });
      return successResponse(res, { 
        success: true, 
        removed: true, 
        reason: 'not_pending', 
        status: p.status 
      });
    }
    
    p.status = 'cancelled';
    p.notes = notes;
    await p.save();
    
    console.log(`[ADMIN] Pending transaction ${id} cancelled by ${req.user.email}`);
    
    return successResponse(res, { 
      success: true, 
      pending: p 
    });
  } catch (err) {
    console.error('[ADMIN CANCEL PENDING] Error:', err);
    return errorResponse(res, 500, 'Failed to cancel pending transaction', err);
  }
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      totalDeposits,
      totalTransactions,
      pendingTransactions,
      pendingDeposits,
      totalBalance,
      activeUsers,
      adminUsers
    ] = await Promise.all([
      User.countDocuments(),
      Deposit.countDocuments(),
      Transaction.countDocuments(),
      PendingTransaction.countDocuments({ status: 'pending' }),
      Deposit.countDocuments({ status: 'pending' }),
      User.aggregate([
        { $group: { _id: null, total: { $sum: '$balance' } } }
      ]),
      User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      User.countDocuments({ role: 'admin' })
    ]);
    
    return successResponse(res, {
      stats: {
        totalUsers,
        totalDeposits,
        totalTransactions,
        pendingTransactions,
        pendingDeposits,
        totalBalance: totalBalance[0]?.total || 0,
        activeUsers,
        adminUsers,
        suspendedUsers: await User.countDocuments({ suspended: true })
      }
    });
  } catch (err) {
    console.error('[ADMIN STATS] Error:', err);
    return errorResponse(res, 500, 'Failed to fetch statistics', err);
  }
});

// =================== REAL-TIME WEBSOCKET BROADCAST FUNCTIONS ===================
let wss;

const broadcastSuspensionUpdate = (userId, suspended, reason = '') => {
  console.log(`📢 Broadcasting suspension update for ${userId}: ${suspended ? 'Suspended' : 'Active'}`);
  
  const message = JSON.stringify({
    type: 'suspension_update',
    userId: userId,
    suspended: suspended,
    reason: reason,
    timestamp: new Date().toISOString()
  });
  
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === 1 && client.userId === userId.toString()) {
        client.send(message);
      }
    });
  }
};

const broadcastBalanceUpdate = (userId, newBalance, amountChanged = 0) => {
  console.log(`💰 Broadcasting balance update for ${userId}: $${newBalance} (Changed: ${amountChanged > 0 ? '+' : ''}${amountChanged})`);
  
  const message = JSON.stringify({
    type: 'balance_update',
    userId: userId,
    balance: newBalance,
    amountChanged: amountChanged,
    timestamp: new Date().toISOString()
  });
  
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === 1 && client.userId === userId.toString()) {
        client.send(message);
      }
    });
  }
};

// Admin: Suspend/unsuspend user (with WebSocket broadcast)
app.put('/api/admin/users/:id/suspend', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { suspended, reason } = req.body || {};
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid user id');
    }
    
    if (id === req.userId) {
      return errorResponse(res, 400, 'Cannot suspend your own account');
    }
    
    const desired = Boolean(suspended);
    const updated = await User.findByIdAndUpdate(
      id,
      { 
        $set: { 
          suspended: desired,
          suspensionReason: reason || '',
          ...(desired && { suspensionDate: new Date() })
        } 
      },
      { new: true }
    ).select('-password -__v');
    
    if (!updated) {
      return errorResponse(res, 404, 'User not found');
    }
    
    console.log(`[ADMIN] User ${id} ${desired ? 'suspended' : 'activated'} by ${req.user.email}`);
    
    // 🔥 BROADCAST REAL-TIME UPDATE VIA WEBSOCKET
    broadcastSuspensionUpdate(id, desired, reason || '');
    
    return successResponse(res, { 
      user: updated,
      message: `User ${desired ? 'suspended' : 'activated'} successfully`
    });
  } catch (err) {
    console.error('[ADMIN SUSPEND USER] Error:', err);
    return errorResponse(res, 500, 'Failed to update user status', err);
  }
});

// =================== ERROR HANDLING ===================
app.use('*', (req, res) => {
  console.log(`[404] Endpoint not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: '/api/endpoints'
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// =================== DATABASE CONNECTION ===================
const start = async () => {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('MONGODB_URI is required in the environment');
    process.exit(1);
  }

  try {
    const options = {
      dbName: process.env.DB_NAME || 'fipay-wallet',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(uri, options);
    
    console.log('✅ Connected to MongoDB');
    console.log(`📁 Database: ${mongoose.connection.db.databaseName}`);
    
    // Ensure admin user exists
    const adminEmail = 'javonmorgan796@gmail.com';
    let adminUser = await User.findOne({ email: adminEmail });
    
    if (adminUser) {
      if (adminUser.role !== 'admin') {
        adminUser.role = 'admin';
        await adminUser.save();
        console.log(`👑 Admin role assigned to: ${adminEmail}`);
      } else {
        console.log(`👑 Admin user already exists: ${adminEmail}`);
      }
    } else {
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      
      adminUser = new User({
        email: adminEmail,
        password: hashedPassword,
        name: 'Admin User',
        role: 'admin',
        emailVerified: true
      });
      
      await adminUser.save();
      console.log(`👑 Admin user created: ${adminEmail}`);
      console.log(`🔑 Default password: ${adminPassword} (Change this immediately!)`);
    }
    
    const server = app.listen(PORT, () => {
      console.log(`\n🎉 Server listening on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 CORS enabled for: ${allowedOrigins.join(', ')}`);
      console.log(`🔐 Authentication via: x-user-id header or Authorization Bearer token`);
      console.log(`👑 Admin access: ${adminEmail}`);
      console.log(`💰 Real-time balance: GET /api/users/:id/balance`);
      console.log(`🚨 Real-time suspension: GET /api/users/:id/suspension`);
      console.log(`⚡ WebSocket real-time updates: ws://localhost:${PORT}/ws`);
      console.log(`\n✨ Server is ready! ✨\n`);
    });
    
    // =================== WEBSOCKET SERVER SETUP ===================
    wss = new WebSocket.Server({ noServer: true });
    
    wss.on('connection', (ws, request) => {
      console.log('🔌 New WebSocket connection');
      
      const url = new URL(request.url, `http://${request.headers.host}`);
      const userId = url.searchParams.get('userId');
      
      if (!userId) {
        console.log('❌ No userId in WebSocket connection');
        ws.close();
        return;
      }
      
      console.log(`🔌 User connected via WebSocket: ${userId.substring(0, 8)}...`);
      ws.userId = userId;
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          
          if (data.type === 'ping') {
            ws.send(JSON.stringify({ 
              type: 'pong', 
              timestamp: new Date().toISOString() 
            }));
          }
          
          if (data.type === 'subscribe_balance') {
            console.log(`📊 User ${userId.substring(0, 8)}... subscribed to balance updates`);
          }
          
          if (data.type === 'subscribe_suspension') {
            console.log(`🚨 User ${userId.substring(0, 8)}... subscribed to suspension updates`);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      ws.on('close', () => {
        console.log(`🔌 User disconnected: ${userId.substring(0, 8)}...`);
      });
      
      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${userId}:`, error);
      });
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'WebSocket connected successfully',
        userId: userId,
        timestamp: new Date().toISOString(),
        features: ['balance_updates', 'suspension_updates']
      }));
    });
    
    // Handle WebSocket upgrade requests
    server.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
      
      if (pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });
    
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB', err);
    process.exit(1);
  }
};

// =================== GRACEFUL SHUTDOWN ===================
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Starting graceful shutdown...');
  
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    
    if (wss) {
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.close();
        }
      });
      console.log('WebSocket server closed.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Starting graceful shutdown...');
  
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    
    if (wss) {
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.close();
        }
      });
      console.log('WebSocket server closed.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});

// Start the server
start();
