const asyncHandler = require("express-async-handler");
const healthNewsService = require("../services/healthNewsService");

class HealthNewsController {
  getNews = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 4;
    const result = await healthNewsService.getNews(limit);
    res.status(200).json(result);
  });
}

module.exports = new HealthNewsController();
