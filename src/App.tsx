import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, db 
} from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  doc, 
  getDoc,
  where,
  limit,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  Home, 
  Search, 
  MessageSquare, 
  Users, 
  User, 
  LogOut, 
  Plus, 
  Heart, 
  Globe, 
  MapPin, 
  MessageCircle,
  Hash,
  Send,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from './lib/utils';
import { UserProfile, Post, Message, Room } from './types';

// --- Components ---

const Navbar = ({ activeTab, setActiveTab, user }: { activeTab: string, setActiveTab: (t: string) => void, user: FirebaseUser | null }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'explore', icon: Search, label: 'Explore' },
    { id: 'messages', icon: MessageSquare, label: 'Messages' },
    { id: 'rooms', icon: Users, label: 'Rooms' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-blue-100 px-4 py-2 flex justify-around items-center z-50 md:top-0 md:bottom-auto md:flex-col md:w-20 md:h-full md:border-t-0 md:border-r">
      <div className="hidden md:flex mb-8 mt-4">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">W</div>
      </div>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            "flex flex-col items-center p-2 rounded-xl transition-all duration-200",
            activeTab === tab.id ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:text-blue-400"
          )}
        >
          <tab.icon size={24} />
          <span className="text-[10px] mt-1 font-medium md:hidden">{tab.label}</span>
        </button>
      ))}
      <div className="hidden md:flex mt-auto mb-4">
        <button onClick={() => signOut(auth)} className="p-2 text-slate-400 hover:text-red-500">
          <LogOut size={24} />
        </button>
      </div>
    </nav>
  );
};

