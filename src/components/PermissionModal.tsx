import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Video, Image as ImageIcon, Bell, ShieldCheck } from 'lucide-react';

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({ isOpen, onClose }) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [denied, setDenied] = useState(false);

  const requestPermissions = async () => {
    setIsRequesting(true);
    let allGranted = true;

    try {
      // Demander l'accès au micro et à la caméra
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      // Arrêter immédiatement les pistes pour ne pas garder la caméra/micro actifs
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.warn("Permissions média refusées ou indisponibles:", error);
      allGranted = false;
    }

    try {
      // Demander l'accès aux notifications
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          allGranted = false;
        }
      }
    } catch (error) {
      console.warn("Erreur de demande de notifications:", error);
      allGranted = false;
    }

    // L'accès à la galerie/fichiers est géré nativement par les input file,
    // on l'inclut juste dans l'explication visuelle.

    // On mémorise qu'on a fait la demande pour ne plus harceler l'utilisateur
    localStorage.setItem('permissionsGranted', 'true');
    setIsRequesting(false);

    if (allGranted) {
      onClose();
    } else {
      setDenied(true);
      // Ferme la modale après quelques secondes pour laisser le temps de lire
      setTimeout(() => onClose(), 3500);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative flex flex-col"
          >
            <div className="p-8 pb-6 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg shadow-blue-500/10">
                <ShieldCheck size={32} />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Autoriser World Connect</h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Pour utiliser les appels et envoyer des médias, World Connect a besoin d'accéder à :
              </p>
            </div>

            <div className="px-8 space-y-4 mb-8">
              <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-green-400 shrink-0">
                  <Mic size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Microphone</h4>
                  <p className="text-xs text-slate-500">Pour les appels audio</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-blue-400 shrink-0">
                  <Video size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Caméra</h4>
                  <p className="text-xs text-slate-500">Pour les appels vidéo</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-purple-400 shrink-0">
                  <ImageIcon size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Galerie</h4>
                  <p className="text-xs text-slate-500">Pour envoyer des photos et vidéos</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-yellow-400 shrink-0">
                  <Bell size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Notifications</h4>
                  <p className="text-xs text-slate-500">Pour recevoir des appels</p>
                </div>
              </div>
            </div>

            <div className="p-6 pt-0 mt-auto flex flex-col gap-3 border-t border-slate-800/50">
              {denied && (
                <motion.p 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  className="text-xs font-semibold text-yellow-500 text-center mb-2 px-2"
                >
                  Certaines permissions ont été refusées. Vous pouvez les activer plus tard dans les paramètres.
                </motion.p>
              )}
              
              <button
                onClick={requestPermissions}
                disabled={isRequesting || denied}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {isRequesting ? 'Demande en cours...' : (denied ? 'Fermeture...' : 'Continuer')}
              </button>
              
              {!isRequesting && !denied && (
                <button
                  onClick={() => {
                    localStorage.setItem('permissionsGranted', 'true');
                    onClose();
                  }}
                  className="w-full bg-transparent text-slate-400 hover:text-slate-200 font-medium py-3 rounded-2xl transition-all"
                >
                  Plus tard
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
