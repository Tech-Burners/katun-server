const axios = require("axios");
const ApiError = require("./ApiError");
const httpStatus = require("http-status");


const sendWhatsAppOtp = async (phoneNumber, otp) => {
  if (!phoneNumber) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Phone number is required"
    );
  }

  if (!otp) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "OTP is required"
    );
  }

  try {
    const graphApiVersion =
      process.env.META_GRAPH_API_VERSION || "v23.0";

    const url = `https://graph.facebook.com/${graphApiVersion}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const response = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "template",
        template: {
          name: process.env.WHATSAPP_OTP_TEMPLATE_NAME,
          language: {
            code: "en_US",
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: otp.toString(),
                },
              ],
            },
          ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    const messageId = response.data?.messages?.[0]?.id;

    console.log("WhatsApp OTP Response:", {
      messageId,
      phoneNumber,
    });

    if (!messageId) {
      console.error(
        "WhatsApp API response did not contain message ID:",
        response.data
      );

      throw new Error(
        "WhatsApp API did not return a message ID"
      );
    }

    return {
      messageId,
      status: "sent",
    };
  } catch (error) {
    const metaError = error.response?.data?.error;

    console.error("WhatsApp OTP Error:", {
      message: error.message,
      status: error.response?.status,
      code: metaError?.code,
      type: metaError?.type,
      errorMessage: metaError?.message,
    });

    if (metaError?.code === 131026) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "WhatsApp message could not be delivered to this number."
      );
    }

    if (metaError?.code === 131047) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "WhatsApp messaging session has expired. Please try again."
      );
    }

    if (metaError?.code === 100) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Invalid WhatsApp configuration or phone number."
      );
    }

    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "We couldn't send the verification code on WhatsApp. Please try again later."
    );
  }
};

module.exports = {
  sendWhatsAppOtp,
};