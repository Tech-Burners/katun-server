const { emailWithNodemailer } = require("../../helpers/email");


const BRAND_COLOR = "#1F6F78";
const APP_NAME = process.env.APP_NAME || "auraVibe";

const sendContactService = async (data) => {
  const { name, email, interestedAs, company, message } = data;

  if (!name || !email || !message) {
    throw new Error("Name, email and message are required");
  }

  /* ======================
        ADMIN EMAIL
  ====================== */

  const adminHtml = `
  <div style="background:#f5f7f8;padding:30px;font-family:Arial,sans-serif;">
    <div style="max-width:620px;margin:auto;background:#ffffff;border-radius:10px;overflow:hidden;">
      
      <div style="background:${BRAND_COLOR};padding:18px;text-align:center;color:#ffffff;">
        <h2 style="margin:0;">${APP_NAME} — New Contact Request</h2>
      </div>

      <div style="padding:25px;color:#1f2937;">
        <table width="100%" cellpadding="8" style="border-collapse:collapse;">
          <tr><td><strong>Name</strong></td><td>${name}</td></tr>
          <tr><td><strong>Email</strong></td><td>${email}</td></tr>
          <tr><td><strong>Interested As</strong></td><td>${interestedAs || "N/A"}</td></tr>
          <tr><td><strong>Company</strong></td><td>${company || "N/A"}</td></tr>
        </table>

        <hr style="margin:22px 0;border:none;border-top:1px solid #e5e7eb;"/>

        <h3 style="margin-bottom:8px;">Message</h3>
        <p style="line-height:1.6;">${message}</p>
      </div>

    </div>
  </div>
  `;

  /* ======================
        USER AUTO REPLY
  ====================== */

  const userHtml = `
  <div style="background:#f5f7f8;padding:30px;font-family:Arial,sans-serif;">
    <div style="max-width:620px;margin:auto;background:#ffffff;border-radius:10px;overflow:hidden;">

      <div style="background:${BRAND_COLOR};padding:18px;text-align:center;color:#ffffff;">
        <h2 style="margin:0;">Welcome to ${APP_NAME}</h2>
      </div>

      <div style="padding:25px;color:#1f2937;">
        <p>Hello <strong>${name}</strong>,</p>

        <p>
          Thank you for reaching out to <strong>${APP_NAME}</strong>.
          Our team received your message and will respond shortly.
        </p>

        <div style="margin-top:20px;background:#f9fafb;padding:15px;border-radius:6px;">
          <strong>Your Message</strong>
          <p style="margin-top:8px;">${message}</p>
        </div>

        <p style="margin-top:25px;">
          Best regards,<br/>
          <strong>${APP_NAME} Team</strong>
        </p>
      </div>

    </div>
  </div>
  `;

  /* ======================
        SPEED OPTIMIZATION
        Send Emails Parallel
  ====================== */

  await Promise.all([
    emailWithNodemailer({
      email: process.env.ADMIN_EMAIL,
      subject: `${APP_NAME} — New Contact Request`,
      html: adminHtml,
    }),

    emailWithNodemailer({
      email,
      subject: `${APP_NAME} received your message ✅`,
      html: userHtml,
    }),
  ]);

  return {
    success: true,
    message: "Contact email sent successfully",
  };
};

module.exports = sendContactService;