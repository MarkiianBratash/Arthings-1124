/**
 * Arthings - Rental Requests Routes
 * "I want to rent X" - users post what they need; others can browse
 */

const express = require('express');
const prisma = require('../db/db');

const router = express.Router();

/**
 * GET /api/rental-requests
 * List rental requests (public). Optional filters: category, city
 */
router.get('/', async (req, res) => {
    try {
        const { category, city, userId } = req.query;
        const where = {};

        if (category) where.category = category;
        if (city) where.city = city;
        if (userId) {
            const uid = userId.startsWith('user-') ? parseInt(userId.replace('user-', ''), 10) : parseInt(userId, 10);
            if (!isNaN(uid)) where.userId = uid;
        }

        const requests = await prisma.rentalRequest.findMany({
            where,
            include: {
                user: {
                    select: { id: true, name: true, city: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        res.json({
            requests: requests.map(r => ({
                id: r.id,
                title: r.title,
                description: r.description,
                category: r.category,
                city: r.city,
                createdAt: r.createdAt.toISOString(),
                user: r.user ? {
                    id: `user-${r.user.id}`,
                    name: r.user.name,
                    city: r.user.city
                } : null
            }))
        });
    } catch (error) {
        console.error('List rental requests error:', error);
        res.status(500).json({ error: 'Failed to load rental requests' });
    }
});

/**
 * POST /api/rental-requests
 * Create a rental request (authenticated)
 */
router.post('/', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { title, description, category, city } = req.body;

        if (!title || !description) {
            return res.status(400).json({ error: 'Title and description are required' });
        }

        const request = await prisma.rentalRequest.create({
            data: {
                userId: req.session.userId,
                title: String(title).trim().slice(0, 255),
                description: String(description).trim().slice(0, 5000),
                category: category ? String(category).trim().slice(0, 50) : null,
                city: city ? String(city).trim().slice(0, 100) : null
            }
        });

        res.status(201).json({
            message: 'Rental request created',
            request: {
                id: request.id,
                title: request.title,
                description: request.description,
                category: request.category,
                city: request.city,
                createdAt: request.createdAt.toISOString()
            }
        });
    } catch (error) {
        console.error('Create rental request error:', error);
        res.status(500).json({ error: 'Failed to create rental request' });
    }
});

/**
 * GET /api/rental-requests/:id
 * Get single rental request (public)
 */
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid request ID' });
        }

        const request = await prisma.rentalRequest.findUnique({
            where: { id },
            include: {
                user: {
                    select: { id: true, name: true, city: true }
                }
            }
        });

        if (!request) {
            return res.status(404).json({ error: 'Rental request not found' });
        }

        res.json({
            request: {
                id: request.id,
                title: request.title,
                description: request.description,
                category: request.category,
                city: request.city,
                createdAt: request.createdAt.toISOString(),
                user: request.user ? {
                    id: `user-${request.user.id}`,
                    name: request.user.name,
                    city: request.user.city
                } : null
            }
        });
    } catch (error) {
        console.error('Get rental request error:', error);
        res.status(500).json({ error: 'Failed to load rental request' });
    }
});

/**
 * DELETE /api/rental-requests/:id
 * Delete own rental request
 */
router.delete('/:id', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid request ID' });
        }

        const request = await prisma.rentalRequest.findUnique({
            where: { id }
        });

        if (!request) {
            return res.status(404).json({ error: 'Rental request not found' });
        }

        if (request.userId !== req.session.userId) {
            return res.status(403).json({ error: 'You can only delete your own requests' });
        }

        await prisma.rentalRequest.delete({
            where: { id }
        });

        res.json({ message: 'Rental request deleted' });
    } catch (error) {
        console.error('Delete rental request error:', error);
        res.status(500).json({ error: 'Failed to delete' });
    }
});

module.exports = router;
