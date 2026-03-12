export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  country?: string;
  city?: string;
  bio?: string;
  interests?: string[];
  createdAt: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  text: string;
  imageUrl?: string;
  likes: number;
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  discordLink?: string;
}
