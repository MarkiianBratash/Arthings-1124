/**
 * ===========================================
 * Arthings - Legal Documents Routes
 * ===========================================
 * 
 * Handles legal document retrieval and user consent recording
 */

const express = require('express');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const prisma = require('../db/db');

const router = express.Router();

// Path to legal documents
const DOCS_DIR = path.join(__dirname, '../../legal/docs');

/**
 * GET /api/legal/documents
 * List available documents
 */
router.get('/documents', async (req, res) => {
    try {
        const documents = await prisma.legalDocument.findMany();

        res.json({
            documents: documents.map(doc => ({
                type: doc.type,
                version: doc.version,
                file: doc.file,
                updatedAt: doc.updatedAt.toISOString()
            }))
        });
    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({ error: 'Failed to get documents' });
    }
});

/**
 * GET /api/legal/document/:type
 * Get document content (HTML)
 */
router.get('/document/:type', async (req, res) => {
    try {
        const { type } = req.params;

        const docConfig = await prisma.legalDocument.findUnique({
            where: { type }
        });

        if (!docConfig) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const filePath = path.join(DOCS_DIR, docConfig.file);

        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            return res.status(404).json({ error: 'Document file missing' });
        }

        // Convert .docx to HTML
        const result = await mammoth.convertToHtml({ path: filePath });
        res.send(result.value);

    } catch (error) {
        console.error('Document conversion error:', error);
        res.status(500).json({ error: 'Failed to load document' });
    }
});

/**
 * POST /api/legal/consent
 * Record user consent
 */
router.post('/consent', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { documentType, documentVersion } = req.body;

        if (!documentType || !documentVersion) {
            return res.status(400).json({ error: 'Missing document info' });
        }

        // Check if already consented
        const existing = await prisma.legalConsent.findFirst({
            where: {
                userId: req.session.userId,
                documentType,
                documentVersion
            }
        });

        if (existing) {
            return res.json({
                message: 'Consent already recorded',
                consent: {
                    id: existing.id,
                    userId: `user-${existing.userId}`,
                    documentType: existing.documentType,
                    documentVersion: existing.documentVersion,
                    acceptedAt: existing.acceptedAt.toISOString()
                }
            });
        }

        // Create new consent
        const newConsent = await prisma.legalConsent.create({
            data: {
                userId: req.session.userId,
                documentType,
                documentVersion,
                ipAddress: req.ip || null,
                userAgent: req.get('User-Agent') || null
            }
        });

        res.status(201).json({
            message: 'Consent recorded',
            consent: {
                id: newConsent.id,
                userId: `user-${newConsent.userId}`,
                documentType: newConsent.documentType,
                documentVersion: newConsent.documentVersion,
                acceptedAt: newConsent.acceptedAt.toISOString()
            }
        });

    } catch (error) {
        console.error('Consent error:', error);
        res.status(500).json({ error: 'Failed to record consent' });
    }
});

/**
 * GET /api/legal/consent/check
 * Check if user needs to consent
 */
router.get('/consent/check', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { type } = req.query; // Optional: filter by type

        // Get latest document versions
        const docs = await prisma.legalDocument.findMany();

        // Get user's consents
        const userConsents = await prisma.legalConsent.findMany({
            where: { userId: req.session.userId }
        });

        // Check status for each doc
        const status = docs.map(doc => {
            const hasConsent = userConsents.some(c =>
                c.documentType === doc.type &&
                c.documentVersion === doc.version
            );
            return {
                type: doc.type,
                version: doc.version,
                hasConsent
            };
        });

        if (type) {
            const specific = status.find(s => s.type === type);
            if (!specific) return res.status(404).json({ error: 'Document type not found' });
            return res.json({ status: specific });
        }

        res.json({ status });

    } catch (error) {
        console.error('Check consent error:', error);
        res.status(500).json({ error: 'Failed to check consent' });
    }
});

module.exports = router;
