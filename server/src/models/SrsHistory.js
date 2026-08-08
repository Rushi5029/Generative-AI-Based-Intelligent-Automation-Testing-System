import mongoose from 'mongoose';

const srsHistorySchema = new mongoose.Schema(
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
      default: 'default',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    srsText: {
      type: String,
      required: true,
    },
    testCaseCount: {
      type: Number,
      default: 0,
    },
    // Snapshot of generated cases so "Load" can restore more than SRS text
    testCasesSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

srsHistorySchema.index({ userId: 1, projectId: 1, createdAt: -1 });

export default mongoose.model('SrsHistory', srsHistorySchema);
