import React, { useState, useEffect, useMemo } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, limit, onSnapshot } from 'firebase/firestore';
import { Search } from 'lucide-react';
import { UserCard } from '../components/UserCard';
import { motion } from 'motion/react';

interface ExplorePageProps {
  user: FirebaseUser;
  onSelectChatUser: (uid: string) => void;
}

export const ExplorePage: React.FC<ExplorePageProps> = ({ user, onSelectChatUser }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Écouter tous les utilisateurs inscrits (limité à 100 pour optimiser)
  useEffect(() => {
    const usersQuery = query(collection(db, 'users'), limit(100));
    
    const unsubscribe = onSnapshot(usersQuery, (snap) => {
      setUsers(
        snap.docs
          .map(d => d.data() as UserProfile)
          .filter(p => p.uid !== user.uid) // Ne pas s'inclure soi-même
      );
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return unsubscribe;
  }, [user.uid]);

  // Filtrer les utilisateurs selon la recherche
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u => 
      u.name.toLowerCase().includes(q) ||
      u.country?.toLowerCase().includes(q) ||
      u.city?.toLowerCase().includes(q) ||
      u.interests?.some(i => i.toLowerCase().includes(q))
    );
  }, [users, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h2 className="text-2xl font-black text-slate-100 tracking-tight">Explorer</h2>
        <p className="text-xs text-slate-400 mt-1">Découvrez et connectez-vous avec des citoyens du monde entier.</p>
      </header>

      {/* Barre de Recherche */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher par nom, pays, ville ou intérêt (#sport, #voyage...)"
          className="w-full bg-slate-900 border border-slate-800/80 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-md shadow-black/10"
        />
      </div>

      {/* Liste des Utilisateurs */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
          {filteredUsers.map(u => (
            <motion.div 
              key={u.uid}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <UserCard 
                profile={u} 
                onMessage={(uid) => onSelectChatUser(uid)} 
              />
            </motion.div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="col-span-full text-center py-16 text-slate-500 bg-slate-900/20 border border-slate-900 rounded-3xl">
              <Search size={40} className="mx-auto mb-3 opacity-20 text-slate-400" />
              <p className="text-sm">Aucun citoyen du monde trouvé pour cette recherche.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
