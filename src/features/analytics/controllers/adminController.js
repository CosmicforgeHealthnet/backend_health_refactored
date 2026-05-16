const svc = require('../services/statsService');

exports.getStats = async (req, res) => {
    try {
        const { from, to, user_type } = req.query;
        const data = await svc.getStats({ from, to, user_type });
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.getVisitors = async (req, res) => {
    try {
        const { from, to, user_type, country, page, limit, offset } = req.query;
        const data = await svc.getVisitors({ from, to, user_type, country, page, limit, offset });
        res.json({ success: true, ...data });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.getEvents = async (req, res) => {
    try {
        const { session_id, event_type, from, to, limit, offset } = req.query;
        const data = await svc.getEvents({ session_id, event_type, from, to, limit, offset });
        res.json({ success: true, ...data });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.getWaitlist = async (req, res) => {
    try {
        const { role, from, to, limit, offset } = req.query;
        const data = await svc.getWaitlist({ role, from, to, limit, offset });
        res.json({ success: true, ...data });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};
