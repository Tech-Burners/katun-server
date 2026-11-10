const {
  initializeApp,
  getApps,
  cert,
} = require("firebase-admin/app");

const {
  getAuth,
} = require("firebase-admin/auth");

const fs = require("fs");
const path = require("path");

const keyPath = path.join(
  __dirname,
  "../../googleFirebaseAdmin.json"
);

console.log("Firebase key path:", keyPath);

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

let firebaseApp = null;
let firebaseAuth = null;

if (serviceAccount) {
  if (getApps().length === 0) {
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    firebaseApp = getApps()[0];
  }
  firebaseAuth = getAuth(firebaseApp);
} else {
  console.warn("⚠️ Warning: googleFirebaseAdmin.json not found! Please place googleFirebaseAdmin.json in project root or set FIREBASE_SERVICE_ACCOUNT in .env");
}

module.exports = firebaseAuth;
