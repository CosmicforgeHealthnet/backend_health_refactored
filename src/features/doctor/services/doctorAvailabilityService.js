// ===================================
// src/features/doctor/services/doctorAvailabilityService.js (Updated with Timezone Support)
// ===================================

const DoctorAvailabilityRepository = require("../repositories/doctorAvailabilityRepository");
const AppointmentRepository = require("../../appointments/repositories/appointmentRepository");
const TimezoneService = require("../../compliance/services/timezoneService");
const userRepository = require("../../auth/repositories/userRepository");
const cache = require("../../../shared/utils/cache");

class DoctorAvailabilityService {
    constructor() {
        this.availabilityRepository = new DoctorAvailabilityRepository();
        this.appointmentRepo = new AppointmentRepository();
    }

    /**
     * Set weekly availability with timezone awareness
     */
    async setWeeklyAvailability(doctorId, availabilityData, req) {
        try {
            // Get doctor's timezone
            const doctorData = await userRepository.findById(doctorId);
            const doctorTimezone = TimezoneService.getUserTimezone(doctorData, req);

            console.log(`Setting availability for doctor ${doctorId} in timezone: ${doctorTimezone}`);

            // Check for duplicate days in the request
            const days = availabilityData.map((item) => item.dayOfWeek);
            const duplicateDays = days.filter(
                (day, index) => days.indexOf(day) !== index
            );

            if (duplicateDays.length > 0) {
                throw new Error(
                    `Duplicate days found in request: ${duplicateDays.join(", ")}`
                );
            }

            // Check for existing availability for these days
            const existingAvailability =
                await this.availabilityRepository.findByDoctorId(doctorId);
            const existingDays = existingAvailability.map((item) => item.dayOfWeek);
            const conflictingDays = days.filter((day) => existingDays.includes(day));

            if (conflictingDays.length > 0) {
                throw new Error(
                    `Doctor already has availability set for: ${conflictingDays.join(
                        ", "
                    )}. Please update existing availability instead of creating new ones.`
                );
            }

            // Create new availability records with timezone info
            const results = [];
            for (const dayAvailability of availabilityData) {
                // Convert times to UTC for storage (using a reference date)
                const referenceDate = this.getReferenceDate(dayAvailability.dayOfWeek);

                const startTimeUTC = this.convertTimeToUTC(
                    referenceDate,
                    dayAvailability.startTime,
                    doctorTimezone
                );

                const endTimeUTC = this.convertTimeToUTC(
                    referenceDate,
                    dayAvailability.endTime,
                    doctorTimezone
                );

                const result = await this.availabilityRepository.create({
                    doctorId,
                    ...dayAvailability,
                    timezone: doctorTimezone,
                    minimumNoticeMinutes: this.clampMinimumNotice(dayAvailability.minimumNoticeMinutes),
                    startTimeUTC: startTimeUTC.toISOString().split('T')[1].substring(0, 8), // Extract HH:MM:SS
                    endTimeUTC: endTimeUTC.toISOString().split('T')[1].substring(0, 8)
                });
                results.push(result);
            }

            // Invalidate availability cache for this doctor
            await cache.invalidatePattern(`doctor:availability:${doctorId}:*`);

            return results;
        } catch (error) {
            throw new Error(`Failed to set availability: ${error.message}`);
        }
    }

