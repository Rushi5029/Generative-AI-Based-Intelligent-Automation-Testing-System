import mongoose from 'mongoose';

const generatedTestDataSchema = new mongoose.Schema(
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
    requirement: {
      type: String,
      required: true,
    },
    valid: [String],
    invalid: [String],
    boundary: [String],
    edge: [String],
    security: [String],
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, projectId: 1, createdAt: -1 },
    ],
  }
);

export default mongoose.model('GeneratedTestData', generatedTestDataSchema);
