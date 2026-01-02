require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// CORS MUST COME FIRST - before any other middleware
const allowedOrigins = [
  'https://fipay.onrender.com',
  'https://fipaybank.onrender.com',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:3000'
];

// Simple CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      // For development, be more permissive
      if (process.env.NODE_ENV === 'development') {
        console.log('Development: Allowing origin', origin);
        return callback(null, true);
      }
      console.error('CORS blocked:', origin);
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin', 'x-user-id', 'user-id', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200,
  maxAge: 86400
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Security middleware (comes after CORS)
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

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint (should work without authentication)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    cors: 'enabled',
    allowedOrigins: allowedOrigins
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Fipay Wallet API',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    docs: '/api-docs',
    cors: {
      enabled: true,
      origins: allowedOrigins
    }
  });
});

// Test CORS endpoint
app.get('/api/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS is working correctly!',
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    cors: '✅ Enabled for your origin'
  });
});

// Public test endpoint (no auth required)
app.get('/api/test-public', (req, res) => {
  return res.json({
    success: true,
    message: 'Public endpoint - no authentication required',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;

// Mongoose User schema
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

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.model('User', userSchema);

// Deposit schema
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

// Indexes for deposits
depositSchema.index({ userId: 1, status: 1 });
depositSchema.index({ createdAt: -1 });
depositSchema.index({ userEmail: 1 });

const Deposit = mongoose.model('Deposit', depositSchema);

// Transaction schema & model
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
  depositId: { type: String, default: '' } // Link to deposit
}, { 
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for transactions
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ status: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

// PendingTransaction schema & model
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
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, // 7 days
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

// Indexes for pending transactions
pendingTransactionSchema.index({ recipientEmail: 1, status: 1 });
pendingTransactionSchema.index({ senderId: 1, status: 1 });
pendingTransactionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

const PendingTransaction = mongoose.model('PendingTransaction', pendingTransactionSchema);

// PendingRecipient schema & model
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

// Recipient history schema & model
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

// Helper function for error responses
const errorResponse = (res, status, message, error = null) => {
  console.error(`[ERROR] ${status}: ${message}`, error);
  return res.status(status).json({
    success: false,
    error: message,
    ...(error && process.env.NODE_ENV === 'development' && { details: error.message })
  });
};

// Helper function for success responses
const successResponse = (res, data = {}, status = 200) => {
  return res.status(status).json({
    success: true,
    ...data
  });
};

// Authentication middleware (more flexible - ALLOWS SUSPENDED USERS)
const authenticateUser = async (req, res, next) => {
  try {
    // Try multiple ways to get user ID
    let userId = req.headers['x-user-id'] || 
                 req.headers['user-id'] ||
                 req.query.userId || 
                 req.body.userId;
    
    // Also check Authorization header for Bearer token
    if (!userId && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const token = req.headers.authorization.split(' ')[1];
      // If token is a valid ObjectId, use it as userId
      if (mongoose.Types.ObjectId.isValid(token)) {
        userId = token;
      }
    }

    if (!userId) {
      console.log('[AUTH] No user ID found in request');
      return errorResponse(res, 401, 'Authentication required. Please provide user ID.');
    }

    // Clean up user ID
    userId = userId.toString().trim();
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log('[AUTH] Invalid user ID format:', userId);
      return errorResponse(res, 401, 'Invalid user ID format');
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log('[AUTH] User not found with ID:', userId);
      return errorResponse(res, 404, 'User not found');
    }

    // REMOVED: Suspension check - allow suspended users to authenticate
    // if (user.suspended) {
    //   console.log('[AUTH] User suspended:', userId);
    //   return errorResponse(res, 403, `Account suspended. Reason: ${user.suspensionReason || 'Contact support for assistance.'}`);
    // }

    console.log('[AUTH] User authenticated:', user.email, user.suspended ? '(SUSPENDED)' : '');
    req.user = user;
    req.userId = userId;
    next();
  } catch (error) {
    console.error('[AUTH] Error:', error);
    return errorResponse(res, 500, 'Authentication error', error);
  }
};

// Middleware to restrict actions for suspended users
const restrictSuspendedUsers = (req, res, next) => {
  if (req.user.suspended) {
    return errorResponse(res, 403, 
      `Account suspended. ${req.user.suspensionReason ? 'Reason: ' + req.user.suspensionReason : 'Contact support for assistance.'}`
    );
  }
  next();
};

// FIXED: Admin middleware with proper token validation
const requireAdmin = async (req, res, next) => {
  try {
    console.log('[ADMIN] Admin access attempt detected');
    
    // Get admin token from header
    const adminToken = req.headers['x-admin'];
    const authHeader = req.headers['authorization'];
    
    // Check if admin token exists in environment
    const validAdminToken = process.env.ADMIN_TOKEN || 'admin-secret-key-change-this';
    
    console.log('[ADMIN] Checking credentials:', {
      hasXAdmin: !!adminToken,
      hasAuthHeader: !!authHeader,
      adminTokenFromEnv: validAdminToken ? 'present' : 'missing'
    });
    
    // Check for admin token in x-admin header
    if (adminToken && adminToken === validAdminToken) {
      console.log('[ADMIN] Access granted via x-admin header');
      req.isAdmin = true;
      return next();
    }
    
    // Check for Bearer token in Authorization header
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token === validAdminToken) {
        console.log('[ADMIN] Access granted via Authorization header');
        req.isAdmin = true;
        return next();
      }
    }
    
    // Also check for admin user role (if user is logged in)
    let userId = req.headers['x-user-id'] || req.headers['user-id'];
    
    // Try to extract from query or body
    if (!userId) {
      userId = req.query.userId || req.body.userId;
    }
    
    // Try to extract from Authorization header if it contains a valid ObjectId
    if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (mongoose.Types.ObjectId.isValid(token)) {
        userId = token;
      }
    }
    
    if (userId && mongoose.Types.ObjectId.isValid(userId.toString().trim())) {
      const cleanUserId = userId.toString().trim();
      const user = await User.findById(cleanUserId);
      
      if (user && user.role === 'admin') {
        console.log('[ADMIN] Access granted via admin role:', user.email);
        req.isAdmin = true;
        req.adminUser = user;
        return next();
      } else if (user) {
        console.log('[ADMIN] User found but not admin:', user.email, 'role:', user.role);
      } else {
        console.log('[ADMIN] User not found with ID:', cleanUserId);
      }
    }
    
    console.error('[ADMIN] Access denied. No valid admin credentials provided');
    console.error('[ADMIN] Headers received:', {
      'x-admin': adminToken ? 'present' : 'missing',
      'authorization': authHeader ? 'present' : 'missing',
      'x-user-id': req.headers['x-user-id'] ? 'present' : 'missing',
      'user-id': req.headers['user-id'] ? 'present' : 'missing'
    });
    
    return errorResponse(res, 403, 'Admin access required. Invalid or missing credentials. Please provide valid admin token or login as admin user.');
    
  } catch (error) {
    console.error('[ADMIN] Authentication error:', error);
    return errorResponse(res, 500, 'Admin authentication error', error);
  }
};

