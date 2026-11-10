const { emailWithNodemailer } = require("./email");

const APP_NAME = process.env.APPNAME || process.env.APP_NAME || "AuraVive";
const BRAND_COLOR = "#1F6F78";
const SUPPORT_EMAIL = process.env.SMTP_USERNAME || "hello@auravive.ng";
const DEFAULT_LOGIN_URL = process.env.FRONTEND_URL || process.env.BACKEND_URL || "https://auravive.ng";

/**
 * Base email layout wrapper for professional, responsive emails
 */
const renderBaseTemplate = ({ title, badgeText, badgeColor = "#1F6F78", badgeBg = "#E0F2FE", content, ctaUrl, ctaText }) => {
  const year = new Date().getFullYear();

  const ctaButtonHtml = ctaUrl && ctaText ? `
    <div style="text-align: center; margin: 32px 0 24px;">
      <a href="${ctaUrl}" target="_blank" style="background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block; box-shadow: 0 2px 4px rgba(31, 111, 120, 0.25);">
        ${ctaText}
      </a>
    </div>
  ` : "";

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1f2937; -webkit-font-smoothing: antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f8; padding: 40px 15px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <!-- Header -->
            <tr>
              <td align="center" style="padding: 28px 24px; background-color: #111827;">
                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">${APP_NAME}</h1>
                <p style="margin: 6px 0 0; color: #9ca3af; font-size: 13px;">Wellness & Lifestyle Partner Network</p>
              </td>
            </tr>

            <!-- Body Content -->
            <tr>
              <td style="padding: 36px 32px;">
                ${badgeText ? `
                  <div style="margin-bottom: 20px;">
                    <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${badgeText}
                    </span>
                  </div>
                ` : ""}

                <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px; font-weight: 600; line-height: 1.4;">
                  ${title}
                </h2>

                <div style="font-size: 15px; line-height: 1.6; color: #4b5563;">
                  ${content}
                </div>

                ${ctaButtonHtml}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding: 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                  This is an automated notification from ${APP_NAME}. If you have any questions or need assistance, reach out to our team at 
                  <a href="mailto:${SUPPORT_EMAIL}" style="color: ${BRAND_COLOR}; text-decoration: none; font-weight: 500;">${SUPPORT_EMAIL}</a>.
                </p>
                <p style="margin: 10px 0 0; color: #9ca3af; font-size: 12px;">
                  &copy; ${year} ${APP_NAME}. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};

/**
 * 1. User Welcome Email (after signup & verification)
 */
const sendUserWelcomeEmail = async ({ email, fullName }) => {
  if (!email) return;

  const displayName = fullName || "User";
  const html = renderBaseTemplate({
    title: `Welcome to ${APP_NAME}, ${displayName}!`,
    badgeText: "Account Ready",
    badgeColor: "#059669",
    badgeBg: "#D1FAE5",
    content: `
      <p>Hello <strong>${displayName}</strong>,</p>
      <p>Thank you for joining <strong>${APP_NAME}</strong>! Your account has been verified and is ready to use.</p>
      <p>With ${APP_NAME}, you can explore top wellness services, book appointments with vetted partners, and manage all your bookings with ease.</p>
      <div style="background-color: #f8fafc; border-left: 4px solid ${BRAND_COLOR}; padding: 14px 18px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px; color: #334155;">
          <strong>Quick Tip:</strong> Keep your account profile up to date to get personalized wellness recommendations and booking reminders.
        </p>
      </div>
      <p>We're thrilled to have you with us!</p>
    `,
    ctaUrl: DEFAULT_LOGIN_URL,
    ctaText: "Explore Services",
  });

  try {
    await emailWithNodemailer({
      email,
      subject: `Welcome to ${APP_NAME}! 🎉`,
      html,
    });
  } catch (error) {
    console.error("Failed to send User Welcome email:", error.message);
  }
};

/**
 * 2. Provider / Partner Application Received Email (after documents submitted)
 */
const sendPartnerRegistrationEmail = async ({ email, fullName, businessName }) => {
  if (!email) return;

  const displayName = businessName || fullName || "Partner";
  const html = renderBaseTemplate({
    title: "Application Received — Under Review",
    badgeText: "Application Submitted",
    badgeColor: "#2563EB",
    badgeBg: "#DBEAFE",
    content: `
      <p>Hello <strong>${displayName}</strong>,</p>
      <p>Thank you for applying to become a verified service provider on the <strong>${APP_NAME}</strong> platform.</p>
      <p>We have successfully received your business details and supporting documents. Our verification team is currently reviewing your application to ensure it meets our quality and compliance standards.</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 22px 0;">
        <h4 style="margin: 0 0 10px; color: #1e293b; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">What happens next?</h4>
        <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6;">
          <li>Our compliance team reviews your certifications and identification.</li>
          <li>Review typically takes <strong>24–48 business hours</strong>.</li>
          <li>You will receive an email as soon as your account is approved.</li>
        </ul>
      </div>
      <p>If we require any additional documentation or clarification, our support team will reach out to you directly.</p>
    `,
  });

  try {
    await emailWithNodemailer({
      email,
      subject: `Application Received — ${APP_NAME} Provider Network`,
      html,
    });
  } catch (error) {
    console.error("Failed to send Partner Registration email:", error.message);
  }
};

