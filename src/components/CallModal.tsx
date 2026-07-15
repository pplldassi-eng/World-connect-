// src/components/CallModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCall } from '../context/CallContext';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, User, Volume2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { agoraService } from '../lib/agora';

export const CallModal: React.FC = () => {
  const {
    activeCall,
    isIncoming,
    isOutgoing,
    isMuted,
    isCamOff,
    isInCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleCamera,
    callError
  } = useCall();

  const remotePlayerRef = useRef<HTMLDivElement>(null);
  const localPlayerRef = useRef<HTMLDivElement>(null);

  const [remoteVideoTrack, setRemoteVideoTrack] = useState<any>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);

  // Subscribe to Agora track modifications reactively
  useEffect(() => {
    setRemoteVideoTrack(agoraService.remoteVideoTrack);
    setLocalVideoTrack(agoraService.localVideoTrack);

    const unsubscribe = agoraService.subscribeTracks(() => {
      setRemoteVideoTrack(agoraService.remoteVideoTrack);
      setLocalVideoTrack(agoraService.localVideoTrack);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const isVideo = activeCall?.type === 'video';
  const isConnected = activeCall?.status === 'accepted';

  // Play remote video track
  useEffect(() => {
    if (isConnected && isVideo && remoteVideoTrack && remotePlayerRef.current) {
      try {
        remoteVideoTrack.play(remotePlayerRef.current);
      } catch (err) {
        console.warn("Error rendering remote track:", err);
      }
    }
  }, [isConnected, isVideo, remoteVideoTrack]);

  // Play local video track
  useEffect(() => {
    if (isConnected && isVideo && localVideoTrack && !isCamOff && localPlayerRef.current) {
      try {
        localVideoTrack.play(localPlayerRef.current);
      } catch (err) {
        console.warn("Error rendering local track:", err);
      }
    }
  }, [isConnected, isVideo, localVideoTrack, isCamOff]);

  if (!activeCall) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
        
        {/* Conteneur d'appel principal */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative w-full h-full flex flex-col justify-between overflow-hidden"
        >
          
          {/* Bannière d'erreur */}
          {callError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600/95 border border-red-500 text-white px-4 py-3 rounded-2xl text-xs font-bold shadow-xl z-50 animate-bounce flex items-center gap-2">
              <span>⚠️</span>
              <span>{callError}</span>
            </div>
          )}

          {/* 1. ÉTAT CONNECTÉ : APPEL VIDÉO */}
          {isConnected && isVideo && (
            <div className="absolute inset-0 w-full h-full bg-slate-950 z-0">
              {/* Flux Vidéo Principal (Remote) - Plein écran */}
              <div 
                ref={remotePlayerRef}
                id="remote-player" 
                className="absolute inset-0 w-full h-full bg-black object-cover [&>div]:object-cover" 
              />

              {/* Rendu visuel d'attente (si pas de vidéo distante reçue) */}
              {!remoteVideoTrack && (
                <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-slate-900/95 text-slate-400 gap-4 z-10 pointer-events-none">
                  <motion.div 
                    animate={{ scale: [1, 1.05, 1] }} 
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-24 h-24 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden"
                  >
                    {activeCall.receiverPhoto ? (
                      <img 
                        src={activeCall.receiverPhoto} 
                        alt="Correspondant" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User size={40} className="text-slate-500" />
                    )}
                  </motion.div>
                  <span className="text-sm font-semibold tracking-wide animate-pulse text-white/80">En attente de la vidéo...</span>
                </div>
              )}

              {/* Flux Vidéo Secondaire (Local) */}
              <div 
                ref={localPlayerRef}
                id="local-player" 
                className={cn(
                  "absolute top-6 right-6 w-32 h-48 bg-black overflow-hidden rounded-2xl border-2 border-slate-700/50 shadow-2xl z-20 transition-all [&>div]:object-cover",
                  isCamOff ? "opacity-0 pointer-events-none" : "opacity-100"
                )} 
              />
            </div>
          )}

          {/* 2. ÉTAT APPEL AUDIO OU NON ENCORE CONNECTÉ */}
          {(!isConnected || !isVideo) && (
            <div className="absolute inset-0 w-full h-full bg-slate-900/90 flex flex-col items-center justify-center p-6 z-0">
              
              <div className="relative flex items-center justify-center mb-12">
                {(isIncoming || isOutgoing || !isConnected) && (
                  <>
                    <motion.div 
                      animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: 'easeOut' }}
                      className="absolute w-40 h-40 rounded-full border-2 border-blue-500/20"
                    />
                    <motion.div 
                      animate={{ scale: [1, 1.8, 1], opacity: [0.2, 0, 0.2] }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: 'easeOut', delay: 0.8 }}
                      className="absolute w-40 h-40 rounded-full border-2 border-blue-500/10"
                    />
                  </>
                )}
                
                <div className="w-32 h-32 rounded-full border-4 border-slate-700/80 overflow-hidden shadow-2xl relative z-10 bg-slate-800 flex items-center justify-center">
                  {isIncoming ? (
                    activeCall.callerPhoto ? (
                      <img src={activeCall.callerPhoto} alt="Caller" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User size={56} className="text-slate-500" />
                    )
                  ) : (
                    activeCall.receiverPhoto ? (
                      <img src={activeCall.receiverPhoto} alt="Receiver" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User size={56} className="text-slate-500" />
                    )
                  )}
                </div>
              </div>

              <div className="text-center space-y-3 z-10">
                <h3 className="text-3xl font-black text-white tracking-tight drop-shadow-md">
                  {isIncoming ? activeCall.callerName : activeCall.receiverName}
                </h3>
                
                <p className="text-base font-semibold tracking-wide text-slate-400 capitalize">
                  {activeCall.status === 'ringing' && (isIncoming ? "Appel entrant..." : "Appel en cours...")}
                  {activeCall.status === 'accepted' && "Appel connecté"}
                  {activeCall.status === 'busy' && "Utilisateur occupé"}
                  {activeCall.status === 'no_answer' && "Pas de réponse"}
                  {activeCall.status === 'ended' && "Appel terminé"}
                </p>
              </div>

              <div className="mt-8 px-5 py-2.5 bg-slate-800/60 rounded-full border border-slate-700/50 flex items-center gap-2.5 text-slate-300 z-10 text-sm shadow-sm">
                {isVideo ? <Video size={16} className="text-blue-400" /> : <Volume2 size={16} className="text-green-400" />}
                <span className="font-bold tracking-wider uppercase">
                  {isVideo ? "Vidéoconférence 1-1" : "Appel Audio 1-1"}
                </span>
              </div>
            </div>
          )}

          {/* 3. BARRE DE CONTRÔLES / ACTIONS */}
          <div className="absolute bottom-0 w-full p-8 pb-12 flex flex-col items-center gap-6 bg-gradient-to-t from-black via-slate-900/80 to-transparent z-30">
            
            {/* Cas 1: Appel entrant */}
            {isIncoming && activeCall.status === 'ringing' ? (
              <div className="flex items-center gap-16">
                <button
                  onClick={rejectCall}
                  className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 text-white flex items-center justify-center transition-all shadow-xl shadow-red-900/40 hover:scale-105"
                  title="Refuser l'appel"
                >
                  <PhoneOff size={28} className="rotate-135" />
                </button>

                <button
                  onClick={acceptCall}
                  className="w-20 h-20 rounded-full bg-green-600 hover:bg-green-500 active:bg-green-700 text-white flex items-center justify-center transition-all shadow-xl shadow-green-900/50 hover:scale-110 relative"
                  title="Répondre"
                >
                  <span className="absolute inset-0 rounded-full border-4 border-green-500/30 animate-ping" />
                  <Phone size={32} />
                </button>
              </div>
            ) : (
              /* Cas 2: Appel connecté ou sortant */
              <div className="flex items-center gap-8 bg-slate-900/80 backdrop-blur-md px-10 py-5 rounded-full border border-slate-700/50 shadow-2xl">
                
                {isConnected && (
                  <button
                    onClick={toggleMic}
                    className={cn(
                      "w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all hover:scale-105 active:scale-95",
                      isMuted 
                        ? "bg-slate-200 border-slate-200 text-slate-900" 
                        : "bg-slate-800/80 border-slate-600 text-white hover:bg-slate-700"
                    )}
                    title={isMuted ? "Réactiver le micro" : "Couper le micro"}
                  >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  </button>
                )}

                <button
                  onClick={endCall}
                  className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 text-white flex items-center justify-center transition-all shadow-xl shadow-red-900/50 hover:scale-105"
                  title="Raccrocher"
                >
                  <PhoneOff size={32} />
                </button>

                {isConnected && isVideo && (
                  <button
                    onClick={toggleCamera}
                    className={cn(
                      "w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all hover:scale-105 active:scale-95",
                      isCamOff 
                        ? "bg-slate-200 border-slate-200 text-slate-900" 
                        : "bg-slate-800/80 border-slate-600 text-white hover:bg-slate-700"
                    )}
                    title={isCamOff ? "Activer la caméra" : "Couper la caméra"}
                  >
                    {isCamOff ? <VideoOff size={24} /> : <Video size={24} />}
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
