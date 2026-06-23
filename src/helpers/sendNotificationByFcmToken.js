const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const serviceAccount = require("../../googleFirebaseAdmin.json");
const userModel = require("../modules/User/user.model");

// Guard against re-initialization
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

// Function to send notification to a user
const sendNotificationByFcmToken = async (receiverId, textMessage) => {
  console.log({ receiverId, textMessage });

  const findUser = await userModel.findOne({ _id: receiverId });
  console.log({ findUser });

  if (!findUser) {
    console.log(`User with id ${receiverId} not found`);
    return;
  }

  const { fcmToken } = findUser;

  if (!fcmToken?.trim()) {
    console.log(`No valid FCM token found for user: ${receiverId}`);
    return;
  }

  const message = {
    notification: {
      body: textMessage,
    },
    token: fcmToken,
  };
console.log({message})
  try {
    const response = await getMessaging().send(message);
    console.log("Successfully sent message:", response);
  } catch (error) {
    console.log("Error sending message:", error);
  }
};

module.exports = { sendNotificationByFcmToken };