/**
 * 3. Provider / Partner Application Approved Email
 */
const sendPartnerApprovedEmail = async ({ email, fullName, businessName }) => {
  if (!email) return;

  const displayName = businessName || fullName || "Partner";
  const html = renderBaseTemplate({
    title: "Congratulations! Your Provider Account is Approved",
    badgeText: "Verified Partner",
    badgeColor: "#059669",
    badgeBg: "#D1FAE5",
    content: `
      <p>Hello <strong>${displayName}</strong>,</p>
      <p>We are delighted to inform you that your application to join the <strong>${APP_NAME}</strong> Partner Network has been <strong>approved</strong>!</p>
      <p>Your account is now verified. You have full access to your provider dashboard to list your services, set your working hours, and start accepting client bookings.</p>
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 18px; margin: 22px 0;">
        <h4 style="margin: 0 0 8px; color: #166534; font-size: 14px;">Next Steps to Get Started:</h4>
        <ol style="margin: 0; padding-left: 20px; color: #15803d; font-size: 14px; line-height: 1.6;">
          <li>Log in to your Partner Portal.</li>
          <li>Configure your available branches and staff.</li>
          <li>Publish your service catalogue and pricing.</li>
        </ol>
      </div>
      <p>Welcome to our network of premier wellness providers!</p>
    `,
    ctaUrl: DEFAULT_LOGIN_URL,
    ctaText: "Go to Partner Dashboard",
  });

  try {
    await emailWithNodemailer({
      email,
      subject: `Your ${APP_NAME} Partner Account is Approved! ✅`,
      html,
    });
  } catch (error) {
    console.error("Failed to send Partner Approved email:", error.message);
  }
};

/**
 * 4. Provider / Partner Application Rejected Email
 */
const sendPartnerRejectedEmail = async ({ email, fullName, businessName, reason }) => {
  if (!email) return;

  const displayName = businessName || fullName || "Partner";
  const html = renderBaseTemplate({
    title: "Update Regarding Your Provider Application",
    badgeText: "Application Status",
    badgeColor: "#DC2626",
    badgeBg: "#FEE2E2",
    content: `
      <p>Hello <strong>${displayName}</strong>,</p>
      <p>Thank you for your interest in joining the <strong>${APP_NAME}</strong> Partner Network.</p>
      <p>After a thorough review of your submitted credentials, we regret to inform you that we are unable to approve your provider application at this time.</p>
      ${reason ? `
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <strong style="color: #991b1b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Reason for Decision:</strong>
          <p style="margin: 6px 0 0; color: #7f1d1d; font-size: 14px;">${reason}</p>
        </div>
      ` : ""}
      <p>If you believe this decision was made in error or if you can provide additional updated documentation, please contact our support desk.</p>
    `,
    ctaUrl: `mailto:${SUPPORT_EMAIL}`,
    ctaText: "Contact Support",
  });

  try {
    await emailWithNodemailer({
      email,
      subject: `Update on your ${APP_NAME} Partner Application`,
      html,
    });
  } catch (error) {
    console.error("Failed to send Partner Rejected email:", error.message);
  }
};

/**
 * 5. Account Suspended / Blocked Email
 */
const sendAccountSuspendedEmail = async ({ email, fullName, role = "user", reason }) => {
  if (!email) return;

  const displayName = fullName || "Customer";
  const html = renderBaseTemplate({
    title: "Notice: Account Suspended",
    badgeText: "Account Action",
    badgeColor: "#DC2626",
    badgeBg: "#FEE2E2",
    content: `
      <p>Hello <strong>${displayName}</strong>,</p>
      <p>We are writing to notify you that your <strong>${APP_NAME}</strong> account (${role}) has been temporarily suspended.</p>
      ${reason ? `
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 18px; border-radius: 4px; margin: 20px 0;">
          <strong style="color: #991b1b; font-size: 13px;">Reason:</strong>
          <p style="margin: 4px 0 0; color: #7f1d1d; font-size: 14px;">${reason}</p>
        </div>
      ` : `
        <p>This action may be due to a violation of our community standards, terms of service, or pending verification.</p>
      `}
      <p>While your account is suspended, you will not be able to log in, create bookings, or manage services.</p>
      <p>If you believe this was done in error or would like to request an appeal, please reach out to our team.</p>
    `,
    ctaUrl: `mailto:${SUPPORT_EMAIL}?subject=Account%20Suspension%20Appeal%20-${encodeURIComponent(email)}`,
    ctaText: "Appeal Suspension",
  });

  try {
    await emailWithNodemailer({
      email,
      subject: `Important: Your ${APP_NAME} Account Has Been Suspended`,
      html,
    });
  } catch (error) {
    console.error("Failed to send Account Suspended email:", error.message);
  }
};

