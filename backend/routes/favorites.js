/**
 * ===========================================
 * Arthings - Favorites Routes
 * ===========================================
 * 
 * Handles user favorite products (wishlist)
 */

const express = require('express');
const prisma = require('../db/db');

const router = express.Router();

/**
 * GET /api/favorites
 * Get user's favorite products
 */
router.get('/', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const favorites = await prisma.favorite.findMany({
            where: { userId: req.session.userId },
            include: {
                item: {
                    include: {
                        user: {
                            select: { id: true, name: true }
                        },
                        images: {
                            orderBy: { sortOrder: 'asc' }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Transform to match expected format
        const favoriteProducts = favorites
            .filter(f => f.item !== null) // Filter out any null items (if deleted)
            .map(f => ({
                id: `prod-${f.item.id}`,
                userId: `user-${f.item.userId}`,
                title: f.item.title,
                description: f.item.description,
                category: f.item.category,
                price: Number(f.item.pricePerDay),
                priceUnit: f.item.priceUnit,
                city: f.item.city,
                available: f.item.isAvailable,
                images: f.item.images.map(img => img.imagePath),
                views: f.item.views,
                createdAt: f.item.createdAt.toISOString(),
                favoriteId: `fav-${f.id}`,
                ownerName: f.item.user?.name || 'Unknown'
            }));

        res.json({ favorites: favoriteProducts });

    } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({ error: 'Failed to get favorites' });
    }
});

/**
 * POST /api/favorites/:productId
 * Add product to favorites
 */
router.post('/:productId', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Parse product ID
        const productIdParam = req.params.productId;
        const numericItemId = productIdParam.startsWith('prod-')
            ? parseInt(productIdParam.replace('prod-', ''))
            : parseInt(productIdParam);

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

        // Check if already favorited (using unique constraint)
        const existing = await prisma.favorite.findUnique({
            where: {
                userId_itemId: {
                    userId: req.session.userId,
                    itemId: numericItemId
                }
            }
        });

        if (existing) {
            return res.status(400).json({ error: 'Product already in favorites' });
        }

        // Add to favorites
        const newFavorite = await prisma.favorite.create({
            data: {
                userId: req.session.userId,
                itemId: numericItemId
            }
        });

        res.status(201).json({
            message: 'Added to favorites',
            favorite: {
                id: `fav-${newFavorite.id}`,
                userId: `user-${newFavorite.userId}`,
                productId: `prod-${newFavorite.itemId}`,
                createdAt: newFavorite.createdAt.toISOString()
            }
        });

    } catch (error) {
        console.error('Add favorite error:', error);
        res.status(500).json({ error: 'Failed to add to favorites' });
    }
});

/**
 * DELETE /api/favorites/:productId
 * Remove product from favorites
 */
router.delete('/:productId', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Parse product ID
        const productIdParam = req.params.productId;
        const numericItemId = productIdParam.startsWith('prod-')
            ? parseInt(productIdParam.replace('prod-', ''))
            : parseInt(productIdParam);

        if (isNaN(numericItemId)) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        // Find and delete favorite
        const favorite = await prisma.favorite.findUnique({
            where: {
                userId_itemId: {
                    userId: req.session.userId,
                    itemId: numericItemId
                }
            }
        });

        if (!favorite) {
            return res.status(404).json({ error: 'Favorite not found' });
        }

        await prisma.favorite.delete({
            where: { id: favorite.id }
        });

        res.json({ message: 'Removed from favorites' });

    } catch (error) {
        console.error('Remove favorite error:', error);
        res.status(500).json({ error: 'Failed to remove from favorites' });
    }
});

/**
 * GET /api/favorites/check/:productId
 * Check if product is in favorites
 */
router.get('/check/:productId', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.json({ isFavorite: false });
        }

        // Parse product ID
        const productIdParam = req.params.productId;
        const numericItemId = productIdParam.startsWith('prod-')
            ? parseInt(productIdParam.replace('prod-', ''))
            : parseInt(productIdParam);

        if (isNaN(numericItemId)) {
            return res.json({ isFavorite: false });
        }

        const favorite = await prisma.favorite.findUnique({
            where: {
                userId_itemId: {
                    userId: req.session.userId,
                    itemId: numericItemId
                }
            }
        });

        res.json({ isFavorite: !!favorite });

    } catch (error) {
        console.error('Check favorite error:', error);
        res.status(500).json({ error: 'Failed to check favorite' });
    }
});

module.exports = router;
