// ============================================
// UTIL — Email OTP Fallback Service
// UniVote ACSES UMaT E-Voting System
// ============================================

/**
 * Send an OTP verification email using the institutional SMTP relay.
 * Falls back to console logging if SMTP is not configured.
 * @param {string} email - Recipient email address
 * @param {string} otp - The 6-digit OTP code
 * @param {string} studentId - Student reference ID for audit context
 * @returns {Promise<boolean>} - true if email was sent successfully
 */
export async function sendOTPEmail(email, otp, studentId) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || 'UniVote ACSES <noreply@umat.edu.gh>';

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn('⚠️  SMTP not configured — email OTP fallback unavailable.');
    return false;
  }

  // Dynamically import nodemailer only when needed
  let nodemailer;
  try {
    nodemailer = await import('nodemailer');
  } catch (err) {
    console.warn('⚠️  nodemailer not installed — run: npm install nodemailer');
    return false;
  }

  const transporter = nodemailer.default.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    secure: Number(smtpPort) === 465,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false },
  });

  const htmlBody = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #fff;">
      <div style="background: linear-gradient(135deg, #1e5c20, #2e7d32); padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; font-size: 20px; margin: 0; font-weight: 800;">🗳️ UniVote — ACSES UMaT</h1>
        <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 4px 0 0;">Secure Electronic Voting System</p>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 28px 24px;">
        <p style="color: #374151; font-size: 14px; margin: 0 0 8px;">Hello,</p>
        <p style="color: #374151; font-size: 14px; margin: 0 0 20px; line-height: 1.6;">
          Your one-time verification code for UniVote login is:
        </p>
        <div style="background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 10px; padding: 18px; text-align: center; margin: 0 0 20px;">
          <div style="font-size: 36px; font-weight: 900; color: #166534; letter-spacing: 0.15em; font-family: 'Courier New', monospace;">${otp}</div>
        </div>
        <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 0 0 6px;">
          This code expires in <strong>30 minutes</strong>. Do NOT share this code with anyone.
        </p>
        <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 0;">
          If you did not request this code, please ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 11px; margin: 0; text-align: center;">
          © 2026 ACSES UMaT · University of Mines and Technology, Tarkwa, Ghana
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject: `UniVote Verification Code: ${otp}`,
      html: htmlBody,
      text: `UniVote ACSES UMaT\nYour verification code is: ${otp}\nThis code expires in 30 minutes.\nDo NOT share this code with anyone.`,
    });
    console.log(`✅ OTP email sent to ${email} (fallback for SMS failure)`);
    return true;
  } catch (error) {
    console.error('❌ Email OTP delivery failed:', error.message);
    return false;
  }
}
