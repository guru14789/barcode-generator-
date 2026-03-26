import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

// Initialize Firebase (same config as your app)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/**
 * Script to query and view Firestore data structure
 * Usage: node query-firestore.mjs
 */

async function queryUserBarcodes(userEmail) {
  try {
    console.log(`\n📋 Querying barcodes for user: ${userEmail}\n`);

    // Query users collection to find by email
    const usersRef = collection(db, 'users');
    const userDocs = await getDocs(usersRef);

    let userUid = null;
    let userData = null;

    // Find user by email
    userDocs.forEach(doc => {
      const data = doc.data();
      if (data.email === userEmail) {
        userUid = doc.id;
        userData = data;
      }
    });

    if (!userUid) {
      console.log(`❌ User not found with email: ${userEmail}`);
      console.log("\n📊 Available users in Firestore:");
      userDocs.forEach(doc => {
        console.log(`  - Email: ${doc.data().email}, UID: ${doc.id}`);
      });
      return;
    }

    console.log(`✅ Found user:`);
    console.log(`   UID: ${userUid}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Display Name: ${userData.displayName || 'N/A'}`);
    console.log(`   Last Login: ${new Date(userData.lastLogin).toLocaleString()}`);

    // Get barcodes for this user
    const barcodesRef = collection(db, 'users', userUid, 'barcodes');
    const barcodeDocs = await getDocs(barcodesRef);

    console.log(`\n📊 Barcodes (${barcodeDocs.size} total):`);
    console.log('─'.repeat(80));

    if (barcodeDocs.size === 0) {
      console.log('No barcodes found for this user');
    } else {
      barcodeDocs.forEach((doc, index) => {
        const barcode = doc.data();
        console.log(`\n${index + 1}. ID in Collection: ${doc.id}`);
        console.log(`   Barcode Code: ${barcode.id}`);
        console.log(`   Label: ${barcode.label || 'No label'}`);
        console.log(`   Format: ${barcode.format}`);
        console.log(`   Created: ${new Date(barcode.createdAt).toLocaleString()}`);
        console.log(`   User ID: ${barcode.userId}`);
      });
    }

    console.log('\n' + '─'.repeat(80));
    console.log(`\n📁 Full document structure:`);
    console.log(JSON.stringify({ user: { uid: userUid, ...userData } }, null, 2));

  } catch (error) {
    console.error('❌ Error querying Firestore:', error);
  } finally {
    process.exit(0);
  }
}

// Run the query for the specified user
const userEmail = process.argv[2] || 'info.sreemeditec@gmail.com';
queryUserBarcodes(userEmail);
