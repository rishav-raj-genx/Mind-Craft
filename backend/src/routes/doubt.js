const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();

const { verifyFirebaseToken }    = require('../middleware/auth');
const { formatValidationErrors } = require('../middleware/errorHandler');
const { getDriver } = require('../config/neo4j');
const { awardForumAnswer } = require('../services/tokenEconomy');
const { generateStudyHint } = require('../services/sarvamAI');
const { v4: uuidv4 } = require('uuid');

const toNumber = (val) => (val && val.toNumber ? val.toNumber() : val);
const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
};
const parseJsonValue = (value, fallback = null) => {
  if (!value || typeof value !== 'string') return value || fallback;
  try {
    return JSON.parse(value);
  } catch (_err) {
    return fallback;
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
      status: hint ? (fallback ? 'fallback' : 'generated') : 'empty',
      usage,
      error: warning || '',
      generatedAt: Date.now(),
    };
  } catch (err) {
    console.warn('Sarvam AI study hint skipped:', err.message);
    req.aiAssist = {
      hint: '',
      provider: 'sarvam-ai',
      status: 'failed',
      error: err.message,
      generatedAt: Date.now(),
    };
  }

  next();
};

const hydrateMissingStudyHints = async (session, doubts) => {
  const missing = doubts
    .filter(d => d.id && d.title && d.content && (!d.aiHint || ['empty', 'failed', 'fallback'].includes(d.aiAssistStatus)))
    .slice(0, 5);

  if (missing.length === 0) return doubts;

  await Promise.all(missing.map(async (d) => {
    try {
      const { hint, model, usage, fallback, warning } = await generateStudyHint({
        title: d.title,
        content: d.content,
        tag: d.tag,
      });

      if (!hint) return;

      d.aiHint = hint;
      d.aiAssistProvider = 'sarvam-ai';
      d.aiAssistModel = model || '';
      d.aiAssistStatus = fallback ? 'fallback' : 'generated';
      d.aiAssistUsage = usage || null;
      d.aiAssistGeneratedAt = Date.now();
      d.aiAssistError = warning || '';

      await session.executeWrite(tx => tx.run(`
        MATCH (d:Doubt {id: $id})
        SET d.aiHint = $hint,
            d.aiAssistProvider = 'sarvam-ai',
            d.aiAssistModel = $model,
            d.aiAssistStatus = $status,
            d.aiAssistUsage = $usage,
            d.aiAssistGeneratedAt = $generatedAt,
            d.aiAssistError = $error
      `, {
        id: d.id,
        hint,
        model: d.aiAssistModel,
        status: d.aiAssistStatus,
        usage: usage ? JSON.stringify(usage) : '',
        generatedAt: d.aiAssistGeneratedAt,
        error: d.aiAssistError,
      }));
    } catch (err) {
      console.warn(`Sarvam AI backfill skipped for doubt ${d.id}:`, err.message);
    }
  }));

  return doubts;
};

const broadcastNewDoubt = async (doubt) => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.executeRead(tx => tx.run(`
      MATCH (u:User)
      WHERE u.uid <> $authorUid
      RETURN u.uid AS uid, u.fcmToken AS fcmToken
    `, { authorUid: doubt.authorUid }));

    const { broadcastToGlobal } = require('../services/chatService');
    const payload = {
      type: 'global_forum_doubt',
      subType: 'new_doubt',
      notification: {
        title: 'New Doubt Posted',
        body: `${doubt.authorName} asked: "${doubt.title}"`,
      },
      data: {
        doubtId: doubt.id,
        authorUid: doubt.authorUid,
        authorName: doubt.authorName,
        title: doubt.title,
        content: doubt.content,
        tag: doubt.tag,
        createdAt: doubt.createdAt,
        route: `/forum?doubtId=${doubt.id}`,
      },
    };

    for (const record of result.records) {
      const uid = record.get('uid');
      const fcmToken = record.get('fcmToken');
      broadcastToGlobal(uid, payload);

      if (fcmToken) {
        try {
          const { admin } = require('../config/firebase');
          await admin.messaging().send({
            token: fcmToken,
            notification: payload.notification,
            data: {
              type: 'forum_doubt',
              doubtId: doubt.id,
              route: `/forum?doubtId=${doubt.id}`,
            },
          });
        } catch (err) {
          console.warn('Forum FCM push skipped:', err.message);
        }
      }
    }
  } catch (err) {
    console.warn('Forum broadcast skipped:', err.message);
  } finally {
    await session.close();
  }
};

