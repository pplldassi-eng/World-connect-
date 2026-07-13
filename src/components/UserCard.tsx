import React from 'react';
import { UserProfile } from '../types';
import { Globe, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UserCardProps {
  profile: UserProfile;
  onMessage: (uid: string) => void;
}

export const UserCard: React.FC<UserCardProps> = ({ profile, onMessage }) => {
  const getFormattedTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { locale: fr });
    } catch (e) {
      return "récemment";
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 flex items-center shadow-lg hover:border-slate-700 transition-all duration-300 group">
      <div className="relative shrink-0">
        <img 
          src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid}`} 
          className="w-14 h-14 rounded-full mr-4 bg-slate-800 border border-slate-700 object-cover"
          referrerPolicy="no-referrer"
          alt={profile.name}
        />
        {profile.isOnline && (
          <div className="absolute bottom-0 right-4 w-3.5 h-3.5 bg-green-500 border-2 border-slate-900 rounded-full animate-pulse"></div>
        )}
      </div>

      <div className="flex-1 min-w-0 pr-2">
        <h4 className="font-bold text-slate-100 text-sm truncate">{profile.name}</h4>
        
        <div className="flex items-center text-xs text-slate-400 mt-1">
          <Globe size={12} className="mr-1 text-slate-500 shrink-0" />
          <span className="truncate">{profile.country || 'Citoyen du Monde'}</span>
          {profile.city && <span className="mx-1 shrink-0">•</span>}
          {profile.city && <span className="truncate text-[11px]">{profile.city}</span>}
        </div>

        {!profile.isOnline && profile.lastSeen && (
          <p className="text-[10px] text-slate-500 mt-0.5">En ligne il y a {getFormattedTime(profile.lastSeen)}</p>
        )}

        <div className="flex flex-wrap gap-1 mt-2">
          {profile.interests?.slice(0, 3).map(interest => (
            <span key={interest} className="px-2 py-0.5 bg-slate-800 border border-slate-700/80 text-blue-400 rounded-full text-[9px] font-medium">
              #{interest}
            </span>
          ))}
        </div>
      </div>

      <button 
        onClick={() => onMessage(profile.uid)}
        className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-500 active:bg-blue-700 transition-all ml-2 shadow-md shadow-blue-900/10 hover:scale-105 active:scale-95"
        title="Envoyer un message"
      >
        <MessageSquare size={18} />
      </button>
    </div>
  );
};
