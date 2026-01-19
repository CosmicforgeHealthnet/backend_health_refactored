// API Routes
const express = require("express");
const router = express.Router();
const {
    whatsapp,
    handleIncomingMessage } = require("./index")

router.get('/', (req, res) => {
    res.json({
        name: 'WhatsApp Business API Server',
        status: 'running',
        version: '1.0.0',
        endpoints: {
            webhook: 'GET/POST /webhook',
            send: 'POST /send',
            sendTemplate: 'POST /send-template',
            sendImage: 'POST /send-image',
            sendInteractive: 'POST /send-interactive',
            broadcast: 'POST /broadcast',
            profile: 'GET /profile',
            health: 'GET /health'
        }
    });
});

// Webhook verification (GET)
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log(token);
    if (mode === 'subscribe' && token ===  process.env.WHATSAPP_NOTI_WEBHOOK_VERIFY_TOKEN) {
        console.log('✅ Webhook verified successfully');
        res.status(200).send(challenge);
    } else {
        console.log('❌ Webhook verification failed');
        res.sendStatus(403);
    }

    console.log(token);
    if (mode === 'subscribe' && token ===  process.env.WHATSAPP_NOTI_WEBHOOK_VERIFY_TOKEN) {
        console.log('✅ Webhook verified successfully');
        res.status(200).send(challenge);
    } else {
        console.log('❌ Webhook verification failed');
        res.sendStatus(403);
    }
});

// Webhook handler (POST)
router.post('/webhook', async (req, res) => {
    try {
        const body = req.body;

        if (body.object === 'whatsapp_business_account') {
            body.entry?.forEach(entry => {
                entry.changes?.forEach(change => {
                    if (change.field === 'messages') {
                        const { messages, statuses } = change.value;

                        // Handle incoming messages
                        if (messages) {
                            messages.forEach(async (message) => {
                                console.log(`📨 Message received from ${message.from}:`, message);
                                await handleIncomingMessage(message);
                            });
                        }

                        // Handle message statuses (delivered, read, etc.)
                        if (statuses) {
                            statuses.forEach((status) => {
                                console.log(`📊 Status update:`, status);
                            });
                        }
                    }
                });
            });
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Error processing webhook');
    }
});


// Send text message
router.post('/send', async (req, res) => {
    try {
        const { to, message } = req.body;

        if (!to || !message) {
            return res.status(400).json({
                error: 'Missing required fields: to, message'
            });
        }

        const result = await whatsapp.sendTextMessage(to, message);
        res.json({
            success: true,
            messageId: result.messages[0].id,
            result
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Send template message
router.post('/send-template', async (req, res) => {
    try {
        const { to, template, language = 'en_US', parameters = [] } = req.body;

        if (!to || !template) {
            return res.status(400).json({
                error: 'Missing required fields: to, template'
            });
        }

        const result = await whatsapp.sendTemplateMessage(to, template, language, parameters);
        res.json({
            success: true,
            messageId: result.messages[0].id,
            result
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Send image message
router.post('/send-image', async (req, res) => {
    try {
        const { to, imageUrl, caption = '' } = req.body;

        if (!to || !imageUrl) {
            return res.status(400).json({
                error: 'Missing required fields: to, imageUrl'
            });
        }

        const result = await whatsapp.sendImageMessage(to, imageUrl, caption);
        res.json({
            success: true,
            messageId: result.messages[0].id,
            result
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Send interactive message
router.post('/send-interactive', async (req, res) => {
    try {
        const { to, text, buttons } = req.body;

        if (!to || !text || !buttons || !Array.isArray(buttons)) {
            return res.status(400).json({
                error: 'Missing required fields: to, text, buttons (array)'
            });
        }

        const result = await whatsapp.sendInteractiveMessage(to, text, buttons);
        res.json({
            success: true,
            messageId: result.messages[0].id,
            result
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Broadcast message
router.post('/broadcast', async (req, res) => {
    try {
        const { numbers, message } = req.body;

        if (!numbers || !Array.isArray(numbers) || !message) {
            return res.status(400).json({
                error: 'Missing required fields: numbers (array), message'
            });
        }

        const results = [];
        for (const number of numbers) {
            try {
                const result = await whatsapp.sendTextMessage(number, message);
                results.push({
                    number,
                    success: true,
                    messageId: result.messages[0].id
                });

                // Rate limiting - 1 message per second
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                results.push({
                    number,
                    success: false,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            totalSent: results.filter(r => r.success).length,
            totalFailed: results.filter(r => !r.success).length,
            results
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});


// Get business profile
router.get('/profile', async (req, res) => {
    try {
        const profile = await whatsapp.getBusinessProfile();
        res.json(profile);
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;