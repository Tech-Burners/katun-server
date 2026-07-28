const httpStatus = require("http-status");
const twilio = require("twilio");
const ApiError = require("./ApiError");

// Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = "AuraVive";
// const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

// Create Twilio client
const TwilioClient = twilio(accountSid, authToken);


// const sendSMSOtp = async (phoneNumber, otp, purpose = "verification") => {
//     // console.log({ phoneNumber, otp, purpose });
//     if (!phoneNumber) {
//         throw new ApiError(httpStatus.BAD_REQUEST, "Phone number is required");
//     }

//     const otpExpiryTime = parseInt(process.env.OTP_EXPIRY_TIME) || 3; // minutes

//     // Friendly, professional SMS
//     let messageBody = `Your ${process.env.APPNAME || "App"} verification code is: ${otp}. It will expire in ${otpExpiryTime} minutes.`;

//     try {
//         const message = await TwilioClient.messages.create({
//             body: messageBody,
//             from: twilioPhone,
//             to: phoneNumber,
//         });

//         if (!message) {
//             throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to send OTP");
//         }

//         return otp;

//     } catch (error) {
//         throw new ApiError(
//             httpStatus.INTERNAL_SERVER_ERROR,
//             `Failed to send OTP: ${error.message}`
//         );
//     }
// };

const sendSMSOtp = async (
  phoneNumber,
  otp,
  purpose = "verification"
) => {
  if (!phoneNumber) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Phone number is required"
    );
  }

  const otpExpiryTime =
    parseInt(process.env.OTP_EXPIRY_TIME) || 3;

  const messageBody = `Your ${process.env.APPNAME || "App"
    } verification code is: ${otp}. It will expire in ${otpExpiryTime} minutes.`;

  try {
    console.log(
 {     body: messageBody,
      from: twilioPhone,
      to: phoneNumber,}
    )
    const message = await TwilioClient.messages.create({
      body: messageBody,
      from: twilioPhone,
      to: phoneNumber,
    });

    console.log("Twilio SMS Response:", {
      sid: message.sid,
      status: message.status,
      to: message.to,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
    });

    // Twilio should always return a message SID
    if (!message?.sid) {
      throw new Error("Twilio did not return a message SID");
    }

    return {
      sid: message.sid,
      status: message.status,
    };

  } catch (error) {
    console.error("Twilio SMS Error:", {
      message: error.message,
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo,
      details: error.details,
    });

    if (error.code === 21211) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "The phone number you entered is invalid. Please check the number and try again."
      );
    }

    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "We couldn't send the verification code. Please try again later."
    );
  }
};

const sendSMSINNumber = async (phoneNumber, message, type = "general") => {

  if (!phoneNumber) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Phone number is required");
  }

  try {

    // console.log(`Sending SMS of type "${type}" to ${phoneNumber}: ${message}`);

    const smsResponse = await TwilioClient.messages.create({
      body: message,
      from: twilioPhone,
      to: phoneNumber,
    });

    if (!smsResponse) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Failed to send SMS of type "${type}"`
      );
    }

    return smsResponse;

  } catch (error) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to send message of type "${type}": ${error.message}`
    );
  }
};


module.exports = {
  sendSMSOtp,
  sendSMSINNumber
};