
require('dotenv').config();
const { sendMagicLinkEmail } = require('../src/shared/services/email/emailHelpers');

async function testMagicLink() {
    // You can change this email to your preferred test address
    const testEmail = process.env.CPANEL_EMAIL_USER || 'ejiofor.e.kevin@gmail.com';

    const user = {
        email: testEmail,
        fullName: 'Test User'
    };
    const token = 'test-token-' + Math.random().toString(36).substring(7);
    const expiresInMinutes = 15;
    const purpose = 'login';

    console.log(`🚀 Attempting to send magic link email to: ${testEmail}`);
    console.log(`📫 Using SMTP Host: ${process.env.CPANEL_EMAIL_HOST}:${process.env.CPANEL_EMAIL_PORT}`);

    try {
        await sendMagicLinkEmail(user, token, expiresInMinutes, purpose);
        console.log('✅ Magic link email sent successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error sending magic link email:');
        console.error(error);
        process.exit(1);
    }
}

testMagicLink();
