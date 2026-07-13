/*
 * Si vous souhaitez utiliser votre propre projet Firebase au lieu du projet automatique généré par AI Studio :
 * Ajoutez ces variables dans l'onglet "Secrets" (Variables d'environnement) de votre projet :
 * - VITE_FIREBASE_API_KEY
 * - VITE_FIREBASE_AUTH_DOMAIN
 * - VITE_FIREBASE_DATABASE_URL
 * - VITE_FIREBASE_PROJECT_ID
 * - VITE_FIREBASE_STORAGE_BUCKET
 * - VITE_FIREBASE_MESSAGING_SENDER_ID
 * - VITE_FIREBASE_APP_ID
 * - VITE_FIREBASE_MEASUREMENT_ID
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const customConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Utilise la configuration des variables d'environnement si elle existe, sinon utilise la configuration locale
const activeConfig = customConfig.apiKey ? customConfig : firebaseConfig;

const app = initializeApp(activeConfig);
export const auth = getAuth(app);
// Si la configuration locale est utilisée, on passe le firestoreDatabaseId (au cas où il a été généré)
// Sinon, on utilise la base de données par défaut du projet customisé.
export const db = getFirestore(app, customConfig.apiKey ? undefined : firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };

  console.error('Firestore Error Details:', errInfo);
  
  // Loguer sans planter l'application entière pour les erreurs temporaires/réseau
  // Cela permet à Firestore de basculer de manière transparente en mode hors-ligne
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (errorMessage.toLowerCase().includes('unavailable') || errorMessage.toLowerCase().includes('offline') || errorMessage.toLowerCase().includes('could not reach')) {
    console.warn("Connexion Firestore temporairement indisponible. Bascule automatique en mode hors-ligne.");
  } else {
    // Pour d'autres erreurs fatales ou de permissions, nous levons une alerte non bloquante dans la console
    console.error("Erreur critique détectée lors de l'opération Firestore:", errorMessage);
  }
}
