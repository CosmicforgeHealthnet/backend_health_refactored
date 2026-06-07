/**
 * LogisticsService — stub ready for future integration with a real logistics provider.
 *
 * Supported future integrations:
 *   - GIG Logistics (Nigeria)
 *   - DHL Express
 *   - Jumia Logistics
 *   - Custom courier
 *
 * To integrate a real provider:
 *   1. Add its SDK/API credentials to .env
 *   2. Implement the relevant method below
 *   3. Route by shipment.logisticsProvider in schedulePickup()
 */
class LogisticsService {

    /**
     * Schedule a pickup with the logistics provider.
     * Currently a stub — logs and returns a placeholder response.
     * Replace with real API call when logistics provider is confirmed.
     */
    async schedulePickup(shipment) {
        console.log(`[Logistics] Pickup scheduled — shipment ${shipment.id}, provider: ${shipment.logisticsProvider || "custom"}`);

        // Future: call provider API here
        // e.g. await dhlService.createShipment({ ... })

        return {
            scheduled: true,
            provider:  shipment.logisticsProvider || "custom",
            message:   "Pickup scheduled. Integration with provider pending.",
        };
    }

    /**
     * Fetch live tracking status from the provider.
     * Returns placeholder until real integration is wired up.
     */
    async getTrackingStatus(trackingNumber, provider) {
        console.log(`[Logistics] Tracking lookup — ${trackingNumber} via ${provider || "custom"}`);

        // Future: call provider tracking API here

        return {
            trackingNumber,
            provider:  provider || "custom",
            status:    "pending_integration",
            message:   "Live tracking will be available once logistics provider is connected.",
        };
    }

    /**
     * Returns the list of supported logistics providers the frontend can display.
     */
    getSupportedProviders() {
        return [
            { key: "gig_logistics",  label: "GIG Logistics" },
            { key: "dhl",            label: "DHL Express" },
            { key: "jumia_logistics", label: "Jumia Logistics" },
            { key: "custom",         label: "Own Delivery / Custom Courier" },
        ];
    }
}

module.exports = new LogisticsService();