// Test authentication endpoint
app.get('/api/auth/test', authenticateUser, async (req, res) => {
  return successResponse(res, {
    message: req.user.suspended ? 'Authentication successful (Account is SUSPENDED)' : 'Authentication successful!',
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      balance: req.user.balance,
      suspended: req.user.suspended,
      suspensionReason: req.user.suspensionReason
    },
    authInfo: {
      method: 'authenticated endpoint',
      timestamp: new Date().toISOString()
    }
  });
});

// Admin test endpoint
app.get('/api/admin/test', requireAdmin, (req, res) => {
  return successResponse(res, {
    message: 'Admin access is working correctly!',
    adminInfo: {
      timestamp: new Date().toISOString(),
      method: req.headers['x-admin'] ? 'x-admin header' : 
              req.headers['authorization'] ? 'authorization header' : 
              req.adminUser ? 'admin role' : 'unknown',
      isAdmin: req.isAdmin,
      adminUser: req.adminUser ? {
        id: req.adminUser._id,
        email: req.adminUser.email,
        name: req.adminUser.name
      } : null
    }
  });
});

// Authentication endpoints
app.post('/api/auth/signup', async (req, res) => {
  try {
    let { email, password, name, phone, countryCode, countryName, countryFlag, dialCode } = req.body;
    
    console.log('[signup] attempt for', email);
    
    if (!email || !password || !name) {
      console.log('[signup] missing fields for', email);
      return errorResponse(res, 400, 'Missing required fields: email, password, name');
    }

    // Normalize email
    email = String(email).toLowerCase().trim();

    const existing = await User.findOne({ email });
    if (existing) {
      console.log('[signup] user already exists:', email);
      return errorResponse(res, 409, 'User already exists');
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ 
      email, 
      password: hashed, 
      name, 
      phone, 
      countryCode, 
      countryName, 
      countryFlag, 
      dialCode 
    });
    
    await user.save();
    console.log('[signup] user created:', user.email);

    const userObj = user.toObject();
    delete userObj.password;

    return successResponse(res, { user: userObj }, 201);
  } catch (err) {
    console.error('[signup] error', err);
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

    // REMOVED: Suspension check - allow suspended users to login
    // if (user.suspended) {
    //   console.log('[login] Attempt by suspended user:', email);
    //   return errorResponse(res, 403, `Account suspended. Reason: ${user.suspensionReason || 'Contact support for assistance.'}`);
    // }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return errorResponse(res, 401, 'Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    // Return user ID explicitly for frontend to use
    return successResponse(res, { 
      user: userObj,
      userId: user._id.toString(), // Important: send user ID
      token: user._id.toString(),  // For backward compatibility
      message: user.suspended ? 'Login successful (Account is SUSPENDED)' : 'Login successful'
    });
  } catch (err) {
    console.error('[login] error', err);
    return errorResponse(res, 500, 'Failed to login', err);
  }
});

// Routes

