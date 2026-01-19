// middlewares/checkTier.js

const { TIERS } = require("../../config/tiersConfig");

module.exports = function checkUserTier(requiredTier) {
  if (!requiredTier || !TIERS.hasOwnProperty(requiredTier)) {
    throw new Error(
      `Invalid tier specified in checkUserTier middleware: ${requiredTier}`
    );
  }

  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userTierLevel = TIERS[user.tier] ?? -1;
      const requiredTierLevel = TIERS[requiredTier];

      if (userTierLevel < requiredTierLevel) {
        return res.status(403).json({
          error: "Access denied",
          message: `You need to have ${requiredTier} tier or higher to access this resource.`,
        });
      }

      next();
    } catch (error) {
      console.error("❌ Error in checkUserTier middleware:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };
};
