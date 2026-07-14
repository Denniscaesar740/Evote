// ============================================
// UTIL — Hubtel SMS Service
// UniVote ACSES UMaT E-Voting System
// ============================================

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

  if (!clientId || !clientSecret) {
    console.warn('⚠️  Hubtel credentials not configured. SMS not sent.');
    console.warn(`   → To: ${phoneNumber}`);
    console.warn(`   → Message: ${message}`);
    return false;
  }

  const formattedNumber = formatGhanaPhone(phoneNumber);
  const recipient = formattedNumber.replace('+', ''); // strip the plus sign for the GET API

  // Construct URL with credentials as query parameters (URL Authentication)
  const url = `https://api.hubtel.com/v1/messages/send` +
    `?From=${encodeURIComponent(senderId)}` +
    `&To=${encodeURIComponent(recipient)}` +
    `&Content=${encodeURIComponent(message)}` +
    `&ClientId=${encodeURIComponent(clientId)}` +
    `&ClientSecret=${encodeURIComponent(clientSecret)}` +
    `&RegisteredDelivery=true`;

  try {
    const response = await fetch(url, {
      method: 'GET',
    });

    const data = await response.json().catch(() => null);

    if (response.ok) {
      console.log(`✅ SMS sent to ${formattedNumber} via Hubtel URL Authentication`);
      return true;
    } else {
      console.error('❌ Hubtel SMS URL Auth error:', data || response.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ SMS URL Auth delivery failed:', error.message);
    return false;
  }
}

/**
 * Generate a random 6-digit numeric OTP
 */
export function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
