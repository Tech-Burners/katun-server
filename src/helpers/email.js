// const nodemailer = require("nodemailer");
// require('dotenv').config();

// const transporter = nodemailer.createTransport({
//   host: "smtp.gmail.com",
//   port: 465,
//   secure: true,
//   auth: {
//     user: process.env.SMTP_USERNAME,
//     pass: process.env.SMTP_PASSWORD
//   },
//    tls: {
//     rejectUnauthorized: false, 
//   }
// });

// const emailWithNodemailer = async (emailData) => {
//   // console.log({emailData});
//   try {
//     const mailOptions = {
//       from: process.env.SMTP_USERNAME, 
//       to: emailData.email, // list of receivers
//       subject: emailData.subject, // Subject line
//       html: emailData.html, // html body
//     }
//     const info = await transporter.sendMail(mailOptions);
//     console.log("---> Email sent %s", info.response);
//   } catch (error) {
//     console.error('Error sending mail', error);
//     throw error;
//   }
// };


// const supportEmailWithNodemailer = async (emailData) => {
//   try {
//     const mailOptions = {
//       from: emailData.email, // sender address
//       to: "xyz@gmail.com", // list of receivers
//       subject: emailData.subject, // Subject line
//       html: emailData.html, // html body
//     }
//     const info = await transporter.sendMail(mailOptions);
//     console.log("---> Email sent %s", info.response);
//   } catch (error) {
//     console.error('Error sending mail', error);
//     throw error;
//   }
// };


// module.exports = {emailWithNodemailer, supportEmailWithNodemailer};











const nodemailer = require("nodemailer");
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com", // use "smtp.zoho.eu" if your account is on the EU data center
  port: 465,
  secure: true,
  auth: {
    user: 'hello@auravive.ng', // your full Zoho email, e.g. support@yourdomain.com
    pass: 'A3MThe56vcqU'  // Zoho app-specific password (not your login password)
  },
  tls: {
    rejectUnauthorized: false,
  }
});

const emailWithNodemailer = async (emailData) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_USERNAME,
      to: emailData.email,
      subject: emailData.subject,
      html: emailData.html,
    }
    const info = await transporter.sendMail(mailOptions);
    console.log("---> Email sent %s", info.response);
  } catch (error) {
    console.error('Error sending mail', error);
    throw error;
  }
};


const supportEmailWithNodemailer = async (emailData) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_USERNAME, // ⚠️ see note below — this can't be emailData.email with Zoho
      to: "xyz@gmail.com",
      replyTo: emailData.email, // use this instead to let support reply to the original sender
      subject: emailData.subject,
      html: emailData.html,
    }
    const info = await transporter.sendMail(mailOptions);
    console.log("---> Email sent %s", info.response);
  } catch (error) {
    console.error('Error sending mail', error);
    throw error;
  }
};


module.exports = {emailWithNodemailer, supportEmailWithNodemailer};


