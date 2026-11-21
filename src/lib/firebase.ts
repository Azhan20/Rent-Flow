import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseConfigVariableNames = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;
const firebaseConfigValues = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.appId,
];

export const missingFirebaseConfigVariables = firebaseConfigVariableNames.filter((_, index) => !firebaseConfigValues[index]);
export const firebaseConfigured = missingFirebaseConfigVariables.length === 0;
if (import.meta.env.DEV && missingFirebaseConfigVariables.length > 0) {
  console.warn('[RentFlow Firebase] Missing required Vite configuration variables:', missingFirebaseConfigVariables);
}

const app = firebaseConfigured
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp())
  : null;
export const auth = app ? getAuth(app) : null;
export const googleAuthProvider = new GoogleAuthProvider();
