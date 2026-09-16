const repository = require("../repositories/reviewRepository");

const troubleAreas = {
    patient: ["signup", "finding_doctor", "booking", "payment", "notifications", "joining_consultation"],
    doctor: ["signup", "verification", "google_calendar", "availability", "appointments", "notifications", "joining_consultation"],
};

function invalid(message, status = 400) {
    return Object.assign(new Error(message), { status });
}

function validateRole(role) {
    if (!Object.prototype.hasOwnProperty.call(troubleAreas, role)) {
        throw invalid("Only patients and doctors can submit app feedback", 403);
    }
}

module.exports = {
    async submit(authorId, role, payload) {
        validateRole(role);
        const { experience, troubleAreas: areas = [], comment } = payload || {};
        if (!["smooth", "some_difficulties", "could_not_finish"].includes(experience)) {
            throw invalid("Please choose your overall experience");
        }
        if (!Array.isArray(areas) || areas.length > troubleAreas[role].length ||
            areas.some((area) => !troubleAreas[role].includes(area))) {
            throw invalid("Please select valid feedback areas for your role");
        }
        if (comment !== undefined && (typeof comment !== "string" || comment.length > 2000)) {
            throw invalid("Comment must be text with at most 2000 characters");
        }
        return repository.createFeedback({
            authorId, role, experience,
            troubleAreas: [...new Set(areas)],
            comment: comment?.trim() || null,
        });
    },

    async getMine(authorId, role) {
        validateRole(role);
        return repository.findFeedbackByAuthor(authorId);
    },
};
