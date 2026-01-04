var admin = require("firebase-admin");

if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    console.error("Thiếu biến môi trường FIREBASE_SERVICE_ACCOUNT");
  }
}

const db = admin.firestore();
module.exports = { admin, db };
