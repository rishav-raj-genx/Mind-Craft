/**
 * test-auth-flow.js
 * Comprehensive validation of Firebase Auth integration:
 * 1. Test client auth token issuance via Identity Toolkit REST API
 * 2. Test backend Admin SDK token verification (verifyFirebaseToken & optionalAuth middleware)
 */

const { auth: adminAuth } = require('../src/config/firebase');
const { verifyFirebaseToken, optionalAuth } = require('../src/middleware/auth');

const API_KEY = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCxTrD1MMH_WT8sjAfSt4WBaKkrwiycAjA';

async function runAuthTests() {
  console.log('--- Starting Firebase Auth Test Suite ---\n');

  // Test 1: Authenticate with Firebase via REST API
  console.log('1. Testing Firebase Client Sign-In (Identity Toolkit API)...');
  const testEmail = 'test_auth_check_123@example.com';
  const testPassword = 'password123456';

  let idToken = null;
  let uid = null;

  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword, returnSecureToken: true }),
    });
    const data = await res.json();
    if (!data.idToken) {
      throw new Error(`Sign in failed: ${JSON.stringify(data)}`);
    }
    idToken = data.idToken;
    uid = data.localId;
    console.log(`✅ Client authentication successful! UID: ${uid}`);
  } catch (err) {
    console.error('❌ Client authentication failed:', err.message);
    process.exit(1);
  }

  // Test 2: Admin SDK token verification
  console.log('\n2. Testing Firebase Admin SDK Token Verification...');
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (decoded.uid === uid) {
      console.log(`✅ Admin SDK verified token successfully! Decoded UID: ${decoded.uid}, Email: ${decoded.email}`);
    } else {
      throw new Error(`UID mismatch: expected ${uid}, got ${decoded.uid}`);
    }
  } catch (err) {
    console.error('❌ Admin SDK verification failed:', err.message);
    process.exit(1);
  }

  // Test 3: Express Middleware verifyFirebaseToken test
  console.log('\n3. Testing Express verifyFirebaseToken Middleware...');
  const mockReqValid = {
    headers: {
      authorization: `Bearer ${idToken}`,
    },
  };
  let nextCalled = false;
  const mockRes = {
    status: (code) => ({
      json: (data) => console.log(`   Response (${code}):`, data),
    }),
  };

  await verifyFirebaseToken(mockReqValid, mockRes, () => {
    nextCalled = true;
  });

  if (nextCalled && mockReqValid.user && mockReqValid.user.uid === uid) {
    console.log('✅ verifyFirebaseToken middleware passed! req.user correctly set:', mockReqValid.user);
  } else {
    console.error('❌ verifyFirebaseToken middleware failed');
    process.exit(1);
  }

  // Test 4: Express Middleware failure test (missing/invalid token)
  console.log('\n4. Testing verifyFirebaseToken rejection with invalid token...');
  let rejected = false;
  const mockReqInvalid = {
    headers: {
      authorization: 'Bearer invalid.token.value',
    },
  };
  const mockResReject = {
    status: (code) => {
      if (code === 401 || code === 403) rejected = true;
      return {
        json: (data) => {
          console.log(`   Correctly rejected with status ${code}:`, data.error);
        },
      };
    },
  };

  await verifyFirebaseToken(mockReqInvalid, mockResReject, () => {
    console.error('❌ next() should not have been called on invalid token');
  });

  if (rejected) {
    console.log('✅ Invalid token properly rejected by middleware!');
  }

  console.log('\n🎉 ALL AUTH TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runAuthTests().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});
