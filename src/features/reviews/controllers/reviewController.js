const reviewService = require("../services/reviewService");

class ReviewController {
    async submitReview(req, res, next) {
        try {
            const { appointmentId, rating, comment } = req.body;
            if (!appointmentId) {
                return res.status(400).json({ success: false, error: "appointmentId is required" });
            }

            const review = await reviewService.submitReview(req.user.id, { appointmentId, rating, comment });
            return res.status(201).json({
                success: true,
                message: "Review submitted",
                review: formatReview(review),
            });
        } catch (error) {
            if (isClientError(error)) return res.status(400).json({ success: false, error: error.message });
            next(error);
        }
    }

    async getPendingReviews(req, res, next) {
        try {
            const role = req.user.role === "doctor" ? "doctor" : "patient";
            const appointments = await reviewService.getPendingReviews(req.user.id, role);
            return res.status(200).json({
                success: true,
                pending: appointments.map((a) => formatPendingAppointment(a, role)),
            });
        } catch (error) {
            next(error);
        }
    }

    async getMyReviews(req, res, next) {
        try {
            const reviews = await reviewService.getMyReviews(req.user.id);
            return res.status(200).json({
                success: true,
                reviews: reviews.map(formatReview),
            });
        } catch (error) {
            next(error);
        }
    }
}

function formatReview(r) {
    return {
        id:            r.id,
        appointmentId: r.appointmentId,
        direction:     r.direction,
        rating:        Number(r.rating),
        comment:       r.comment,
        createdAt:     r.createdAt,
        target: r.target
            ? { id: r.target.id, fullName: r.target.fullName }
            : undefined,
    };
}

function formatPendingAppointment(a, role) {
    const other = role === "doctor" ? a.patient : a.doctor;
    return {
        appointmentId: a.id,
        completedAt:   a.completedAt,
        otherParty: other
            ? { id: other.id, fullName: other.fullName }
            : undefined,
    };
}

function isClientError(error) {
    return (
        error.message.includes("not found") ||
        error.message.includes("required") ||
        error.message.includes("must be") ||
        error.message.includes("already") ||
        error.message.includes("not authorized")
    );
}

module.exports = new ReviewController();
