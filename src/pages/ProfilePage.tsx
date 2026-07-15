import React, { useState } from 'react';
import { User as FirebaseUser, signOut } from 'firebase/auth';
import { UserProfile } from '../types';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { MapPin, User, LogOut, Edit3, Save, X, Hash, Globe, Building, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProfilePageProps {
  user: FirebaseUser;
  profile: UserProfile | null;
  onProfileUpdate: (updatedData: Partial<UserProfile>) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ 
  user, 
  profile, 
  onProfileUpdate 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(profile?.bio || '');
  const [country, setCountry] = useState(profile?.country || '');
  const [city, setCity] = useState(profile?.city || '');
  const [interestsText, setInterestsText] = useState(profile?.interests?.join(', ') || '');
  const [isSaving, setIsSaving] = useState(false);

  // Sauvegarder les modifications du profil
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    // Formater les intérêts en tableau de chaînes nettoyées
    const formattedInterests = interestsText
      .split(',')
      .map(i => i.trim().replace(/^#/, '')) // Retirer les hashs éventuels entrés par le user
      .filter(i => i.length > 0);

    const updatedData: Partial<UserProfile> = {
      bio: bio.trim(),
      country: country.trim(),
      city: city.trim(),
      interests: formattedInterests
    };

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, updatedData);
      onProfileUpdate(updatedData);
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEdit = () => {
    setBio(profile?.bio || '');
    setCountry(profile?.country || '');
    setCity(profile?.city || '');
    setInterestsText(profile?.interests?.join(', ') || '');
    setIsEditing(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h2 className="text-2xl font-black text-slate-100 tracking-tight">Mon Profil</h2>
        <p className="text-xs text-slate-400 mt-1">Gérez vos informations de compte et vos intérêts de partage.</p>
      </header>

      <div className="bg-slate-900 rounded-3xl border border-slate-800/80 shadow-xl overflow-hidden">
        {/* Banner decorative */}
        <div className="h-28 bg-gradient-to-r from-blue-900/60 via-indigo-950/80 to-blue-950/70 relative"></div>
        
        <div className="p-6 sm:p-8 -mt-14 relative text-center">
          {/* Avatar Area */}
          <div className="relative inline-block mb-4">
            <img 
              src={profile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
              className="w-28 h-28 rounded-full border-4 border-slate-900 shadow-2xl bg-slate-800 object-cover"
              referrerPolicy="no-referrer"
              alt={profile?.name || 'Profil'}
            />
            <div className="absolute bottom-1 right-1 bg-blue-600 text-white p-2 rounded-full shadow-lg border border-slate-950">
              <User size={14} />
            </div>
          </div>

          <h2 className="text-2xl font-black text-slate-100 tracking-tight">{profile?.name}</h2>
          
          <p className="text-slate-400 text-xs mt-1.5 flex items-center justify-center gap-1">
            <MapPin size={14} className="text-blue-500 shrink-0" />
            <span>{profile?.city ? `${profile.city}, ` : ''}{profile?.country || 'Citoyen du Monde'}</span>
          </p>

          {/* Bio display */}
          <div className="text-left mt-8 bg-slate-950/30 border border-slate-800/50 p-5 rounded-2xl">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-slate-200 text-sm tracking-wide uppercase">Ma Bio</h4>
              {!isEditing && (
                <button 
                  onClick={handleOpenEdit}
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-bold"
                >
                  <Edit3 size={12} />
                  <span>Modifier</span>
                </button>
              )}
            </div>
            
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
              {profile?.bio || "Aucune bio pour l'instant. Présentez-vous au monde ! 🌍"}
            </p>
          </div>

          {/* Interests display */}
          <div className="text-left mt-6 bg-slate-950/30 border border-slate-800/50 p-5 rounded-2xl">
            <h4 className="font-bold text-slate-200 text-sm tracking-wide uppercase mb-3">Mes Intérêts</h4>
            <div className="flex flex-wrap gap-2">
              {profile?.interests?.length ? (
                profile.interests.map(i => (
                  <span key={i} className="px-3 py-1 bg-slate-800 border border-slate-700/80 text-blue-400 rounded-full text-xs font-semibold shadow-sm">
                    #{i}
                  </span>
                ))
              ) : (
                <span className="text-slate-500 text-xs italic">Ajoutez quelques centres d'intérêt pour trouver des personnes partageant les mêmes idées.</span>
              )}
            </div>
          </div>

          {/* Settings / Permissions */}
          <div className="mt-8">
            <button 
              onClick={() => {
                localStorage.removeItem('wc_permissions_asked');
                window.location.reload();
              }}
              className="w-full mb-3 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-md"
            >
              <Shield size={18} />
              Réinitialiser les permissions
            </button>
            <button 
              onClick={() => signOut(auth)}
              className="w-full py-3.5 bg-slate-950 hover:bg-red-950/20 text-red-500 border border-slate-800 hover:border-red-900/30 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-md"
            >
              <LogOut size={18} />
              Se déconnecter
            </button>
          </div>
        </div>
      </div>

      {/* Edit Profile Overlay / Form Modal */}
      <AnimatePresence>
        {isEditing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
                <h3 className="font-black text-slate-100 text-lg tracking-tight">Modifier mon profil</h3>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/80 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
                {/* Ville & Pays */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 flex items-center gap-1">
                      <Building size={12} />
                      <span>Ville</span>
                    </label>
                    <input 
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ex: Paris"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 flex items-center gap-1">
                      <Globe size={12} />
                      <span>Pays</span>
                    </label>
                    <input 
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Ex: France"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-600"
                    />
                  </div>
                </div>

                {/* Bio */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Ma Bio</label>
                  <textarea 
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Dites-en un peu plus sur vous..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-600 resize-none"
                    rows={4}
                  />
                </div>

                {/* Centres d'intérêt */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <Hash size={12} />
                    <span>Intérêts (séparés par des virgules)</span>
                  </label>
                  <input 
                    type="text"
                    value={interestsText}
                    onChange={(e) => setInterestsText(e.target.value)}
                    placeholder="Ex: sport, voyage, tech, musique"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-600"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">Vos intérêts apparaîtront sous forme de hashtags sur votre profil.</span>
                </div>

                {/* Boutons d'action */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/60 mt-6">
                  <button 
                    type="button" 
                    onClick={() => setIsEditing(false)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-2 shadow-md shadow-blue-900/20"
                  >
                    <Save size={16} />
                    <span>{isSaving ? "Enregistrement..." : "Enregistrer"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
