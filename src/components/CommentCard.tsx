import React, { useState } from 'react';
import { PostComment } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { Heart, Edit2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { fr } from 'date-fns/locale';

interface CommentCardProps {
  comment: PostComment;
  currentUserId: string;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
}

export const CommentCard: React.FC<CommentCardProps> = ({ 
  comment, 
  currentUserId, 
  onLike, 
  onDelete, 
  onEdit 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const isAuthor = comment.authorId === currentUserId;
  const isLiked = comment.likedBy?.includes(currentUserId);

  const handleSave = () => {
    if (!editText.trim()) return;
    onEdit(comment.id, editText);
    setIsEditing(false);
  };

  const getFormattedTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: fr });
    } catch (e) {
      return "à l'instant";
    }
  };

  return (
    <div className="bg-slate-800/40 border border-slate-800/60 rounded-xl p-3 mb-2 group transition-all hover:bg-slate-800/80">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center">
          <img 
            src={comment.authorPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.authorId}`} 
            className="w-6 h-6 rounded-full mr-2 border border-slate-700 bg-slate-800"
            referrerPolicy="no-referrer"
            alt={comment.authorName}
          />
          <span className="text-xs font-bold text-slate-200">{comment.authorName}</span>
          <span className="text-[10px] text-slate-500 ml-2">{getFormattedTime(comment.createdAt)}</span>
        </div>
        {isAuthor && !isEditing && (
          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => setIsEditing(true)} 
              className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
              title="Modifier"
            >
              <Edit2 size={12} />
            </button>
            <button 
              onClick={() => onDelete(comment.id)} 
              className="p-1 text-slate-400 hover:text-red-400 transition-colors"
              title="Supprimer"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
      
      {isEditing ? (
        <div className="mt-2">
          <textarea 
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            rows={2}
          />
          <div className="flex justify-end space-x-2 mt-1">
            <button 
              onClick={() => setIsEditing(false)} 
              className="text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              Annuler
            </button>
            <button 
              onClick={handleSave} 
              className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition-colors"
            >
              Enregistrer
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-300 whitespace-pre-wrap">{comment.text}</p>
      )}

      <div className="flex items-center mt-2">
        <button 
          onClick={() => onLike(comment.id)}
          className={cn(
            "flex items-center text-[10px] transition-colors gap-1", 
            isLiked ? "text-red-500" : "text-slate-400 hover:text-red-500"
          )}
        >
          <Heart size={10} className={cn(isLiked && "fill-current text-red-500")} />
          <span>{comment.likes || 0}</span>
        </button>
      </div>
    </div>
  );
};
