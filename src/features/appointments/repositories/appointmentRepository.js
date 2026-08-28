// ===================================
// src/repositories/AppointmentRepository.js
// ===================================

const AppDataSource = require("../../../config/database");
const Appointment = require("../entities/Appointment");
const { In, MoreThanOrEqual, Between } = require("typeorm");
const {
    sanitizeAppointment,
    sanitizeAppointments,
} = require("../../../shared/utils/sanitizeAppointment");

class AppointmentRepository {
    constructor() {
        this.repository = AppDataSource.getRepository(Appointment);
    }

    async create(appointmentData) {
        const appointment = this.repository.create(appointmentData);
        return await this.repository.save(appointment);
    }

    async find(options = {}) {
        return await this.repository.find({
            ...options,
            relations: [
                "patient",
                "doctor",
                "patient.patientProfile",
                "patient.patientProfile.medicalConditions",
                "patient.patientProfile.surgeries",
                "patient.patientProfile.allergies",
                "patient.patientProfile.familyHistories",
                "patient.patientProfile.medications",
                "patient.patientProfile.immunizations",
                "patient.patientProfile.healthInsurance",
                "patient.patientProfile.disability",
                "patient.patientProfile.consent",
                "doctor.doctorProfile",
                "doctor.doctorProfile.professionalLicense",
                "doctor.doctorProfile.professionalCertificate",
                "doctor.doctorProfile.clinicalPractice",
                "doctor.doctorProfile.digitalHealthTools",
                "appointmentChat",
                "appointmentChat.room"
            ],
        });
    }


    async findById(id) {
        const appointment = await this.repository.findOne({
            where: { id },
            relations: [
                "patient",
                "doctor",
                "patient.patientProfile",
                "patient.patientProfile.medicalConditions",
                "patient.patientProfile.surgeries",
                "patient.patientProfile.allergies",
                "patient.patientProfile.familyHistories",
                "patient.patientProfile.medications",
                "patient.patientProfile.immunizations",
                "patient.patientProfile.healthInsurance",
                "patient.patientProfile.disability",
                "patient.patientProfile.consent",
                "doctor.doctorProfile",
                "doctor.doctorProfile.professionalLicense",
                "doctor.doctorProfile.professionalCertificate",
                "doctor.doctorProfile.clinicalPractice",
                "doctor.doctorProfile.digitalHealthTools",
                "appointmentChat",
                "appointmentChat.room"
            ],
        });

        if (!appointment) return null;
        return sanitizeAppointment(appointment);

    }


