import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('⚠️ MONGODB_URI environment variable is not set on Render. MongoDB features are operating in fallback/demo mode. To connect a live database, add MONGODB_URI in your Render Dashboard.');
      return null;
    }
  }

  const uriToUse = mongoUri || 'mongodb://localhost:27017/ai-testing-system';

  try {
    const conn = await mongoose.connect(uriToUse, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    if (process.env.NODE_ENV === 'production') {
      logger.warn('⚠️ MongoDB connection could not be established. Server continuing to operate for health checks and API endpoints.');
      return null;
    }
    throw error;
  }
};

export default connectDB;
