const axios = require("axios");
const ZoomOAuthService = require("../../appointments/services/zoomMeet/zoomOAuthService");

// Voice Spaces are instant, audio-only, open-ended rooms — a much simpler
// Zoom payload than the appointments feature's scheduled-consultation meetings.
// NOTE: this Zoom account is on the free Basic plan (verified against the real
// API) — registration and live-participant-listing endpoints are paid-only /
// unavailable, so per-participant server-side mute/remove is NOT possible here.
// The host mutes/removes people using Zoom's own in-meeting moderator UI
// (available to them via startUrl) instead of our REST API.
class VoiceSpaceZoomService extends ZoomOAuthService {
    async createInstantMeeting(topic) {
        const headers = await this.getZoomHeaders();

        const response = await axios.post(
            `${this.baseURL}/users/me/meetings`,
            {
                topic: topic || "Community Voice Space",
                type: 1, // instant meeting
                settings: {
                    host_video: false,
                    participant_video: false,
                    join_before_host: true,
                    mute_upon_entry: true,
                    waiting_room: false,
                    audio: "voip",
                    approval_type: 2, // no registration required
                },
            },
            { headers }
        );

        return {
            zoomMeetingId: response.data.id.toString(),
            joinUrl: response.data.join_url,
            startUrl: response.data.start_url,
        };
    }

    async endMeeting(zoomMeetingId) {
        try {
            const headers = await this.getZoomHeaders();
            await axios.patch(
                `${this.baseURL}/meetings/${zoomMeetingId}/status`,
                { action: "end" },
                { headers }
            );
        } catch (error) {
            // Already ended / never started / not found — not our problem, the
            // space itself is still authoritative in our own DB either way.
            if (error.response?.status !== 400 && error.response?.status !== 404) {
                console.error(`[VoiceSpaceZoomService] failed to end meeting ${zoomMeetingId}:`, error.response?.data || error.message);
            }
        }
    }
}

module.exports = VoiceSpaceZoomService;
