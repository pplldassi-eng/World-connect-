import React, { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, Post } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, addDoc, doc, updateDoc, arrayUnion, arrayRemove, increment, getDoc, deleteDoc } from 'firebase/firestore';
import { Globe, Plus, Image as ImageIcon } from 'lucide-react';
import { PostCard } from '../components/PostCard';
import { motion } from 'motion/react';

interface FeedPageProps {
  user: FirebaseUser;
  profile: UserProfile | null;
}

export const FeedPage: React.FC<FeedPageProps> = ({ user, profile }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostText, setNewPostText] = useState('');
  const [newPostImageUrl, setNewPostImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Écoute des posts en temps réel
  useEffect(() => {
    const postsQuery = query(
      collection(db, 'posts'), 
      orderBy('createdAt', 'desc'), 
      limit(50)
    );

    const unsubscribe = onSnapshot(postsQuery, (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
    });

    return unsubscribe;
  }, []);

  // Création d'un post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim() && !newPostImageUrl.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: profile?.name || user.displayName || 'Utilisateur',
        authorPhoto: profile?.photoURL || user.photoURL || '',
        text: newPostText,
        imageUrl: newPostImageUrl.trim() || null,
        likes: 0,
        likedBy: [],
        createdAt: new Date().toISOString()
      });
      setNewPostText('');
      setNewPostImageUrl('');
      setShowImageInput(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'posts');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Like d'un post
  const handleToggleLikePost = async (postId: string) => {
    const postRef = doc(db, 'posts', postId);
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const isLiked = post.likedBy?.includes(user.uid);
    try {
      await updateDoc(postRef, {
        likedBy: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
        likes: increment(isLiked ? -1 : 1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  // Commentaires
  const handleCreateComment = async (postId: string, text: string) => {
    try {
      await addDoc(collection(db, 'comments'), {
        postId,
        authorId: user.uid,
        authorName: profile?.name || user.displayName || 'Utilisateur',
        authorPhoto: profile?.photoURL || user.photoURL || '',
        text,
        likes: 0,
        likedBy: [],
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'comments');
    }
  };

  const handleUpdateComment = async (commentId: string, text: string) => {
    try {
      await updateDoc(doc(db, 'comments', commentId), { text });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `comments/${commentId}`);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteDoc(doc(db, 'comments', commentId));
    } catch (error) {
      // Import deleteDoc dynamically if needed or define it. We'll import deleteDoc from firestore.
    }
  };

  const handleToggleLikeComment = async (commentId: string) => {
    const commentRef = doc(db, 'comments', commentId);
    try {
      const snap = await getDoc(commentRef); // We can import getDoc
      if (!snap.exists()) return;
      const data = snap.data();
      const likedBy = data.likedBy || [];
      const isLiked = likedBy.includes(user.uid);
      
      await updateDoc(commentRef, {
        likedBy: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
        likes: increment(isLiked ? -1 : 1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `comments/${commentId}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">World Connect</h2>
          <p className="text-xs text-slate-400">Fil d'actualité mondial</p>
        </div>
        <div className="flex items-center text-blue-400 bg-blue-950/40 px-3 py-1.5 rounded-full border border-blue-900/40 text-xs font-semibold gap-1.5">
          <Globe size={14} className="animate-spin-slow" />
          <span>Global</span>
        </div>
      </header>

      {/* Post Creator */}
      <form onSubmit={handleCreatePost} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg shadow-black/10">
        <div className="flex items-start">
          <img 
            src={profile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
            className="w-10 h-10 rounded-full mr-3 border border-slate-800 bg-slate-900 object-cover shrink-0"
            referrerPolicy="no-referrer"
            alt={profile?.name || 'Moi'}
          />
          <div className="flex-1 min-w-0">
            <textarea 
              value={newPostText}
              onChange={(e) => setNewPostText(e.target.value)}
              placeholder="Que se passe-t-il dans votre monde ?"
              className="w-full bg-transparent border-none outline-none focus:ring-0 text-slate-100 placeholder-slate-500 resize-none py-2 text-sm"
              rows={3}
            />
            {showImageInput && (
              <input 
                type="url"
                value={newPostImageUrl}
                onChange={(e) => setNewPostImageUrl(e.target.value)}
                placeholder="Lien de l'image (https://...)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 mt-2 outline-none focus:border-blue-500"
              />
            )}
          </div>
        </div>
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800/80">
          <button 
            type="button" 
            onClick={() => setShowImageInput(!showImageInput)}
            className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800/40 rounded-xl transition-all"
            title="Ajouter une image"
          >
            <ImageIcon size={20} />
          </button>
          
          <button 
            type="submit"
            disabled={isSubmitting || (!newPostText.trim() && !newPostImageUrl.trim())}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-50 transition-all shadow-md shadow-blue-900/20"
          >
            {isSubmitting ? "Envoi..." : "Publier"}
          </button>
        </div>
      </form>

      {/* Posts List */}
      <div className="space-y-4">
        {posts.map(post => (
          <PostCard 
            key={post.id} 
            post={post} 
            currentUserId={user.uid}
            onLike={handleToggleLikePost}
            onComment={handleCreateComment}
            onDeleteComment={handleDeleteComment}
            onEditComment={handleUpdateComment}
            onLikeComment={handleToggleLikeComment}
          />
        ))}
        {posts.length === 0 && (
          <div className="text-center py-12 text-slate-500 bg-slate-900/40 border border-slate-900 rounded-2xl">
            <p className="text-sm">Aucun post disponible. Soyez le premier à publier !</p>
          </div>
        )}
      </div>
    </div>
  );
};
