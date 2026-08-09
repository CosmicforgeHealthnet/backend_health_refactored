const communityMemberRepository = require("../repositories/communityMemberRepository");

function requireCommunityRole(...allowedRoles) {
    return async (req, res, next) => {
        try {
            const communityId = req.params.communityId || req.params.id;
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

            const membership = await communityMemberRepository.findActiveByUserAndCommunity(userId, communityId);
            if (!membership || !allowedRoles.includes(membership.role)) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to perform this action in this community",
                });
            }

            req.communityMembership = membership;
            next();
        } catch (error) {
            next(error);
        }
    };
}

module.exports = { requireCommunityRole };