    /**
     * Get available slots with timezone conversion
     */
    async getAvailableSlots(doctorId, date, patientTimezone = null, req = null) {
        try {
            // Determine target timezone first for cache key
            const targetTimezone = patientTimezone || TimezoneService.getUserTimezone(null, req);
            const cacheKey = `doctor:availability:${doctorId}:${date}:${targetTimezone}`;

            // Try to get from cache
            const cachedResult = await cache.get(cacheKey);
            if (cachedResult) {
                return cachedResult;
            }

            // Get doctor's timezone
            const doctorData = await userRepository.findById(doctorId);
            const doctorTimezone = TimezoneService.getUserTimezone(doctorData, req);


            const dayOfWeek = this.getDayOfWeek(date);

            // Get doctor's availability for this day
            const dayAvailability =
                await this.availabilityRepository.findByDoctorAndDay(
                    doctorId,
                    dayOfWeek
                );

            if (!dayAvailability.length) {
                return {
                    date,
                    doctorId,
                    availableSlots: [],
                    bookedSlots: [],
                    doctorTimezone,
                    targetTimezone,
                    message: "Doctor not available on this day",
                };
            }

            // Check for unavailability periods
            const unavailability =
                await this.availabilityRepository.findUnavailabilityByDoctor(
                    doctorId,
                    date,
                    date
                );

            // Get existing appointments for this date (using UTC times for comparison)
            const existingAppointments =
                await this.appointmentRepo.findDoctorAvailability(doctorId, date);

            // Get booked time slots in target timezone
            const bookedSlots = existingAppointments
                .filter((apt) => {
                    if (apt.status === "cancelled") return false;

                    // For pending appointments, only count as booked if within 10 minutes
                    if (apt.status === "pending") {
                        const createdAt = new Date(apt.createdAt);
                        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
                        return createdAt > tenMinutesAgo;
                    }

                    // Block slots for approved appointments
                    if (apt.isDoctorApproved === true) {
                        return true;
                    }

                    return true;
                })
                .map((apt) => {
                    // Convert appointment time to target timezone
                    if (apt.appointmentTimeUTC) {
                        const targetTime = TimezoneService.convertFromUTC(
                            apt.appointmentTimeUTC,
                            targetTimezone
                        );
                        return targetTime.time;
                    } else {
                        // Fallback for old appointments without UTC time
                        const aptTimezone = apt.patientTimezone || apt.doctorTimezone || doctorTimezone;
                        const utcTime = TimezoneService.convertToUTC(
                            apt.appointmentDate,
                            apt.appointmentTime,
                            aptTimezone
                        );
                        const targetTime = TimezoneService.convertFromUTC(utcTime, targetTimezone);
                        return targetTime.time;
                    }
                })
                .filter(Boolean)
                .sort();

            // Generate all possible time slots in target timezone
            const allSlots = new Set();

            for (const availability of dayAvailability) {
                // Convert doctor's availability to target timezone
                const availabilitySlots = this.generateTimezoneAwareSlots(
                    availability,
                    date,
                    doctorTimezone,
                    targetTimezone
                );

                availabilitySlots.forEach((slot) => allSlots.add(slot));
            }

            const isToday = this.isToday(date, targetTimezone);
            const currentTime = isToday ? this.getCurrentTime(targetTimezone) : null;
            // Doctor-configurable lead time (defaults to 0 — bookable up to the last minute)
            const BOOKING_BUFFER_MINUTES = dayAvailability[0]?.minimumNoticeMinutes ?? 0;

            // Filter out unavailable/booked and already-past/too-soon slots for today
            const availableSlots = Array.from(allSlots)
                .filter((slot) => {
                    const isNotBooked = !bookedSlots.includes(slot);
                    const isNotUnavailable = !this.isSlotUnavailableInTimezone(
                        slot,
                        unavailability,
                        date,
                        targetTimezone,
                        doctorTimezone
                    );

                    // Filter out past time slots and those within the 1-hour buffer for today
                    const isNotPastTime =
                        !isToday ||
                        this.timeToMinutes(slot) >= (this.timeToMinutes(currentTime) + BOOKING_BUFFER_MINUTES);

                    return isNotBooked && isNotUnavailable && isNotPastTime;
                })
                .sort();

            const result = {
                date,
                doctorId,
                availableSlots,
                bookedSlots,
                dayOfWeek,
                doctorTimezone,
                targetTimezone,
                totalSlots: Array.from(allSlots).length,
                availableCount: availableSlots.length,
                bookedCount: bookedSlots.length,
            };

            // Cache the result for 5 minutes
            await cache.set(cacheKey, result, 300);

            return result;
        } catch (error) {
            throw new Error(`Failed to get available slots: ${error.message}`);
        }
    }

    /**
     * Generate timezone-aware time slots
     */
    generateTimezoneAwareSlots(availability, date, doctorTimezone, targetTimezone) {
        try {
            // Generate slots in doctor's timezone first
            const doctorSlots = this.generateTimeSlots(
                availability.startTime,
                availability.endTime,
                availability.slotDuration,
                availability.breakTime
            );

            // Convert each slot to target timezone
            const convertedSlots = doctorSlots.map(slot => {
                const utcTime = TimezoneService.convertToUTC(date, slot, doctorTimezone);
                const targetTime = TimezoneService.convertFromUTC(utcTime, targetTimezone);
                return targetTime.time;
            });

            return convertedSlots;
        } catch (error) {
            console.error('Error generating timezone-aware slots:', error);
            return [];
        }
    }

