import React, { useState, useEffect } from 'react';
import { Post, PostComment } from '../types';
import { db } from '../firebase';
import { query, collection, where, orderBy, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Send } from 'lucide-react';
import { cn } from '../lib/utils';
import { CommentCard } from './CommentCard';
import { fr } from 'date-fns/locale';

interface PostCardProps {
  post: Post;
  currentUserId: string;
  onLike: (id: string) => void;
  onComment: (postId: string, text: string) => void;
  onDeleteComment: (id: string) => void;
  onEditComment: (id: string, text: string) => void;
  onLikeComment: (id: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({ 
  post, 
  currentUserId, 
  onLike, 
  onComment,
  onDeleteComment,
  onEditComment,
  onLikeComment
}) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<PostComment[]>([]);
  const isLiked = post.likedBy?.includes(currentUserId);

  useEffect(() => {
    if (!showComments) return;
    
    const q = query(
      collection(db, 'comments'), 
      where('postId', '==', post.id), 
      orderBy('createdAt', 'asc')
    );
    
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as PostComment)));
    }, (error) => {
      console.error("Error loading comments", error);
    });
    
    return unsub;
  }, [showComments, post.id]);

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onComment(post.id, commentText);
    setCommentText('');
  };

  const getFormattedTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: fr });
    } catch (e) {
      return "à l'instant";
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 mb-4 shadow-lg shadow-black/10 hover:border-slate-800 transition-all duration-300"
    >
      {/* Author Header */}
      <div className="flex items-center mb-3">
        <img 
          src={post.authorPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorId}`} 
          alt={post.authorName}
          className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 mr-3"
          referrerPolicy="no-referrer"
        />
        <div>
          <h4 className="font-semibold text-slate-100 text-sm leading-tight">{post.authorName}</h4>
          <p className="text-xs text-slate-500 mt-0.5">{getFormattedTime(post.createdAt)}</p>
        </div>
      </div>

      {/* Post Text */}
      <p className="text-slate-300 text-sm mb-4 whitespace-pre-wrap leading-relaxed">{post.text}</p>
      
      {/* Post Image (optional) */}
      {post.imageUrl && (
        <div className="rounded-xl overflow-hidden mb-4 border border-slate-800 bg-slate-950">
          <img 
            src={post.imageUrl} 
            alt="Contenu du post" 
            className="w-full object-cover max-h-96 hover:scale-[1.01] transition-transform duration-300" 
            referrerPolicy="no-referrer" 
          />
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center text-slate-400 border-t border-slate-800/60 pt-3 gap-6">
        <button 
          onClick={() => onLike(post.id)}
          className={cn(
            "flex items-center transition-all duration-200 gap-1.5 hover:text-red-500", 
            isLiked ? "text-red-500 scale-105" : ""
          )}
        >
          <Heart size={18} className={cn(isLiked && "fill-current text-red-500")} />
          <span className="text-xs font-semibold">{post.likes}</span>
        </button>
        <button 
          onClick={() => setShowComments(!showComments)}
          className={cn(
            "flex items-center transition-all duration-200 gap-1.5 hover:text-blue-400", 
            showComments ? "text-blue-400" : ""
          )}
        >
          <MessageCircle size={18} />
          <span className="text-xs font-semibold">
            {showComments ? "Masquer les commentaires" : "Commenter"}
          </span>
        </button>
      </div>

      {/* Comments Drawer / Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-slate-800/60">
              <div className="max-h-60 overflow-y-auto mb-4 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {comments.map(c => (
                  <CommentCard 
                    key={c.id} 
                    comment={c} 
                    currentUserId={currentUserId}
                    onLike={onLikeComment}
                    onDelete={onDeleteComment}
                    onEdit={onEditComment}
                  />
                ))}
                {comments.length === 0 && (
                  <p className="text-center text-xs text-slate-500 py-4 italic">Aucun commentaire pour le moment.</p>
                )}
              </div>
              
              <form onSubmit={handleSubmitComment} className="flex gap-2">
                <input 
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Écrire un commentaire..."
                  className="flex-1 bg-slate-800 text-slate-200 border border-slate-700 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder-slate-500"
                />
                <button 
                  type="submit"
                  disabled={!commentText.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl disabled:opacity-50 transition-colors flex items-center justify-center shrink-0"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
