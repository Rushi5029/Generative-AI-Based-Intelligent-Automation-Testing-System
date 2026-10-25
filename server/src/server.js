import './env.js';
import express from 'express';
import cors from 'cors';
import connectDB from './config/database.js';
import config from './config/index.js';
import logger from './utils/logger.js';
import { errorHandler } from './middleware/error.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { requestLogger, projectContext } from './middleware/common.js';

import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import testCaseRoutes from './routes/testCaseRoutes.js';
import requirementRoutes from './routes/requirementRoutes.js';
import testRunRoutes from './routes/testRunRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import healthRoutes from './routes/healthRoutes.js';

// Initialize Express application
const app = express();

// Database Connection
const connectDatabaseAsync = async (retryCount = 0) => {
  try {
    await connectDB();
    // Rebuild indexes so ChatSession uniqueness is per-user+project (not global sessionId)
    try {
      const { default: ChatSession } = await import('./models/ChatSession.js');
      await ChatSession.syncIndexes();
    } catch (idxErr) {
      logger.warn(`ChatSession index sync skipped: ${idxErr.message}`);
    }
  } catch (error) {
    logger.error(`Database connection attempt ${retryCount + 1} failed: ${error.message}`);
    if (config.env === 'production' && retryCount < 5) {
      logger.info('Retrying database connection in 10 seconds...');
      setTimeout(() => connectDatabaseAsync(retryCount + 1), 10000);
    }
  }
};

connectDatabaseAsync();

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (config.env === 'development' || config.corsOrigin === '*') {
        return callback(null, true);
      }
      const allowedOrigins = (config.corsOrigin || '').split(',').map((s) => s.trim().replace(/\/$/, ''));
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Project-Id', 'X-Request-Id'],
  })
);

app.use(requestLogger);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api', projectContext);

// Rate limiting
app.use('/api/', generalLimiter);

// Health Check Routes
app.use('/', healthRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/test-cases', testCaseRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/test-runs', testRunRoutes);
app.use('/api/history', historyRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Global Error Handler
app.use(errorHandler);

// Start Server
const PORT = config.port || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`✅ Server started successfully on port ${PORT} (0.0.0.0)`);
  logger.info(`Environment: ${config.env}`);
  const maskedDb = (process.env.MONGODB_URI || '').replace(/:([^:@]+)@/, ':****@');
  logger.info(`Database: ${maskedDb}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  logger.error(`Unhandled Rejection: ${error.message}`);
  if (config.env === 'production') {
    server.close(() => process.exit(1));
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  if (config.env === 'production') {
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