router.get('/', verifyFirebaseToken, async (req, res, next) => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const { tag } = req.query;
    let query = `MATCH (d:Doubt) RETURN d ORDER BY d.createdAt DESC LIMIT 50`;
    let params = {};
    if (tag && tag !== 'All Doubts') {
      query = `MATCH (d:Doubt {tag: $tag}) RETURN d ORDER BY d.createdAt DESC LIMIT 50`;
      params = { tag };
    }
    const result = await session.executeRead(tx => tx.run(query, params));
    let doubts = result.records.map(r => {
      const d = r.get('d').properties;
      d.createdAt = toNumber(d.createdAt);
      d.upvotes = toNumber(d.upvotes);
      d.answerCount = toNumber(d.answerCount);
      // Fetch answers and upvotes later or assume empty for list view
      d.answers = parseJsonArray(d.answers);
      d.upvotedBy = parseJsonArray(d.upvotedBy);
      d.aiAssistUsage = parseJsonValue(d.aiAssistUsage, null);
      return d;
    });
    doubts = await hydrateMissingStudyHints(session, doubts);
    res.json({ success: true, data: doubts });
  } catch (err) { next(err); } finally { await session.close(); }
});

router.get('/trending', verifyFirebaseToken, async (req, res, next) => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.executeRead(tx => tx.run(`
      MATCH (d:Doubt)
      RETURN d.tag AS tag, count(d) AS count
      ORDER BY count DESC LIMIT 6
    `));
    const trending = result.records.map(r => ({ tag: r.get('tag'), count: toNumber(r.get('count')) })).filter(t => t.tag);
    res.json({ success: true, data: trending });
  } catch (err) { next(err); } finally { await session.close(); }
});

router.post('/', verifyFirebaseToken, [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('content').trim().notEmpty().withMessage('Content is required'),
  body('tag').trim().notEmpty().withMessage('Tag is required'),
], attachSarvamStudyHint, async (req, res, next) => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const errors = formatValidationErrors(req);
    if (errors) return res.status(400).json(errors);
    const uid = req.user.uid;
    let authorName = req.user.name || req.user.email || 'Anonymous';
    let authorAvatar = req.user.picture || '';

    const userRes = await session.executeRead(tx => tx.run(`MATCH (u:User {uid: $uid}) RETURN u`, { uid }));
    if(userRes.records.length > 0) {
      const u = userRes.records[0].get('u').properties;
      authorName = u.name || authorName;
      authorAvatar = u.photoUrl || authorAvatar;
    }

    const id = uuidv4();
    const doubt = {
      id, authorUid: uid, authorName, 
      authorAvatar: authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=7C3AED&color=fff`,
      title: req.body.title, content: req.body.content, tag: req.body.tag,
      upvotes: 0, answerCount: 0, createdAt: Date.now(),
      answers: JSON.stringify([]), upvotedBy: JSON.stringify([]),
      aiHint: req.aiAssist?.hint || '',
      aiAssistProvider: req.aiAssist?.provider || 'sarvam-ai',
      aiAssistModel: req.aiAssist?.model || '',
      aiAssistStatus: req.aiAssist?.status || 'skipped',
      aiAssistUsage: req.aiAssist?.usage ? JSON.stringify(req.aiAssist.usage) : '',
      aiAssistGeneratedAt: req.aiAssist?.generatedAt || Date.now(),
      aiAssistError: req.aiAssist?.error || ''
    };

    await session.executeWrite(tx => tx.run(`CREATE (d:Doubt) SET d = $doubt`, { doubt }));
    broadcastNewDoubt(doubt);
    
    const ret = {...doubt, answers: [], upvotedBy: [], aiAssistUsage: parseJsonValue(doubt.aiAssistUsage, null)};
    res.status(201).json({ success: true, data: ret });
  } catch (err) { next(err); } finally { await session.close(); }
});

router.post('/:id/answer', verifyFirebaseToken, [
  body('content').trim().notEmpty().withMessage('Answer content is required'),
], async (req, res, next) => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const errors = formatValidationErrors(req);
    if (errors) return res.status(400).json(errors);
    const uid = req.user.uid;
    
    let authorName = req.user.name || 'Anonymous';
    let authorAvatar = req.user.picture || '';
    const userRes = await session.executeRead(tx => tx.run(`MATCH (u:User {uid: $uid}) RETURN u`, { uid }));
    if(userRes.records.length > 0) {
      const u = userRes.records[0].get('u').properties;
      authorName = u.name || authorName;
      authorAvatar = u.photoUrl || authorAvatar;
    }

    const answer = { uid, authorName, authorAvatar: authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=DCFD8B&color=151f00`, content: req.body.content, createdAt: Date.now() };
    
    const result = await session.executeWrite(tx => tx.run(`
      MATCH (d:Doubt {id: $id})
      RETURN d
    `, { id: req.params.id }));
    if(result.records.length === 0) return res.status(404).json({ success: false, error: 'Doubt not found' });
    
    const dProp = result.records[0].get('d').properties;
    const answers = parseJsonArray(dProp.answers);
    answers.push(answer);
    
    await session.executeWrite(tx => tx.run(`
      MATCH (d:Doubt {id: $id})
      MATCH (u:User {uid: $uid})
      MERGE (u)-[:ANSWERED]->(d)
      SET d.answers = $answers, d.answerCount = coalesce(d.answerCount, 0) + 1
      RETURN d.authorUid AS authorUid, d.title AS title
    `, { id: req.params.id, answers: JSON.stringify(answers), uid }));

    try {
      await awardForumAnswer(uid, req.params.id);
    } catch (awardErr) {
      console.warn('Forum token award skipped:', awardErr.message);
    }
    
    const authorUid = dProp.authorUid;
    if(authorUid !== uid) {
      const { broadcastToGlobal } = require('../services/chatService');
      broadcastToGlobal(authorUid, {
        type: 'global_new_message',
        notification: { title: 'Forum Activity', body: `${authorName} answered your doubt: "${dProp.title}"` },
        data: { type: 'FORUM_REPLY', id: `doubt-${req.params.id}`, route: `/forum?doubtId=${req.params.id}`, matchId: '' }
      });
    }
    res.json({ success: true, data: answer });
  } catch (err) { next(err); } finally { await session.close(); }
});

