// // src/jobs/UserJob.js
// // ===================================
// const cron = require("node-cron");
// const userRepository = require("../../auth/repositories/userRepository");
// const {
//   sendProfileCompletionReminderEmail,
// } = require("../../../shared/services/email/helper/index");

// class UserJob {
//   static start() {
//     console.log('🔔 Profile completion reminder (every Monday)...');

//     // Every 24 hours at 9am
//     cron.schedule("0 9 * * *", async () => {
//       await runProfileCompletionReminders();
//     });
//   }
// }

// async function runProfileCompletionReminders() {
//   try {
//     console.log("⏳ Running profile completion reminder...");

//     // Fetch all doctors
//     const doctors = await userRepository.findAllDoctors();

//     // Filter doctors with incomplete profiles
//     const incompleteDoctors = doctors.filter((doctor) => {
//       const profile = doctor.doctorProfile;

//       // Customize this condition based on your definition of "complete"
//       return (
//         !profile ||
//         // !profile.professionalLicense ||
//         !profile.professionalCertificate ||
//         !profile.clinicalPractice ||
//         !profile.digitalHealthTools ||
//         !doctor.doctorPricing ||
//         !doctor.doctorAvailability
//       );
//     });


//     console.log(
//       `Found ${incompleteDoctors.length} doctors with incomplete profiles.`
//     );

//     // Send emails
//     for (const doctor of incompleteDoctors) {
//       await sendProfileCompletionReminderEmail(doctor);
//       console.log(`📧 Sent reminder to: ${doctor.email}`);
//     }

//     console.log("✅ Profile completion reminders sent.");
//   } catch (error) {
//     console.error("❌ Error running profile reminder cron:", error);
//   }
// }

// module.exports = UserJob;


// src/jobs/UserJob.js
// ===================================
const cron = require("node-cron");
const userRepository = require("../../auth/repositories/userRepository");
const {
  sendProfileCompletionReminderEmail,
} = require("../../../shared/services/email/emailHelpers");

class UserJob {
  static start() {
    console.log("🔔 Profile completion reminder (daily at 9am)...");

    // Run every day at 9AM
    cron.schedule("0 12 * * *", async () => {
      await runProfileCompletionReminders();
    });
  }
}

async function runProfileCompletionReminders() {
  try {
    console.log("⏳ Running profile completion reminder...");

    // Fetch all doctors
    const doctors = await userRepository.findAllDoctors();

    // Filter doctors with incomplete profiles
    const incompleteDoctors = doctors.filter((doctor) => {
      const profile = doctor.doctorProfile;
      return (
        !profile ||
        // !profile.professionalCertificate ||
        // !profile.clinicalPractice ||
        // !profile.digitalHealthTools ||
        !doctor.doctorPricing ||
        !doctor.doctorAvailability
      );
    });

    if (incompleteDoctors.length === 0) {
      console.log("✅ No incomplete doctors found.");
      return;
    }

    console.log(
      `📦 Found ${incompleteDoctors.length} doctors with incomplete profiles.`
    );

    const batchSize = 20;
    let batchIndex = 0;

    // Function to process a batch
    const processBatch = async () => {
      const start = batchIndex * batchSize;
      const end = start + batchSize;
      const batch = incompleteDoctors.slice(start, end);

      console.log("length of batch doctors, :", batch.length);
      console.log(batch.map(a => a.email));

      if (batch.length === 0) {
        console.log("✅ All profile reminder batches completed.");
        clearInterval(intervalId); // stop timer
        return;
      }

      console.log(
        `📨 Sending batch ${batchIndex + 1} (${batch.length} doctors)...`
      );

      for (const doctor of batch) {
        try {
          await sendProfileCompletionReminderEmail(doctor);
          console.log(`📧 Sent reminder to: ${doctor.email}`);
        } catch (err) {
          console.error(`❌ Failed to send to ${doctor.email}:`, err);
        }
      }

      batchIndex++;
    };

    // Start immediately with the first batch
    await processBatch();

    // Then continue every 1 hour
    const intervalId = setInterval(processBatch, 60 * 60 * 1000);
    // const intervalId = setInterval(processBatch,  5000);

  } catch (error) {
    console.error("❌ Error running profile reminder cron:", error);
  }
}

module.exports = UserJob;