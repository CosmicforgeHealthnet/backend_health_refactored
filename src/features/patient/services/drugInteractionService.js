// Live drug-drug interaction lookups against RxNav (U.S. National Library of
// Medicine / NIH) — a free, public, no-key-required API. We do not maintain
// our own interaction data; NLM is the authoritative source.
const axios = require("axios");

const RXNAV_BASE = "https://rxnav.nlm.nih.gov/REST";
const REQUEST_TIMEOUT_MS = 8000;

class DrugInteractionService {
  // Resolves a free-text medication name (as entered by a doctor on a
  // prescription) to its RxNorm concept ID. Returns null if no match.
  async resolveRxcui(drugName) {
    const { data } = await axios.get(`${RXNAV_BASE}/rxcui.json`, {
      params: { name: drugName, search: 2 },
      timeout: REQUEST_TIMEOUT_MS,
    });

    return data?.idGroup?.rxnormId?.[0] || null;
  }

  // Given 2+ RxNorm concept IDs, returns the known interaction pairs between
  // them per NLM's interaction API.
  async checkInteractions(rxcuis) {
    if (rxcuis.length < 2) return [];

    const { data } = await axios.get(`${RXNAV_BASE}/interaction/list.json`, {
      params: { rxcuis: rxcuis.join("+") },
      timeout: REQUEST_TIMEOUT_MS,
    });

    const groups = data?.fullInteractionTypeGroup || [];
    const pairs = [];

    for (const group of groups) {
      for (const type of group.fullInteractionType || []) {
        for (const pair of type.interactionPair || []) {
          pairs.push({
            description: pair.description,
            severity: pair.severity || null,
            drugs: (pair.interactionConcept || []).map(
              (c) => c.minConceptItem?.name
            ),
          });
        }
      }
    }

    return pairs;
  }
}

module.exports = new DrugInteractionService();