router.patch('/:id/upvote', verifyFirebaseToken, async (req, res, next) => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const uid = req.user.uid;
    const result = await session.executeRead(tx => tx.run(`MATCH (d:Doubt {id: $id}) RETURN d`, { id: req.params.id }));
    if(result.records.length === 0) return res.status(404).json({ success: false, error: 'Doubt not found' });
    
    const dProp = result.records[0].get('d').properties;
    let upvotedBy = parseJsonArray(dProp.upvotedBy);
    const upvotes = toNumber(dProp.upvotes) || 0;
    
    if(upvotedBy.includes(uid)) {
      upvotedBy = upvotedBy.filter(id => id !== uid);
      const newUpvotes = Math.max(0, upvotes - 1);
      await session.executeWrite(tx => tx.run(`MATCH (d:Doubt {id: $id}) SET d.upvotedBy = $upvotedBy, d.upvotes = $newUpvotes`, { id: req.params.id, upvotedBy: JSON.stringify(upvotedBy), newUpvotes }));
      res.json({ success: true, upvoted: false, upvotes: newUpvotes });
    } else {
      upvotedBy.push(uid);
      const newUpvotes = upvotes + 1;
      await session.executeWrite(tx => tx.run(`MATCH (d:Doubt {id: $id}) SET d.upvotedBy = $upvotedBy, d.upvotes = $newUpvotes`, { id: req.params.id, upvotedBy: JSON.stringify(upvotedBy), newUpvotes }));
      res.json({ success: true, upvoted: true, upvotes: newUpvotes });
    }
  } catch (err) { next(err); } finally { await session.close(); }
});

router.delete('/:id', verifyFirebaseToken, async (req, res, next) => {
  const driver = getDriver();
  const session = driver.session();
  try {
    const uid = req.user.uid;
    const result = await session.executeRead(tx => tx.run(`MATCH (d:Doubt {id: $id}) RETURN d`, { id: req.params.id }));
    if(result.records.length === 0) return res.status(404).json({ success: false, error: 'Doubt not found' });
    if(result.records[0].get('d').properties.authorUid !== uid) return res.status(403).json({ success: false, error: 'Only author can resolve' });
    await session.executeWrite(tx => tx.run(`MATCH (d:Doubt {id: $id}) DETACH DELETE d`, { id: req.params.id }));
    res.json({ success: true, message: 'Doubt resolved' });
  } catch (err) { next(err); } finally { await session.close(); }
});

module.exports = router;
