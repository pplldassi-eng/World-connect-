import React, { useState, useEffect, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, Room, RoomMessage } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, collection, query, where, orderBy, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';
import { Send, ChevronLeft, Users, Hash, Paperclip, Mic, Square, Loader2, X, Video, Trash } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { compressImageFile, validateVideoFile, validateVideoDuration } from '../utils/media';
import { uploadToCloudinary } from '../lib/cloudinary';


interface RoomChatPageProps {
  user: FirebaseUser;
  profile: UserProfile | null;
  roomId: string;
  onBack: () => void;
}

export const RoomChatPage: React.FC<RoomChatPageProps> = ({ 
  user, 
  profile, 
  roomId, 
  onBack 
}) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [onlineCount, setOnlineCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // États pour l'envoi de médias
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Annuler le téléversement en cours (simulé car l'upload continue en fond, on l'ignore juste côté UI)
  const cancelUpload = () => {
    setUploading(false);
    setUploadProgress(null);
  };

  // Charger les détails du salon en temps réel
  useEffect(() => {
    if (!roomId) return;
    const roomRef = doc(db, 'rooms', roomId);
    
    const unsubscribe = onSnapshot(roomRef, (snap) => {
      if (snap.exists()) {
        setRoom({ id: snap.id, ...snap.data() } as Room);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `rooms/${roomId}`);
    });

    return unsubscribe;
  }, [roomId]);

  // Charger les messages du salon en temps réel
  useEffect(() => {
    if (!roomId) return;
    const messagesQuery = query(
      collection(db, 'room_messages'),
      where('roomId', '==', roomId)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snap) => {
      const fetchedMessages = snap.docs.map(d => ({ id: d.id, ...d.data() } as RoomMessage));
      // Trier chronologiquement (du plus ancien au plus récent) en mémoire pour éviter d'exiger un index composite
      fetchedMessages.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      });
      setMessages(fetchedMessages);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'room_messages');
      setLoading(false);
    });

    return unsubscribe;
  }, [roomId]);

  // Scroller vers le bas automatiquement
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Suivi en temps réel des utilisateurs connectés (en ligne)
  useEffect(() => {
    const onlineQuery = query(
      collection(db, 'users'),
      where('isOnline', '==', true)
    );

    const unsubscribe = onSnapshot(onlineQuery, (snap) => {
      setOnlineCount(snap.size);
    }, (error) => {
      console.warn("Erreur comptage utilisateurs en ligne", error);
    });

    return unsubscribe;
  }, []);

  // Gestion du téléversement d'une image
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Veuillez sélectionner uniquement une image.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Compression de l'image via browser-image-compression
      const compressedFile = await compressImageFile(file);

      const result = await uploadToCloudinary(compressedFile, (progress) => {
        setUploadProgress(progress);
      });
      
      try {
        await addDoc(collection(db, 'room_messages'), {
          roomId,
          senderId: user.uid,
          senderName: profile?.name || user.displayName || 'Citoyen',
          senderPhoto: profile?.photoURL || user.photoURL || '',
          text: '[Image]',
          type: 'image',
          url: result.url,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'room_messages');
      }
    } catch (err: any) {
      console.error("Erreur d'upload image:", err);
      alert(err.message || "Echec de l'upload.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Gestion du téléversement d'une vidéo
  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        await addDoc(collection(db, 'room_messages'), {
          roomId,
          senderId: user.uid,
          senderName: profile?.name || user.displayName || 'Citoyen',
          senderPhoto: profile?.photoURL || user.photoURL || '',
          text: '[Vidéo]',
          type: 'video',
          url: result.url,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'room_messages');
      }
    } catch (err: any) {
      console.error("Erreur d'upload vidéo:", err);
      alert(err.message || "Echec de l'upload.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Démarrer l'enregistrement audio (message vocal)
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

  // Gestion du téléversement de l'audio
  const uploadAudio = async (blob: Blob) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      const result = await uploadToCloudinary(blob, (progress) => {
        setUploadProgress(progress);
      });
      
      try {
        await addDoc(collection(db, 'room_messages'), {
          roomId,
          senderId: user.uid,
          senderName: profile?.name || user.displayName || 'Citoyen',
          senderPhoto: profile?.photoURL || user.photoURL || '',
          text: '[Message Vocal]',
          type: 'audio',
          url: result.url,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'room_messages');
      }
    } catch (err: any) {
      console.error("Erreur d'upload audio:", err);
      alert(err.message || "Echec de l'upload audio.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Envoyer un message dans le salon
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;

    const textToSend = newMessageText.trim();
    setNewMessageText(''); // vider l'input instantanément pour une sensation fluide

    try {
      await addDoc(collection(db, 'room_messages'), {
        roomId,
        senderId: user.uid,
        senderName: profile?.name || user.displayName || 'Citoyen',
        senderPhoto: profile?.photoURL || user.photoURL || '',
        text: textToSend,
        type: 'text',
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'room_messages');
    }
  };

  // Supprimer un message du salon thématique
  const handleDeleteMessage = async (messageId: string) => {
    if (window.confirm("Voulez-vous vraiment supprimer ce message ?")) {
      try {
        await deleteDoc(doc(db, 'room_messages', messageId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'room_messages');
      }
    }
  };

  const getFormattedTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: fr });
    } catch (e) {
      return "à l'instant";
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] flex flex-col bg-slate-900 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between shrink-0">
        <div className="flex items-center min-w-0">
          <button 
            onClick={onBack} 
            className="mr-3 p-2 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all shrink-0"
            title="Retour aux salons"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="relative mr-3 shrink-0 hidden sm:block">
            {room?.imageUrl ? (
              <img 
                src={room.imageUrl} 
                className="w-10 h-10 rounded-xl border border-slate-800 object-cover"
                referrerPolicy="no-referrer"
                alt={room.name}
              />
            ) : (
              <div className="w-10 h-10 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center text-blue-400">
                <Hash size={18} />
              </div>
            )}
          </div>
          
          <div className="min-w-0">
            <h4 className="font-bold text-slate-100 text-sm truncate leading-none flex items-center gap-2">
              {room?.name || 'Chargement...'}
            </h4>
            <p className="text-[10px] text-slate-400 mt-1.5 truncate flex items-center gap-1.5">
              <span>{room?.description || 'Salon thématique World Connect'}</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-green-400 font-bold">{onlineCount} {onlineCount > 1 ? 'en ligne' : 'en ligne'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center text-slate-400 gap-1.5 bg-slate-800/40 px-3 py-1.5 rounded-xl border border-slate-800/50 text-xs font-semibold shrink-0">
          <Users size={14} className="text-blue-400" />
          <span className="hidden xs:inline">Salon public</span>
        </div>
      </div>

      {/* Zone de chat */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 bg-slate-900/20">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user.uid;
            return (
              <div 
                key={msg.id}
                className={cn(
                  "flex items-start gap-3 max-w-[85%]",
                  isMe ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                {!isMe && (
                  <img 
                    src={msg.senderPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`} 
                    className="w-8 h-8 rounded-full border border-slate-800 bg-slate-800 shrink-0 object-cover mt-1"
                    referrerPolicy="no-referrer"
                    alt={msg.senderName}
                  />
                )}
                
                <div className="flex flex-col">
                  {!isMe && (
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-xs font-bold text-slate-300">{msg.senderName}</span>
                      <span className="text-[9px] text-slate-500">{getFormattedTime(msg.createdAt)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 group">
                    <div 
                      className={cn(
                        "p-3 rounded-2xl text-sm leading-relaxed break-words shadow-md",
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
                  {isMe && (
                    <span className="text-[9px] text-slate-500 mt-1 self-end px-1">{getFormattedTime(msg.createdAt)}</span>
                  )}
                </div>
              </div>
            );
          })
        )}

        {messages.length === 0 && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12 text-center">
            <Hash size={36} className="text-slate-700 mb-2 animate-bounce" />
            <p className="text-xs italic">Début du salon. Envoyez le premier message ! 🚀</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
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
            placeholder={recording ? "Enregistrement vocal en cours..." : `Échanger sur #${room?.name || 'salon'}...`}
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
  );
};