// Create deposit (restricted for suspended users)
app.post('/api/deposits', authenticateUser, restrictSuspendedUsers, async (req, res) => {
  try {
    const { userId, userEmail, userName, crypto, symbol, amount, cryptoAmount, address, date, notes } = req.body;
    
    if (!userId || !userEmail || !crypto || !symbol || !amount) {
      return errorResponse(res, 400, 'Missing required deposit fields');
    }

    const deposit = new Deposit({ 
      userId, 
      userEmail: userEmail.toLowerCase(), 
      userName, 
      crypto, 
      symbol, 
      amount: Number(amount), 
      cryptoAmount, 
      address, 
      date: date || new Date(),
      notes
    });
    
    await deposit.save();
    
    // Create transaction record (FIXED: include depositId)
    const transaction = new Transaction({
      userId,
      type: 'deposit',
      amount: Number(amount),
      status: 'pending',
      crypto,
      symbol,
      description: `Deposit ${crypto} ${amount}`,
      reference: deposit._id.toString(),
      depositId: deposit._id.toString() // Link to deposit
    });
    
    await transaction.save();
    
    return successResponse(res, { deposit, transaction }, 201);
  } catch (err) {
    return errorResponse(res, 500, 'Failed to create deposit', err);
  }
});

// Get deposits (all or by userId) - ALLOW SUSPENDED USERS TO VIEW
app.get('/api/deposits', authenticateUser, async (req, res) => {
  try {
    const { userId, status, page = 1, limit = 20 } = req.query;
    const query = {};
    
    // Use authenticated user's ID if not specified
    const targetUserId = userId || req.userId;
    if (targetUserId) query.userId = String(targetUserId);
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
    return errorResponse(res, 500, 'Failed to fetch deposits', err);
  }
});

// Approve deposit -> update deposit status and user balance
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

      // Update user balance
      const user = await User.findOne({ email: deposit.userEmail }).session(session);
      if (user) {
        user.balance = (user.balance || 0) + deposit.amount;
        await user.save({ session });
      }

      // Update transaction status (FIXED: include depositId)
      await Transaction.findOneAndUpdate(
        { depositId: id, type: 'deposit' },
        { 
          status: 'completed',
          description: `Deposit ${deposit.crypto} ${deposit.amount} approved`
        },
        { session }
      );

      return successResponse(res, { deposit, user: user ? { 
        _id: user._id, 
        email: user.email, 
        name: user.name, 
        balance: user.balance 
      } : null });
    });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to approve deposit', err);
  } finally {
    await session.endSession();
  }
});

// Reject deposit
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

    // Update transaction status (FIXED: include depositId)
    await Transaction.findOneAndUpdate(
      { depositId: id, type: 'deposit' },
      { 
        status: 'failed',
        description: `Deposit ${deposit.crypto} ${deposit.amount} rejected`
      }
    );

    return successResponse(res, { deposit });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to reject deposit', err);
  }
});

