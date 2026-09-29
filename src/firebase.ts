import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, disableNetwork } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth();

// Global quota state indicator
export let isQuotaExceeded = false;
const quotaListeners: Array<(exceeded: boolean) => void> = [];

export function subscribeQuotaState(listener: (exceeded: boolean) => void) {
  quotaListeners.push(listener);
  listener(isQuotaExceeded);
  return () => {
    const idx = quotaListeners.indexOf(listener);
    if (idx >= 0) quotaListeners.splice(idx, 1);
  };
}

export function setQuotaExceededState(exceeded: boolean) {
  if (isQuotaExceeded !== exceeded) {
    isQuotaExceeded = exceeded;
    quotaListeners.forEach(l => l(isQuotaExceeded));
    if (exceeded) {
      try {
        disableNetwork(db).catch(() => {});
      } catch (err) {
        // ignore
      }
    }
  }
}

export function checkIsQuotaError(error: unknown): boolean {
  if (!error) return false;
  const errStr = String(error instanceof Error ? error.message : error).toLowerCase();
  const code = (error as any)?.code || '';
  return (
    code === 'resource-exhausted' ||
    errStr.includes('quota limit exceeded') ||
    errStr.includes('resource-exhausted') ||
    errStr.includes('quota exceeded') ||
    errStr.includes('free daily write units') ||
    errStr.includes('free daily read units')
  );
}

// Validate Connection to Firestore (Skill Requirement)
async function testConnection() {
  try {
    await getDoc(doc(db, 'test', 'connection'));
  } catch (error) {
    if (checkIsQuotaError(error)) {
      setQuotaExceededState(true);
      console.warn("Firestore Quota Exceeded detected on initial connection test.");
    } else if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// Error Handling (Skill Requirement)
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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  if (checkIsQuotaError(error)) {
    setQuotaExceededState(true);
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}
