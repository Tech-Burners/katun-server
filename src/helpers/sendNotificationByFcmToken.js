const fs = require("fs");
const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const userModel = require("../modules/User/user.model");

const keyPath = path.join(__dirname, "../../googleFirebaseAdmin.json");
let serviceAccount = null;

if (fs.existsSync(keyPath)) {
  try {
    serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  } catch (err) {
    console.error("❌ Failed to parse googleFirebaseAdmin.json:", err.message);
  }
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    console.error("❌ Failed to parse FIREBASE_SERVICE_ACCOUNT env var:", err.message);
  }
}

// Guard against re-initialization
if (serviceAccount && !getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

// Function to send notification to a user
const sendNotificationByFcmToken = async (
  receiverId,
  title,
  textMessage,
  bookingId,
  type
) => {
  if (!getApps().length) {
    console.warn("⚠️ Firebase Admin not initialized. Skipping push notification.");
    return;
  }

  const findUser = await userModel.findOne({ _id: receiverId });

  if (!findUser) {
    console.log(`User with id ${receiverId} not found`);
    return;
  }

  const { fcmToken } = findUser;

  if (!fcmToken?.trim()) {
    console.log(`No valid FCM token found for user: ${receiverId}`);
    return;
  }

  const data = {};

  if (type) {
    data.type = String(type);
  }

  if (bookingId) {
    data.bookingId = String(bookingId);
  }

  const message = {
    notification: {
      title,
      body: textMessage,
    },
    data,
    token: fcmToken,
  };

  try {
    const response = await getMessaging().send(message);
    console.log("Successfully sent message:", response);
  } catch (error) {
    console.log("Error sending message:", error);
  }
};

module.exports = { sendNotificationByFcmToken };
