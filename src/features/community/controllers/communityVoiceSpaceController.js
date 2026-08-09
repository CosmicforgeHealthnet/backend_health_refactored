const communityVoiceSpaceService = require("../services/communityVoiceSpaceService");
const { formatVoiceSpace } = require("../utils/formatters");

class CommunityVoiceSpaceController {
    async start(req, res, next) {
        try {
            const space = await communityVoiceSpaceService.startSpace(req.params.communityId, req.user.id, req.body.title);
            return res.status(201).json({ success: true, message: "Voice space started", space: formatVoiceSpace(space, req.user.id) });
        } catch (error) {
            next(error);
        }
    }

    async getActive(req, res, next) {
        try {
            const active = await communityVoiceSpaceService.getActiveSpace(req.params.communityId);
            if (!active) return res.status(404).json({ success: false, message: "No live voice space in this community" });

            const space = await communityVoiceSpaceService.getSpace(active.id, req.user.id);
            return res.status(200).json({ success: true, space: formatVoiceSpace(space, req.user.id) });
        } catch (error) {
            next(error);
        }
    }

    async getById(req, res, next) {
        try {
            const space = await communityVoiceSpaceService.getSpace(req.params.id, req.user.id);
            return res.status(200).json({ success: true, space: formatVoiceSpace(space, req.user.id) });
        } catch (error) {
            next(error);
        }
    }

    async end(req, res, next) {
        try {
            await communityVoiceSpaceService.endSpace(req.params.id, req.user.id);
            return res.status(200).json({ success: true, message: "Voice space ended" });
        } catch (error) {
            next(error);
        }
    }

    async listHistory(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const result = await communityVoiceSpaceService.listCommunitySpaces(req.params.communityId, {
                page: Number(page), limit: Number(limit),
            });
            return res.status(200).json({
                success: true,
                ...result,
                spaces: result.spaces.map((s) => formatVoiceSpace(s, req.user.id)),
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CommunityVoiceSpaceController();
