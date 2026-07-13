export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phoneNumber?: string;
  photoURL?: string;
  country?: string;
  city?: string;
  bio?: string;
  interests?: string[];
  createdAt: string;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  text: string;
  imageUrl?: string;
  likes: number;
  likedBy?: string[];
  createdAt: string;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  text: string;
  createdAt: string;
  likes: number;
  likedBy?: string[];
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: string;
  type?: 'text' | 'image' | 'audio';
  url?: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  discordLink?: string;
}

export interface RoomMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  createdAt: string;
  type?: 'text' | 'image' | 'audio';
  url?: string;
}