    /**
     * Check if slot is unavailable in target timezone
     */
    isSlotUnavailableInTimezone(slot, unavailabilityPeriods, date, targetTimezone, doctorTimezone) {
        return unavailabilityPeriods.some((period) => {
            // If entire day is unavailable
            if (!period.startTime && !period.endTime) {
                return true;
            }

            // Check if slot falls within unavailable time range
            if (period.startTime && period.endTime) {
                // Convert unavailability period to target timezone
                try {
                    const startUTC = TimezoneService.convertToUTC(date, period.startTime, doctorTimezone);
                    const endUTC = TimezoneService.convertToUTC(date, period.endTime, doctorTimezone);

                    const startInTarget = TimezoneService.convertFromUTC(startUTC, targetTimezone);
                    const endInTarget = TimezoneService.convertFromUTC(endUTC, targetTimezone);

                    const slotMinutes = this.timeToMinutes(slot);
                    const startMinutes = this.timeToMinutes(startInTarget.time);
                    const endMinutes = this.timeToMinutes(endInTarget.time);

                    return slotMinutes >= startMinutes && slotMinutes < endMinutes;
                } catch (error) {
                    console.error('Error converting unavailability to target timezone:', error);
                    return false;
                }
            }

            return false;
        });
    }

    /**
     * Check if date is today in specific timezone
     */
    isToday(date, timezone) {
        try {
            const now = new Date();
            const todayInTimezone = TimezoneService.convertFromUTC(now, timezone);
            return todayInTimezone.date === date;
        } catch (error) {
            console.error('Error checking if date is today:', error);
            return false;
        }
    }

    /**
     * Get current time in specific timezone
     */
    getCurrentTime(timezone) {
        try {
            const now = new Date();
            const timeInTimezone = TimezoneService.convertFromUTC(now, timezone);
            return timeInTimezone.time;
        } catch (error) {
            console.error('Error getting current time in timezone:', error);
            return '00:00';
        }
    }

    /**
     * Convert time to UTC using reference date
     */
    convertTimeToUTC(referenceDate, time, timezone) {
        try {
            return TimezoneService.convertToUTC(
                referenceDate.toISOString().split('T')[0],
                time,
                timezone
            );
        } catch (error) {
            console.error('Error converting time to UTC:', error);
            return new Date();
        }
    }

    /**
     * Get reference date for day of week calculations
     */
    getReferenceDate(dayOfWeek) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = new Date();
        const todayDayIndex = today.getDay();
        const targetDayIndex = days.indexOf(dayOfWeek.toLowerCase());

        if (targetDayIndex === -1) {
            throw new Error(`Invalid day of week: ${dayOfWeek}`);
        }

        const daysUntilTarget = (targetDayIndex - todayDayIndex + 7) % 7;
        const referenceDate = new Date(today);
        referenceDate.setDate(today.getDate() + daysUntilTarget);