    async findAll(filters = {}) {
        const whereClause = {};

        if (filters.patientId) {
            whereClause.patient = { id: filters.patientId };
        }

        if (filters.doctorId) {
            whereClause.doctor = { id: filters.doctorId };
        }

        if (filters.status) {
            whereClause.status = filters.status;
        }

        if (filters.appointmentDate) {
            whereClause.appointmentDate = filters.appointmentDate;
        }

        if (filters.paymentStatus) {
            whereClause.paymentStatus = filters.paymentStatus;
        }

        if (filters.dateRange) {
            whereClause.appointmentDate = Between(
                filters.dateRange.startDate,
                filters.dateRange.endDate
            );
        }

        const page = filters.page || 1;
        const limit = filters.limit || 10;
        const skip = (page - 1) * limit;

        const [appointments, total] = await this.repository.findAndCount({
            where: whereClause,
            order: { appointmentDate: "DESC", appointmentTime: "DESC" },
            skip,
            take: limit,
            relations: [
                "patient",
                "doctor",
                "patient.patientProfile",
                "patient.patientProfile.medicalConditions",
                "patient.patientProfile.surgeries",
                "patient.patientProfile.allergies",
                "patient.patientProfile.familyHistories",
                "patient.patientProfile.medications",
                "patient.patientProfile.immunizations",
                "patient.patientProfile.healthInsurance",
                "patient.patientProfile.disability",
                "patient.patientProfile.consent",
                "doctor.doctorProfile",
                "doctor.doctorProfile.professionalLicense",
                "doctor.doctorProfile.professionalCertificate",
                "doctor.doctorProfile.clinicalPractice",
                "doctor.doctorProfile.digitalHealthTools",
                "appointmentChat",
                "appointmentChat.room"
            ],
        });

        return {
            data: sanitizeAppointments(appointments),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }


    async update(id, updateData) {
        await this.repository.update(id, updateData);
        return await this.findById(id);
    }

    async delete(id) {
        return await this.repository.delete(id);
    }

    async findByPatientId(patientId) {
        const appointments = await this.repository.find({
            where: { patientId },
            order: { appointmentDate: "DESC", appointmentTime: "DESC" },
            relations: [
                "patient",
                "doctor",
                "patient.patientProfile",
                "patient.patientProfile.medicalConditions",
                "patient.patientProfile.surgeries",
                "patient.patientProfile.allergies",
                "patient.patientProfile.familyHistories",
                "patient.patientProfile.medications",
                "patient.patientProfile.immunizations",
                "patient.patientProfile.healthInsurance",
                "patient.patientProfile.disability",
                "patient.patientProfile.consent",
                "doctor.doctorProfile",
                "doctor.doctorProfile.professionalLicense",
                "doctor.doctorProfile.professionalCertificate",
                "doctor.doctorProfile.clinicalPractice",
                "doctor.doctorProfile.digitalHealthTools",
                "appointmentChat",
                "appointmentChat.room"
            ],
        });

        return sanitizeAppointments(appointments);

    }

    async findByDoctorId(doctorId) {
        const appointments = await this.repository.find({
            where: { doctorId },
            order: { appointmentDate: "ASC", appointmentTime: "ASC" },
            relations: [
                "patient",
                "doctor",
                "patient.patientProfile",
                "patient.patientProfile.medicalConditions",
                "patient.patientProfile.surgeries",
                "patient.patientProfile.allergies",
                "patient.patientProfile.familyHistories",
                "patient.patientProfile.medications",
                "patient.patientProfile.immunizations",
                "patient.patientProfile.healthInsurance",
                "patient.patientProfile.disability",
                "patient.patientProfile.consent",
                "doctor.doctorProfile",
                "doctor.doctorProfile.professionalLicense",
                "doctor.doctorProfile.professionalCertificate",
                "doctor.doctorProfile.clinicalPractice",
                "doctor.doctorProfile.digitalHealthTools",
                "appointmentChat",
                "appointmentChat.room"
            ],
        });

        return sanitizeAppointments(appointments);

    }

    async findUpcomingAppointmentsForPatient(patientId) {
        const today = new Date();
        const appointments = await this.repository.find({
            where: {
                patientId,
                appointmentDate: MoreThanOrEqual(today),
                status: In(["scheduled", "pending"]),
            },
            order: { appointmentDate: "ASC", appointmentTime: "ASC" },
            relations: [
                "patient",
                "doctor",
                "patient.patientProfile",
                "patient.patientProfile.medicalConditions",
                "patient.patientProfile.surgeries",
                "patient.patientProfile.allergies",
                "patient.patientProfile.familyHistories",
                "patient.patientProfile.medications",
                "patient.patientProfile.immunizations",
                "patient.patientProfile.healthInsurance",
                "patient.patientProfile.disability",
                "patient.patientProfile.consent",
                "doctor.doctorProfile",
                "doctor.doctorProfile.professionalLicense",
                "doctor.doctorProfile.professionalCertificate",
                "doctor.doctorProfile.clinicalPractice",
                "doctor.doctorProfile.digitalHealthTools",
                "appointmentChat",
                "appointmentChat.room"
            ],
        });

        return sanitizeAppointments(appointments);

    }

    // Lean lookup for calendar/dashboard views — avoids the heavy medical
    // profile / verification-document joins that findAll()/findUpcoming...()
    // pull in, since those aren't needed to render a calendar cell.
    async findByPatientAndDateRange(patientId, startDate, endDate) {
        const appointments = await this.repository.find({
            where: {
                patientId,
                appointmentDate: Between(startDate, endDate),
            },
            order: { appointmentDate: "ASC", appointmentTime: "ASC" },
            relations: ["doctor"],
        });

        return sanitizeAppointments(appointments);
    }

    async findUpcomingAppointmentsForDoctor(doctorId) {
        const today = new Date();
        const appointments = await this.repository.find({
            where: {
                doctorId,
                appointmentDate: MoreThanOrEqual(today),
                status: In(["scheduled", "pending"]),
            },
            order: { appointmentDate: "ASC", appointmentTime: "ASC" },
            relations: [
                "patient",
                "doctor",
                "patient.patientProfile",
                "patient.patientProfile.medicalConditions",
                "patient.patientProfile.surgeries",
                "patient.patientProfile.allergies",
                "patient.patientProfile.familyHistories",
                "patient.patientProfile.medications",
                "patient.patientProfile.immunizations",
                "patient.patientProfile.healthInsurance",
                "patient.patientProfile.disability",
                "patient.patientProfile.consent",
                "doctor.doctorProfile",
                "doctor.doctorProfile.professionalLicense",
                "doctor.doctorProfile.professionalCertificate",
                "doctor.doctorProfile.clinicalPractice",
                "doctor.doctorProfile.digitalHealthTools",
                "appointmentChat",
                "appointmentChat.room"
            ],
        });

        return sanitizeAppointments(appointments);

    }

    async findDoctorAvailability(doctorId, date) {
        return await this.repository.find({
            where: {
                doctorId,
                appointmentDate: date,
                status: In(["scheduled", "pending"]),
            },
            order: { appointmentTime: "ASC" },
        });
    }

    async getAnalytics(filters = {}) {
        const whereClause = {};

        if (filters.patientId) whereClause.patient = { id: filters.patientId };
        if (filters.doctorId) whereClause.doctor = { id: filters.doctorId };
        if (filters.startDate && filters.endDate) {
            whereClause.appointmentDate = Between(filters.startDate, filters.endDate);
        }

        // Get total count
        const total = await this.repository.count({ where: whereClause });

        // Get count by status
        const statusCounts = await this.repository
            .createQueryBuilder("appointment")
            .select("appointment.status", "status")
            .addSelect("COUNT(appointment.id)", "count")
            .where(whereClause)
            .groupBy("appointment.status")
            .getRawMany();

        // Get revenue (if applicable, assuming consultationFee handling)
        // For now, simple aggregation
        const revenue = await this.repository
            .createQueryBuilder("appointment")
            .select("SUM(appointment.consultationFee)", "totalRevenue")
            .where({ ...whereClause, paymentStatus: "completed" })
            .getRawOne();


        return {
            totalAppointments: total,
            statusBreakdown: statusCounts.reduce((acc, curr) => {
                acc[curr.status] = parseInt(curr.count);
                return acc;
            }, {}),
            totalRevenue: parseFloat(revenue?.totalRevenue || 0)
        };
    }
}

module.exports = AppointmentRepository;
