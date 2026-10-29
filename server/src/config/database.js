import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;
  const isCloudOrProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.RENDER === 'true' ||
    Boolean(process.env.RENDER_SERVICE_ID) ||
    Boolean(process.env.VERCEL);

  // If in cloud/production and no URI or pointing to localhost/127.0.0.1, skip attempting local connect
  if (!mongoUri || mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1')) {
    if (isCloudOrProduction) {
      logger.warn(
        '⚠️ No cloud MongoDB Atlas URI found in cloud environment (MONGODB_URI is unset or points to localhost). ' +
        'Please add your MongoDB Atlas connection string (mongodb+srv://...) in the Render Dashboard -> Environment tab. ' +
        'Continuing in resilient mode without crashing.'
      );
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
    if (isCloudOrProduction) {
      logger.warn('⚠️ MongoDB connection could not be established. Server continuing to operate for health checks and API endpoints.');
      return null;
    }
    throw error;
  }
};

export default connectDB;
