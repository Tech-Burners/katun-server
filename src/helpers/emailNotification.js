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

/**
 * 9. OTP / Verification Code Verified Email (Check-in / Service Started)
 */
const sendOtpVerifiedEmail = async ({
  email,
  fullName,
  serviceName = "Service",
  providerName = "AuraVive Partner",
  bookingId,
  date = new Date(),
  ctaUrl = DEFAULT_LOGIN_URL,
}) => {
  if (!email) return;

  const displayName = fullName || "Valued Customer";
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

  const content = `
    <p style="margin: 0 0 16px;">Hello <strong>${displayName}</strong>,</p>
    <p style="margin: 0 0 20px;">Your verification code (OTP) for <strong>${serviceName}</strong> has been verified successfully by your service provider <strong>${providerName}</strong>.</p>

    <!-- Status Card -->
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0 24px;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #166534; letter-spacing: 0.6px;">Verification Status</div>
      <div style="font-size: 22px; font-weight: 800; color: #15803d; margin: 6px 0 4px;">
        OTP Verified &amp; Check-in Confirmed
      </div>
      <div style="font-size: 13px; color: #16a34a; font-weight: 600;">
        ● Service Session Started
      </div>
    </div>

    <!-- Booking Details Table -->
    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
      <table width="100%" cellpadding="11" cellspacing="0" style="border-collapse: collapse; font-size: 13.5px;">
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #fafafa;">
          <td colspan="2" style="font-weight: 700; color: #334155; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Session Details</td>
        </tr>
        ${
          bookingId
            ? `<tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="color: #64748b; width: 40%;">Booking ID:</td>
                <td style="font-weight: 600; color: #0f172a;">${bookingId}</td>
              </tr>`
            : ""
        }
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; width: 40%;">Service Name:</td>
          <td style="font-weight: 600; color: #0f172a;">${serviceName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b;">Service Provider:</td>
          <td style="font-weight: 600; color: #0f172a;">${providerName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b;">Check-in Time:</td>
          <td style="font-weight: 600; color: #0f172a;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Service Status:</td>
          <td style="font-weight: 700; color: #15803d;">In Progress (Service Started)</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #f8fafc; border-left: 4px solid #1F6F78; padding: 14px 16px; border-radius: 4px; margin-bottom: 24px; font-size: 13px; color: #475569;">
      <strong>Note:</strong> Your service session is now underway. Once your session concludes, your provider will mark it as fully completed.
    </div>
  `;

  const html = renderBaseTemplate({
    title: "OTP Verified - Service Started",
    badgeText: "OTP Verified",
    badgeColor: "#15803d",
    badgeBg: "#dcfce7",
    content,
    ctaUrl: null,
  });

  try {
    await emailWithNodemailer({
      email,
      subject: `OTP Verified - Service Started: ${serviceName} | ${APP_NAME}`,
      html,
    });
  } catch (error) {
    console.error(`Failed to send OTP Verified email to ${email}:`, error.message);
  }
};

/**
 * Format date for booking emails
 */
