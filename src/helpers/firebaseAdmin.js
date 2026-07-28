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

const serviceAccount = JSON.parse(
  fs.readFileSync(keyPath, "utf8")
);

let firebaseApp;

if (getApps().length === 0) {
  firebaseApp = initializeApp({
    credential: cert(serviceAccount),
  });
} else {
  firebaseApp = getApps()[0];
}

const firebaseAuth = getAuth(firebaseApp);

module.exports = firebaseAuth;