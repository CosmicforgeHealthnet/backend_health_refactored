const communityService = require("../services/communityService");
const { formatCommunity } = require("../utils/formatters");

class CommunityController {
    async create(req, res, next) {
        try {
            const { name, description, category, tags, privacyType, bannerUrl, avatarUrl, rules } = req.body;
            if (!name) {
                return res.status(400).json({ success: false, message: "name is required" });
            }

            const community = await communityService.createCommunity(req.user.id, {
                name, description, category, tags, privacyType, bannerUrl, avatarUrl, rules,
            });

            return res.status(201).json({ success: true, message: "Community created", community: formatCommunity(community) });
        } catch (error) {
            next(error);
        }
    }

    async getMyCommunities(req, res, next) {
        try {
            const communities = await communityService.listMyCommunities(req.user.id);
            return res.status(200).json({ success: true, communities: communities.map(formatCommunity) });
        } catch (error) {
            next(error);
        }
    }

    async discover(req, res, next) {
        try {
            const { search, category, privacyType, page = 1, limit = 20 } = req.query;
            const result = await communityService.discoverCommunities(req.user.id, {
                search, category, privacyType, page: Number(page), limit: Number(limit),
            });
            return res.status(200).json({ success: true, ...result, communities: result.communities.map(formatCommunity) });
        } catch (error) {
            next(error);
        }
    }

    async getById(req, res, next) {
        try {
            const community = await communityService.getCommunityById(req.params.id, req.user.id);
            return res.status(200).json({ success: true, community: formatCommunity(community) });
        } catch (error) {
            next(error);
        }
    }

    async update(req, res, next) {
        try {
            const community = await communityService.updateCommunity(req.params.id, req.body);
            return res.status(200).json({ success: true, message: "Community updated", community: formatCommunity(community) });
        } catch (error) {
            next(error);
        }
    }

    async delete(req, res, next) {
        try {
            await communityService.deleteCommunity(req.params.id);
            return res.status(200).json({ success: true, message: "Community deleted" });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new CommunityController();
