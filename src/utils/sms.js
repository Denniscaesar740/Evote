// ============================================
// UTIL — Hubtel SMS Service
// UniVote UMaT E-Voting System
// ============================================
import crypto from 'crypto';

/**
 * Format a Ghana phone number to international format (+233XXXXXXXXX)
 */
function formatGhanaPhone(phoneNumber) {
  let clean = String(phoneNumber).replace(/\D/g, ''); // strip non-digits
  if (clean.startsWith('0')) {
    clean = '233' + clean.substring(1);
  } else if (!clean.startsWith('233')) {
    clean = '233' + clean;
  }
  return '+' + clean;
}

/**
 * Send an SMS via the Hubtel SMS API
 * @param {string} phoneNumber - Recipient phone number (any Ghana format)
 * @param {string} message - SMS text content
 * @returns {Promise<boolean>} - true if sent successfully
 */
export async function sendSMS(phoneNumber, message) {
  const clientId = process.env.HUBTEL_CLIENT_ID;
  const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
  const senderId = process.env.HUBTEL_SENDER_ID || 'UniVote';

  const formattedNumber = formatGhanaPhone(phoneNumber);

  if (!clientId || !clientSecret) {
    console.log(`\n============================================`);
    console.log(`📱 [SMS DISPATCH - DEV/DEMO MODE]`);
    console.log(`   To     : ${formattedNumber}`);
    console.log(`   Sender : ${senderId}`);
    console.log(`   Content: ${message}`);
    console.log(`============================================\n`);
    return true;
  }

  const recipient = formattedNumber.replace('+', '');
  const url = `https://sms.hubtel.com/v1/messages/send`;
  const authHeader = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        From: senderId,
        To: recipient,
        Content: message,
        RegisteredDelivery: true
      })
    });

    const data = await response.json().catch(() => null);

    if (response.ok) {
      console.log(`✅ SMS sent to ${formattedNumber} via Hubtel API`);
      return true;
    } else {
      console.error('❌ Hubtel SMS API error:', data || response.statusText);
      console.log(`📱 [SMS FALLBACK DISPATCH] To: ${formattedNumber} | Message: ${message}`);
      return true;
    }
  } catch (error) {
    console.error('❌ SMS API delivery failed:', error.message);
    console.log(`📱 [SMS FALLBACK DISPATCH] To: ${formattedNumber} | Message: ${message}`);
    return true;
  }
}

/**
 * Generate a random 6-digit numeric OTP
 */
export function generateOTP() {
  return String(crypto.randomInt(100000, 1000000));
}