// Get transactions (by userId) - FIXED: includes deposits properly
app.get('/api/transactions', authenticateUser, async (req, res) => {
  try {
    const { userId, type, status, page = 1, limit = 50, includeDeposits = 'true' } = req.query;
    
    // Use authenticated user's ID if not specified
    const targetUserId = userId || req.userId;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    // Get regular transactions
    const transactionQuery = { userId: targetUserId };
    if (type && type !== 'deposit') transactionQuery.type = type;
    if (status) transactionQuery.status = status;
    
    const [transactions, transactionsTotal] = await Promise.all([
      Transaction.find(transactionQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Transaction.countDocuments(transactionQuery)
    ]);
    
    let allTransactions = [...transactions];
    let totalCount = transactionsTotal;
    
    // If includeDeposits is true, get deposits and merge them
    if (includeDeposits === 'true' && (!type || type === 'deposit')) {
      const depositQuery = { userId: targetUserId };
      if (status) {
        // Map transaction status to deposit status
        const statusMap = {
          'completed': 'approved',
          'failed': 'rejected',
          'pending': 'pending',
          'cancelled': 'rejected'
        };
        if (statusMap[status]) {
          depositQuery.status = statusMap[status];
        }
      }
      
      const [deposits, depositsTotal] = await Promise.all([
        Deposit.find(depositQuery)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Deposit.countDocuments(depositQuery)
      ]);
      
      // Convert deposits to transaction format for frontend
      const depositTransactions = deposits.map(deposit => ({
        _id: deposit._id,
        userId: deposit.userId,
        type: 'deposit',
        amount: deposit.amount,
        crypto: deposit.crypto,
        symbol: deposit.symbol,
        date: deposit.date || deposit.createdAt,
        status: deposit.status === 'approved' ? 'completed' : 
                deposit.status === 'rejected' ? 'failed' : 'pending',
        description: `Deposit ${deposit.crypto} ${deposit.amount}`,
        createdAt: deposit.createdAt,
        updatedAt: deposit.updatedAt,
        isDeposit: true,
        depositDetails: {
          cryptoAmount: deposit.cryptoAmount,
          address: deposit.address,
          transactionHash: deposit.transactionHash,
          notes: deposit.notes,
          status: deposit.status
        }
      }));
      
      // Combine and sort
      allTransactions = [...depositTransactions, ...transactions];
      allTransactions.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
      
      // Apply pagination after sorting
      allTransactions = allTransactions.slice(0, limitNum);
      
      totalCount = transactionsTotal + depositsTotal;
    }
    
    return successResponse(res, { 
      transactions: allTransactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (err) {
    console.error('[transactions] error:', err);
    return errorResponse(res, 500, 'Failed to fetch transactions', err);
  }
});

// Get all user data in one endpoint (transactions + deposits)
app.get('/api/user-data', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    
    const [user, transactions, deposits] = await Promise.all([
      User.findById(userId).select('-password -__v'),
      Transaction.find({ userId }).sort({ createdAt: -1 }).limit(50).lean(),
      Deposit.find({ userId }).sort({ createdAt: -1 }).limit(50).lean()
    ]);
    
    // Format deposits as transactions for consistency
    const depositTransactions = deposits.map(deposit => ({
      _id: deposit._id,
      userId: deposit.userId,
      type: 'deposit',
      amount: deposit.amount,
      crypto: deposit.crypto,
      symbol: deposit.symbol,
      date: deposit.date || deposit.createdAt,
      status: deposit.status === 'approved' ? 'completed' : 
              deposit.status === 'rejected' ? 'failed' : 'pending',
      description: `Deposit ${deposit.crypto} ${deposit.amount}`,
      createdAt: deposit.createdAt,
      updatedAt: deposit.updatedAt,
      isDeposit: true,
      depositDetails: {
        cryptoAmount: deposit.cryptoAmount,
        address: deposit.address,
        transactionHash: deposit.transactionHash,
        notes: deposit.notes,
        status: deposit.status
      }
    }));
    
    // Combine and sort
    const allTransactions = [...depositTransactions, ...transactions];
    allTransactions.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
    
    return successResponse(res, {
      user,
      transactions: allTransactions,
      deposits,
      summary: {
        totalBalance: user.balance || 0,
        totalTransactions: transactions.length + deposits.length,
        pendingDeposits: deposits.filter(d => d.status === 'pending').length,
        accountStatus: user.suspended ? 'suspended' : 'active'
      }
    });
  } catch (err) {
    console.error('[user-data] error:', err);
    return errorResponse(res, 500, 'Failed to fetch user data', err);
  }
});

// Get user summary (balance, transaction counts, etc.)
app.get('/api/user-summary', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId;
    
    const [transactionsCount, depositsCount, pendingDeposits, user] = await Promise.all([
      Transaction.countDocuments({ userId }),
      Deposit.countDocuments({ userId }),
      Deposit.countDocuments({ userId, status: 'pending' }),
      User.findById(userId).select('balance name email suspended suspensionReason')
    ]);
    
    return successResponse(res, {
      summary: {
        userId,
        name: user.name,
        email: user.email,
        balance: user.balance || 0,
        totalTransactions: transactionsCount,
        totalDeposits: depositsCount,
        pendingDeposits: pendingDeposits,
        accountStatus: user.suspended ? 'suspended' : 'active',
        suspensionReason: user.suspensionReason
      }
    });
  } catch (err) {
    console.error('[user-summary] error:', err);
    return errorResponse(res, 500, 'Failed to fetch user summary', err);
  }
});

// Create pending transaction (restricted for suspended users)
app.post('/api/pending', authenticateUser, restrictSuspendedUsers, async (req, res) => {
  try {
    let { senderId, senderEmail, recipientEmail, amount, message } = req.body;
    
    if (!senderId || !senderEmail || !recipientEmail || amount === undefined || amount === null) {
      return errorResponse(res, 400, 'Missing required fields: senderId, senderEmail, recipientEmail, amount');
    }
    
    amount = Number(amount);
    if (isNaN(amount) || amount <= 0) {
      return errorResponse(res, 400, 'Invalid amount');
    }
    
    const pending = new PendingTransaction({ 
      senderId, 
      senderEmail, 
      recipientEmail: recipientEmail.toLowerCase().trim(), 
      amount, 
      message 
    });
    
    await pending.save();
    return successResponse(res, { pending }, 201);
  } catch (err) {
    return errorResponse(res, 500, 'Failed to create pending transaction', err);
  }
});

