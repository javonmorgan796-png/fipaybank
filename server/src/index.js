require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
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
  max: 200, // Limit each IP to 200 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced CORS configuration for production
const allowedOrigins = process.env.CLIENT_ORIGINS 
  ? process.env.CLIENT_ORIGINS.split(',') 
  : [
      'https://fipay.onrender.com',
      'https://fipaybank.onrender.com'
      // 'http://localhost:5173',
      // 'http://localhost:8080',
      // 'http://localhost:3000' 
      // Keep existing localhost:3000 if you still need it
    ];

console.log('Allowed CORS origins:', allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      // For development, you might want to be more permissive
      if (process.env.NODE_ENV === 'development') {
        console.log('Development mode: Allowing origin', origin);
        return callback(null, true);
      }
      
      const msg = `The CORS policy for this site does not allow access from the specified origin: ${origin}`;
      console.error('CORS blocked:', msg);
      return callback(new Error(msg), false);
    }
  },
 // SIMPLIFIED CORS - Replace lines 45-96 with this:

const corsOptions = {
  origin: ['https://fipay.onrender.com', 'https://fipaybank.onrender.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Fipay Wallet API',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    docs: '/api-docs'
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
  description: { type: String, default: '' }
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

// Authentication middleware (basic)
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 401, 'Authentication required');
    }

    const token = authHeader.split(' ')[1];
    // For now, using simple token check - you should implement proper JWT validation
    const userId = req.headers['x-user-id'] || req.query.userId;
    
    if (!userId) {
      return errorResponse(res, 401, 'User ID required');
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    if (user.suspended) {
      return errorResponse(res, 403, 'Account suspended');
    }

    req.user = user;
    next();
  } catch (error) {
    return errorResponse(res, 500, 'Authentication error', error);
  }
};

// Admin middleware
const requireAdmin = async (req, res, next) => {
  try {
    const adminHeader = req.headers['x-admin'] || req.headers['authorization'];
    
    // For now, using simple check - implement proper admin authentication
    if (!adminHeader) {
      return errorResponse(res, 403, 'Admin access required');
    }

    // You should implement proper admin token validation here
    next();
  } catch (error) {
    return errorResponse(res, 500, 'Admin authentication error', error);
  }
};

// Routes

// Create deposit
app.post('/api/deposits', authenticateUser, async (req, res) => {
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
    
    // Create transaction record
    const transaction = new Transaction({
      userId,
      type: 'deposit',
      amount: Number(amount),
      status: 'pending',
      crypto,
      symbol,
      description: `Deposit ${crypto} ${amount}`,
      reference: deposit._id.toString()
    });
    
    await transaction.save();
    
    return successResponse(res, { deposit, transaction }, 201);
  } catch (err) {
    return errorResponse(res, 500, 'Failed to create deposit', err);
  }
});

