import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const chatTestCaseSchema = new mongoose.Schema(
  {
    scenario: { type: String, required: true },
    preconditions: [String],
    steps: [String],
    expectedResults: { type: String },
    priority: {
      type: String,
      enum: ['High', 'Medium', 'Low'],
      default: 'Medium',
    },
    category: {
      type: String,
      enum: ['functional', 'negative', 'edge', 'security', 'boundary', 'performance', 'integration'],
      default: 'functional',
    },
    status: {
      type: String,
      default: 'Draft',
    },
  },
  { _id: false }
);

const chatSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    messages: [messageSchema],
    generatedTestCases: [chatTestCaseSchema],
    status: {
      type: String,
      enum: ['active', 'saved', 'cleared'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Unique per user+project (not globally) so users cannot collide on sessionId
chatSessionSchema.index({ userId: 1, projectId: 1, sessionId: 1 }, { unique: true });
chatSessionSchema.index({ userId: 1, projectId: 1, createdAt: -1 });

export default mongoose.model('ChatSession', chatSessionSchema);
