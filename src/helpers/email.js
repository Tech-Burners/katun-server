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
  host: "smtp.zoho.com", // use smtp.zoho.eu / smtp.zoho.in / smtp.zoho.com.au if your account is on another region
  port: 465,
  secure: true, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USERNAME, // hello@auravive.ng
    pass: process.env.SMTP_PASSWORD  // Zoho app-specific password, not your login password
  }
});

const emailWithNodemailer = async (emailData) => {
  try {
    const mailOptions = {
      from: `"Auravive" <${process.env.SMTP_USERNAME}>`,
      to: emailData.email,
      subject: emailData.subject,
      html: emailData.html,
    }
    console.log(mailOptions);
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
      from: `"Auravive Support" <${process.env.SMTP_USERNAME}>`, // must be your own authenticated address
      to: "hello@auravive.ng", // your support inbox
      replyTo: emailData.email, // so you can hit "reply" and it goes to the customer
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

module.exports = { emailWithNodemailer, supportEmailWithNodemailer };