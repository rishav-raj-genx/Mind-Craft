const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { body } = require('express-validator');
const router = express.Router();

const { requireAuth, optionalAuth } = require('../middleware/auth');
const { formatValidationErrors } = require('../middleware/errorHandler');
const { prisma } = require('../config/prisma');
const { awardForumAnswer } = require('../services/tokenEconomy');
const { generateStudyHint } = require('../services/sarvamAI');
const { v4: uuidv4 } = require('uuid');
const { getPagination } = require('../utils/pagination');
const { broadcastToGlobal } = require('../services/chatService');

const MAX_DOUBT_IMAGES = 4;
const MAX_DOUBT_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_COMPRESSED_IMAGE_BYTES = 320 * 1024;
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

const uploadDoubtImages = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_DOUBT_IMAGE_BYTES,
    files: MAX_DOUBT_IMAGES,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    const err = new Error(`Invalid image format: "${file.mimetype}". Upload JPG, PNG, WEBP, HEIC, or HEIF.`);
    err.statusCode = 415;
    cb(err, false);
  },
});

async function findUser(uid) {
  if (!uid) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uid);
  return prisma.user.findFirst({
    where: {
      OR: [
        { clerkUserId: uid },
        ...(isUuid ? [{ id: uid }] : []),
      ],
      deletedAt: null,
    },
  });
}

const compressDoubtImage = async (file, index) => {
  let buffer = await sharp(file.buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72, effort: 4 })
    .toBuffer();

  if (buffer.length > MAX_COMPRESSED_IMAGE_BYTES) {
    buffer = await sharp(file.buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 58, effort: 5 })
      .toBuffer();
  }

  const metadata = await sharp(buffer).metadata();

  return {
    id: uuidv4(),
    order: index,
    mimeType: 'image/webp',
    fileName: `${file.fieldname || 'doubt'}-${index + 1}.webp`,
    width: metadata.width || null,
    height: metadata.height || null,
    size: buffer.length,
    dataUri: `data:image/webp;base64,${buffer.toString('base64')}`,
    createdAt: Date.now(),
  };
};

const attachCompressedDoubtImages = async (req, _res, next) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      req.doubtImages = [];
      return next();
    }
    req.doubtImages = await Promise.all(files.map(compressDoubtImage));
    next();
  } catch (err) {
    err.statusCode = err.statusCode || 400;
    next(err);
  }
};

const attachSarvamStudyHint = async (req, _res, next) => {
  try {
    const errors = formatValidationErrors(req);
    if (errors) return next();

    const { hint, model, usage, fallback, warning } = await generateStudyHint({
      title: req.body.title,
      content: req.body.content,
      tag: req.body.tag,
    });

    req.aiAssist = {
      hint,
      provider: 'sarvam-ai',
      model,
      status: hint ? (fallback ? 'FALLBACK' : 'GENERATED') : 'EMPTY',
      usage,
      error: warning || '',
      generatedAt: new Date(),
    };
  } catch (err) {
    console.warn('Sarvam AI study hint skipped:', err.message);
    req.aiAssist = {
      hint: '',
      provider: 'sarvam-ai',
      status: 'FAILED',
      error: err.message,
      generatedAt: new Date(),
    };
  }
  next();
};

function formatDoubt(d, currentUserId = null) {
  const images = (d.images || []).map((img) => ({
    id: img.id,
    order: img.sortOrder,
    mimeType: img.mimeType,
    fileName: img.fileName,
    width: img.width,
    height: img.height,
    size: img.sizeBytes,
    dataUri: img.objectKey,
  }));

  const answers = (d.answers || []).map((a) => ({
    answerId: a.id,
    id: a.id,
    authorUid: a.author?.clerkUserId || a.authorId,
    authorName: a.author?.name || 'Anonymous',
    authorPhoto: a.author?.photoUrl || '',
    content: a.content,
    createdAt: new Date(a.createdAt).getTime(),
    isAccepted: a.isAccepted,
  }));

  const hasUpvoted = currentUserId
    ? (d.votes || []).some((v) => v.userId === currentUserId)
    : false;

  return {
    id: d.id,
    questionId: d.id,
    authorUid: d.author?.clerkUserId || d.authorId,
    authorName: d.author?.name || 'Anonymous',
    authorPhoto: d.author?.photoUrl || '',
    authorCollege: d.author?.college?.name || '',
    authorDepartment: d.author?.department?.name || '',
    title: d.title,
    content: d.content,
    tag: d.primaryTag || 'General',
    images,
    upvotes: d.upvoteCount,
    hasUpvoted,
    answersCount: answers.length,
    answers,
    aiHint: d.aiHint || '',
    aiAssistStatus: (d.aiAssistStatus || '').toLowerCase(),
    createdAt: new Date(d.createdAt).getTime(),
  };
}

