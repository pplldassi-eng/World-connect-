// src/context/CallContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, updateDoc, onSnapshot, collection, query, where, deleteDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { agoraService } from '../lib/agora';

// --- Synthétiseur de Sonnerie Web Audio ---
class SoundManager {
  private audioCtx: AudioContext | null = null;
  private intervalId: any = null;

  init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playIncoming() {
    this.stop();
    try {
      this.init();
      if (!this.audioCtx) return;

      const playTone = () => {
        if (!this.audioCtx) return;
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        // Tonalités de sonnerie double agréable
        osc1.frequency.value = 440;
        osc2.frequency.value = 480;

        gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.25, this.audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.25, this.audioCtx.currentTime + 1.5);
        gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 1.8);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        osc1.start();
        osc2.start();

        osc1.stop(this.audioCtx.currentTime + 1.8);
        osc2.stop(this.audioCtx.currentTime + 1.8);
      };

      playTone();
      this.intervalId = setInterval(playTone, 3000);
    } catch (e) {
      console.warn("Échec du démarrage de la sonnerie entrante", e);
    }
  }

  playOutgoing() {
    this.stop();
    try {
      this.init();
      if (!this.audioCtx) return;

      const playTone = () => {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        // Tonalité de retour d'appel européenne (425Hz)
        osc.frequency.value = 425;

        gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.15, this.audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.15, this.audioCtx.currentTime + 1.2);
        gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 1.4);

        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 1.4);
      };

      playTone();
      this.intervalId = setInterval(playTone, 4000);
    } catch (e) {
      console.warn("Échec du démarrage de la sonnerie sortante", e);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

const soundManager = new SoundManager();

// --- Types pour les Appels ---
export interface CallSession {
  id: string; // channelId
  callerId: string;
  callerName: string;
  callerPhoto: string;
  receiverId: string;
  receiverName: string;
  receiverPhoto: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'accepted' | 'ended' | 'busy' | 'no_answer';
  createdAt: string;
}

interface CallContextType {
  activeCall: CallSession | null;
  isIncoming: boolean;
  isOutgoing: boolean;
  isMuted: boolean;
  isCamOff: boolean;
  isInCall: boolean;
  startCall: (receiverId: string, type: 'audio' | 'video', receiverName: string, receiverPhoto: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  callError: string | null;
  clearCallError: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ user: FirebaseUser | null; profile: UserProfile | null; children: React.ReactNode }> = ({ 
  user, 
  profile, 
  children 
}) => {
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [isIncoming, setIsIncoming] = useState(false);
  const [isOutgoing, setIsOutgoing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [isInCall, setIsInCall] = useState(false);

  // Refs pour éviter des fermetures obsolètes dans les closures
  const activeCallRef = useRef<CallSession | null>(null);
  activeCallRef.current = activeCall;

  const noAnswerTimeoutRef = useRef<any>(null);

  const clearCallError = () => setCallError(null);

  // 1. Écoute globale des appels entrants en temps réel
  useEffect(() => {
    if (!user?.uid) {
      setActiveCall(null);
      setIsIncoming(false);
      setIsOutgoing(false);
      return;
    }

    const callsQuery = query(
      collection(db, 'calls'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'ringing')
    );

    const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
      snapshot.docs.forEach(async (docSnap) => {
        const data = docSnap.data() as CallSession;
        
        // Si l'utilisateur est déjà occupé dans un autre appel
        if (activeCallRef.current && activeCallRef.current.id !== data.id) {
          try {
            await updateDoc(doc(db, 'calls', data.id), { status: 'busy' });
          } catch (e) {
            handleFirestoreError(e, OperationType.UPDATE, 'calls/' + data.id);
          }
          return;
        }

        // Sinon, c'est un appel entrant valide !
        setActiveCall(data);
        setIsIncoming(true);
        setIsOutgoing(false);
        soundManager.playIncoming();
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'calls');
    });

    return unsubscribe;
  }, [user?.uid]);

  // 2. Écoute en temps réel des changements d'état du document d'appel actif
  useEffect(() => {
    if (!activeCall?.id) return;

    const unsubscribe = onSnapshot(doc(db, 'calls', activeCall.id), async (docSnap) => {
      if (!docSnap.exists()) {
        // Le document a été supprimé brusquement
        handleCallTermination("Appel interrompu.", true);
        return;
      }

      const updatedCall = docSnap.data() as CallSession;
      
      // Mettre à jour les informations en local
      setActiveCall(updatedCall);

      if (updatedCall.status === 'accepted') {
        soundManager.stop();
        if (isOutgoing) {
          setIsOutgoing(false);
        }
      } else if (updatedCall.status === 'busy') {
        soundManager.stop();
        setCallError("L'utilisateur est actuellement occupé.");
        handleCallTermination(undefined, false);
      } else if (updatedCall.status === 'no_answer') {
        soundManager.stop();
        setCallError("Pas de réponse.");
        handleCallTermination(undefined, false);
      } else if (updatedCall.status === 'ended') {
        soundManager.stop();
        handleCallTermination("Appel terminé.", false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'calls/' + activeCall.id);
    });

    return unsubscribe;
  }, [activeCall?.id, isOutgoing]);

  // Nettoyer les ressources d'appel locaux
  const handleCallTermination = async (message?: string, skipDelete = false) => {
    soundManager.stop();
    if (noAnswerTimeoutRef.current) {
      clearTimeout(noAnswerTimeoutRef.current);
      noAnswerTimeoutRef.current = null;
    }

    const currentCallId = activeCallRef.current?.id;

    // Quitter Agora proprement
    await agoraService.leave();
    setIsInCall(false);
    
    // Supprimer le document d'appel Firestore
    if (currentCallId && !skipDelete && auth.currentUser) {
      try {
        await deleteDoc(doc(db, 'calls', currentCallId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'calls/' + currentCallId);
      }
    }

    setActiveCall(null);
    setIsIncoming(false);
    setIsOutgoing(false);
    setIsMuted(false);
    setIsCamOff(false);

    if (message) {
      console.log(message);
    }
  };

  // 2.b. Nettoyage à la fermeture de l'onglet
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      if (activeCallRef.current && auth.currentUser) {
        // Essayons de supprimer le doc pour éviter que l'autre partie ne reste bloquée
        try {
          // Utilisation de fetch ou simplement ne pas await
          deleteDoc(doc(db, 'calls', activeCallRef.current.id));
        } catch (err) {}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Rejoindre le canal Agora
  const joinAgoraChannel = async (channelId: string, type: 'audio' | 'video') => {
    try {
      await agoraService.joinAndPublish(channelId, type);
      setIsInCall(true);
      setIsMuted(false);
      setIsCamOff(false);
    } catch (err: any) {
      console.error("Échec de la connexion à l'appel Agora", err);
      setCallError(err.message || "Impossible d'établir la connexion d'appel.");
      await endCall();
    }
  };

  // 3. Passer un appel (Caller)
  const startCall = async (receiverId: string, type: 'audio' | 'video', receiverName: string, receiverPhoto: string) => {
    if (!user) return;
    setCallError(null);

    const channelId = [user.uid, receiverId].sort().join('_');
    const callDocRef = doc(db, 'calls', channelId);

    const callSession: CallSession = {
      id: channelId,
      callerId: user.uid,
      callerName: profile?.name || 'Citoyen Connecté',
      callerPhoto: profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
      receiverId,
      receiverName,
      receiverPhoto,
      type,
      status: 'ringing',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(callDocRef, callSession);
      setActiveCall(callSession);
      setIsOutgoing(true);
      setIsIncoming(false);
      soundManager.playOutgoing();

      // NEW: Joindre immédiatement le canal pour l'appelant
      await joinAgoraChannel(channelId, type);

      // Gérer la non-réponse après 35 secondes
      noAnswerTimeoutRef.current = setTimeout(async () => {
        if (activeCallRef.current && activeCallRef.current.status === 'ringing') {
          try {
            await updateDoc(callDocRef, { status: 'no_answer' });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, 'calls/' + channelId);
          }
        }
      }, 35000);

    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'calls/' + channelId);
      setCallError("Une erreur est survenue lors de la tentative d'appel.");
    }
  };

  // 4. Accepter un appel (Receiver)
  const acceptCall = async () => {
    if (!activeCall) return;
    soundManager.stop();
    setCallError(null);

    try {
      const callDocRef = doc(db, 'calls', activeCall.id);
      await updateDoc(callDocRef, { status: 'accepted' });
      
      setIsIncoming(false);
      await joinAgoraChannel(activeCall.id, activeCall.type);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'calls/' + activeCall.id);
      await rejectCall();
    }
  };

  // 5. Refuser un appel (Receiver)
  const rejectCall = async () => {
    if (!activeCall) return;
    soundManager.stop();
    try {
      const callDocRef = doc(db, 'calls', activeCall.id);
      await updateDoc(callDocRef, { status: 'ended' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'calls/' + activeCall.id);
    }
    await handleCallTermination(undefined, false);
  };

  // 6. Raccrocher / Terminer l'appel en cours (Caller ou Receiver)
  const endCall = async () => {
    if (!activeCall) return;
    soundManager.stop();
    try {
      const callDocRef = doc(db, 'calls', activeCall.id);
      await updateDoc(callDocRef, { status: 'ended' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'calls/' + activeCall.id);
    }
    await handleCallTermination(undefined, false);
  };

  // 7. Couper le micro
  const toggleMic = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    await agoraService.toggleMic(!nextMuted);
  };

  // 8. Activer / couper la caméra
  const toggleCamera = async () => {
    const nextCamOff = !isCamOff;
    setIsCamOff(nextCamOff);
    await agoraService.toggleCamera(!nextCamOff);
  };

  return (
    <CallContext.Provider value={{
      activeCall,
      isIncoming,
      isOutgoing,
      isMuted,
      isCamOff,
      isInCall,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMic,
      toggleCamera,
      callError,
      clearCallError
    }}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall doit être utilisé à l'intérieur d'un CallProvider");
  }
  return context;
};