// Get deposits (all or by userId)
app.get('/api/deposits', authenticateUser, async (req, res) => {
  try {
    const { userId, status, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (userId) query.userId = String(userId);
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

      // Update transaction status
      await Transaction.findOneAndUpdate(
        { reference: id, type: 'deposit' },
        { status: 'completed' },
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

    // Update transaction status
    await Transaction.findOneAndUpdate(
      { reference: id, type: 'deposit' },
      { status: 'failed' }
    );

    return successResponse(res, { deposit });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to reject deposit', err);
  }
});

// Get transactions (by userId)
app.get('/api/transactions', authenticateUser, async (req, res) => {
  try {
    const { userId, type, status, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (userId) query.userId = String(userId);
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
    return errorResponse(res, 500, 'Failed to fetch transactions', err);
  }
});

// Create pending transaction
app.post('/api/pending', authenticateUser, async (req, res) => {
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
app.post('/api/pending-recipient', authenticateUser, async (req, res) => {
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

// Admin: list pending recipients
app.get('/api/admin/pending-recipient', requireAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { status: status || 'pending' };
    
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

// Admin: recipient history list
app.get('/api/admin/pending-recipient/history', requireAdmin, async (req, res) => {
  try {
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
    return errorResponse(res, 500, 'Failed to fetch recipient history', err);
  }
});

// Admin: approve pending recipient (creates a minimal User)
app.put('/api/admin/pending-recipient/:id/approve', requireAdmin, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { id } = req.params;
      const { notes } = req.body;
      const adminId = req.headers['x-admin'] || 'admin';
      
      const pr = await PendingRecipient.findById(id).session(session);
      if (!pr) {
        throw new Error('Pending recipient not found');
      }
      
      if (pr.status !== 'pending') {
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
        const randomPassword = crypto.randomBytes(12).toString('hex');
        const hashed = await bcrypt.hash(randomPassword, 10);
        user = new User({ 
          email: pr.email, 
          password: hashed, 
          name: pr.name || pr.email.split('@')[0],
          emailVerified: true
        });
        
        await user.save({ session });
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
      
      return successResponse(res, { 
        success: true, 
        removed: true, 
        user: safeUser, 
        history 
      });
    });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to approve pending recipient', err);
  } finally {
    await session.endSession();
  }
});

// Admin: reject pending recipient
app.put('/api/admin/pending-recipient/:id/reject', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.headers['x-admin'] || 'admin';
    
    const pr = await PendingRecipient.findById(id);
    if (!pr) {
      return errorResponse(res, 404, 'Pending recipient not found');
    }
    
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
    
    return successResponse(res, { 
      success: true, 
      removed: true, 
      history 
    });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to reject pending recipient', err);
  }
});

// Admin: list all pending transactions
app.get('/api/admin/pending', requireAdmin, async (req, res) => {
  try {
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
    return errorResponse(res, 500, 'Failed to fetch pending transactions', err);
  }
});

// Admin: cleanup old pending transactions and non-pending records
app.delete('/api/admin/pending/cleanup', requireAdmin, async (req, res) => {
  try {
    const olderThanDays = Number(req.query.olderThanDays || 30);
    const cutoff = new Date(Date.now() - Math.max(0, olderThanDays) * 24 * 60 * 60 * 1000);
    
    const nonPendingResult = await PendingTransaction.deleteMany({ 
      status: { $ne: 'pending' } 
    });
    
    const oldPendingResult = await PendingTransaction.deleteMany({ 
      status: 'pending', 
      createdAt: { $lt: cutoff } 
    });
    
    return successResponse(res, {
      removedNonPending: nonPendingResult.deletedCount || 0,
      removedOldPending: oldPendingResult.deletedCount || 0,
      cutoffDate: cutoff,
      message: 'Cleanup completed successfully'
    });
  } catch (err) {
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

// Send money (atomic balance update + create transactions)
app.post('/api/transactions/send', authenticateUser, async (req, res) => {
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

      if (sender.suspended === true) {
        throw new Error('Sender account is suspended');
      }

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

    if (user.suspended) {
      return errorResponse(res, 403, 'Account suspended');
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return errorResponse(res, 401, 'Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    return successResponse(res, { user: userObj });
  } catch (err) {
    console.error('[login] error', err);
    return errorResponse(res, 500, 'Failed to login', err);
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
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid user id');
    }
    
    const user = await User.findById(id).select('-password -__v');
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
          ...(reason && { suspensionReason: reason })
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
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid user id');
    }
    
    // Check if user is updating their own profile
    if (req.user._id.toString() !== id && req.user.role !== 'admin') {
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
      id,
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
app.put('/api/users/:id/password', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid user id');
    }
    
    // Check if user is updating their own password
    if (req.user._id.toString() !== id) {
      return errorResponse(res, 403, 'You can only update your own password');
    }
    
    if (!currentPassword || !newPassword) {
      return errorResponse(res, 400, 'Current password and new password are required');
    }
    
    if (newPassword.length < 6) {
      return errorResponse(res, 400, 'New password must be at least 6 characters');
    }
    
    const user = await User.findById(id);
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
    
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 CORS origins: ${allowedOrigins.join(', ')}`);
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
