const router = require("express").Router();
const healthNewsController = require("../controllers/healthNewsController");

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: Public health content (news, etc.) for the patient dashboard.
 */

/**
 * @swagger
 * /api/health/news:
 *   get:
 *     summary: Get recent health news
 *     tags: [Health]
 *     description: |
 *       Live health news normalised from the World Health Organization's
 *       public RSS feed, cached server-side for 30 minutes.
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 4
 */
router.get("/news", healthNewsController.getNews);

module.exports = router;
