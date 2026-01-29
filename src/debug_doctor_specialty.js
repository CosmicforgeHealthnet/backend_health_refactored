
const AppDataSource = require('./config/database');
const authService = require('./features/auth/services/authService');
const doctorService = require('./features/doctor/services/doctorService');
const userRepository = require('./features/auth/repositories/userRepository');

async function debugDoctorSpecialty() {
    try {
        console.log('Initializing database...');
        await AppDataSource.initialize();
        console.log('Database initialized.');

        const testEmail = `testdoctor-${Date.now()}@test.com`;
        const testSpecialty = "Cardiology";

        console.log(`\n1. Creating Doctor with specialty: ${testSpecialty}`);
        const user = await authService.register({
            fullName: "Test Doctor",
            email: testEmail,
            password: "Password123!",
            role: "doctor",
            phoneNumber: "+2348012345678",
            departmentSpecialty: testSpecialty,
            country: "Nigeria"
        });

        console.log('User created:', {
            id: user.id,
            email: user.email,
            departmentSpecialty: user.departmentSpecialty
        });

        if (user.departmentSpecialty !== testSpecialty) {
            console.error('❌ ERROR: departmentSpecialty was NOT saved correctly during registration!');
        } else {
            console.log('✅ SUCCESS: departmentSpecialty saved correctly during registration.');
        }

        console.log('\n2. Fetching all doctors...');
        const doctors = await doctorService.getAllDoctors();
        const foundDoctor = doctors.find(d => d.email === testEmail);

        if (foundDoctor) {
            console.log('Found doctor in getAllDoctors list:', {
                id: foundDoctor.id,
                email: foundDoctor.email,
                departmentSpecialty: foundDoctor.departmentSpecialty
            });

            if (foundDoctor.departmentSpecialty === testSpecialty) {
                console.log('✅ SUCCESS: getAllDoctors returns the correct departmentSpecialty.');
            } else {
                console.error(`❌ ERROR: getAllDoctors returned: ${foundDoctor.departmentSpecialty}, expected: ${testSpecialty}`);
            }
        } else {
            console.error('❌ ERROR: Could not find the newly created doctor in the list.');
        }

        console.log('\n3. Cleaning up...');
        await userRepository.repo.delete(user.id);
        console.log('Test user deleted.');

    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        await AppDataSource.destroy();
    }
}

debugDoctorSpecialty();
