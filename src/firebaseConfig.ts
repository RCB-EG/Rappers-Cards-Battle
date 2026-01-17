
import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAy0RKJYuYWoPuIwpsRtVoS32agGRW8tsg",
  authDomain: "rcbattle-bdebb.firebaseapp.com",
  projectId: "rcbattle-bdebb",
  storageBucket: "rcbattle-bdebb.firebasestorage.app",
  messagingSenderId: "685689383355",
  appId: "1:685689383355:web:6030b58bc19e9850e93c9e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth and Firestore services to be used in App.tsx
export const auth = getAuth(app);
export const db = getFirestore(app);
