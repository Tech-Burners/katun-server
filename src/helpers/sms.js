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


const sendSMSOtp = async (phoneNumber, otp, purpose = "verification") => {
    console.log({ phoneNumber, otp, purpose });
    if (!phoneNumber) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Phone number is required");
    }

    const otpExpiryTime = parseInt(process.env.OTP_EXPIRY_TIME) || 3; // minutes

    // Friendly, professional SMS
    let messageBody = `Your ${process.env.APPNAME || "App"} verification code is: ${otp}. It will expire in ${otpExpiryTime} minutes.`;

    try {
        const message = await TwilioClient.messages.create({
            body: messageBody,
            from: twilioPhone,
            to: phoneNumber,
        });

        if (!message) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Failed to send OTP");
        }

        return otp;

    } catch (error) {
        throw new ApiError(
            httpStatus.INTERNAL_SERVER_ERROR,
            `Failed to send OTP: ${error.message}`
        );
    }
};



const sendSMSINNumber = async (phoneNumber, message, type = "general") => {

    if (!phoneNumber) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Phone number is required");
    }

    try {

        console.log(`Sending SMS of type "${type}" to ${phoneNumber}: ${message}`);

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