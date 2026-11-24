const express = require('express');
const { Webhook } = require('svix');
const { prisma } = require('../config/prisma');
const { processClerkEvent } = require('../services/clerkUserSync');

const router = express.Router();

router.post('/', express.raw({ type: '*/*' }), async (req, res, next) => {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    console.error('[Clerk Webhook] Missing CLERK_WEBHOOK_SIGNING_SECRET');
    return res.status(503).json({ success: false, error: 'Clerk webhook is not configured' });
  }

  const svixId = req.get('svix-id');
  const svixTimestamp = req.get('svix-timestamp');
  const svixSignature = req.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('[Clerk Webhook] Missing svix verification headers');
    return res.status(400).json({ success: false, error: 'Missing svix verification headers' });
  }

  let event;
  try {
    const webhook = new Webhook(secret);
    const rawPayload = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    event = webhook.verify(rawPayload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
  } catch (err) {
    console.error('[Clerk Webhook] Signature verification failed:', err.message);
    err.statusCode = 400;
    return next(err);
  }

  if (!event?.type) {
    return res.status(400).json({ success: false, error: 'Malformed Clerk webhook event' });
  }

  try {
    const existing = await prisma.clerkWebhookEvent.findUnique({ where: { clerkEventId: svixId } });
    if (existing?.processedAt) {
      console.log(`[Clerk Webhook] Event ${svixId} already processed (duplicate)`);
      return res.json({ success: true, duplicate: true });
    }

    await prisma.clerkWebhookEvent.upsert({
      where: { clerkEventId: svixId },
      create: { clerkEventId: svixId, eventType: event.type },
      update: { eventType: event.type, failedAt: null, error: null },
    });

    await processClerkEvent(event);

    await prisma.clerkWebhookEvent.update({
      where: { clerkEventId: svixId },
      data: { processedAt: new Date(), failedAt: null, error: null },
    });

    console.log(`[Clerk Webhook] Event ${svixId} (${event.type}) processed successfully`);
    return res.json({ success: true });
  } catch (err) {
    console.error(`[Clerk Webhook] Event ${svixId} execution failed:`, err.message);
    await prisma.clerkWebhookEvent.update({
      where: { clerkEventId: svixId },
      data: { failedAt: new Date(), error: err.message },
    }).catch((recordError) => {
      console.error('[Clerk Webhook] Failed to record error state:', recordError.message);
    });
    return next(err);
  }
});

module.exports = router;