router.post(
  '/',
  requireAuth,
  uploadDoubtImages.array('images', MAX_DOUBT_IMAGES),
  attachCompressedDoubtImages,
  [
    body('title').trim().isLength({ min: 5 }).withMessage('Title must be at least 5 characters'),
    body('content').trim().isLength({ min: 10 }).withMessage('Content must be at least 10 characters'),
    body('tag').trim().notEmpty().withMessage('Subject tag is required'),
  ],
  attachSarvamStudyHint,
  async (req, res, next) => {
    try {
      const errors = formatValidationErrors(req);
      if (errors) return res.status(400).json(errors);

      const user = await findUser(req.user.clerkUserId);
      if (!user) return res.status(404).json({ success: false, error: 'User not found' });

      const doubtRecord = await prisma.$transaction(async (tx) => {
        const doubt = await tx.doubt.create({
          data: {
            authorId: user.id,
            title: req.body.title.trim(),
            content: req.body.content.trim(),
            primaryTag: req.body.tag.trim(),
            aiHint: req.aiAssist?.hint || null,
            aiAssistProvider: req.aiAssist?.provider || 'sarvam-ai',
            aiAssistModel: req.aiAssist?.model || null,
            aiAssistStatus: req.aiAssist?.status || 'EMPTY',
            aiAssistUsage: req.aiAssist?.usage || undefined,
            aiAssistGeneratedAt: req.aiAssist?.generatedAt || null,
            aiAssistError: req.aiAssist?.error || null,
          },
        });

        if (req.doubtImages?.length) {
          await tx.doubtImage.createMany({
            data: req.doubtImages.map((img) => ({
              doubtId: doubt.id,
              uploadedBy: user.id,
              objectKey: img.dataUri,
              mimeType: img.mimeType,
              fileName: img.fileName,
              width: img.width,
              height: img.height,
              sizeBytes: img.size,
              sortOrder: img.order,
            })),
          });
        }

        return tx.doubt.findUnique({
          where: { id: doubt.id },
          include: { author: { include: { college: true, department: true } }, images: true, answers: true, votes: true },
        });
      });

      const formatted = formatDoubt(doubtRecord, user.id);

      // Broadcast new doubt to active users
      prisma.user.findMany({
        where: { id: { not: user.id }, deletedAt: null },
        select: { clerkUserId: true },
        take: 50,
      }).then((recipients) => {
        recipients.forEach((r) => {
          broadcastToGlobal(r.clerkUserId, {
            type: 'global_forum_doubt',
            subType: 'new_doubt',
            notification: {
              title: 'New Doubt Posted',
              body: `${user.name} asked: "${formatted.title}"`,
            },
            data: {
              doubtId: formatted.id,
              authorUid: user.clerkUserId,
              authorName: user.name,
              title: formatted.title,
              route: `/forum?doubtId=${formatted.id}`,
            },
          });
        });
      }).catch(() => {});

      res.status(201).json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { tag } = req.query;
    const { limit, offset } = getPagination(req.query);

    const currentUser = req.user?.clerkUserId ? await findUser(req.user.clerkUserId) : null;

    const doubts = await prisma.doubt.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        ...(tag ? { primaryTag: tag } : {}),
      },
      include: {
        author: { include: { college: true, department: true } },
        images: true,
        answers: { where: { deletedAt: null }, include: { author: true } },
        votes: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const formatted = doubts.map((d) => formatDoubt(d, currentUser?.id));

    res.json({
      success: true,
      count: formatted.length,
      limit,
      offset,
      hasMore: formatted.length === limit,
      data: formatted,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUser = req.user?.clerkUserId ? await findUser(req.user.clerkUserId) : null;

    const doubt = await prisma.doubt.findUnique({
      where: { id },
      include: {
        author: { include: { college: true, department: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        answers: {
          where: { deletedAt: null },
          include: { author: true },
          orderBy: { createdAt: 'asc' },
        },
        votes: true,
      },
    });

    if (!doubt || doubt.deletedAt) {
      return res.status(404).json({ success: false, error: 'Doubt not found' });
    }

    res.json({ success: true, data: formatDoubt(doubt, currentUser?.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/answer', requireAuth, [
  body('content').trim().isLength({ min: 5 }).withMessage('Answer must be at least 5 characters'),
], async (req, res, next) => {
  try {
    const errors = formatValidationErrors(req);
    if (errors) return res.status(400).json(errors);

    const { id } = req.params;
    const user = await findUser(req.user.clerkUserId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const doubt = await prisma.doubt.findUnique({
      where: { id },
      include: { author: true },
    });

    if (!doubt || doubt.deletedAt) {
      return res.status(404).json({ success: false, error: 'Doubt not found' });
    }

    const answer = await prisma.$transaction(async (tx) => {
      const created = await tx.doubtAnswer.create({
        data: {
          doubtId: id,
          authorId: user.id,
          content: req.body.content.trim(),
        },
        include: { author: true },
      });

      await tx.doubt.update({
        where: { id },
        data: { answerCount: { increment: 1 } },
      });

      return created;
    });

    try {
      await awardForumAnswer(user.clerkUserId, id);
    } catch (_err) {}

    broadcastToGlobal(doubt.author.clerkUserId, {
      type: 'global_forum_doubt',
      subType: 'new_answer',
      notification: {
        title: 'New Answer on Your Doubt',
        body: `${user.name} answered: "${req.body.content.trim().slice(0, 80)}"`,
      },
      data: {
        doubtId: id,
        route: `/forum?doubtId=${id}`,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        answerId: answer.id,
        id: answer.id,
        authorUid: user.clerkUserId,
        authorName: user.name,
        authorPhoto: user.photoUrl || '',
        content: answer.content,
        createdAt: new Date(answer.createdAt).getTime(),
        isAccepted: false,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/upvote', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await findUser(req.user.clerkUserId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const doubt = await prisma.doubt.findUnique({
      where: { id },
      select: { id: true, upvoteCount: true, deletedAt: true },
    });

    if (!doubt || doubt.deletedAt) {
      return res.status(404).json({ success: false, error: 'Doubt not found' });
    }

    const existingVote = await prisma.doubtVote.findUnique({
      where: { doubtId_userId: { doubtId: id, userId: user.id } },
    });

    let hasUpvoted = false;
    let upvotes = doubt.upvoteCount;

    if (existingVote) {
      await prisma.$transaction([
        prisma.doubtVote.delete({
          where: { doubtId_userId: { doubtId: id, userId: user.id } },
        }),
        prisma.doubt.update({
          where: { id },
          data: { upvoteCount: { decrement: 1 } },
        }),
      ]);
      hasUpvoted = false;
      upvotes = Math.max(0, upvotes - 1);
    } else {
      await prisma.$transaction([
        prisma.doubtVote.create({
          data: { doubtId: id, userId: user.id },
        }),
        prisma.doubt.update({
          where: { id },
          data: { upvoteCount: { increment: 1 } },
        }),
      ]);
      hasUpvoted = true;
      upvotes += 1;
    }

    res.json({ success: true, data: { upvotes, hasUpvoted } });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await findUser(req.user.clerkUserId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const doubt = await prisma.doubt.findUnique({
      where: { id },
      include: { author: true },
    });

    if (!doubt) {
      return res.status(404).json({ success: false, error: 'Doubt not found' });
    }

    if (doubt.author.clerkUserId !== req.user.clerkUserId) {
      return res.status(403).json({ success: false, error: 'Unauthorized to delete this doubt' });
    }

    await prisma.doubt.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: new Date() },
    });

    res.json({ success: true, message: 'Doubt deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
