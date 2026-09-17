const AppDataSource = require("../../../config/database");

const reviewRepo      = () => AppDataSource.getRepository("Review");
const appointmentRepo = () => AppDataSource.getRepository("Appointment");

const reviewRepository = {
    createFeedback(data) {
        return AppDataSource.getRepository("AppFeedback").save(data);
    },

    findFeedbackByAuthor(authorId) {
        return AppDataSource.getRepository("AppFeedback").find({
            where: { authorId },
            order: { createdAt: "DESC" },
        });
    },

    findAppointmentById(id) {
        return appointmentRepo().findOne({ where: { id } });
    },

    findByAppointmentAndDirection(appointmentId, direction) {
        return reviewRepo().findOne({ where: { appointmentId, direction } });
    },

    create(data) {
        return reviewRepo().save(data);
    },

    // Completed appointments for this user that don't yet have a review row
    // for the direction this user would author.
    async findPendingForUser(userId, role) {
        const direction  = role === "doctor" ? "doctor_to_patient" : "patient_to_doctor";
        const userColumn = role === "doctor" ? "doctorId" : "patientId";

        return appointmentRepo()
            .createQueryBuilder("a")
            .leftJoinAndSelect("a.doctor",  "doctor")
            .leftJoinAndSelect("a.patient", "patient")
            .leftJoin("reviews", "r", "r.appointmentId = a.id AND r.direction = :direction", { direction })
            .where(`a.${userColumn} = :userId`, { userId })
            .andWhere("a.status = :status", { status: "completed" })
            .andWhere("r.id IS NULL")
            .orderBy("a.completedAt", "DESC")
            .getMany();
    },

    findSubmittedByAuthor(authorId) {
        return reviewRepo().find({
            where: { authorId },
            relations: ["target"],
            order: { createdAt: "DESC" },
        });
    },
};

module.exports = reviewRepository;
