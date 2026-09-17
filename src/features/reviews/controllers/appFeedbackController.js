const service = require("../services/appFeedbackService");

module.exports = {
    async submit(req, res, next) {
        try {
            const feedback = await service.submit(req.user.id, req.user.role, req.body);
            return res.status(201).json({ success: true, feedback });
        } catch (error) {
            if (error.status === 400 || error.status === 403) {
                return res.status(error.status).json({ success: false, error: error.message });
            }
            next(error);
        }
    },

    async getMine(req, res, next) {
        try {
            const feedback = await service.getMine(req.user.id, req.user.role);
            return res.status(200).json({ success: true, feedback });
        } catch (error) {
            if (error.status === 403) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    },
};
