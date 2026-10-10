const { createClerkClient } = require('@clerk/clerk-sdk-node');

const secretKey = process.env.CLERK_SECRET_KEY;

if (!secretKey && process.env.NODE_ENV === 'production') {
  throw new Error('CLERK_SECRET_KEY is required in production');
}

const clerkClient = createClerkClient({ secretKey });

module.exports = { clerkClient };
