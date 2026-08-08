import mongoose from 'mongoose';

const affectedTestCaseSchema = new mongoose.Schema(
  {
    testCaseId: { type: String, required: true },
    scenario: { type: String, required: true },
    impact: {
      type: String,
      enum: ['High', 'Medium', 'Low'],
      required: true,
    },
    reason: { type: String, required: true },
    regressionPriority: {
      type: String,
      enum: ['Immediate', 'Next Sprint', 'Low Priority'],
      required: true,
    },
  },
  { _id: false }
);

const requirementImpactSchema = new mongoose.Schema(
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
    requirementId: {
      type: String,
      default: '',
    },
    oldRequirement: {
      type: String,
      required: true,
    },
    newRequirement: {
      type: String,
      required: true,
    },
    affectedTestCases: [affectedTestCaseSchema],
    impactLevel: {
      type: String,
      enum: ['High', 'Medium', 'Low', 'None'],
      default: 'Low',
    },
    reason: {
      type: String,
      default: '',
    },
    totalAffected: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, projectId: 1, createdAt: -1 },
    ],
  }
);

export default mongoose.model('RequirementImpact', requirementImpactSchema);