/**
 * 6. Account Reactivated / Unblocked Email
 */
const sendAccountActivatedEmail = async ({ email, fullName, role = "user" }) => {
  if (!email) return;

  const displayName = fullName || "Customer";
  const html = renderBaseTemplate({
    title: "Your Account Has Been Reactivated",
    badgeText: "Access Restored",
    badgeColor: "#059669",
    badgeBg: "#D1FAE5",
    content: `
      <p>Hello <strong>${displayName}</strong>,</p>
      <p>Good news! Your <strong>${APP_NAME}</strong> account has been reactivated, and full access to the platform has been restored.</p>
      <p>You can now log in to your account and continue using all features as usual.</p>
      <p>Thank you for your patience and cooperation.</p>
    `,
    ctaUrl: DEFAULT_LOGIN_URL,
    ctaText: "Log In to Account",
  });

  try {
    await emailWithNodemailer({
      email,
      subject: `Your ${APP_NAME} Account Has Been Reactivated ✅`,
      html,
    });
  } catch (error) {
    console.error("Failed to send Account Activated email:", error.message);
  }
};

/**
 * 7. Staff Credentials Email (When Admin adds Employee, HR, Sub-Admin)
 */
const sendStaffCredentialsEmail = async ({ email, fullName, role = "Employee", temporaryPassword, loginUrl = DEFAULT_LOGIN_URL }) => {
  if (!email) return;

  const displayName = fullName || "Team Member";
  const formattedRole = role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  const html = renderBaseTemplate({
    title: `Your ${APP_NAME} Account Has Been Created`,
    badgeText: formattedRole,
    badgeColor: "#1D4ED8",
    badgeBg: "#DBEAFE",
    content: `
      <p>Hello <strong>${displayName}</strong>,</p>
      <p>An administrator has created an account for you on <strong>${APP_NAME}</strong> with the role of <strong>${formattedRole}</strong>.</p>
      <p>You can use the credentials below to log in to your portal:</p>

      <!-- Credential Card -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-bottom: 12px;">
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Login Email</span>
              <div style="font-size: 15px; font-weight: 600; color: #0f172a; margin-top: 4px;">${email}</div>
            </td>
          </tr>
          <tr>
            <td>
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Temporary Password</span>
              <div style="margin-top: 6px;">
                <code style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 16px; font-weight: 700; color: #1e293b; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 8px 14px; display: inline-block;">
                  ${temporaryPassword}
                </code>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Security Advisory Notice -->
      <div style="font-size: 13px; color: #92400e; background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 18px 0;">
        <strong>Important Security Notice:</strong> For your security, this is a temporary password. You are strongly advised to change your password immediately after your first login via the Account Settings.
      </div>

      <p>If you did not expect this invitation or have questions about your access, please contact your system administrator.</p>
    `,
    ctaUrl: loginUrl,
    ctaText: "Log In to Portal",
  });

  try {
    await emailWithNodemailer({
      email,
      subject: `Your ${APP_NAME} ${formattedRole} Account Details 🔑`,
      html,
    });
  } catch (error) {
    console.error(`Failed to send Staff Credentials email to ${email}:`, error.message);
  }
};

/**
 * 8. Transaction Receipt / Details Email
 */