// List pending transactions by recipientEmail
app.get('/api/pending', authenticateUser, async (req, res) => {
  try {
    const { recipientEmail, senderId, status, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (recipientEmail) query.recipientEmail = String(recipientEmail).toLowerCase().trim();
    if (senderId) query.senderId = String(senderId);
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
    return errorResponse(res, 500, 'Failed to fetch pending transactions', err);
  }
});

// Pending Recipient endpoints
app.post('/api/pending-recipient', authenticateUser, restrictSuspendedUsers, async (req, res) => {
  try {
    let { email, name, createdBy } = req.body;
    
    if (!email) {
      return errorResponse(res, 400, 'Missing email');
    }
    
    email = String(email).toLowerCase().trim();
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return successResponse(res, { 
        pendingRecipient: null,
        user: existingUser,
        message: 'User already exists' 
      });
    }
    
    const existing = await PendingRecipient.findOne({ email, status: 'pending' });
    if (existing) {
      return successResponse(res, { pendingRecipient: existing });
    }
    
    const pendingRecipient = new PendingRecipient({ 
      email, 
      name: name || '', 
      createdBy: createdBy || req.user?._id || '' 
    });
    
    await pendingRecipient.save();
    return successResponse(res, { pendingRecipient }, 201);
  } catch (err) {
    return errorResponse(res, 500, 'Failed to create pending recipient', err);
  }
});

