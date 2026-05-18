const { trackEvent } = require('../services/trackingService');

exports.track = async (req, res) => {
    try {
        const { session_id, event_type } = req.body;

        if (!session_id || typeof session_id !== 'string') {
            return res.status(400).json({ success: false, message: 'session_id is required' });
        }
        if (!event_type || typeof event_type !== 'string') {
            return res.status(400).json({ success: false, message: 'event_type is required' });
        }

        await trackEvent(req.body);
        res.status(202).json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