const sendTransactionEmail = async ({
  email,
  fullName,
  txRef,
  transactionId,
  transactionType = "Booking Payment",
  amount = 0,
  currency = "NGN",
  paymentMethod = "card",
  paymentStatus = "successful",
  date = new Date(),
  serviceName,
  providerName,
  bookingId,
  description,
  ctaUrl = DEFAULT_LOGIN_URL,
  ctaText = "View in Dashboard",
}) => {
  if (!email) return;

  const displayName = fullName || "Customer";
  const numAmount = Number(amount) || 0;
  const formattedAmount = numAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const currencySymbol = currency === "NGN" ? "₦" : `${currency} `;
  const refCode = txRef || transactionId || "N/A";

  const dateObj = date instanceof Date ? date : new Date(date);
  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleDateString();

  const normalizedStatus = String(paymentStatus).toLowerCase();
  let badgeText = "Payment Successful";
  let badgeColor = "#059669";
  let badgeBg = "#D1FAE5";
  let statusColor = "#10B981";
  let statusText = "● Successful";

  if (normalizedStatus.includes("refund")) {
    badgeText = "Refund Processed";
    badgeColor = "#2563EB";
    badgeBg = "#DBEAFE";
    statusColor = "#3B82F6";
    statusText = "● Refunded";
  } else if (normalizedStatus.includes("fail")) {
    badgeText = "Payment Failed";
    badgeColor = "#DC2626";
    badgeBg = "#FEE2E2";
    statusColor = "#EF4444";
    statusText = "● Failed";
  } else if (normalizedStatus.includes("pend") || normalizedStatus.includes("process")) {
    badgeText = "Payment Processing";
    badgeColor = "#D97706";
    badgeBg = "#FEF3C7";
    statusColor = "#F59E0B";
    statusText = "● Processing";
  }

  const normalizedMethod = String(paymentMethod).toLowerCase();
  let displayMethod = "Card";
  if (normalizedMethod.includes("wallet")) displayMethod = "Digital Wallet";
  else if (normalizedMethod.includes("cash")) displayMethod = "Cash on Location";
  else if (normalizedMethod.includes("bank")) displayMethod = "Bank Transfer";
  else if (normalizedMethod.includes("ussd")) displayMethod = "USSD";

  const content = `
    <p style="margin: 0 0 16px;">Hello <strong>${displayName}</strong>,</p>
    <p style="margin: 0 0 20px;">Thank you for your transaction with <strong>${APP_NAME}</strong>. Below is your official transaction receipt and summary.</p>

    <!-- Amount Card -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px 20px; text-align: center; margin: 20px 0 24px;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.6px;">Total Amount</div>
      <div style="font-size: 32px; font-weight: 800; color: #0f172a; margin: 6px 0 4px;">
        ${currencySymbol}${formattedAmount}
      </div>
      <div style="font-size: 13px; color: ${statusColor}; font-weight: 600;">
        ${statusText}
      </div>
    </div>

    <!-- Transaction Details Table -->
    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
      <table width="100%" cellpadding="11" cellspacing="0" style="border-collapse: collapse; font-size: 13.5px;">
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #fafafa;">
          <td colspan="2" style="font-weight: 700; color: #334155; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
            Transaction Overview
          </td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500; width: 42%;">Reference (TxRef)</td>
          <td style="color: #0f172a; font-weight: 600; font-family: 'SFMono-Regular', Consolas, monospace; text-align: right; word-break: break-all;">
            ${refCode}
          </td>
        </tr>
        ${bookingId ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Booking ID</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">#${bookingId}</td>
        </tr>` : ""}
        ${serviceName ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Service</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${serviceName}</td>
        </tr>` : ""}
        ${providerName ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Provider / Partner</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${providerName}</td>
        </tr>` : ""}
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Transaction Type</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${transactionType}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Payment Method</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${displayMethod}</td>
        </tr>
        <tr>
          <td style="color: #64748b; font-weight: 500;">Date & Time</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${formattedDate}</td>
        </tr>
      </table>
    </div>

    ${description ? `
      <div style="background-color: #f8fafc; border-left: 3px solid ${BRAND_COLOR}; padding: 10px 14px; font-size: 13px; color: #475569; margin-bottom: 20px; border-radius: 4px;">
        <strong>Note:</strong> ${description}
      </div>
    ` : ""}

    <!-- Security Advisory -->
    <p style="font-size: 12.5px; color: #64748b; line-height: 1.5; margin: 18px 0 0;">
      Please retain this email as an official record of your transaction. If you have any inquiries regarding this charge or did not authorize it, please contact our support desk immediately at <a href="mailto:${SUPPORT_EMAIL}" style="color: ${BRAND_COLOR}; font-weight: 500; text-decoration: none;">${SUPPORT_EMAIL}</a>.
    </p>
  `;

  const html = renderBaseTemplate({
    title: `${transactionType} Receipt — ${currencySymbol}${formattedAmount}`,
    badgeText,
    badgeColor,
    badgeBg,
    content,
    ctaUrl,
    ctaText,
  });

  try {
    await emailWithNodemailer({
      email,
      subject: `Transaction Receipt: ${currencySymbol}${formattedAmount} [${refCode}] 🧾`,
      html,
    });
  } catch (error) {
    console.error(`Failed to send Transaction email to ${email}:`, error.message);
  }
};

module.exports = {
  sendUserWelcomeEmail,
  sendPartnerRegistrationEmail,
  sendPartnerApprovedEmail,
  sendPartnerRejectedEmail,
  sendAccountSuspendedEmail,
  sendAccountActivatedEmail,
  sendStaffCredentialsEmail,
  sendTransactionEmail,
};

