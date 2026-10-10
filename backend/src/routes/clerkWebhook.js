const express = require('express');
const { Webhook } = require('svix');
const { prisma } = require('../config/prisma');
const { processClerkEvent } = require('../services/clerkUserSync');

const router = express.Router();

router.post('/', express.raw({ type: 'application/json' }), async (req, res, next) => {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return res.status(503).json({ success: false, error: 'Clerk webhook is not configured' });
  }

  let event;
  try {
    const webhook = new Webhook(secret);
    event = webhook.verify(req.body, {
      'svix-id': req.get('svix-id'),
      'svix-timestamp': req.get('svix-timestamp'),
      'svix-signature': req.get('svix-signature'),
    });
  } catch (err) {
    err.statusCode = 400;
    return next(err);
  }

  const eventId = req.get('svix-id');
  if (!eventId || !event?.type) {
    return res.status(400).json({ success: false, error: 'Malformed Clerk webhook event' });
  }

  try {
    const existing = await prisma.clerkWebhookEvent.findUnique({ where: { clerkEventId: eventId } });
    if (existing?.processedAt) return res.json({ success: true, duplicate: true });

    await prisma.clerkWebhookEvent.upsert({
      where: { clerkEventId: eventId },
      create: { clerkEventId: eventId, eventType: event.type },
      update: { eventType: event.type, failedAt: null, error: null },
    });

    await processClerkEvent(event);
    await prisma.clerkWebhookEvent.update({
      where: { clerkEventId: eventId },
      data: { processedAt: new Date(), failedAt: null, error: null },
    });

    return res.json({ success: true });
  } catch (err) {
    await prisma.clerkWebhookEvent.update({
      where: { clerkEventId: eventId },
      data: { failedAt: new Date(), error: err.message },
    }).catch((recordError) => {
      console.error('Failed to record Clerk webhook error:', recordError);
    });
    return next(err);
  }
});

module.exports = router;
