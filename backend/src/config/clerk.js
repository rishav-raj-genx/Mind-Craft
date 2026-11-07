const { createClerkClient, clerkClient } = require('@clerk/express');

const secretKey = process.env.CLERK_SECRET_KEY;

if (!secretKey && process.env.NODE_ENV === 'production') {
  throw new Error('CLERK_SECRET_KEY is required in production');
}

const client = secretKey ? createClerkClient({ secretKey }) : clerkClient;

module.exports = { clerkClient: client };
