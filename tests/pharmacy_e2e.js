const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/pharmacy';
const email = `test_pharmacy_${Math.floor(Math.random() * 10000)}@example.com`;
const password = 'Password123!';
let token = '';
let pharmacyId = '';

async function runTests() {
    console.log('🚀 Starting Pharmacy E2E Tests...');
    console.log(`📧 Test Email: ${email}`);

    try {
        // 1. Register Pharmacy
        console.log('\n--- 1. Registration ---');
        const registerRes = await axios.post(`${BASE_URL}/auth/register`, {
            fullName: "Test Owner",
            email: email,
            password: password,
            pharmacyName: "E2E Test Pharmacy",
            registrationNumber: `REG-${Math.floor(Math.random() * 1000000)}`,
            address: "123 Test Street",
            phone: "08012345678",
            primaryContactPerson: "Test Owner",
            preferredUsername: `testpharmacy_${Math.floor(Math.random() * 1000)}`
        });
        console.log('✅ Registration successful');

        // 2. Login
        console.log('\n--- 2. Login ---');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: email,
            password: password
        });
        token = loginRes.data.data.token;
        console.log('✅ Login successful, token received');

        const config = {
            headers: { Authorization: `Bearer ${token}` }
        };

        // 3. Get Profile
        console.log('\n--- 3. Get Profile ---');
        const profileRes = await axios.get(`${BASE_URL}/auth/profile`, config);
        pharmacyId = profileRes.data.data.id;
        console.log(`✅ Profile retrieved. Pharmacy ID: ${pharmacyId}`);

        // 4. Update Profile Settings
        console.log('\n--- 4. Update Profile Settings ---');
        const updateRes = await axios.put(`${BASE_URL}/auth/profile`, {
            operatingHours: { open: "08:00 AM", close: "10:00 PM" },
            serviceRadius: 15,
            defaultCurrency: "NGN",
            notificationPreferences: { email: true, sms: false, push: true }
        }, config);
        console.log('✅ Profile settings updated');

        // 5. Set Pricing
        console.log('\n--- 5. Set Pricing ---');
        const pricingRes = await axios.post(`${BASE_URL}/auth/pricing`, {
            feeType: "delivery",
            price: 1500,
            currency: "NGN"
        }, config);
        console.log('✅ Pricing updated');

        // 6. Add Staff
        console.log('\n--- 6. Add Staff ---');
        const staffEmail = `staff_${Math.floor(Math.random() * 10000)}@example.com`;
        const staffRes = await axios.post(`${BASE_URL}/auth/staff`, {
            fullName: "Test Pharmacist",
            email: staffEmail,
            password: "Password123!",
            role: "pharmacist"
        }, config);
        console.log(`✅ Staff added: ${staffEmail}`);

        // 7. Get Staff List
        console.log('\n--- 7. Get Staff List ---');
        const staffListRes = await axios.get(`${BASE_URL}/auth/staff`, config);
        console.log(`✅ Staff list retrieved. Count: ${staffListRes.data.data.length}`);

        // 8. Delete Staff
        console.log('\n--- 8. Delete Staff ---');
        const staffId = staffRes.data.data.id;
        await axios.delete(`${BASE_URL}/auth/staff/${staffId}`, config);
        console.log('✅ Staff member removed');

        // 9. Dashboard Stats
        console.log('\n--- 9. Dashboard Stats ---');
        const statsRes = await axios.get(`${BASE_URL}/dashboard/stats`, config);
        console.log('✅ Dashboard stats retrieved');

        // 10. Recent Activity
        console.log('\n--- 10. Recent Activity ---');
        const activityRes = await axios.get(`${BASE_URL}/dashboard/activity`, config);
        console.log('✅ Recent activity retrieved');

        console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');

    } catch (error) {
        console.error('\n❌ TEST FAILED!');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

runTests();
