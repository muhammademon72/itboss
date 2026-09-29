import React, { useState, useEffect } from 'react';
import { CompanyProfile } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getLocalCache, setLocalCache } from '../utils/localCache';

export default function CompanyProfileForm() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const docRef = doc(db, 'settings', 'companyProfile');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const fetched = { id: docSnap.id, ...docSnap.data() } as CompanyProfile;
          setProfile(fetched);
          setLocalCache('companyProfile', [fetched]);
        } else {
          const cached = getLocalCache<CompanyProfile>('companyProfile');
          if (cached && cached.length > 0) {
            setProfile(cached[0]);
          } else {
            setProfile({ id: 'companyProfile', name: '', address: '', contact: '', email: '', website: '' } as CompanyProfile);
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'settings/companyProfile');
        const cached = getLocalCache<CompanyProfile>('companyProfile');
        if (cached && cached.length > 0) {
          setProfile(cached[0]);
        } else {
          setProfile({ id: 'companyProfile', name: '', address: '', contact: '', email: '', website: '' } as CompanyProfile);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      await setDoc(doc(db, 'settings', 'companyProfile'), {
        ...profile,
        updatedAt: serverTimestamp(),
      });
      setLocalCache('companyProfile', [profile]);
      alert('Profile updated!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/companyProfile');
      setLocalCache('companyProfile', [profile]);
      alert('Profile saved locally!');
    }
  };

  if (loading) return <div className="p-8 text-xs">Loading...</div>;

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h2 className="text-xl font-bold mb-6">Company Profile</h2>
      {profile && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="border p-2 w-full text-xs" placeholder="Company Name" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} />
          <input className="border p-2 w-full text-xs" placeholder="Address" value={profile.address} onChange={e => setProfile({...profile, address: e.target.value})} />
          <input className="border p-2 w-full text-xs" placeholder="Contact" value={profile.contact} onChange={e => setProfile({...profile, contact: e.target.value})} />
          <input className="border p-2 w-full text-xs" placeholder="Email" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} />
          <input className="border p-2 w-full text-xs" placeholder="Website" value={profile.website} onChange={e => setProfile({...profile, website: e.target.value})} />
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 text-xs rounded">Save Profile</button>
        </form>
      )}
    </div>
  );
}
