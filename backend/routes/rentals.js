/**
 * ===========================================
 * Arthings - Rentals Routes
 * ===========================================
 * 
 * Handles rental requests and lifecycle management
 */

const express = require('express');
const prisma = require('../db/db');

const router = express.Router();

/**
 * GET /api/rentals
 * Get user's rentals (as renter or owner)
 */
router.get('/', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { role } = req.query;

        let rentals;

        if (role === 'owner') {
            // Get rentals for products the user owns
            rentals = await prisma.rental.findMany({
                where: {
                    item: {
                        userId: req.session.userId
                    }
                },
                include: {
                    item: {
                        include: {
                            images: {
                                orderBy: { sortOrder: 'asc' },
                                take: 1
                            },
                            user: {
                                select: { id: true, name: true, phone: true }
                            }
                        }
                    },
                    renter: {
                        select: { id: true, name: true, email: true, phone: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        } else {
            // Get rentals where user is the renter
            rentals = await prisma.rental.findMany({
                where: { renterId: req.session.userId },
                include: {
                    item: {
                        include: {
                            images: {
                                orderBy: { sortOrder: 'asc' },
                                take: 1
                            },
                            user: {
                                select: { id: true, name: true, phone: true }
                            }
                        }
                    },
                    renter: {
                        select: { id: true, name: true, email: true, phone: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
        }

        // Transform to match expected format
        const formattedRentals = rentals.map(r => ({
            id: `rental-${r.id}`,
            productId: `prod-${r.itemId}`,
            renterId: `user-${r.renterId}`,
            startDate: r.startDate.toISOString().split('T')[0],
            endDate: r.endDate.toISOString().split('T')[0],
            days: r.days,
            pricePerDay: Number(r.pricePerDay),
            totalPrice: Number(r.totalPrice),
            message: r.message,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
            product: r.item ? {
                id: `prod-${r.item.id}`,
                title: r.item.title,
                image: r.item.images[0]?.imagePath || null,
                price: Number(r.item.pricePerDay),
                priceUnit: r.item.priceUnit
            } : null,
            renterName: r.renter?.name || 'Unknown',
            renterEmail: r.renter?.email || '',
            renterPhone: r.renter?.phone || '',
            ownerName: r.item?.user?.name || 'Unknown',
            ownerPhone: r.item?.user?.phone || ''
        }));

        res.json({ rentals: formattedRentals });

    } catch (error) {
        console.error('Get rentals error:', error);
        res.status(500).json({ error: 'Failed to get rentals' });
    }
});

/**
 * POST /api/rentals
 * Create a rental request
 */
router.post('/', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { productId, startDate, endDate, message } = req.body;

        // Validation
        if (!productId || !startDate || !endDate) {
            return res.status(400).json({ error: 'Product ID, start date, and end date are required' });
        }

        // Parse product ID
        const numericItemId = productId.startsWith('prod-')
            ? parseInt(productId.replace('prod-', ''))
            : parseInt(productId);

        if (isNaN(numericItemId)) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        // Check if product exists
        const product = await prisma.item.findUnique({
            where: { id: numericItemId }
        });

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Check if not renting own product
        if (product.userId === req.session.userId) {
            return res.status(400).json({ error: 'You cannot rent your own product' });
        }

        // Check availability
        if (!product.isAvailable) {
            return res.status(400).json({ error: 'Product is not available' });
        }

        // Calculate rental days and total price
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        if (days < 1) {
            return res.status(400).json({ error: 'Invalid date range' });
        }

        const totalPrice = Number(product.pricePerDay) * days;

        // Create rental
        const newRental = await prisma.rental.create({
            data: {
                itemId: numericItemId,
                renterId: req.session.userId,
                startDate: start,
                endDate: end,
                days,
                pricePerDay: product.pricePerDay,
                totalPrice,
                message: message || null,
                status: 'pending'
            }
        });

        res.status(201).json({
            message: 'Rental request created',
            rental: {
                id: `rental-${newRental.id}`,
                productId: `prod-${newRental.itemId}`,
                renterId: `user-${newRental.renterId}`,
                startDate: newRental.startDate.toISOString().split('T')[0],
                endDate: newRental.endDate.toISOString().split('T')[0],
                days: newRental.days,
                pricePerDay: Number(newRental.pricePerDay),
                totalPrice: Number(newRental.totalPrice),
                message: newRental.message,
                status: newRental.status,
                createdAt: newRental.createdAt.toISOString()
            }
        });

    } catch (error) {
        console.error('Create rental error:', error);
        res.status(500).json({ error: 'Failed to create rental' });
    }
});

/**
 * PUT /api/rentals/:id/status
 * Update rental status (owner only)
 */
router.put('/:id/status', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { status } = req.body;
        const validStatuses = ['approved', 'declined', 'completed', 'cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Parse rental ID
        const idParam = req.params.id;
        const numericId = idParam.startsWith('rental-')
            ? parseInt(idParam.replace('rental-', ''))
            : parseInt(idParam);

        if (isNaN(numericId)) {
            return res.status(400).json({ error: 'Invalid rental ID' });
        }

        // Fetch rental with item
        const rental = await prisma.rental.findUnique({
            where: { id: numericId },
            include: {
                item: true
            }
        });

        if (!rental) {
            return res.status(404).json({ error: 'Rental not found' });
        }

        // Check if user is product owner or renter (for cancellation)
        const isOwner = rental.item && rental.item.userId === req.session.userId;
        const isRenter = rental.renterId === req.session.userId;

        if (status === 'cancelled' && !isRenter) {
            return res.status(403).json({ error: 'Only the renter can cancel' });
        }

        if (status !== 'cancelled' && !isOwner) {
            return res.status(403).json({ error: 'Only the owner can update rental status' });
        }

        // Update status
        const updatedRental = await prisma.rental.update({
            where: { id: numericId },
            data: { status }
        });

        res.json({
            message: 'Rental status updated',
            rental: {
                id: `rental-${updatedRental.id}`,
                productId: `prod-${updatedRental.itemId}`,
                renterId: `user-${updatedRental.renterId}`,
                status: updatedRental.status,
                updatedAt: updatedRental.updatedAt.toISOString()
            }
        });

    } catch (error) {
        console.error('Update rental error:', error);
        res.status(500).json({ error: 'Failed to update rental' });
    }
});

/**
 * GET /api/rentals/:id
 * Get single rental
 */
router.get('/:id', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Parse rental ID
        const idParam = req.params.id;
        const numericId = idParam.startsWith('rental-')
            ? parseInt(idParam.replace('rental-', ''))
            : parseInt(idParam);

        if (isNaN(numericId)) {
            return res.status(400).json({ error: 'Invalid rental ID' });
        }

        const rental = await prisma.rental.findUnique({
            where: { id: numericId },
            include: {
                item: {
                    include: {
                        images: {
                            orderBy: { sortOrder: 'asc' },
                            take: 1
                        }
                    }
                }
            }
        });

        if (!rental) {
            return res.status(404).json({ error: 'Rental not found' });
        }

        // Check if user is involved in this rental
        const isOwner = rental.item && rental.item.userId === req.session.userId;
        const isRenter = rental.renterId === req.session.userId;

        if (!isOwner && !isRenter) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({
            rental: {
                id: `rental-${rental.id}`,
                productId: `prod-${rental.itemId}`,
                renterId: `user-${rental.renterId}`,
                startDate: rental.startDate.toISOString().split('T')[0],
                endDate: rental.endDate.toISOString().split('T')[0],
                days: rental.days,
                pricePerDay: Number(rental.pricePerDay),
                totalPrice: Number(rental.totalPrice),
                message: rental.message,
                status: rental.status,
                createdAt: rental.createdAt.toISOString()
            }
        });

    } catch (error) {
        console.error('Get rental error:', error);
        res.status(500).json({ error: 'Failed to get rental' });
    }
});

module.exports = router;
