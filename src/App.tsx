import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInAnonymously, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  User as FirebaseUser,
  ConfirmationResult
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  getDocFromServer 
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { UserProfile } from './types';
import { Globe, LogOut, CheckCircle2 } from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// Components & Pages
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';
import { FeedPage } from './pages/FeedPage';
import { ExplorePage } from './pages/ExplorePage';
import { MessagesPage } from './pages/MessagesPage';
import { RoomsPage } from './pages/RoomsPage';
import { RoomChatPage } from './pages/RoomChatPage';
import { ProfilePage } from './pages/ProfilePage';
import { CallProvider } from './context/CallContext';
import { CallModal } from './components/CallModal';
import { PermissionModal } from './components/PermissionModal';
import { requestPermissionsOnce } from './lib/agora';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Core navigation state
  const [selectedChatUser, setSelectedChatUser] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Ask for permissions implicitly on boot if not already done
  useEffect(() => {
    requestPermissionsOnce();
  }, []);

  // Authentication UI forms
  const [authMode, setAuthMode] = useState<'google' | 'email' | 'phone' | 'guest'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // Handle Authentication status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        if (!localStorage.getItem('permissionsGranted')) {
          setShowPermissionModal(true);
        }

        // Fetch or create user profile document in Firestore
        const docRef = doc(db, 'users', u.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: u.uid,
              name: u.displayName || u.email?.split('@')[0] || u.phoneNumber || 'Citoyen du Monde',
              email: u.email || '',
              phoneNumber: u.phoneNumber || '',
              photoURL: u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`,
              createdAt: new Date().toISOString(),
              interests: [],
              country: '',
              city: '',
              bio: ''
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          console.warn("Firestore offline ou inaccessible. Utilisation d'un profil hors ligne temporaire.", error);
          const fallbackProfile: UserProfile = {
            uid: u.uid,
            name: u.displayName || u.email?.split('@')[0] || u.phoneNumber || 'Citoyen du Monde',
            email: u.email || '',
            phoneNumber: u.phoneNumber || '',
            photoURL: u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`,
            createdAt: new Date().toISOString(),
            interests: [],
            country: '',
            city: '',
            bio: '',
            isOnline: false
          };
          setProfile(fallbackProfile);
        }
      } else {
        setProfile(null);
      }
      setIsAuthReady(true);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Presence Logic (Online / Offline state tracking)
  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    
    const setOnline = async () => {
      try {
        await updateDoc(userRef, {
          isOnline: true,
          lastSeen: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Visibility update: setOnline failed", e);
      }
    };

    const setOffline = async () => {
      try {
        await updateDoc(userRef, {
          isOnline: false,
          lastSeen: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Visibility update: setOffline failed", e);
      }
    };

    setOnline();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setOnline();
      } else {
        setOffline();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', setOffline);

    return () => {
      setOffline();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', setOffline);
    };
  }, [user]);

  // Connection testing to log server reachability
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.warn("Please check your Firebase configuration or network status.");
        }
      }
    }
    testConnection();
  }, []);

  // Sign-in methods
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Google login failed", error);
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible'
      });
    }
  };

  const handlePhoneSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setupRecaptcha();
    const appVerifier = (window as any).recaptchaVerifier;
    try {
      const result = await signInWithPhoneNumber(auth, phone, appVerifier);
      setConfirmationResult(result);
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    if (!confirmationResult) return;
    try {
      await confirmationResult.confirm(otp);
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Profile update handler to instantly synchronize local state with doc changes
  const handleProfileLocalUpdate = (updatedData: Partial<UserProfile>) => {
    setProfile(prev => prev ? { ...prev, ...updatedData } : null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center overflow-y-auto">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8"
        >
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-2xl mb-4 mx-auto hover:rotate-12 transition-transform duration-300">
            <Globe size={40} className="animate-pulse" />
          </div>
          <h1 className="text-3xl font-black mb-1 tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            World Connect
          </h1>
          <p className="text-slate-400 max-w-xs mx-auto text-xs mt-1.5 leading-relaxed">
            Connectez vos cœurs et vos esprits au-delà de toutes les frontières.
          </p>
        </motion.div>
        
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl w-full max-w-sm">
          {/* Auth Switcher */}
          <div className="flex mb-6 bg-slate-950 p-1 rounded-xl overflow-x-auto gap-1">
            {['google', 'email', 'phone', 'guest'].map((mode) => (
              <button 
                key={mode}
                onClick={() => {
                  setAuthMode(mode as any);
                  setAuthError('');
                }}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-[10px] font-bold transition-all capitalize whitespace-nowrap", 
                  authMode === mode 
                    ? "bg-slate-800 text-blue-400 shadow-md" 
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                {mode === 'phone' ? 'Tél' : mode === 'guest' ? 'Invité' : mode}
              </button>
            ))}
          </div>

          {authError && (
            <p className="text-red-500 text-xs mb-4 text-center bg-red-950/20 border border-red-900/30 p-2.5 rounded-xl">
              {authError}
            </p>
          )}

          {authMode === 'google' && (
            <button 
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-900/10 transition-all flex items-center justify-center disabled:opacity-50"
            >
              {authLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <img src="https://www.google.com/favicon.ico" className="w-4 h-4 mr-2" />
                  Se connecter avec Google
                </>
              )}
            </button>
          )}

          {authMode === 'guest' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">Aucun compte requis. Lancez-vous directement !</p>
              <button 
                onClick={handleGuestSignIn}
                disabled={authLoading}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3.5 rounded-xl font-bold transition-all flex items-center justify-center disabled:opacity-50 gap-2"
              >
                {authLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Globe size={18} className="text-blue-400" />
                    Continuer en Invité
                  </>
                )}
              </button>
            </div>
          )}

          {authMode === 'email' && (
            <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
              <input 
                type="email" 
                placeholder="Adresse email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 text-sm placeholder-slate-600 text-slate-200"
                required
              />
              <input 
                type="password" 
                placeholder="Mot de passe" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 text-sm placeholder-slate-600 text-slate-200"
                required
              />
              <div className="flex gap-2 pt-1">
                <button 
                  type="button"
                  onClick={handleEmailSignIn}
                  disabled={authLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-bold text-xs disabled:opacity-50 flex items-center justify-center transition-colors"
                >
                  {authLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : "Connexion"}
                </button>
                <button 
                  type="button"
                  onClick={handleEmailSignUp}
                  disabled={authLoading}
                  className="flex-1 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-850 py-2.5 rounded-xl font-bold text-xs disabled:opacity-50 flex items-center justify-center transition-all"
                >
                  {authLoading ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div> : "Créer Compte"}
                </button>
              </div>
            </form>
          )}

          {authMode === 'phone' && (
            <div className="space-y-3">
              {!confirmationResult ? (
                <form onSubmit={handlePhoneSignIn} className="space-y-3">
                  <input 
                    type="tel" 
                    placeholder="Ex: +33612345678" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 text-sm placeholder-slate-600 text-slate-200"
                    required
                  />
                  <button 
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-bold text-xs disabled:opacity-50 flex items-center justify-center transition-colors"
                  >
                    {authLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : "Envoyer le code"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  <input 
                    type="text" 
                    placeholder="Code de vérification" 
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 text-sm placeholder-slate-600 text-slate-200"
                    required
                  />
                  <button 
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-bold text-xs disabled:opacity-50 flex items-center justify-center transition-colors"
                  >
                    {authLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : "Vérifier le code"}
                  </button>
                </form>
              )}
            </div>
          )}
          <div id="recaptcha-container" className={cn(authMode === 'phone' ? "block" : "hidden")}></div>
        </div>
        
        <p className="mt-8 text-slate-600 text-[10px] tracking-wide">
          En vous inscrivant, vous acceptez de vous connecter au niveau mondial.
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <CallProvider user={user} profile={profile}>
        <div className="min-h-screen bg-slate-950 text-slate-100 pb-24 md:pb-0 md:pl-20">
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onNavigate={() => {
            // Optionnellement nettoyer les sélections lors de la navigation navbar
            if (activeTab !== 'messages') setSelectedChatUser(null);
            if (activeTab !== 'rooms') setSelectedRoomId(null);
          }}
        />
        
        <main className="max-w-2xl mx-auto px-4 pt-6 md:pt-8">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <FeedPage user={user} profile={profile} />
              </motion.div>
            )}

            {activeTab === 'explore' && (
              <motion.div 
                key="explore"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <ExplorePage 
                  user={user} 
                  onSelectChatUser={(uid) => {
                    setSelectedChatUser(uid);
                    setActiveTab('messages');
                  }} 
                />
              </motion.div>
            )}

            {activeTab === 'messages' && (
              <motion.div 
                key="messages"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <MessagesPage 
                  user={user} 
                  selectedChatUser={selectedChatUser} 
                  setSelectedChatUser={setSelectedChatUser} 
                />
              </motion.div>
            )}

            {activeTab === 'rooms' && (
              <motion.div 
                key="rooms"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <RoomsPage 
                  user={user}
                  profile={profile}
                  onJoinRoom={(roomId) => {
                    setSelectedRoomId(roomId);
                    setActiveTab('room_chat');
                  }} 
                />
              </motion.div>
            )}

            {activeTab === 'room_chat' && selectedRoomId && (
              <motion.div 
                key="room_chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <RoomChatPage 
                  user={user} 
                  profile={profile} 
                  roomId={selectedRoomId} 
                  onBack={() => {
                    setSelectedRoomId(null);
                    setActiveTab('rooms');
                  }} 
                />
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <ProfilePage 
                  user={user} 
                  profile={profile} 
                  onProfileUpdate={handleProfileLocalUpdate} 
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
      <CallModal />
      <PermissionModal isOpen={showPermissionModal} onClose={() => setShowPermissionModal(false)} />
      </CallProvider>
    </ErrorBoundary>
  );
}
