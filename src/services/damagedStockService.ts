import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { DamagedStockProposal } from '../types';

const COLLECTION_NAME = 'damaged_stock_proposals';

export function subscribeToDamagedStockProposals(callback: (proposals: DamagedStockProposal[]) => void) {
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const proposals = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    } as DamagedStockProposal));
    callback(proposals);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
  });
}

export async function addDamagedStockProposal(data: Omit<DamagedStockProposal, 'id'>) {
  try {
    return await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
  }
}

export async function updateDamagedStockProposal(id: string, data: Partial<DamagedStockProposal>) {
  try {
    const itemRef = doc(db, COLLECTION_NAME, id);
    return await updateDoc(itemRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
  }
}

export async function deleteDamagedStockProposal(id: string) {
  try {
    const itemRef = doc(db, COLLECTION_NAME, id);
    return await deleteDoc(itemRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
  }
}