const PostCard = ({ post }: { post: Post }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-blue-50 rounded-2xl p-4 mb-4 shadow-sm"
    >
      <div className="flex items-center mb-3">
        <img 
          src={post.authorPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorId}`} 
          alt={post.authorName}
          className="w-10 h-10 rounded-full bg-blue-100 mr-3"
          referrerPolicy="no-referrer"
        />
        <div>
          <h4 className="font-semibold text-slate-900">{post.authorName}</h4>
          <p className="text-xs text-slate-400">{formatDistanceToNow(new Date(post.createdAt))} ago</p>
        </div>
      </div>
      <p className="text-slate-700 mb-4 whitespace-pre-wrap">{post.text}</p>
      {post.imageUrl && (
        <img src={post.imageUrl} className="rounded-xl w-full mb-4 object-cover max-h-96" referrerPolicy="no-referrer" />
      )}
      <div className="flex items-center text-slate-400 border-t border-blue-50 pt-3">
        <button className="flex items-center mr-6 hover:text-blue-600 transition-colors">
          <Heart size={18} className="mr-1" />
          <span className="text-sm">{post.likes}</span>
        </button>
        <button className="flex items-center hover:text-blue-600 transition-colors">
          <MessageCircle size={18} className="mr-1" />
          <span className="text-sm">Reply</span>
        </button>
      </div>
    </motion.div>
  );
};

const UserCard = ({ profile, onMessage }: { profile: UserProfile, onMessage: (uid: string) => void }) => {
  return (
    <div className="bg-white border border-blue-50 rounded-2xl p-4 flex items-center shadow-sm hover:shadow-md transition-shadow">
      <img 
        src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.uid}`} 
        className="w-14 h-14 rounded-full mr-4 bg-blue-50"
        referrerPolicy="no-referrer"
      />
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-slate-900 truncate">{profile.name}</h4>
        <div className="flex items-center text-xs text-slate-500 mt-1">
          <Globe size={12} className="mr-1" />
          <span>{profile.country || 'Global Citizen'}</span>
          {profile.city && <span className="mx-1">• {profile.city}</span>}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {profile.interests?.slice(0, 3).map(interest => (
            <span key={interest} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-medium">
              {interest}
            </span>
          ))}
        </div>
      </div>
      <button 
        onClick={() => onMessage(profile.uid)}
        className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors ml-2"
      >
        <MessageSquare size={18} />
      </button>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Data states
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChatUser, setSelectedChatUser] = useState<string | null>(null);

  // Form states
  const [newPostText, setNewPostText] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch or create profile
        const docRef = doc(db, 'users', u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: u.uid,
            name: u.displayName || 'New User',
            email: u.email || '',
            photoURL: u.photoURL || '',
            createdAt: new Date().toISOString(),
            interests: [],
            country: '',
            city: '',
            bio: ''
          };
          await setDoc(docRef, newProfile);
          setProfile(newProfile);
        }
      }
      setIsAuthReady(true);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Connection test
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Real-time listeners
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
    const unsubPosts = onSnapshot(postsQuery, (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
    });

    const usersQuery = query(collection(db, 'users'), limit(100));
    const unsubUsers = onSnapshot(usersQuery, (snap) => {
      setUsers(snap.docs.map(d => d.data() as UserProfile).filter(p => p.uid !== user.uid));
    });

    const roomsQuery = query(collection(db, 'rooms'));
    const unsubRooms = onSnapshot(roomsQuery, (snap) => {
      // Seed rooms if empty
      if (snap.empty) {
        const defaultRooms = [
          { name: 'Africa Room', description: 'Culture et actualités Africaines', discordLink: '#' },
          { name: 'Travel Room', description: 'Conseils voyage', discordLink: '#' },
          { name: 'Entrepreneur Room', description: 'Business et opportunités', discordLink: '#' },
          { name: 'Language Exchange', description: 'Apprendre des langues', discordLink: '#' }
        ];
        defaultRooms.forEach(r => addDoc(collection(db, 'rooms'), r));
      }
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as Room)));
    });

    return () => {
      unsubPosts();
      unsubUsers();
      unsubRooms();
    };
  }, [isAuthReady, user]);

  // Messages listener
  useEffect(() => {
    if (!user || !selectedChatUser) return;
    
    const msgQuery = query(
      collection(db, 'messages'),
      where('senderId', 'in', [user.uid, selectedChatUser]),
      where('receiverId', 'in', [user.uid, selectedChatUser]),
      orderBy('createdAt', 'asc')
    );
    
    const unsub = onSnapshot(msgQuery, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    });
    
    return unsub;
  }, [user, selectedChatUser]);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPostText.trim()) return;

    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: profile?.name || user.displayName,
        authorPhoto: profile?.photoURL || user.photoURL,
        text: newPostText,
        likes: 0,
        createdAt: new Date().toISOString()
      });
      setNewPostText('');
    } catch (error) {
      console.error("Post failed", error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedChatUser || !newMessageText.trim()) return;

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: user.uid,
        receiverId: selectedChatUser,
        text: newMessageText,
        createdAt: new Date().toISOString()
      });
      setNewMessageText('');
    } catch (error) {
      console.error("Message failed", error);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.country?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.interests?.some(i => i.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [users, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-blue-600 flex flex-col items-center justify-center p-6 text-white text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8"
        >
          <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center text-blue-600 shadow-2xl mb-6 mx-auto">
            <Globe size={48} />
          </div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">World Connect</h1>
          <p className="text-blue-100 max-w-xs mx-auto">Connecting hearts and minds across every border.</p>
        </motion.div>
        
        <button 
          onClick={handleSignIn}
          className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-bold text-lg shadow-xl hover:bg-blue-50 transition-all active:scale-95 flex items-center"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5 mr-3" />
          Join with Google
        </button>
        
        <p className="mt-12 text-blue-200 text-sm">
          By joining, you agree to connect globally.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0 md:pl-20">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} user={user} />
      
      <main className="max-w-2xl mx-auto px-4 pt-6">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <header className="mb-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900">Feed</h2>
                <div className="flex items-center text-blue-600 font-medium">
                  <Globe size={18} className="mr-1" />
                  <span>Global</span>
                </div>
              </header>

              <form onSubmit={handleCreatePost} className="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-blue-50">
                <div className="flex items-start">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                    className="w-10 h-10 rounded-full mr-3"
                    referrerPolicy="no-referrer"
                  />
                  <textarea 
                    value={newPostText}
                    onChange={(e) => setNewPostText(e.target.value)}
                    placeholder="What's happening in your world?"
                    className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 resize-none py-2"
                    rows={3}
                  />
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
                  <div className="flex space-x-2">
                    <button type="button" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Plus size={20} />
                    </button>
                  </div>
                  <button 
                    type="submit"
                    disabled={!newPostText.trim()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold disabled:opacity-50 hover:bg-blue-700 transition-colors"
                  >
                    Post
                  </button>
                </div>
              </form>

              <div className="space-y-4">
                {posts.map(post => (
                  <div key={post.id}>
                    <PostCard post={post} />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'explore' && (
            <motion.div 
              key="explore"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <header className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Explore</h2>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, country or interest..."
                    className="w-full bg-white border border-blue-100 rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-sm"
                  />
                </div>
              </header>

              <div className="grid gap-4">
                {filteredUsers.map(u => (
                  <div key={u.uid}>
                    <UserCard 
                      profile={u} 
                      onMessage={(uid) => {
                        setSelectedChatUser(uid);
                        setActiveTab('messages');
                      }} 
                    />
                  </div>
                ))}
                {filteredUsers.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Search size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No users found matching your search.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'messages' && (
            <motion.div 
              key="messages"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-[calc(100vh-8rem)] flex flex-col"
            >
              {!selectedChatUser ? (
                <>
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">Messages</h2>
                  <div className="space-y-2 overflow-y-auto">
                    {users.map(u => (
                      <button 
                        key={u.uid}
                        onClick={() => setSelectedChatUser(u.uid)}
                        className="w-full bg-white p-4 rounded-2xl flex items-center border border-blue-50 hover:border-blue-200 transition-all shadow-sm"
                      >
                        <img src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} className="w-12 h-12 rounded-full mr-4" referrerPolicy="no-referrer" />
                        <div className="text-left">
                          <h4 className="font-bold text-slate-900">{u.name}</h4>
                          <p className="text-xs text-slate-400">Click to start chatting</p>
                        </div>
                        <ChevronRight className="ml-auto text-slate-300" size={20} />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-blue-50 overflow-hidden">
                  <div className="p-4 border-b border-blue-50 flex items-center">
                    <button onClick={() => setSelectedChatUser(null)} className="mr-3 text-slate-400 hover:text-blue-600">
                      <ChevronRight className="rotate-180" size={24} />
                    </button>
                    <img 
                      src={users.find(u => u.uid === selectedChatUser)?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedChatUser}`} 
                      className="w-8 h-8 rounded-full mr-3"
                      referrerPolicy="no-referrer"
                    />
                    <h4 className="font-bold text-slate-900">
                      {users.find(u => u.uid === selectedChatUser)?.name || 'Chat'}
                    </h4>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map(msg => (
                      <div 
                        key={msg.id}
                        className={cn(
                          "max-w-[80%] p-3 rounded-2xl text-sm",
                          msg.senderId === user.uid 
                            ? "bg-blue-600 text-white ml-auto rounded-tr-none" 
                            : "bg-slate-100 text-slate-800 rounded-tl-none"
                        )}
                      >
                        {msg.text}
                      </div>
                    ))}
                    {messages.length === 0 && (
                      <div className="text-center py-12 text-slate-300 italic">
                        No messages yet. Say hello!
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendMessage} className="p-4 border-t border-blue-50 flex gap-2">
                    <input 
                      type="text"
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button 
                      type="submit"
                      disabled={!newMessageText.trim()}
                      className="bg-blue-600 text-white p-2 rounded-xl disabled:opacity-50"
                    >
                      <Send size={20} />
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'rooms' && (
            <motion.div 
              key="rooms"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Discussion Rooms</h2>
              <div className="grid gap-4">
                {rooms.map(room => (
                  <div key={room.id} className="bg-white p-6 rounded-2xl border border-blue-50 shadow-sm hover:border-blue-200 transition-all">
                    <div className="flex items-center mb-3">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mr-4">
                        <Hash size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{room.name}</h3>
                        <p className="text-sm text-slate-500">{room.description}</p>
                      </div>
                    </div>
                    <button className="w-full mt-4 bg-blue-50 text-blue-600 py-3 rounded-xl font-bold hover:bg-blue-600 hover:text-white transition-all">
                      Join Discussion
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="bg-white rounded-3xl p-8 border border-blue-50 shadow-sm text-center mb-6">
                <div className="relative inline-block mb-6">
                  <img 
                    src={profile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                    className="w-32 h-32 rounded-full border-4 border-white shadow-xl bg-blue-50"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-1 right-1 bg-blue-600 text-white p-2 rounded-full shadow-lg">
                    <User size={16} />
                  </div>
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-2">{profile?.name}</h2>
                <p className="text-slate-500 mb-6 flex items-center justify-center">
                  <MapPin size={16} className="mr-1" />
                  {profile?.city ? `${profile.city}, ` : ''}{profile?.country || 'Global Citizen'}
                </p>
                
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <div className="font-bold text-slate-900">{posts.filter(p => p.authorId === user.uid).length}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Posts</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <div className="font-bold text-slate-900">1.2k</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Followers</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <div className="font-bold text-slate-900">842</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Following</div>
                  </div>
                </div>

                <div className="text-left mb-8">
                  <h4 className="font-bold text-slate-900 mb-2">Bio</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {profile?.bio || "No bio yet. Tell the world about yourself!"}
                  </p>
                </div>

                <div className="text-left mb-8">
                  <h4 className="font-bold text-slate-900 mb-2">Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {profile?.interests?.length ? profile.interests.map(i => (
                      <span key={i} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">#{i}</span>
                    )) : (
                      <span className="text-slate-400 text-sm italic">Add some interests to find like-minded people.</span>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => signOut(auth)}
                  className="w-full py-4 border border-red-100 text-red-500 rounded-2xl font-bold hover:bg-red-50 transition-all flex items-center justify-center"
                >
                  <LogOut size={20} className="mr-2" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
