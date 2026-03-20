const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api'; // Adjust to your local server URL

async function testOtpFlow() {
  const email = `test_otp_${Date.now()}@example.com`;
  const password = 'Password123!';

  console.log('--- Step 1: Signup with OTP ---');
  try {
    const signupRes = await axios.post(`${BASE_URL}/auth/signup`, {
      fullName: 'Test User',
      email: email,
      password: password,
      role: 'patient',
      platform: 'mobile'
    });
    console.log('✅ Signup successful. Message:', signupRes.data.message);
  } catch (err) {
    console.error('❌ Signup failed:', err.response?.data || err.message);
    return;
  }

  console.log('\n--- Step 2: Request Verification OTP (already sent by signup) ---');
  // In a real test, you'd check the DB or logs for the OTP.
  // We'll assume the OTP is generated.

  console.log('\n--- Step 3: Verify Email with OTP (Manual Check Needed in DB) ---');
  console.log('Note: To test this locally, you must find the OTP in the database for:', email);
  
  // Example call (you'd replace '123456' with the actual OTP from DB)
  /*
  try {
    const verifyRes = await axios.post(`${BASE_URL}/auth/verify-email-otp`, {
      email,
      otp: '123456'
    });
    console.log('✅ Email verification successful:', verifyRes.data.message);
  } catch (err) {
    console.error('❌ Email verification failed:', err.response?.data || err.message);
  }
  */

  console.log('\n--- Step 4: Password Reset Request with OTP ---');
  try {
    const resetReqRes = await axios.post(`${BASE_URL}/auth/password-reset-request`, {
      email,
      platform: 'mobile'
    });
    console.log('✅ Password reset request successful:', resetReqRes.data.message);
  } catch (err) {
    console.error('❌ Password reset request failed:', err.response?.data || err.message);
  }

  console.log('\n--- Step 5: Verify Password Reset OTP (Manual Check Needed in DB) ---');
   // Example call (you'd replace '123456' with the actual OTP from DB)
  /*
  try {
    const verifyResetRes = await axios.post(`${BASE_URL}/auth/verify-password-reset-otp`, {
      email,
      otp: '123456'
    });
    console.log('✅ Password reset OTP verified. Token:', verifyResetRes.data.token);
  } catch (err) {
    console.error('❌ Password reset OTP verification failed:', err.response?.data || err.message);
  }
  */
}

testOtpFlow();