const formatBookingDate = (d) => {
  if (!d) return "As scheduled";
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return String(d);
  return dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Format time range for booking emails
 */
const formatBookingTime = (start, end) => {
  if (!start && !end) return "Flexible / Standard business hours";
  const formatSingle = (val) => {
    if (!val) return "";
    const dateObj = val instanceof Date ? val : new Date(val);
    if (isNaN(dateObj.getTime())) return String(val);
    return dateObj.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };
  const startStr = formatSingle(start);
  const endStr = formatSingle(end);
  if (startStr && endStr) return `${startStr} - ${endStr}`;
  return startStr || endStr || "As scheduled";
};

/**
 * Clean display name for payment method
 */
const getDisplayPaymentMethod = (method) => {
  const m = String(method || "").toLowerCase();
  if (m.includes("cash")) return "Cash on Location";
  if (m.includes("wallet")) return "Digital Wallet";
  if (m.includes("bank")) return "Bank Transfer";
  if (m.includes("ussd")) return "USSD";
  return "Card (Debit/Credit)";
};

/**
 * Clean display name for payment status
 */
const getDisplayPaymentStatus = (paymentStatus, paymentMethod) => {
  const m = String(paymentMethod || "").toLowerCase();
  const s = String(paymentStatus || "").toLowerCase();
  if (m === "cash") {
    return s === "paid" ? "Paid (Cash Collected)" : "Pending (Cash on Delivery)";
  }
  if (s === "paid" || s === "successful") return "Paid";
  if (s === "refunded") return "Refunded";
  if (s === "failed") return "Failed";
  return "Pending Payment";
};

/**
 * 10. User Booking Confirmation Email (Full Details)
 */
const sendUserBookingConfirmationEmail = async ({
  email,
  customerName,
  bookingId,
  serviceName = "Wellness Service",
  providerName = "AuraVive Partner",
  providerAddress = "Partner Location",
  date,
  startTime,
  endTime,
  duration,
  isOneTime = true,
  sessionLeft,
  servicePrice = 0,
  addons = [],
  tips = 0,
  totalPrice = 0,
  currency = "NGN",
  paymentMethod = "card",
  paymentStatus = "paid",
  status = "pending",
  pin,
  ctaUrl = DEFAULT_LOGIN_URL,
}) => {
  if (!email) return;

  const displayName = customerName || "Valued Customer";
  const numTotal = Number(totalPrice) || 0;
  const formattedTotal = numTotal.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const numBase = Number(servicePrice) || 0;
  const formattedBase = numBase.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const numTips = Number(tips) || 0;
  const formattedTips = numTips.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const currencySymbol = currency === "NGN" ? "₦" : `${currency} `;

  // Format date & time
  const formattedDate = formatBookingDate(date);
  const formattedTime = formatBookingTime(startTime, endTime);

  // Status mapping
  const isApproved = String(status).toLowerCase() === "approved";
  const badgeText = isApproved ? "Booking Confirmed" : "Booking Placed";
  const badgeColor = isApproved ? "#059669" : "#D97706";
  const badgeBg = isApproved ? "#D1FAE5" : "#FEF3C7";

  // Payment method & status formatting
  const displayPaymentMethod = getDisplayPaymentMethod(paymentMethod);
  const displayPaymentStatus = getDisplayPaymentStatus(paymentStatus, paymentMethod);

  // Addons HTML rows
  let addonsHtml = "";
  if (Array.isArray(addons) && addons.length > 0) {
    const addonRows = addons
      .map(
        (a) =>
          `<div style="font-size: 13px; color: #4b5563; margin-top: 4px;">+ ${
            a.serviceName || a.name || "Add-on"
          }: <strong>${currencySymbol}${Number(a.price || 0).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}</strong></div>`
      )
      .join("");
    addonsHtml = `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="color: #64748b; font-weight: 500; vertical-align: top; padding: 11px;">Selected Add-ons</td>
        <td style="color: #0f172a; text-align: right; padding: 11px;">
          ${addonRows}
        </td>
      </tr>
    `;
  }

  // Payment Note
  let paymentNote = "";
  if (String(paymentMethod).toLowerCase() === "cash") {
    paymentNote = `
      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #92400e; margin: 18px 0;">
        <strong>Cash Payment:</strong> You selected <strong>Cash on Location</strong>. Please have <strong>${currencySymbol}${formattedTotal}</strong> ready to pay your provider directly upon check-in.
      </div>
    `;
  } else {
    paymentNote = `
      <div style="background-color: #f8fafc; border-left: 4px solid ${BRAND_COLOR}; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #475569; margin: 18px 0;">
        <strong>Payment Note:</strong> Your payment of <strong>${currencySymbol}${formattedTotal}</strong> was processed via <strong>${displayPaymentMethod}</strong>. No additional charge is required at arrival.
      </div>
    `;
  }

  const content = `
    <p style="margin: 0 0 16px;">Hello <strong>${displayName}</strong>,</p>
    <p style="margin: 0 0 20px;">
      ${
        isApproved
          ? `Great news! Your booking for <strong>${serviceName}</strong> has been confirmed. Below are your full appointment details.`
          : `Thank you for booking with <strong>${APP_NAME}</strong>! Your booking for <strong>${serviceName}</strong> has been placed and is waiting for provider confirmation.`
      }
    </p>

    <!-- Total Amount Card -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px 20px; text-align: center; margin: 20px 0 24px;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.6px;">Total Booking Amount</div>
      <div style="font-size: 32px; font-weight: 800; color: #0f172a; margin: 6px 0 0;">
        ${currencySymbol}${formattedTotal}
      </div>
    </div>

    <!-- Booking Overview Table -->
    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 22px;">
      <table width="100%" cellpadding="11" cellspacing="0" style="border-collapse: collapse; font-size: 13.5px;">
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #fafafa;">
          <td colspan="2" style="font-weight: 700; color: #334155; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
            Booking &amp; Service Details
          </td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500; width: 42%;">Booking Reference</td>
          <td style="color: #0f172a; font-weight: 600; font-family: 'SFMono-Regular', Consolas, monospace; text-align: right;">#${bookingId}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Service</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${serviceName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Service Provider</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${providerName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Location / Address</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${providerAddress}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Appointment Date</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${formattedDate}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Scheduled Time</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${formattedTime}</td>
        </tr>
        ${duration ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Duration</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${duration} minutes</td>
        </tr>` : ""}
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Session Type</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${isOneTime ? "Single Session" : `Package (${sessionLeft || "Multiple"} sessions)`}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Payment Method</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${displayPaymentMethod}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Payment Status</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${displayPaymentStatus}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Base Service Price</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${currencySymbol}${formattedBase}</td>
        </tr>
        ${addonsHtml}
        ${numTips > 0 ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Tip</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${currencySymbol}${formattedTips}</td>
        </tr>` : ""}
        <tr style="background-color: #fafafa;">
          <td style="color: #0f172a; font-weight: 700;">Total Amount</td>
          <td style="color: ${BRAND_COLOR}; font-weight: 800; font-size: 15px; text-align: right;">${currencySymbol}${formattedTotal}</td>
        </tr>
      </table>
    </div>

    ${paymentNote}
  `;

  const html = renderBaseTemplate({
    title: isApproved ? `Booking Confirmed: ${serviceName}` : `Booking Placed: ${serviceName}`,
    badgeText,
    badgeColor,
    badgeBg,
    content,
    ctaUrl: null,
  });

  try {
    await emailWithNodemailer({
      email,
      subject: isApproved
        ? `Booking Confirmed: ${serviceName} [${bookingId}] ✅`
        : `Booking Placed: ${serviceName} [${bookingId}] 📅`,
      html,
    });
  } catch (error) {
    console.error(`Failed to send User Booking email to ${email}:`, error.message);
  }
};

/**
 * 11. Partner New Booking Email (Full Details)
 */
const sendPartnerNewBookingEmail = async ({
  email,
  partnerName,
  customerName,
  customerPhone,
  customerEmail,
  bookingId,
  serviceName = "Wellness Service",
  providerAddress = "Partner Location",
  date,
  startTime,
  endTime,
  duration,
  isOneTime = true,
  sessionLeft,
  servicePrice = 0,
  addons = [],
  tips = 0,
  totalPrice = 0,
  currency = "NGN",
  paymentMethod = "card",
  paymentStatus = "paid",
  status = "pending",
  bookingRequestExpireAt,
  ctaUrl = DEFAULT_LOGIN_URL,
}) => {
  if (!email) return;

  const displayName = partnerName || "Partner";
  const numTotal = Number(totalPrice) || 0;
  const formattedTotal = numTotal.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const numBase = Number(servicePrice) || 0;
  const formattedBase = numBase.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const numTips = Number(tips) || 0;
  const formattedTips = numTips.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const currencySymbol = currency === "NGN" ? "₦" : `${currency} `;

  // Format date & time
  const formattedDate = formatBookingDate(date);
  const formattedTime = formatBookingTime(startTime, endTime);

  // Status mapping
  const isApproved = String(status).toLowerCase() === "approved";
  const badgeText = isApproved ? "New Booking Scheduled" : "Action Required — New Request";
  const badgeColor = isApproved ? "#059669" : "#DC2626";
  const badgeBg = isApproved ? "#D1FAE5" : "#FEE2E2";
  const statusIndicator = isApproved
    ? `<span style="color: #10B981; font-weight: 700;">● Confirmed on Calendar</span>`
    : `<span style="color: #EF4444; font-weight: 700;">● Awaiting Your Approval</span>`;

  // Payment method & status formatting
  const displayPaymentMethod = getDisplayPaymentMethod(paymentMethod);
  const displayPaymentStatus = getDisplayPaymentStatus(paymentStatus, paymentMethod);

  // Addons HTML rows
  let addonsHtml = "";
  if (Array.isArray(addons) && addons.length > 0) {
    const addonRows = addons
      .map(
        (a) =>
          `<div style="font-size: 13px; color: #4b5563; margin-top: 4px;">+ ${
            a.serviceName || a.name || "Add-on"
          }: <strong>${currencySymbol}${Number(a.price || 0).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}</strong></div>`
      )
      .join("");
    addonsHtml = `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="color: #64748b; font-weight: 500; vertical-align: top; padding: 11px;">Client Add-ons</td>
        <td style="color: #0f172a; text-align: right; padding: 11px;">
          ${addonRows}
        </td>
      </tr>
    `;
  }

  // Action box
  const isCash = String(paymentMethod).toLowerCase() === "cash";
  const operationalNotice = isApproved
    ? `
      <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px 18px; border-radius: 4px; margin: 20px 0;">
        <strong style="color: #166534; font-size: 14px;">Confirmed Appointment</strong>
        <p style="margin: 6px 0 0; color: #15803d; font-size: 13.5px; line-height: 1.5;">
          This booking is confirmed on your schedule. Please ensure your assigned staff member and workstation are ready.
        </p>
      </div>
    `
    : `
      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 4px; margin: 20px 0;">
        <strong style="color: #92400e; font-size: 14px;">Action Required — Pending Approval</strong>
        <p style="margin: 6px 0 0; color: #78350f; font-size: 13.5px; line-height: 1.5;">
          A client has requested this appointment. Please log in to your Partner Portal to <strong>approve or decline</strong> this booking before the acceptance window expires.
        </p>
      </div>
    `;

  const cashNotice = isCash
    ? `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-size: 13px; color: #991b1b;">
        <strong>Cash Payment Notice:</strong> The client selected <strong>Cash on Location</strong>. Please collect <strong>${currencySymbol}${formattedTotal}</strong> directly from the client upon arrival.
      </div>
    `
    : "";

  const content = `
    <p style="margin: 0 0 16px;">Hello <strong>${displayName}</strong>,</p>
    <p style="margin: 0 0 20px;">
      You have received a new booking for <strong>${serviceName}</strong> on <strong>${APP_NAME}</strong>. Below are the full client and appointment details.
    </p>

    <!-- Total Booking Value & Status Card -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px 20px; text-align: center; margin: 20px 0 24px;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.6px;">Booking Value</div>
      <div style="font-size: 32px; font-weight: 800; color: #0f172a; margin: 6px 0 4px;">
        ${currencySymbol}${formattedTotal}
      </div>
      <div style="font-size: 13px;">
        ${statusIndicator}
      </div>
    </div>

    ${operationalNotice}

    <!-- Client & Booking Details Table -->
    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 22px;">
      <table width="100%" cellpadding="11" cellspacing="0" style="border-collapse: collapse; font-size: 13.5px;">
        <tr style="border-bottom: 1px solid #f1f5f9; background-color: #fafafa;">
          <td colspan="2" style="font-weight: 700; color: #334155; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
            Booking &amp; Client Overview
          </td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500; width: 42%;">Booking Reference</td>
          <td style="color: #0f172a; font-weight: 600; font-family: 'SFMono-Regular', Consolas, monospace; text-align: right;">#${bookingId}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Service</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${serviceName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Client Name</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${customerName || "Customer"}</td>
        </tr>
        ${customerPhone ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Client Phone</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${customerPhone}</td>
        </tr>` : ""}
        ${customerEmail ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Client Email</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${customerEmail}</td>
        </tr>` : ""}
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Appointment Date</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${formattedDate}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Scheduled Time</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${formattedTime}</td>
        </tr>
        ${duration ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Duration</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${duration} minutes</td>
        </tr>` : ""}
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Service Location</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${providerAddress}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Session Type</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${isOneTime ? "Single Session" : `Package (${sessionLeft || "Multiple"} sessions)`}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Payment Method</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${displayPaymentMethod}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Payment Status</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${displayPaymentStatus}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Base Service Price</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${currencySymbol}${formattedBase}</td>
        </tr>
        ${addonsHtml}
        ${numTips > 0 ? `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="color: #64748b; font-weight: 500;">Tip</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${currencySymbol}${formattedTips}</td>
        </tr>` : ""}
        <tr style="background-color: #fafafa;">
          <td style="color: #0f172a; font-weight: 700;">Total Booking Value</td>
          <td style="color: ${BRAND_COLOR}; font-weight: 800; font-size: 15px; text-align: right;">${currencySymbol}${formattedTotal}</td>
        </tr>
      </table>
    </div>

    ${cashNotice}

    <!-- OTP Check-in Advisory -->
    <div style="background-color: #f8fafc; border-left: 3px solid ${BRAND_COLOR}; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #475569; margin: 18px 0;">
      <strong>Check-in PIN Verification:</strong> The client has been issued a 4-digit verification code. When the client arrives for their session, ask for this code and enter it into your Partner App/Dashboard to verify attendance and start the service timer.
    </div>
  `;

  const html = renderBaseTemplate({
    title: isApproved ? `New Booking: ${serviceName}` : `New Booking Request: ${serviceName}`,
    badgeText,
    badgeColor,
    badgeBg,
    content,
    ctaUrl: null,
  });

  try {
    await emailWithNodemailer({
      email,
      subject: isApproved
        ? `New Booking Scheduled: ${serviceName} [${bookingId}] 🗓️`
        : `Action Required: New Booking Request for ${serviceName} [${bookingId}] ⚠️`,
      html,
    });
  } catch (error) {
    console.error(`Failed to send Partner Booking email to ${email}:`, error.message);
  }
};

module.exports = {
  sendOtpVerifiedEmail,
  sendUserWelcomeEmail,
  sendPartnerRegistrationEmail,
  sendPartnerApprovedEmail,
  sendPartnerRejectedEmail,
  sendAccountSuspendedEmail,
  sendAccountActivatedEmail,
  sendStaffCredentialsEmail,
  sendTransactionEmail,
  sendUserBookingConfirmationEmail,
  sendPartnerNewBookingEmail,
  formatBookingDate,
  formatBookingTime,
  getDisplayPaymentMethod,
  getDisplayPaymentStatus,
};

