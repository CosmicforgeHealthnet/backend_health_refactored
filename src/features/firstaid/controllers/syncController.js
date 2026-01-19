const contentService = require("../services/contentService");

/**
 * ===================================
 *   SYNC CONTROLLER (Mobile + Web)
 * ===================================
 */
class SyncController {
  /**
   * ===============================
   *  MOBILE OFFLINE SYNC
   * ===============================
   */

  // Get full offline manifest for mobile apps
  async getOfflineManifest(req, res, next) {
    try {
      const manifest = await contentService.getOfflineSyncManifest();
      res.json({ success: true, data: manifest });
    } catch (error) {
      next(error);
    }
  }

  /**
   * ===============================
   *  WEB / PWA OFFLINE SYNC
   * ===============================
   */

  // Get lightweight manifest for web Progressive Web App (PWA)
  async getWebManifest(req, res, next) {
    try {
      const manifest = await contentService.getWebOfflineManifest();

      res.set({
        "Cache-Control": "public, max-age=300", // 5 minutes cache
        ETag: `"${manifest.version}"`,
        "Last-Modified": new Date(manifest.lastUpdated).toUTCString(),
      });

      res.json({ success: true, data: manifest });
    } catch (error) {
      next(error);
    }
  }

  // Check if client needs to update (incremental sync)
  async checkForUpdates(req, res, next) {
    try {
      const { clientVersion } = req.query;

      const latestVersion = await contentService.getLatestContentVersion();
      const hasUpdates = clientVersion < latestVersion;

      res.json({
        success: true,
        data: {
          hasUpdates,
          latestVersion,
          clientVersion,
          action: hasUpdates ? "fetch_full_manifest" : "no_action",
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Health check for sync system
  async getHealthCheck(req, res, next) {
    try {
      const health = await contentService.getSyncHealthStatus();
      res.json({ success: true, data: health });
    } catch (error) {
      next(error);
    }
  }
}

/**
 * ===================================
 *  EXPORT SINGLE CONTROLLER
 * ===================================
 */
module.exports = new SyncController();
