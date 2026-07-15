import React, { useState, useEffect, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, Message } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, where, or, and, doc, deleteDoc } from 'firebase/firestore';
import { Send, ChevronLeft, MessageSquare, History, Paperclip, Mic, Square, Loader2, X, Video, Trash, Phone } from 'lucide-react';
import { cn } from '../lib/utils';
import { useCall } from '../context/CallContext';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { compressImageFile, validateVideoFile, validateVideoDuration } from '../utils/media';
import { uploadToCloudinary } from '../lib/cloudinary';

interface MessagesPageProps {
  user: FirebaseUser;
  selectedChatUser: string | null;
  setSelectedChatUser: (uid: string | null) => void;
}

export const MessagesPage: React.FC<MessagesPageProps> = ({ 
  user, 
  selectedChatUser, 
  setSelectedChatUser 
}) => {
  const { startCall } = useCall();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [messageLimit, setMessageLimit] = useState(20);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // États pour l'envoi de médias
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Annuler le téléversement de média (simulé)
  const cancelUpload = () => {
    setUploading(false);
    setUploadProgress(null);
  };

  // Charger la liste des utilisateurs
  useEffect(() => {
    const usersQuery = query(collection(db, 'users'), limit(100));
    
    const unsubscribe = onSnapshot(usersQuery, (snap) => {
      setUsers(
        snap.docs
          .map(d => d.data() as UserProfile)
          .filter(p => p.uid !== user.uid)
      );
      setLoadingUsers(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoadingUsers(false);
    });

    return unsubscribe;
  }, [user.uid]);

  // Charger les messages en temps réel avec pagination (sans index composite Firestore requis !)
  useEffect(() => {
    if (!selectedChatUser) {
      setMessages([]);
      return;
    }

    // Requête sans orderBy pour éviter d'exiger la création d'un index composite
    const msgQuery = query(
      collection(db, 'messages'),
      or(
        and(where('senderId', '==', user.uid), where('receiverId', '==', selectedChatUser)),
        and(where('senderId', '==', selectedChatUser), where('receiverId', '==', user.uid))
      ),
      limit(200) // Récupère un lot de messages récents à trier côté client
    );

    const unsubscribe = onSnapshot(msgQuery, (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      // Trier chronologiquement (du plus vieux au plus récent)
      fetched.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      });
      // Slicing pour respecter la pagination demandée par l'utilisateur (afficher les N derniers)
      const sliced = fetched.slice(-messageLimit);
      setMessages(sliced);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return unsubscribe;
  }, [user.uid, selectedChatUser, messageLimit]);

  // Scroller automatiquement vers le bas lors de la réception de nouveaux messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Réinitialiser la limite de messages lors du changement d'interlocuteur
  useEffect(() => {
    setMessageLimit(20);
  }, [selectedChatUser]);

  // Gestion du téléversement d'une image en message privé
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedChatUser) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Veuillez sélectionner uniquement une image.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Compression de l'image
      const compressedFile = await compressImageFile(file);

      const result = await uploadToCloudinary(compressedFile, (progress) => {
        setUploadProgress(progress);
      });
      
      try {
        await addDoc(collection(db, 'messages'), {
          senderId: user.uid,
          receiverId: selectedChatUser,
          text: '[Image]',
          type: 'image',
          url: result.url,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'messages');
      }
    } catch (err: any) {
      console.error("Erreur d'upload image:", err);
      alert(err.message || "Echec de l'upload ou compression.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Gestion du téléversement d'une vidéo
  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedChatUser) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert("Veuillez sélectionner uniquement une vidéo.");
      return;
    }

    if (!validateVideoFile(file)) {
      alert("La vidéo est trop volumineuse (max 5MB).");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const isDurationValid = await validateVideoDuration(file);
    if (!isDurationValid) {
      alert("La vidéo est trop longue (max 15s).");
      setUploading(false);
      setUploadProgress(null);
      return;
    }

    try {
      const result = await uploadToCloudinary(file, (progress) => {
        setUploadProgress(progress);
      });
      
      try {
        await addDoc(collection(db, 'messages'), {
          senderId: user.uid,
          receiverId: selectedChatUser,
          text: '[Vidéo]',
          type: 'video',
          url: result.url,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'messages');
      }
    } catch (err: any) {
      console.error("Erreur d'upload vidéo:", err);
      alert(err.message || "Echec de l'upload de la vidéo.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Démarrer l'enregistrement audio (message privé vocal)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await uploadAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (err) {
      console.error("Erreur d'accès au micro", err);
      alert("Impossible d'accéder au microphone.");
    }
  };

  // Arrêter l'enregistrement audio
  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  // Gestion du téléversement de l'audio en privé
  const uploadAudio = async (blob: Blob) => {
    if (!selectedChatUser) return;
    setUploading(true);
    setUploadProgress(0);

    try {
      const result = await uploadToCloudinary(blob, (progress) => {
        setUploadProgress(progress);
      });
      
      try {
        await addDoc(collection(db, 'messages'), {
          senderId: user.uid,
          receiverId: selectedChatUser,
          text: '[Message Vocal]',
          type: 'audio',
          url: result.url,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'messages');
      }
    } catch (err: any) {
      console.error("Erreur d'upload audio:", err);
      alert(err.message || "Echec de l'upload audio.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Envoi d'un message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChatUser || !newMessageText.trim()) return;

    const textToSend = newMessageText.trim();
    setNewMessageText(''); // vider instantanément pour fluidité

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: user.uid,
        receiverId: selectedChatUser,
        text: textToSend,
        type: 'text',
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  // Charger plus de messages
  const handleLoadMore = () => {
    setMessageLimit(prev => prev + 20);
  };

  // Supprimer un message privé
  const handleDeleteMessage = async (messageId: string) => {
    if (window.confirm("Voulez-vous vraiment supprimer ce message ?")) {
      try {
        await deleteDoc(doc(db, 'messages', messageId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'messages');
      }
    }
  };

  // Trouver l'utilisateur sélectionné
  const chatUser = users.find(u => u.uid === selectedChatUser);

  const getFormattedTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { locale: fr });
    } catch (e) {
      return "récemment";
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] flex flex-col">
      {!selectedChatUser ? (
        // Liste des chats
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="mb-6 shrink-0">
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">Messages Directs</h2>
            <p className="text-xs text-slate-400 mt-1">Échanges privés avec vos contacts mondiaux.</p>
          </header>

          {loadingUsers ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
              {users.map(u => (
                <button 
                  key={u.uid}
                  onClick={() => setSelectedChatUser(u.uid)}
                  className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 p-4 rounded-2xl flex items-center transition-all duration-300 text-left group shadow-lg shadow-black/5"
                >
                  <div className="relative shrink-0 mr-4">
                    <img 
                      src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                      className="w-12 h-12 rounded-full border border-slate-800 bg-slate-800 object-cover" 
                      referrerPolicy="no-referrer"
                      alt={u.name}
                    />
                    {u.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-slate-900 rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-200 text-sm group-hover:text-blue-400 transition-colors">{u.name}</h4>
                    <p className="text-xs text-slate-500 mt-1 truncate">
                      {u.isOnline ? "En ligne" : `Hors ligne • vu il y a ${getFormattedTime(u.lastSeen || '')}`}
                    </p>
                  </div>
                  <div className="ml-auto p-2 bg-slate-800/40 rounded-xl text-slate-400 group-hover:text-blue-400 transition-colors">
                    <MessageSquare size={16} />
                  </div>
                </button>
              ))}

              {users.length === 0 && (
                <div className="text-center py-16 text-slate-500 bg-slate-900/20 border border-slate-900 rounded-2xl">
                  <p className="text-sm">Aucun utilisateur disponible pour le moment.</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        // Fenêtre de discussion active
        <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center shrink-0">
            <button 
              onClick={() => setSelectedChatUser(null)} 
              className="mr-3 p-2 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
              title="Retour à la liste"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="relative mr-3 shrink-0">
              <img 
                src={chatUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedChatUser}`} 
                className="w-10 h-10 rounded-full border border-slate-800 object-cover"
                referrerPolicy="no-referrer"
                alt={chatUser?.name || 'Chat'}
              />
              {chatUser?.isOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></div>
              )}
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-slate-100 text-sm truncate leading-none">
                {chatUser?.name || 'Utilisateur'}
              </h4>
              <p className="text-[10px] text-slate-400 mt-1.5 truncate">
                {chatUser?.isOnline 
                  ? 'En ligne maintenant' 
                  : chatUser?.lastSeen 
                    ? `Dernière connexion il y a ${getFormattedTime(chatUser.lastSeen)}`
                    : 'Hors ligne'}
              </p>
            </div>

            {/* Boutons d'Appels Audio / Vidéo 1-1 */}
            {chatUser && (
              <div className="ml-auto flex items-center gap-2">
                {/* Appel Audio */}
                <button
                  onClick={() => startCall(
                    chatUser.uid, 
                    'audio', 
                    chatUser.name, 
                    chatUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chatUser.uid}`
                  )}
                  className="p-2.5 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-green-400 rounded-xl transition-all active:scale-95 border border-slate-800"
                  title="Appel Audio"
                >
                  <Phone size={17} />
                </button>

                {/* Appel Vidéo */}
                <button
                  onClick={() => startCall(
                    chatUser.uid, 
                    'video', 
                    chatUser.name, 
                    chatUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chatUser.uid}`
                  )}
                  className="p-2.5 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-blue-400 rounded-xl transition-all active:scale-95 border border-slate-800"
                  title="Appel Vidéo"
                >
                  <Video size={17} />
                </button>
              </div>
            )}
          </div>
          
          {/* Zone de Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
            {/* Bouton Charger Plus (Pagination) */}
            {messages.length >= messageLimit && (
              <div className="flex justify-center py-2">
                <button 
                  onClick={handleLoadMore}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-800/50 hover:bg-slate-800 text-blue-400 hover:text-blue-300 text-xs font-semibold rounded-full border border-slate-800 transition-all shadow-md shadow-black/10"
                >
                  <History size={12} />
                  <span>Charger les messages précédents (20+)</span>
                </button>
              </div>
            )}

            {messages.map(msg => {
              const isMe = msg.senderId === user.uid;
              return (
                <div 
                  key={msg.id}
                  className={cn(
                    "flex items-center gap-2 group max-w-[85%]",
                    isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  <div 
                    className={cn(
                      "p-3.5 rounded-2xl text-sm leading-relaxed shadow-md break-words max-w-full",
                      isMe 
                        ? "bg-blue-600 text-white rounded-tr-none shadow-blue-900/10" 
                        : "bg-slate-800 text-slate-200 rounded-tl-none shadow-black/5"
                    )}
                  >
                    {msg.type === 'image' && msg.url ? (
                      <div className="space-y-1">
                        <img 
                          src={msg.url} 
                          alt="Image partagée" 
                          className="max-w-full sm:max-w-xs rounded-xl shadow border border-slate-700/50 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(msg.url, '_blank')}
                        />
                        {msg.text && msg.text !== '[Image]' && <p className="mt-1">{msg.text}</p>}
                      </div>
                    ) : msg.type === 'video' && msg.url ? (
                      <div className="space-y-1 py-1">
                        <video src={msg.url} controls className="max-w-full sm:max-w-xs rounded-xl shadow border border-slate-700/50" />
                        {msg.text && msg.text !== '[Vidéo]' && <p className="mt-1">{msg.text}</p>}
                      </div>
                    ) : msg.type === 'audio' && msg.url ? (
                      <div className="space-y-1 py-1">
                        <audio src={msg.url} controls className="max-w-full sm:max-w-xs rounded-lg accent-blue-500" />
                        {msg.text && msg.text !== '[Message Vocal]' && <p className="mt-1">{msg.text}</p>}
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                  {isMe && (
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800/80 rounded-lg shrink-0"
                      title="Supprimer ce message"
                    >
                      <Trash size={14} />
                    </button>
                  )}
                </div>
              );
            })}

            {messages.length === 0 && (
              <div className="text-center py-16 text-slate-500 italic text-xs">
                Aucun message pour l'instant. Dites bonjour ! 👋
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Formulaire d'Envoi */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-950/20 flex flex-col gap-2 shrink-0">
            <AnimatePresence>
              {uploading && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-slate-800/80 border border-slate-700/50 p-2.5 rounded-xl flex items-center justify-between gap-3 text-xs text-blue-400 overflow-hidden"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Loader2 size={14} className="animate-spin text-blue-500 shrink-0" />
                    <span className="truncate">Téléversement ({uploadProgress}%)...</span>
                  </div>
                  <div className="flex-1 bg-slate-950 h-1.5 rounded-full overflow-hidden">
                    <motion.div 
                      className="bg-blue-500 h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress || 0}%` }}
                      transition={{ ease: "easeOut", duration: 0.2 }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={cancelUpload}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-950/40 border border-red-800/30 text-red-400 hover:bg-red-900/40 transition-colors text-[10px] font-medium shrink-0"
                  >
                    <X size={10} />
                    <span>Annuler</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-2">
              {/* Input fichier caché (Image) */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />

              {/* Input fichier caché (Vidéo) */}
              <input 
                type="file" 
                ref={videoInputRef} 
                onChange={handleVideoChange} 
                accept="video/mp4,video/webm,video/ogg" 
                className="hidden" 
              />

              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || recording}
                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all hover:text-white disabled:opacity-50 shrink-0 flex items-center justify-center border border-slate-700/60"
                title="Envoyer une image"
              >
                <Paperclip size={18} />
              </button>

              <button 
                type="button"
                onClick={() => videoInputRef.current?.click()}
                disabled={uploading || recording}
                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all hover:text-white disabled:opacity-50 shrink-0 flex items-center justify-center border border-slate-700/60"
                title="Envoyer une vidéo (max 15s, 5MB)"
              >
                <Video size={18} />
              </button>

              <button 
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={uploading}
                className={cn(
                  "p-3 rounded-xl transition-all shrink-0 flex items-center justify-center border",
                  recording 
                    ? "bg-red-600 border-red-500 text-white animate-pulse" 
                    : "bg-slate-800 hover:bg-slate-700 border-slate-700/60 text-slate-300 hover:text-white disabled:opacity-50"
                )}
                title={recording ? "Arrêter l'enregistrement" : "Enregistrer un message vocal"}
              >
                {recording ? <Square size={18} /> : <Mic size={18} />}
              </button>

              <input 
                type="text"
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                disabled={recording}
                placeholder={recording ? "Enregistrement vocal en cours..." : "Rédiger votre message..."}
                className="flex-1 bg-slate-800 text-slate-100 border border-slate-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 placeholder-slate-500"
              />

              <button 
                type="submit"
                disabled={!newMessageText.trim() || recording || uploading}
                className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl disabled:opacity-50 transition-all shrink-0 flex items-center justify-center shadow-md shadow-blue-900/20"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