        return referenceDate;
    }

    /**
     * Replace weekly availability with timezone awareness
     */
    async replaceWeeklyAvailability(doctorId, availabilityData, req) {
        try {
            // Get doctor's timezone
            const doctorData = await userRepository.findById(doctorId);
            const doctorTimezone = TimezoneService.getUserTimezone(doctorData, req);

            // Check for duplicate days in request
            const days = availabilityData.map((item) => item.dayOfWeek);
            const duplicateDays = days.filter(
                (day, index) => days.indexOf(day) !== index
            );

            if (duplicateDays.length > 0) {
                throw new Error(
                    `Duplicate days found in request: ${duplicateDays.join(", ")}`
                );
            }

            // Delete ALL existing active availability for this doctor
            const existingAvailability =
                await this.availabilityRepository.findByDoctorId(doctorId);
            for (const existing of existingAvailability) {
                await this.availabilityRepository.delete(existing.id);
            }


            // Create new availability records with timezone info
            const results = [];
            for (const dayAvailability of availabilityData) {
                const referenceDate = this.getReferenceDate(dayAvailability.dayOfWeek);

                const startTimeUTC = this.convertTimeToUTC(
                    referenceDate,
                    dayAvailability.startTime,
                    doctorTimezone
                );

                const endTimeUTC = this.convertTimeToUTC(
                    referenceDate,
                    dayAvailability.endTime,
                    doctorTimezone
                );

                const result = await this.availabilityRepository.create({
                    doctorId,
                    ...dayAvailability,
                    timezone: doctorTimezone,
                    minimumNoticeMinutes: this.clampMinimumNotice(dayAvailability.minimumNoticeMinutes),
                    startTimeUTC: startTimeUTC.toISOString().split('T')[1].substring(0, 8),
                    endTimeUTC: endTimeUTC.toISOString().split('T')[1].substring(0, 8)
                });
                results.push(result);
            }

            // Invalidate availability cache for this doctor
            await cache.invalidatePattern(`doctor:availability:${doctorId}:*`);

            return results;
        } catch (error) {
            throw new Error(`Failed to replace availability: ${error.message}`);
        }
    }

    // Doctor can set any lead time, but never more than 1 hour
    clampMinimumNotice(value) {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0) return 0;
        return Math.min(60, Math.floor(n));
    }

    // Keep existing utility methods
    getDayOfWeek(date) {
        const days = [
            "sunday",
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
        ];
        return days[new Date(date).getDay()];
    }

    generateTimeSlots(startTime, endTime, slotDuration, breakTime) {
        const slots = [];
        const start = this.timeToMinutes(startTime);
        const end = this.timeToMinutes(endTime);

        for (let time = start; time < end; time += slotDuration + breakTime) {
            if (time + slotDuration <= end) {
                slots.push(this.minutesToTime(time));
            }
        }
        return slots;
    }

    timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(":").map(Number);
        return hours * 60 + minutes;
    }

    minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, "0")}:${mins
            .toString()
            .padStart(2, "0")}`;
    }

    normalizeTimeFormat(timeString) {
        if (!timeString) return null;

        if (timeString.includes(":")) {
            const parts = timeString.split(":");
            const hours = parts[0].padStart(2, "0");
            const minutes = parts[1].padStart(2, "0");
            return `${hours}:${minutes}`;
        }

        return timeString;
    }

    // Keep other existing methods but add timezone awareness where needed...
    async getDoctorAvailability(doctorId) {
        return await this.availabilityRepository.findByDoctorId(doctorId);
    }

    async setUnavailability(doctorId, unavailabilityData) {
        const result = await this.availabilityRepository.createUnavailability({
            doctorId,
            ...unavailabilityData,
        });
        // Invalidate availability cache
        await cache.invalidatePattern(`doctor:availability:${doctorId}:*`);
        return result;
    }

    async findUnavailabilityByDoctor(doctorId, startDate, endDate) {
        try {
            return await this.availabilityRepository.findUnavailabilityByDoctor(
                doctorId,
                startDate,
                endDate
            );
        } catch (error) {
            console.error("Error finding doctor unavailability:", error);
            return [];
        }
    }

    async updateAvailability(doctorId, availabilityId, updateData) {
        try {
            const availability = await this.availabilityRepository.repository.findOne(
                {
                    where: { id: availabilityId, doctorId },
                }
            );

            if (!availability) {
                throw new Error(
                    "Availability record not found or does not belong to this doctor"
                );
            }

            const updatedAvailability = await this.availabilityRepository.update(
                availabilityId,
                {
                    ...updateData,
                    updatedAt: new Date(),
                }
            );

            // Invalidate availability cache
            await cache.invalidatePattern(`doctor:availability:${doctorId}:*`);

            return updatedAvailability;
        } catch (error) {
            throw new Error(`Failed to update availability: ${error.message}`);
        }
    }

    async deleteAvailability(doctorId, availabilityId) {
        try {
            const availability = await this.availabilityRepository.repository.findOne(
                {
                    where: { id: availabilityId, doctorId },
                }
            );

            if (!availability) {
                throw new Error(
                    "Availability record not found or does not belong to this doctor"
                );
            }

            // Invalidate availability cache
            await cache.invalidatePattern(`doctor:availability:${doctorId}:*`);

            return await this.availabilityRepository.delete(availabilityId);
        } catch (error) {
            throw new Error(`Failed to delete availability: ${error.message}`);
        }
    }

    async updateUnavailability(doctorId, unavailabilityId, updateData) {
        try {
            const unavailability =
                await this.availabilityRepository.unavailabilityRepository.findOne({
                    where: { id: unavailabilityId, doctorId },
                });

            if (!unavailability) {
                throw new Error(
                    "Unavailability record not found or does not belong to this doctor"
                );
            }

            const updated =
                await this.availabilityRepository.unavailabilityRepository.update(
                    unavailabilityId,
                    {
                        ...updateData,
                        updatedAt: new Date(),
                    }
                );

            // Invalidate availability cache
            await cache.invalidatePattern(`doctor:availability:${doctorId}:*`);

            return await this.availabilityRepository.unavailabilityRepository.findOne(
                {
                    where: { id: unavailabilityId },
                }
            );
        } catch (error) {
            throw new Error(`Failed to update unavailability: ${error.message}`);
        }
    }

    async deleteUnavailability(doctorId, unavailabilityId) {
        try {
            const unavailability =
                await this.availabilityRepository.unavailabilityRepository.findOne({
                    where: { id: unavailabilityId, doctorId },
                });

            if (!unavailability) {
                throw new Error(
                    "Unavailability record not found or does not belong to this doctor"
                );
            }

            // Invalidate availability cache
            await cache.invalidatePattern(`doctor:availability:${doctorId}:*`);

            return await this.availabilityRepository.unavailabilityRepository.update(
                unavailabilityId,
                { isActive: false }
            );
        } catch (error) {
            throw new Error(`Failed to delete unavailability: ${error.message}`);
        }
    }
}

module.exports = DoctorAvailabilityService;
