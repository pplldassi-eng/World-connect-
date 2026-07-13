import React, { useState, useEffect } from 'react';
import { Room } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { MessageSquare, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

interface RoomsPageProps {
  onJoinRoom: (roomId: string) => void;
}

export const RoomsPage: React.FC<RoomsPageProps> = ({ onJoinRoom }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  // Écouter les salons de discussion en temps réel
  useEffect(() => {
    const roomsQuery = query(collection(db, 'rooms'));

    const unsubscribe = onSnapshot(roomsQuery, (snap) => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as Room)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rooms');
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h2 className="text-2xl font-black text-slate-100 tracking-tight">Salons de Discussion</h2>
        <p className="text-xs text-slate-400 mt-1">Rejoignez des salons thématiques intégrés pour échanger en direct.</p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
          {rooms.map((room) => (
            <motion.div 
              key={room.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-slate-900 rounded-3xl border border-slate-800/80 shadow-lg hover:shadow-2xl hover:border-slate-700 transition-all overflow-hidden group flex flex-col"
            >
              {room.imageUrl ? (
                <div className="h-44 overflow-hidden relative shrink-0 border-b border-slate-800">
                  <img 
                    src={room.imageUrl} 
                    alt={room.name} 
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent flex items-end p-5">
                    <h3 className="font-black text-xl text-white tracking-tight drop-shadow-sm">{room.name}</h3>
                  </div>
                </div>
              ) : (
                <div className="p-6 pb-2 shrink-0">
                  <h3 className="font-black text-xl text-slate-100 tracking-tight">{room.name}</h3>
                </div>
              )}
              
              <div className="p-6 flex-1 flex flex-col justify-between">
                <p className="text-slate-400 text-sm mb-6 leading-relaxed flex-1">
                  {room.description}
                </p>
                
                <button 
                  onClick={() => onJoinRoom(room.id)}
                  className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white py-3.5 rounded-2xl font-bold transition-all shadow-md shadow-blue-900/10 hover:shadow-lg flex items-center justify-center text-sm gap-2"
                >
                  <MessageSquare size={18} />
                  Rejoindre la discussion
                </button>
              </div>
            </motion.div>
          ))}

          {rooms.length === 0 && (
            <div className="col-span-full text-center py-16 text-slate-500 bg-slate-900/20 border border-slate-900 rounded-3xl">
              <ShieldAlert size={40} className="mx-auto mb-3 opacity-20 text-slate-400" />
              <p className="text-sm">Aucun salon de discussion n'est disponible pour le moment.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
