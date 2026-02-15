/**
 * Authentication Middleware
 * Checks if user is logged in via session
 */

const prisma = require('../db/db');

function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Authentication required' });
    }
}

/**
 * Require admin privileges.
 * Must be used AFTER requireAuth.
 */
async function requireAdmin(req, res, next) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.session.userId },
            select: { isAdmin: true }
        });
        if (user && user.isAdmin) {
            next();
        } else {
            res.status(403).json({ error: 'Admin access required' });
        }
    } catch (err) {
        console.error('Admin check error:', err);
        res.status(500).json({ error: 'Failed to verify admin status' });
    }
}

function optionalAuth(req, res, next) {
    // Just pass through, session data will be available if logged in
    next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth };
