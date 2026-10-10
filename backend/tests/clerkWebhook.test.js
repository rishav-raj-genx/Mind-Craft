jest.mock('../src/config/prisma', () => ({
  prisma: {
    clerkWebhookEvent: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../src/services/clerkUserSync', () => ({
  processClerkEvent: jest.fn().mockResolvedValue(undefined),
}));

const express = require('express');
const request = require('supertest');
const { Webhook } = require('svix');
const router = require('../src/routes/clerkWebhook');
const { prisma } = require('../src/config/prisma');

describe('Clerk webhook route', () => {
  const app = express();
  app.use('/webhooks/clerk', router);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: error.message }));

  beforeEach(() => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = 'whsec_test';
    prisma.clerkWebhookEvent.findUnique.mockResolvedValue(null);
    prisma.clerkWebhookEvent.upsert.mockResolvedValue({});
    prisma.clerkWebhookEvent.update.mockResolvedValue({});
  });

  it('rejects an invalid signature', async () => {
    const response = await request(app)
      .post('/webhooks/clerk')
      .set('svix-id', 'msg_invalid')
      .set('svix-timestamp', String(Math.floor(Date.now() / 1000)))
      .set('svix-signature', 'v1,invalid')
      .send(JSON.stringify({ type: 'user.created', data: {} }));
    expect(response.status).toBe(400);
  });

  it('returns duplicate success for an already processed event', async () => {
    prisma.clerkWebhookEvent.findUnique.mockResolvedValue({ processedAt: new Date() });
    const payload = JSON.stringify({ type: 'user.updated', data: {} });
    const webhook = new Webhook(process.env.CLERK_WEBHOOK_SIGNING_SECRET);
    const timestamp = new Date();
    const signature = webhook.sign('msg_duplicate', timestamp, payload);
    const response = await request(app)
      .post('/webhooks/clerk')
      .set('svix-id', 'msg_duplicate')
      .set('svix-timestamp', String(Math.floor(timestamp.getTime() / 1000)))
      .set('svix-signature', signature)
      .set('content-type', 'application/json')
      .send(payload);
    expect(response.status).toBe(200);
    expect(response.body.duplicate).toBe(true);
  });
});