app.get('/api/pending-recipient', authenticateUser, async (req, res) => {
  try {
    const { email, status, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (email) query.email = String(email).toLowerCase().trim();
    if (status) query.status = status;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    const [pendingRecipients, total] = await Promise.all([
      PendingRecipient.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      PendingRecipient.countDocuments(query)
    ]);
    
    return successResponse(res, { 
      pendingRecipients, 
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to fetch pending recipients', err);
  }
});

// FIXED: Admin: list pending recipients with detailed logging
app.get('/api/admin/pending-recipient', requireAdmin, async (req, res) => {
  try {
    console.log('[ADMIN PENDING RECIPIENT] Request received at:', new Date().toISOString());
    console.log('[ADMIN PENDING RECIPIENT] Query params:', req.query);
    console.log('[ADMIN PENDING RECIPIENT] Headers:', {
      'x-admin': req.headers['x-admin'] ? 'present' : 'missing',
      'authorization': req.headers['authorization'] ? 'present' : 'missing',
      'user-id': req.headers['user-id'] ? 'present' : 'missing',
      'x-user-id': req.headers['x-user-id'] ? 'present' : 'missing'
    });
    
    const { status, page = 1, limit = 20, email } = req.query;
    const query = {};
    
    if (status) {
      query.status = status;
    } else {
      query.status = 'pending';
    }
    
    if (email) {
      query.email = String(email).toLowerCase().trim();
    }
    
    console.log('[ADMIN PENDING RECIPIENT] MongoDB query:', query);
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    // Count total first
    const total = await PendingRecipient.countDocuments(query);
    console.log(`[ADMIN PENDING RECIPIENT] Total documents found: ${total}`);
    
    const pendingRecipients = await PendingRecipient.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();
    
    console.log(`[ADMIN PENDING RECIPIENT] Returning ${pendingRecipients.length} pending recipients`);
    
    return successResponse(res, { 
      pendingRecipients, 
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      queryInfo: {
        status: query.status,
        emailFilter: query.email || 'none',
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[ADMIN PENDING RECIPIENT] Failed to fetch pending recipients:', err);
    return errorResponse(res, 500, 'Failed to fetch pending recipients', err);
  }
});

// Admin: recipient history list
app.get('/api/admin/pending-recipient/history', requireAdmin, async (req, res) => {
  try {
    console.log('[ADMIN RECIPIENT HISTORY] Request received');
    
    const { limit = 100, page = 1 } = req.query;
    const limitNum = Math.max(1, Math.min(500, parseInt(limit)));
    const pageNum = Math.max(1, parseInt(page));
    const skip = (pageNum - 1) * limitNum;
    
    const [history, total] = await Promise.all([
      RecipientHistory.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      RecipientHistory.countDocuments({})
    ]);
    
    console.log(`[ADMIN RECIPIENT HISTORY] Returning ${history.length} history records`);
    
    return successResponse(res, { 
      history, 
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('[ADMIN RECIPIENT HISTORY] Failed to fetch recipient history:', err);
    return errorResponse(res, 500, 'Failed to fetch recipient history', err);
  }
});

// Admin: approve pending recipient (creates a minimal User)
app.put('/api/admin/pending-recipient/:id/approve', requireAdmin, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      console.log('[ADMIN APPROVE RECIPIENT] Starting approval for ID:', req.params.id);
      
      const { id } = req.params;
      const { notes } = req.body;
      const adminId = req.headers['x-admin'] || 'admin';
      
      const pr = await PendingRecipient.findById(id).session(session);
      if (!pr) {
        console.log('[ADMIN APPROVE RECIPIENT] Pending recipient not found with ID:', id);
        throw new Error('Pending recipient not found');
      }
      
      console.log('[ADMIN APPROVE RECIPIENT] Found pending recipient:', {
        id: pr._id,
        email: pr.email,
        status: pr.status
      });
      
      if (pr.status !== 'pending') {
        console.log('[ADMIN APPROVE RECIPIENT] Status is not pending:', pr.status);
        const history = new RecipientHistory({
          email: pr.email,
          name: pr.name || '',
          action: 'approve',
          performedBy: adminId,
          performedAt: new Date(),
          recipientId: String(pr._id),
          notes: 'Auto-approved (already processed)'
        });
        
        await history.save({ session });
        await PendingRecipient.deleteOne({ _id: pr._id }).session(session);
        
        return successResponse(res, { 
          success: true, 
          removed: true, 
          reason: 'not_pending', 
          history 
        });
      }

      // Create user if not exists
      let user = await User.findOne({ email: pr.email }).session(session);
      if (!user) {
        console.log('[ADMIN APPROVE RECIPIENT] Creating new user for email:', pr.email);
        const randomPassword = crypto.randomBytes(12).toString('hex');
        const hashed = await bcrypt.hash(randomPassword, 10);
        user = new User({ 
          email: pr.email, 
          password: hashed, 
          name: pr.name || pr.email.split('@')[0],
          emailVerified: true
        });
        
        await user.save({ session });
        console.log('[ADMIN APPROVE RECIPIENT] New user created:', user._id);
      } else {
        console.log('[ADMIN APPROVE RECIPIENT] User already exists:', user._id);
      }

      const history = new RecipientHistory({
        email: pr.email,
        name: pr.name || '',
        action: 'approve',
        performedBy: adminId,
        performedAt: new Date(),
        recipientId: String(pr._id),
        userId: String(user._id),
        notes
      });
      
      await history.save({ session });
      await PendingRecipient.deleteOne({ _id: pr._id }).session(session);

      const safeUser = user.toObject();
      delete safeUser.password;
      
      console.log('[ADMIN APPROVE RECIPIENT] Approval completed successfully');
      
      return successResponse(res, { 
        success: true, 
        removed: true, 
        user: safeUser, 
        history 
      });
    });
  } catch (err) {
    console.error('[ADMIN APPROVE RECIPIENT] Failed to approve pending recipient:', err);
    return errorResponse(res, 500, 'Failed to approve pending recipient', err);
  } finally {
    await session.endSession();
  }
});

// Admin: reject pending recipient
app.put('/api/admin/pending-recipient/:id/reject', requireAdmin, async (req, res) => {
  try {
    console.log('[ADMIN REJECT RECIPIENT] Starting rejection for ID:', req.params.id);
    
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.headers['x-admin'] || 'admin';
    
    const pr = await PendingRecipient.findById(id);
    if (!pr) {
      console.log('[ADMIN REJECT RECIPIENT] Pending recipient not found with ID:', id);
      return errorResponse(res, 404, 'Pending recipient not found');
    }
    
    console.log('[ADMIN REJECT RECIPIENT] Found pending recipient:', {
      id: pr._id,
      email: pr.email,
      status: pr.status
    });
    
    const history = new RecipientHistory({
      email: pr.email,
      name: pr.name || '',
      action: 'reject',
      performedBy: adminId,
      performedAt: new Date(),
      recipientId: String(pr._id),
      notes
    });
    
    await history.save();
    await PendingRecipient.deleteOne({ _id: pr._id });
    
    console.log('[ADMIN REJECT RECIPIENT] Rejection completed successfully');
    
    return successResponse(res, { 
      success: true, 
      removed: true, 
      history 
    });
  } catch (err) {
    console.error('[ADMIN REJECT RECIPIENT] Failed to reject pending recipient:', err);
    return errorResponse(res, 500, 'Failed to reject pending recipient', err);
  }
});

// Admin: list all pending transactions
app.get('/api/admin/pending', requireAdmin, async (req, res) => {
  try {
    console.log('[ADMIN PENDING TX] Request received');
    
    const { days = 30, status, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (status) {
      query.status = status;
    } else {
      query.status = 'pending';
    }
    
    const cutoff = new Date(Date.now() - Math.max(0, days) * 24 * 60 * 60 * 1000);
    query.createdAt = { $gte: cutoff };
    
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
    
    console.log(`[ADMIN PENDING TX] Returning ${pendings.length} pending transactions`);
    
    return successResponse(res, { 
      pendings, 
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      cutoffDate: cutoff
    });
  } catch (err) {
    console.error('[ADMIN PENDING TX] Failed to fetch pending transactions:', err);
    return errorResponse(res, 500, 'Failed to fetch pending transactions', err);
  }
});

// Admin: cleanup old pending transactions and non-pending records
app.delete('/api/admin/pending/cleanup', requireAdmin, async (req, res) => {
  try {
    console.log('[ADMIN CLEANUP] Request received');
    
    const olderThanDays = Number(req.query.olderThanDays || 30);
    const cutoff = new Date(Date.now() - Math.max(0, olderThanDays) * 24 * 60 * 60 * 1000);
    
    console.log('[ADMIN CLEANUP] Cleaning up with cutoff date:', cutoff);
    
    const nonPendingResult = await PendingTransaction.deleteMany({ 
      status: { $ne: 'pending' } 
    });
    
    const oldPendingResult = await PendingTransaction.deleteMany({ 
      status: 'pending', 
      createdAt: { $lt: cutoff } 
    });
    
    console.log('[ADMIN CLEANUP] Cleanup results:', {
      removedNonPending: nonPendingResult.deletedCount || 0,
      removedOldPending: oldPendingResult.deletedCount || 0
    });
    
    return successResponse(res, {
      removedNonPending: nonPendingResult.deletedCount || 0,
      removedOldPending: oldPendingResult.deletedCount || 0,
      cutoffDate: cutoff,
      message: 'Cleanup completed successfully'
    });
  } catch (err) {
    console.error('[ADMIN CLEANUP] Failed to cleanup pending transactions:', err);
    return errorResponse(res, 500, 'Failed to cleanup pending transactions', err);
  }
});

// Admin: approve a pending transaction
app.put('/api/admin/pending/:id/approve', requireAdmin, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { id } = req.params;
      const { notes } = req.body;
      const adminId = req.headers['x-admin'] || 'admin';
      
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

      // For email recipient type we require the pending recipient to be approved (or existing user)
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

      // Perform balance updates (always deduct sender)
      await User.updateOne({ _id: sender._id }, { $inc: { balance: -amt } }, { session });
      sender = await User.findById(sender._id).session(session);

      let senderTx = null;
      let recipientTx = null;

      if (recipient) {
        // Internal recipient: credit and create both transactions
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
      } else {
        // External recipient (crypto wallet / bank) — only create sender tx with recipient details
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
      }

      // Mark pending as claimed/approved
      p.status = 'claimed';
      p.approvedBy = adminId;
      p.approvedAt = new Date();
      p.notes = notes;
      await p.save({ session });

      const freshSender = await User.findById(sender._id).select('-password -__v').lean();
      const freshRecipient = recipient ? 
        await User.findById(recipient._id).select('-password -__v').lean() : 
        null;
      
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
    return errorResponse(res, 500, 'Failed to approve pending transaction', err);
  } finally {
    await session.endSession();
  }
});

// Admin: cancel a pending transaction
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
    
    return successResponse(res, { 
      success: true, 
      pending: p 
    });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to cancel pending transaction', err);
  }
});

