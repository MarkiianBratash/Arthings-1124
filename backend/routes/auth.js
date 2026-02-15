/**
 * ===========================================
 * Arthings - Authentication Routes
 * ===========================================
 * 
 * Handles user registration, login, logout, and profile management
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../db/db');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, phone, city, consents } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user with legal consents in a transaction
        const newUser = await prisma.$transaction(async (tx) => {
            // Create user
            const user = await tx.user.create({
                data: {
                    email: email.toLowerCase(),
                    passwordHash: hashedPassword,
                    name: name || email.split('@')[0],
                    phone: phone || null,
                    city: city || null,
                    avatar: null,
                    isVerified: false
                }
            });

            // Record consents if provided
            if (consents && Array.isArray(consents)) {
                for (const consent of consents) {
                    await tx.legalConsent.create({
                        data: {
                            userId: user.id,
                            documentType: consent.type,
                            documentVersion: consent.version,
                            ipAddress: req.ip || null,
                            userAgent: req.get('User-Agent') || null
                        }
                    });
                }
            }

            return user;
        });

        // Return user without password
        const { passwordHash, ...userWithoutPassword } = newUser;
        res.status(201).json({
            message: 'Registration successful',
            user: {
                ...userWithoutPassword,
                id: `user-${newUser.id}` // Maintain compatibility with frontend
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Create session
        req.session.userId = user.id;
        req.session.userEmail = user.email;

        // Return user without password
        const { passwordHash, ...userWithoutPassword } = user;
        res.json({
            message: 'Login successful',
            user: {
                ...userWithoutPassword,
                id: `user-${user.id}`,
                isAdmin: user.isAdmin
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * POST /api/auth/logout
 * Destroy session
 */
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

/**
 * GET /api/auth/me
 * Get current logged-in user
 */
router.get('/me', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: req.session.userId }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { passwordHash, ...userWithoutPassword } = user;
        res.json({
            user: {
                ...userWithoutPassword,
                id: `user-${user.id}`,
                isAdmin: user.isAdmin
            }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const { name, phone, city } = req.body;

        const updatedUser = await prisma.user.update({
            where: { id: req.session.userId },
            data: {
                ...(name && { name }),
                ...(phone !== undefined && { phone: phone || null }),
                ...(city !== undefined && { city: city || null })
            }
        });

        const { passwordHash, ...userWithoutPassword } = updatedUser;
        res.json({
            message: 'Profile updated',
            user: {
                ...userWithoutPassword,
                id: `user-${updatedUser.id}` // Maintain compatibility with frontend
            }
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Profile update failed' });
    }
});

/**
 * DELETE /api/auth/account
 * Delete current user's account permanently
 */
router.delete('/account', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userId = req.session.userId;

        // Delete the user (cascade will delete items, favorites, rentals, consents)
        await prisma.user.delete({
            where: { id: userId }
        });

        // Destroy session
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destroy error:', err);
            }
        });

        res.json({ message: 'Account deleted successfully' });

    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

module.exports = router;
