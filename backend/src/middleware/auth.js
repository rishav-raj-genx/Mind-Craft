/**
 * auth.js — Passport Session Authentication Middleware
 *
 * Provides requireAuth and optionalAuth middleware that check
 * Passport session state (req.isAuthenticated).
 */

/**
 * Express middleware that requires a valid Passport session.
 * Returns 401 if the user is not authenticated.
 */
function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }
  return res.status(401).json({
    success: false,
    error: 'Authentication required. Please log in.',
  });
}

/**
 * Optional auth middleware — sets req.user from session if present,
 * but does not block the request if missing.
 */
function optionalAuth(req, _res, next) {
  // Passport automatically populates req.user from session if authenticated.
  // If not authenticated, req.user will be undefined — normalize to null.
  if (!req.user) {
    req.user = null;
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