// Send money (atomic balance update + create transactions) - RESTRICTED FOR SUSPENDED USERS
app.post('/api/transactions/send', authenticateUser, restrictSuspendedUsers, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      console.log('[transactions:send] start payload', req.body);
      
      let { senderId, recipientType, recipientEmail, recipientDetails, amount, crypto, symbol, paymentMethod, cardId, message } = req.body;
      
      // Normalize bank fields from top-level if not provided inside recipientDetails
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

      // Validation
      const missing = [];
      if (!senderId) missing.push('senderId');
      if (!recipientType) missing.push('recipientType');
      if (amount === undefined || amount === null) missing.push('amount');
      
      if (missing.length > 0) {
        const resp = { 
          error: 'Missing required fields', 
          missing, 
          received: { senderId, recipientType, amount, recipientDetails } 
        };
        console.log('[transactions:send] missing fields', resp);
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
      }

      // Coerce amount to number
      amount = Number(amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount');
      }

      recipientType = String(recipientType || 'email');

      // Normalize email if provided
      if (recipientEmail) {
        recipientEmail = String(recipientEmail).toLowerCase().trim();
      }

      // Normalize recipient details for crypto and bank
      recipientDetails = recipientDetails || {};
      crypto = String(crypto || '').trim();
      symbol = String(symbol || '').trim();
      paymentMethod = String(paymentMethod || 'balance');
      cardId = String(cardId || '');

      // DEBUG: log incoming payload for easier diagnosis of missing-fields issues
      console.log('[transactions:send] incoming payload', { 
        senderId, 
        recipientType, 
        recipientEmail, 
        recipientDetails, 
        amount, 
        crypto, 
        symbol, 
        paymentMethod, 
        cardId 
      });

      // Per-type validation
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

      // REMOVED: Suspension check - handled by restrictSuspendedUsers middleware
      // if (sender.suspended === true) {
      //   throw new Error('Sender account is suspended');
      // }

      // If using wallet balance, ensure sender has sufficient funds before creating pending
      if (paymentMethod !== 'card' && (sender.balance || 0) < amount) {
        throw new Error('Insufficient balance');
      }

      // If using card payment, cardId must be provided
      if (paymentMethod === 'card' && !cardId) {
        throw new Error('Missing cardId for card payment');
      }

      if (recipientType === 'bank') {
        recipientDetails = recipientDetails || {};
        if (!recipientDetails.senderEmail) {
          recipientDetails.senderEmail = sender.email;
        }
      }

      // Prepare pending transaction payload
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
      
      return successResponse(res, { 
        success: true, 
        status: 'pending', 
        pending,
        message: 'Transaction created and pending admin approval'
      });
    });
  } catch (err) {
    console.error('[transactions:send] error', err);
    return errorResponse(res, 500, `Failed to send money: ${err.message}`, err);
  } finally {
    await session.endSession();
  }
});

// User management endpoints
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
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
  } catch (err) {
    return errorResponse(res, 500, 'Failed to fetch users', err);
  }
});

