const OTP = require('./otp.model');
const { emailWithNodemailer } = require('../../helpers/email');
const ApiError = require('../../helpers/ApiError');
const httpStatus = require('http-status');
const { sendSMSOtp } = require('../../helpers/sms');


const sendOTP = async (name, sentTo, receiverType, purpose = 'email-verification') => {

  const otp = Math.floor(100000 + Math.random() * 900000);

  const otpExpiryTime = parseInt(process.env.OTP_EXPIRY_TIME) || 3;
  const expiredAt = new Date(Date.now() + otpExpiryTime * 60 * 1000);

  await OTP.findOneAndUpdate(
    { sentTo, receiverType, purpose, status: 'pending' },
    { otp, expiredAt, status: 'pending', verifiedAt: null },
    { upsert: true, new: true }
  );

  // EMAIL
  if (receiverType === 'email') {
    const subject = purpose === 'email-verification'
      ? 'Email verification code'
      : 'Forgot password code';

    const emailData = {
      email: sentTo,
      subject,
      html: `Your OTP is <b>${otp}</b>. It will expire in ${otpExpiryTime} minutes.`,
    };

    emailWithNodemailer(emailData).catch(console.error);
  }

  //SMS 
  if (receiverType === 'phone') {
    console.log({ sentTo, otp });
    await sendSMSOtp(sentTo, otp);
  }

  return true;
};


const checkOTPService = async (sentTo, receiverType) => {
  return await OTP.findOne({ sentTo: sentTo, status: 'pending', receiverType: receiverType, expiredAt: { $gt: new Date() } })
}

const normalizeSentTo = (sentTo, receiverType) => {
  if (!sentTo) return sentTo;

  sentTo = String(sentTo).trim();

  if (receiverType === 'phone') {
    // normalize phone
    if (!sentTo.startsWith('+')) {
      return `+${sentTo}`;
    }
    return sentTo;
  }

  if (receiverType === 'email') {
    // normalize email
    return sentTo.toLowerCase(); // important
  }

  return sentTo;
};


const verifyOTP = async (sentTo, receiverType, purpose, otp) => {
  console.log({ sentTo, receiverType, purpose, otp });
  sentTo = normalizeSentTo(sentTo, receiverType);

  console.log({ sentTo, receiverType, purpose, otp });

  const otpData = await OTP.findOne({
    sentTo,
    receiverType,
    purpose,
    otp,
    expiredAt: { $gt: new Date() },
    status: "pending",
  });

  console.log({ otpData });

  if (!otpData) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP');
  }

  otpData.status = 'expired';
  otpData.verifiedAt = new Date();
  await otpData.save();
  return otpData;
};


const checkOTPValidity = (sentTo) => {
  return OTP.findOne({ sentTo: sentTo, expiredAt: { $gt: new Date() }, status: 'verified' })
}

const updateOTP = async (otpId, otpBody) => {
  const otpData = await OTP.findById(otpId);
  if (!otpData) {
    return false;
  }
  Object.assign(otpData, otpBody);
  await otpData.save();
  return true;
}

const deleteOTP = async (otpId) => {
  return await OTP.findByIdAndDelete(otpId);
}

module.exports = {
  sendOTP,
  checkOTPService,
  verifyOTP,
  checkOTPValidity,
  updateOTP,
  deleteOTP
}