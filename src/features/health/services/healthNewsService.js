// GET /api/health/news/ — live health news, fetched from WHO's own public
// RSS feed (no API key required) per the dashboard spec's flow: WHO ->
// backend fetcher -> validation/sanitisation -> normalisation -> caching ->
// CosmicForge News API -> frontend. We never fabricate news content.
const axios = require("axios");
const { parseStringPromise } = require("xml2js");
const cache = require("../../../shared/utils/cache");

const WHO_NEWS_RSS_URL = "https://www.who.int/rss-feeds/news-english.xml";
const CACHE_TTL_SECONDS = 30 * 60; // 30 minutes
const REQUEST_TIMEOUT_MS = 8000;

function stripHtml(text) {
  return (text || "").replace(/<[^>]*>/g, "").trim();
}

function extractFirstImage(html) {
  const match = (html || "").match(/<img[^>]*\ssrc="([^"]+)"/i);
  return match ? match[1] : null;
}

function extractText(field) {
  // xml2js can hand back either a plain string or { _: "text" } depending
  // on whether the element had attributes (e.g. WHO's guid isPermaLink).
  if (typeof field === "string") return field;
  if (field && typeof field === "object" && "_" in field) return field._;
  return "";
}

class HealthNewsService {
  async getNews(limit = 4) {
    const articles = await cache.getOrSet(
      "health:news:who",
      () => this._fetchAndNormalize(),
      CACHE_TTL_SECONDS
    );

    return { articles: (articles || []).slice(0, limit) };
  }

  async _fetchAndNormalize() {
    try {
      const { data: xml } = await axios.get(WHO_NEWS_RSS_URL, { timeout: REQUEST_TIMEOUT_MS });
      const parsed = await parseStringPromise(xml, { explicitArray: false });

      const items = parsed?.rss?.channel?.item;
      const list = Array.isArray(items) ? items : items ? [items] : [];

      return list.map((item) => {
        const guid = extractText(item.guid);
        // The lead image, when an article has one, is embedded as an <img>
        // inside the escaped HTML of a10:content — not a dedicated
        // media/enclosure tag, which this feed doesn't have.
        const content = extractText(item["a10:content"]);
        return {
          id: guid ? guid.replace(/^urn:uuid:/, "") : item.link,
          title: stripHtml(extractText(item.title)),
          summary: stripHtml(extractText(item.description)),
          category: null, // WHO's general news feed doesn't carry a topic taxonomy
          image: extractFirstImage(content),
          source: "World Health Organization (WHO)",
          source_url: item.link,
          published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
        };
      });
    } catch (error) {
      // News is an optional dashboard section — never let a WHO outage
      // break the rest of the page.
      console.error("healthNewsService fetch error:", error.message);
      return [];
    }
  }
}

module.exports = new HealthNewsService();
