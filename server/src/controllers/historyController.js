import SrsHistory from '../models/SrsHistory.js';
import { catchAsync } from '../middleware/error.js';

export const listSrsHistory = catchAsync(async (req, res) => {
  const projectId = req.query.projectId || req.projectId || 'default';
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

  const entries = await SrsHistory.find({
    userId: req.user.id,
    projectId,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  res.status(200).json({
    success: true,
    data: entries.map((entry) => ({
      id: String(entry._id),
      title: entry.title,
      srsText: entry.srsText,
      testCaseCount: entry.testCaseCount || 0,
      testCasesSnapshot: entry.testCasesSnapshot || [],
      createdAt: entry.createdAt,
      projectId: entry.projectId,
    })),
  });
});

export const createSrsHistory = catchAsync(async (req, res) => {
  const projectId = req.body.projectId || req.projectId || 'default';
  const { title, srsText, testCaseCount, testCasesSnapshot } = req.body;

  if (!srsText || !String(srsText).trim()) {
    return res.status(400).json({
      success: false,
      message: 'srsText is required',
    });
  }

  const entry = await SrsHistory.create({
    userId: req.user.id,
    projectId,
    title: title || `SRS - ${new Date().toLocaleString()}`,
    srsText: String(srsText),
    testCaseCount: Number(testCaseCount) || (Array.isArray(testCasesSnapshot) ? testCasesSnapshot.length : 0),
    testCasesSnapshot: Array.isArray(testCasesSnapshot) ? testCasesSnapshot.slice(0, 200) : [],
  });

  // Cap history per user+project at 50 entries
  const excess = await SrsHistory.find({ userId: req.user.id, projectId })
    .sort({ createdAt: -1 })
    .skip(50)
    .select('_id');
  if (excess.length) {
    await SrsHistory.deleteMany({ _id: { $in: excess.map((d) => d._id) } });
  }

  res.status(201).json({
    success: true,
    message: 'SRS history saved',
    data: {
      id: String(entry._id),
      title: entry.title,
      srsText: entry.srsText,
      testCaseCount: entry.testCaseCount,
      testCasesSnapshot: entry.testCasesSnapshot,
      createdAt: entry.createdAt,
      projectId: entry.projectId,
    },
  });
});

export const deleteSrsHistory = catchAsync(async (req, res) => {
  const entry = await SrsHistory.findOneAndDelete({
    _id: req.params.id,
    userId: req.user.id,
  });

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: 'History entry not found',
    });
  }

  res.status(200).json({
    success: true,
    message: 'History entry deleted',
  });
});
