import mongoose from 'mongoose';

const aiLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    action: {
      type: String,
      enum: [
        'generate_test_cases',
        'detect_ambiguities',
        'prioritize_tests',
        'generate_script',
        'analyze_coverage',
        'detect_duplicates',
        'generate_negative_cases',
        'assess_risk',
        'create_traceability',
        'change_impact',
        'generate_test_data',
        'chat_testcase',
        'chat_testcase_stream',
        'chat_testcase_save',
        'save_chat_testcases',
      ],
      required: true,
      index: true,
    },
    inputText: String,
    inputLength: Number,
    outputLength: Number,
    apiProvider: {
      type: String,
      enum: ['OpenAI', 'HuggingFace', 'Claude', 'Local', 'Gemini'],
      default: 'Gemini',
    },
    model: {
      type: String,
      default: 'gpt-3.5-turbo',
    },
    tokensUsed: {
      prompt: Number,
      completion: Number,
      total: Number,
    },
    costEstimate: Number,
    executionTime: Number,
    status: {
      type: String,
      enum: ['Success', 'Failed', 'Partial', 'Retry'],
      default: 'Success',
    },
    errorMessage: String,
    retryCount: {
      type: Number,
      default: 0,
    },
    relatedEntity: {
      entityType: {
        type: String,
        enum: ['Requirement', 'TestCase', 'Project'],
      },
      entityId: mongoose.Schema.Types.ObjectId,
    },
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, createdAt: -1 },
      { action: 1, status: 1 },
      { 'relatedEntity.entityId': 1 },
    ],
  }
);

export default mongoose.model('AILog', aiLogSchema);
