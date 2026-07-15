import React, { useState, useEffect, useRef } from 'react';
import { Room, UserProfile } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { MessageSquare, ShieldAlert, Plus, Trash2, X, Image, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { uploadToCloudinary } from '../lib/cloudinary';
import { User as FirebaseUser } from 'firebase/auth';

interface RoomsPageProps {
  onJoinRoom: (roomId: string) => void;
  user: FirebaseUser | null;
  profile: UserProfile | null;
}

export const RoomsPage: React.FC<RoomsPageProps> = ({ onJoinRoom, user, profile }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Écouter les salons de discussion en temps réel
  useEffect(() => {
    const roomsQuery = query(collection(db, 'rooms'));

    const unsubscribe = onSnapshot(roomsQuery, (snap) => {
      const fetchedRooms = snap.docs.map(d => ({ id: d.id, ...d.data() } as Room));
      
      // Trier par date de création (les plus récents en premier)
      fetchedRooms.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setRooms(fetchedRooms);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rooms');
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Seeding automatique de salons par défaut si la liste est vide et que le chargement est terminé
  useEffect(() => {
    if (!loading && rooms.length === 0) {
      const defaultRooms = [
        {
          name: "Général 🌍",
          description: "Le salon principal pour faire connaissance, échanger sur divers sujets et se connecter au niveau mondial.",
          imageUrl: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=800&q=80",
          createdBy: "system",
          createdAt: new Date(Date.now() - 3000).toISOString()
        },
        {
          name: "Technologie & Code 💻",
          description: "Partagez vos projets, discutez de programmation, d'intelligence artificielle et des technologies de demain.",
          imageUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80",
          createdBy: "system",
          createdAt: new Date(Date.now() - 2000).toISOString()
        },
        {
          name: "Arts & Musique 🎨",
          description: "Exprimez votre créativité ! Un espace dédié au partage de vos œuvres, de vos musiques favorites et de vos inspirations.",
          imageUrl: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=800&q=80",
          createdBy: "system",
          createdAt: new Date(Date.now() - 1000).toISOString()
        }
      ];

      defaultRooms.forEach(async (r) => {
        try {
          await addDoc(collection(db, 'rooms'), r);
        } catch (err) {
          console.error("Erreur d'auto-seeding de salon :", err);
        }
      });
    }
  }, [loading, rooms.length]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError('');
    setUploadProgress(10);
    try {
      const result = await uploadToCloudinary(file, (progress) => {
        setUploadProgress(Math.max(10, progress));
      });
      setImageUrl(result.url);
    } catch (err) {
      console.error("Erreur de téléversement d'image", err);
      setError("Impossible d'importer l'image. Veuillez réessayer.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Le nom du salon est requis.");
      return;
    }
    if (!description.trim()) {
      setError("La description du salon est requise.");
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const newRoomData = {
        name: name.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim() || "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?auto=format&fit=crop&w=800&q=80",
        createdBy: user?.uid || 'anonymous',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'rooms'), newRoomData);
      
      setName('');
      setDescription('');
      setImageUrl('');
      setShowCreateModal(false);
    } catch (err: any) {
      setError("Erreur lors de la création du salon. Veuillez réessayer.");
      handleFirestoreError(err, OperationType.CREATE, 'rooms');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRoom = async (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Voulez-vous vraiment supprimer ce salon ? Tous ses messages resteront enregistrés mais le salon ne sera plus visible.")) {
      try {
        await deleteDoc(doc(db, 'rooms', roomId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'rooms');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">Salons de Discussion</h2>
          <p className="text-xs text-slate-400 mt-1">Rejoignez des salons thématiques ou créez le vôtre pour échanger.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-blue-900/20 shrink-0"
        >
          <Plus size={16} />
          Créer un salon
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
          {rooms.map((room) => {
            const isCreatedByMe = room.createdBy === user?.uid;
            return (
              <motion.div 
                key={room.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-slate-900 rounded-3xl border border-slate-800/80 shadow-lg hover:shadow-2xl hover:border-slate-700 transition-all overflow-hidden group flex flex-col relative"
              >
                {/* Image de couverture */}
                <div className="h-44 overflow-hidden relative shrink-0 border-b border-slate-800 bg-slate-950">
                  {room.imageUrl ? (
                    <img 
                      src={room.imageUrl} 
                      alt={room.name} 
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-900/30 to-indigo-950/30 flex items-center justify-center">
                      <MessageSquare size={48} className="text-slate-800" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent flex items-end p-5">
                    <h3 className="font-black text-xl text-white tracking-tight drop-shadow-sm">{room.name}</h3>
                  </div>

                  {/* Bouton de suppression du créateur */}
                  {isCreatedByMe && (
                    <button
                      onClick={(e) => handleDeleteRoom(room.id, e)}
                      className="absolute top-4 right-4 bg-slate-950/60 hover:bg-red-600/90 text-slate-300 hover:text-white p-2 rounded-xl transition-all shadow-md backdrop-blur-sm z-10"
                      title="Supprimer ce salon"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                
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
            );
          })}

          {rooms.length === 0 && (
            <div className="col-span-full text-center py-16 text-slate-500 bg-slate-900/20 border border-slate-900 rounded-3xl">
              <ShieldAlert size={40} className="mx-auto mb-3 opacity-20 text-slate-400" />
              <p className="text-sm">Aucun salon de discussion n'est disponible pour le moment.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal de création de salon */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setShowCreateModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-slate-900 border border-slate-800/80 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-800/60 flex items-center justify-between">
                <h3 className="font-black text-lg text-slate-100 tracking-tight">Créer un nouveau salon</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateRoomSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
                {error && (
                  <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-400 leading-normal">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Nom */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Nom du salon *</label>
                  <input
                    type="text"
                    placeholder="Ex: Passion Voyage, Tech & Web..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={40}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 text-sm placeholder-slate-600 text-slate-200 transition-all"
                    required
                  />
                  <div className="text-[10px] text-slate-500 text-right">{name.length}/40</div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Description *</label>
                  <textarea
                    placeholder="Décrivez en quelques mots le sujet de ce salon de discussion..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={150}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 text-sm placeholder-slate-600 text-slate-200 resize-none transition-all"
                    required
                  />
                  <div className="text-[10px] text-slate-500 text-right">{description.length}/150</div>
                </div>

                {/* Cover Image Upload */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">Image de couverture (Optionnelle)</label>
                  
                  {imageUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 h-32 group/image">
                      <img src={imageUrl} alt="Cover preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="bg-red-600 text-white font-bold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1 hover:bg-red-500 transition-colors shadow-md"
                        >
                          <X size={12} />
                          Retirer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full border border-dashed border-slate-800 hover:border-slate-700 hover:bg-slate-950/20 bg-slate-950/40 rounded-xl py-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-slate-400 hover:text-slate-300"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 size={24} className="animate-spin text-blue-500" />
                          <span className="text-xs">Téléversement de l'image ({uploadProgress}%)</span>
                        </>
                      ) : (
                        <>
                          <Image size={24} className="text-slate-500" />
                          <span className="text-xs font-medium">Importer une image</span>
                          <span className="text-[10px] text-slate-600">Recommandé : 800x450 px</span>
                        </>
                      )}
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-3 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    disabled={isSubmitting}
                    className="flex-1 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold text-sm py-3 rounded-xl transition-all disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isUploading}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-3 rounded-xl transition-all shadow-md shadow-blue-900/10 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Création...
                      </>
                    ) : (
                      "Créer le salon"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
