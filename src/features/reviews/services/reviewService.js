const reviewRepository = require("../repositories/reviewRepository");

class ReviewService {
    async submitReview(authorId, { appointmentId, rating, comment }) {
        if (!appointmentId) throw new Error("appointmentId is required");

        const numericRating = Number(rating);
        if (!numericRating || numericRating < 1 || numericRating > 5) {
            throw new Error("Rating must be between 1 and 5");
        }

        const appointment = await reviewRepository.findAppointmentById(appointmentId);
        if (!appointment) throw new Error("Appointment not found");
        if (appointment.status !== "completed") {
            throw new Error("Appointment must be completed before it can be reviewed");
        }

        let direction, targetId;
        if (appointment.patientId === authorId) {
            direction = "patient_to_doctor";
            targetId  = appointment.doctorId;
        } else if (appointment.doctorId === authorId) {
            direction = "doctor_to_patient";
            targetId  = appointment.patientId;
        } else {
            throw new Error("You are not authorized to review this appointment");
        }

        const existing = await reviewRepository.findByAppointmentAndDirection(appointmentId, direction);
        if (existing) throw new Error("You have already reviewed this appointment");

        return reviewRepository.create({
            appointmentId,
            authorId,
            targetId,
            direction,
            rating: numericRating,
            comment: comment || null,
        });
    }

    async getPendingReviews(userId, role) {
        return reviewRepository.findPendingForUser(userId, role);
    }

    async getMyReviews(userId) {
        return reviewRepository.findSubmittedByAuthor(userId);
    }
}

module.exports = new ReviewService();
