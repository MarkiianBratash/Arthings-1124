/**
 * ===========================================
 * Arthings - Admin Routes
 * ===========================================
 *
 * Protected routes for platform administration.
 * All routes require authentication + admin privileges.
 */

const express = require('express');
const prisma = require('../db/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Apply auth + admin middleware to ALL routes in this file
router.use(requireAuth, requireAdmin);

// -------------------------------------------------
// GET /api/admin/check — verify caller is admin
// -------------------------------------------------
router.get('/check', (req, res) => {
    res.json({ admin: true });
});

// -------------------------------------------------
// GET /api/admin/stats — dashboard statistics
// -------------------------------------------------
router.get('/stats', async (req, res) => {
    try {
        const [
            totalUsers,
            totalListings,
            totalRentals,
            activeRentals,
            revenueResult
        ] = await Promise.all([
            prisma.user.count(),
            prisma.item.count(),
            prisma.rental.count(),
            prisma.rental.count({ where: { status: 'approved' } }),
            prisma.rental.aggregate({ _sum: { totalPrice: true } })
        ]);

        // Recent activity — last 10 rentals
        const recentRentals = await prisma.rental.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                renter: { select: { id: true, name: true, email: true } },
                item: { select: { id: true, title: true } }
            }
        });

        res.json({
            stats: {
                totalUsers,
                totalListings,
                totalRentals,
                activeRentals,
                totalRevenue: Number(revenueResult._sum.totalPrice || 0)
            },
            recentRentals: recentRentals.map(r => ({
                id: r.id,
                renterName: r.renter.name,
                renterEmail: r.renter.email,
                itemTitle: r.item.title,
                status: r.status,
                totalPrice: Number(r.totalPrice),
                createdAt: r.createdAt.toISOString()
            }))
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Failed to load stats' });
    }
});

// -------------------------------------------------
// GET /api/admin/users — list users (with search)
// -------------------------------------------------
router.get('/users', async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } }
            ];
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true, email: true, name: true, phone: true,
                    city: true, isVerified: true, isAdmin: true,
                    createdAt: true,
                    _count: { select: { items: true, rentalsAsRenter: true } }
                }
            }),
            prisma.user.count({ where })
        ]);

        res.json({
            users: users.map(u => ({
                id: u.id,
                email: u.email,
                name: u.name,
                phone: u.phone,
                city: u.city,
                isVerified: u.isVerified,
                isAdmin: u.isAdmin,
                createdAt: u.createdAt.toISOString(),
                listingsCount: u._count.items,
                rentalsCount: u._count.rentalsAsRenter
            })),
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({ error: 'Failed to load users' });
    }
});

// -------------------------------------------------
// DELETE /api/admin/users/:id — delete user
// -------------------------------------------------
router.delete('/users/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID' });

        // Prevent self-deletion
        if (id === req.session.userId) {
            return res.status(400).json({ error: 'Cannot delete your own account from admin panel' });
        }

        await prisma.user.delete({ where: { id } });
        res.json({ message: 'User deleted' });
    } catch (error) {
        console.error('Admin delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// -------------------------------------------------
// PUT /api/admin/users/:id/toggle-admin
// -------------------------------------------------
router.put('/users/:id/toggle-admin', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID' });

        if (id === req.session.userId) {
            return res.status(400).json({ error: 'Cannot change your own admin status' });
        }

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const updated = await prisma.user.update({
            where: { id },
            data: { isAdmin: !user.isAdmin }
        });

        res.json({ message: `User is now ${updated.isAdmin ? 'an admin' : 'a regular user'}`, isAdmin: updated.isAdmin });
    } catch (error) {
        console.error('Admin toggle error:', error);
        res.status(500).json({ error: 'Failed to toggle admin' });
    }
});

// -------------------------------------------------
// GET /api/admin/listings — list all items
// -------------------------------------------------
router.get('/listings', async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { description: { contains: search } }
            ];
        }

        const [listings, total] = await Promise.all([
            prisma.item.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    images: { take: 1, orderBy: { sortOrder: 'asc' } },
                    _count: { select: { rentals: true, favorites: true } }
                }
            }),
            prisma.item.count({ where })
        ]);

        res.json({
            listings: listings.map(l => ({
                id: l.id,
                title: l.title,
                category: l.category,
                price: Number(l.pricePerDay),
                priceUnit: l.priceUnit,
                city: l.city,
                isAvailable: l.isAvailable,
                views: l.views,
                image: l.images[0]?.imagePath || null,
                ownerName: l.user.name,
                ownerEmail: l.user.email,
                rentalsCount: l._count.rentals,
                favoritesCount: l._count.favorites,
                createdAt: l.createdAt.toISOString()
            })),
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('Admin listings error:', error);
        res.status(500).json({ error: 'Failed to load listings' });
    }
});

// -------------------------------------------------
// DELETE /api/admin/listings/:id
// -------------------------------------------------
router.delete('/listings/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid listing ID' });

        // Delete image files
        const item = await prisma.item.findUnique({
            where: { id },
            include: { images: true }
        });
        if (!item) return res.status(404).json({ error: 'Listing not found' });

        for (const img of item.images) {
            const fullPath = path.join(__dirname, '../..', img.imagePath);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }

        await prisma.item.delete({ where: { id } });
        res.json({ message: 'Listing deleted' });
    } catch (error) {
        console.error('Admin delete listing error:', error);
        res.status(500).json({ error: 'Failed to delete listing' });
    }
});

// -------------------------------------------------
// GET /api/admin/rentals — list all rentals
// -------------------------------------------------
router.get('/rentals', async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (status) where.status = status;

        const [rentals, total] = await Promise.all([
            prisma.rental.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    renter: { select: { id: true, name: true, email: true } },
                    item: {
                        select: { id: true, title: true, user: { select: { name: true } } }
                    }
                }
            }),
            prisma.rental.count({ where })
        ]);

        res.json({
            rentals: rentals.map(r => ({
                id: r.id,
                itemTitle: r.item.title,
                ownerName: r.item.user?.name || 'Unknown',
                renterName: r.renter.name,
                renterEmail: r.renter.email,
                startDate: r.startDate.toISOString().split('T')[0],
                endDate: r.endDate.toISOString().split('T')[0],
                days: r.days,
                totalPrice: Number(r.totalPrice),
                status: r.status,
                createdAt: r.createdAt.toISOString()
            })),
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('Admin rentals error:', error);
        res.status(500).json({ error: 'Failed to load rentals' });
    }
});

// -------------------------------------------------
// PUT /api/admin/rentals/:id/status
// -------------------------------------------------
router.put('/rentals/:id/status', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { status } = req.body;

        if (isNaN(id)) return res.status(400).json({ error: 'Invalid rental ID' });

        const validStatuses = ['pending', 'approved', 'declined', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const updated = await prisma.rental.update({
            where: { id },
            data: { status }
        });

        res.json({ message: 'Rental status updated', status: updated.status });
    } catch (error) {
        console.error('Admin update rental error:', error);
        res.status(500).json({ error: 'Failed to update rental status' });
    }
});

module.exports = router;
