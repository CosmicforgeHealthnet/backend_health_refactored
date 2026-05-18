const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentController');
const crypto = require('crypto');
const captureRawBody = require('../../../shared/middlewares/captureRawBody');
const { logWebhookDelivery } = require('../../admin-ops/services/jobTracker');

const webhookLogger = (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (data) {
        const event = req.body?.event || req.body?.event?.type || 'unknown';
        logWebhookDelivery({
            event,
            provider: req.params.provider || 'unknown',
            statusCode: res.statusCode,
            payload: req.body,
            responseBody: JSON.stringify(data).substring(0, 500),
        }).catch(() => {});
        return originalJson(data);
    };
    next();
};

// Flutterwave webhook signature verification
const verifyFlutterwaveSignature = (req, res, next) => {
    try {
        const signature = req.headers['verif-hash'];
        const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;

        console.log('🔍 Flutterwave webhook verification:');
        // console.log('- Received signature:', signature); // Security: Don't log full signature
        console.log('- Expected hash exists:', !!secretHash);

        if (!secretHash) {
            console.log('⚠️ FLUTTERWAVE_SECRET_HASH not set - ALLOWING ALL (DEV ONLY)');
            req.params.provider = 'flutterwave';
            return next();
        }

        if (!signature) {
            console.log('❌ Missing signature for Flutterwave');
            return res.status(401).json({ error: 'Unauthorized - Missing signature' });
        }

        if (signature !== secretHash) {
            console.log('❌ Invalid Flutterwave signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        console.log('✅ Flutterwave signature verified');
        req.params.provider = 'flutterwave';
        next();
    } catch (error) {
        console.error('❌ Flutterwave signature verification error:', error);
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Paystack webhook signature verification
const verifyPaystackSignature = (req, res, next) => {
    try {
        const signature = req.headers['x-paystack-signature'];
        const secret = process.env.PAYSTACK_SECRET_KEY;

        console.log('🔍 Paystack webhook verification details:');
        console.log('- Header Signature:', signature ? `${signature.substring(0, 10)}...` : 'MISSING');
        console.log('- Raw Body Length:', req.rawBody ? req.rawBody.length : 'UNDEFINED');
        // console.log('- Raw Body Preview:', req.rawBody ? req.rawBody.substring(0, 100) : 'N/A');

        if (!secret) {
            console.log('⚠️ PAYSTACK_SECRET_KEY not set - ALLOWING ALL (DEV ONLY)');
            req.params.provider = 'paystack';
            return next();
        }

        if (!signature) {
            console.log('❌ Missing signature for Paystack');
            return res.status(401).json({ error: 'Unauthorized - Missing signature' });
        }

        if (!req.rawBody) {
            console.log('❌ Req.rawBody is missing! Middleware issue.');
            return res.status(500).json({ error: 'Server configuration error - rawBody missing' });
        }

        const hash = crypto
            .createHmac('sha512', secret)
            .update(req.rawBody, 'utf8')
            .digest('hex');

        console.log('- Calculated Hash:', hash ? `${hash.substring(0, 10)}...` : 'ERROR');

        if (hash !== signature) {
            console.log('❌ Invalid Paystack signature mismatch');
            console.log(`Expected: ${hash}`);
            console.log(`Received: ${signature}`);
            return res.status(401).json({ error: 'Invalid signature' });
        }

        console.log('✅ Paystack signature verified');
        req.params.provider = 'paystack';
        next();
    } catch (error) {
        console.error('❌ Paystack signature verification error:', error);
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Webhook handling middleware wrapper
const handleWebhookProvider = (req, res, next) => {
    const { provider } = req.params;
    console.log('🎯 WEBHOOK ROUTE HIT:', provider);

    if (provider === 'flutterwave') {
        return verifyFlutterwaveSignature(req, res, next);
    } else if (provider === 'paystack') {
        return verifyPaystackSignature(req, res, next);
    } else {
        console.log('⚠️ Unknown provider:', provider);
        // For debugging, we might want to log what we received even if unknown
        return res.status(400).json({ error: 'Unknown provider' });
    }
};

// Define routes
router.post('/:provider',
    handleWebhookProvider,
    webhookLogger,
    PaymentController.handleWebhook
);

module.exports = router;
