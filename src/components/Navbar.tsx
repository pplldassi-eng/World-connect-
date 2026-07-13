import React from 'react';
import { 
  Home, 
  Search, 
  MessageSquare, 
  Users, 
  User, 
  LogOut 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNavigate?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onNavigate }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Accueil' },
    { id: 'explore', icon: Search, label: 'Explorer' },
    { id: 'messages', icon: MessageSquare, label: 'Messages' },
    { id: 'rooms', icon: Users, label: 'Salons' },
    { id: 'profile', icon: User, label: 'Profil' },
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-4 py-2 flex justify-around items-center z-50 md:top-0 md:bottom-auto md:left-0 md:right-auto md:flex-col md:w-20 md:h-full md:border-t-0 md:border-r">
      {/* Brand logo (desktop only) */}
      <div className="hidden md:flex mb-8 mt-4">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">W</div>
      </div>

      {/* Tabs */}
      <div className="flex justify-around w-full md:flex-col md:gap-4 md:items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id || (tab.id === 'rooms' && activeTab === 'room_chat');
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "flex flex-col items-center p-2.5 rounded-xl transition-all duration-200",
                isActive 
                  ? "text-blue-500 bg-slate-800/80 shadow-md shadow-black/10" 
                  : "text-slate-400 hover:text-blue-400 hover:bg-slate-800/30"
              )}
            >
              <Icon size={24} />
              <span className="text-[10px] mt-1 font-medium md:hidden">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sign out (desktop only) */}
      <div className="hidden md:flex mt-auto mb-4">
        <button 
          onClick={() => signOut(auth)} 
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-950/20 rounded-xl transition-colors"
          title="Se déconnecter"
        >
          <LogOut size={24} />
        </button>
      </div>
    </nav>
  );
};
