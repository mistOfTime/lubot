import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0321173657",
  appId: "1:184197718451:web:d8a5039576e1c54704abc6",
  apiKey: "AIzaSyAqXpXcFj4k-q17RL9kY_y9yOy-g_4t498",
  authDomain: "gen-lang-client-0321173657.firebaseapp.com",
  storageBucket: "gen-lang-client-0321173657.firebasestorage.app",
  messagingSenderId: "184197718451",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-542aca7e-ac3f-4d41-8fef-c70d52396ac5");
export const googleProvider = new GoogleAuthProvider();