app.get('/api/users/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Allow users to get their own profile or admins to get any profile
    const targetId = id === 'me' ? req.userId : id;
    
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return errorResponse(res, 400, 'Invalid user id');
    }
    
    // Check permissions
    if (targetId !== req.userId && req.user.role !== 'admin') {
      return errorResponse(res, 403, 'You can only view your own profile');
    }
    
    const user = await User.findById(targetId).select('-password -__v');
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    
    return successResponse(res, { user });
  } catch (err) {
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
    return errorResponse(res, 500, 'Failed to fetch user', err);
  }
});

// Admin: suspend or unsuspend a user
app.put('/api/admin/users/:id/suspend', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { suspended, reason } = req.body || {};
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid user id');
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
    
    return successResponse(res, { 
      user: updated,
      message: `User ${desired ? 'suspended' : 'activated'} successfully`
    });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to update user status', err);
  }
});

// Update user profile
app.put('/api/users/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, countryCode, countryName, countryFlag, dialCode, avatar } = req.body;
    
    // Allow users to update their own profile or admins to update any profile
    const targetId = id === 'me' ? req.userId : id;
    
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return errorResponse(res, 400, 'Invalid user id');
    }
    
    // Check if user is updating their own profile
    if (targetId !== req.userId && req.user.role !== 'admin') {
      return errorResponse(res, 403, 'You can only update your own profile');
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (countryCode !== undefined) updateData.countryCode = countryCode;
    if (countryName !== undefined) updateData.countryName = countryName;
    if (countryFlag !== undefined) updateData.countryFlag = countryFlag;
    if (dialCode !== undefined) updateData.dialCode = dialCode;
    if (avatar !== undefined) updateData.avatar = avatar;
    
    const updated = await User.findByIdAndUpdate(
      targetId,
      { $set: updateData },
      { new: true }
    ).select('-password -__v');
    
    if (!updated) {
      return errorResponse(res, 404, 'User not found');
    }
    
    return successResponse(res, { 
      user: updated,
      message: 'Profile updated successfully'
    });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to update profile', err);
  }
});

// Change password
app.put('/api/users/:id/password', authenticateUser, restrictSuspendedUsers, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    
    // Allow users to update their own password only
    const targetId = id === 'me' ? req.userId : id;
    
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return errorResponse(res, 400, 'Invalid user id');
    }
    
    // Check if user is updating their own password
    if (targetId !== req.userId) {
      return errorResponse(res, 403, 'You can only update your own password');
    }
    
    if (!currentPassword || !newPassword) {
      return errorResponse(res, 400, 'Current password and new password are required');
    }
    
    if (newPassword.length < 6) {
      return errorResponse(res, 400, 'New password must be at least 6 characters');
    }
    
    const user = await User.findById(targetId);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return errorResponse(res, 401, 'Current password is incorrect');
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    
    return successResponse(res, { 
      message: 'Password updated successfully' 
    });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to update password', err);
  }
});

// DEBUG: optional users listing (enable with ENABLE_DEBUG=true)
app.get('/api/debug/users', async (req, res) => {
  if (process.env.ENABLE_DEBUG !== 'true') {
    return errorResponse(res, 403, 'Debug endpoint disabled');
  }
  
  try {
    const users = await User.find({}).select('-password -__v');
    return successResponse(res, { users });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to fetch debug users', err);
  }
});

// Statistics endpoint
app.get('/api/stats', requireAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      totalDeposits,
      totalTransactions,
      pendingTransactions,
      totalBalance
    ] = await Promise.all([
      User.countDocuments(),
      Deposit.countDocuments(),
      Transaction.countDocuments(),
      PendingTransaction.countDocuments({ status: 'pending' }),
      User.aggregate([
        { $group: { _id: null, total: { $sum: '$balance' } } }
      ])
    ]);
    
    return successResponse(res, {
      stats: {
        totalUsers,
        totalDeposits,
        totalTransactions,
        pendingTransactions,
        totalBalance: totalBalance[0]?.total || 0,
        activeUsers: await User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
      }
    });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to fetch statistics', err);
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handling middleware
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

// Connect to Mongo
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
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Admin token required: ${process.env.ADMIN_TOKEN ? 'Yes' : 'No (using default)'}`);
    
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 CORS origins: ${allowedOrigins.join(', ')}`);
      console.log(`✅ CORS is ENABLED for: https://fipay.onrender.com`);
      console.log(`🔐 Authentication accepts: x-user-id header, user-id header, Authorization Bearer token, or userId query parameter`);
      console.log(`👑 Admin access methods:`);
      console.log(`   1. Set 'x-admin' header to: ${process.env.ADMIN_TOKEN || 'admin-secret-key-change-this'}`);
      console.log(`   2. Use Authorization: Bearer ${process.env.ADMIN_TOKEN || 'admin-secret-key-change-this'}`);
      console.log(`   3. Login as user with role: 'admin' in database`);
      console.log(`💰 Deposits now included in transactions by default`);
      console.log(`🔓 Suspended users can now login and view their data`);
      console.log(`🚫 Suspended users are restricted from making transactions`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB', err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Starting graceful shutdown...');
  
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
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
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});

start();
