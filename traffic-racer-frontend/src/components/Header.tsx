"use client";
import { motion } from 'framer-motion';
import { Zap, LogOut, Wallet, Menu } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

export default function Header() {
 const { isAuthenticated, username, balance, logout } = useStore();
 const router = useRouter();

 const handleLogout = () => {
  logout();
  router.push('/auth');
 };

 return (
  <header className="fixed top-0 w-full z-50 glass-card border-b border-white/10 px-4 md:px-6 py-3 flex justify-between items-center h-16">

   {/* LOGO SECTION - UPDATED TO JUNGLE BET */}
   <div
    className="flex items-center gap-2 cursor-pointer group" 
    onClick={() => router.push('/')}
   >
    <Zap className="text-[var(--jungle-green)] fill-current transition-transform group-hover:scale-110" size={28} />
    <span className="font-bold text-xl tracking-tighter uppercase italic text-white">
     Jungle<span className="text-[var(--jungle-green)] not-italic ml-1">Bet</span>
    </span>
   </div>

   {/* RIGHT SIDE ACTIONS */}
   <div className="flex items-center gap-3 md:gap-6">

    {isAuthenticated ? (
      <>
       {/* Balance Display */}
       <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="hidden sm:flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-[var(--jungle-green)]/30 shadow-[0_0_10px_rgba(204,255,0,0.1)]"
       >
        <Wallet size={16} className="text-[var(--jungle-green)]" />
        <span className="font-mono font-bold text-sm text-white tabular-nums">
         ${balance.toFixed(2)}
        </span>
       </motion.div>

       {/* Mobile Balance Icon Only */}
       <div className="sm:hidden p-2 bg-black/40 rounded-full border border-white/10">
        <Wallet size={18} className="text-[var(--jungle-green)]" />
       </div>

       {/* Logout Button */}
       <button
        onClick={handleLogout}
        className="p-2 hover:bg-red-500/20 rounded-full transition-colors group"
       >
        <LogOut size={20} className="group-hover:text-red-400 transition-colors" />
       </button>
      </>
     ):(
      /* LOGIN BUTTON - FIXED VISIBILITY */
      <button
       onClick={() => router.push('/auth')}
       className="bg-[var(--jungle-green)] text-black font-extrabold px-5 py-2 rounded-full hover:shadow-[0_0_15px_var(--jungle-green)] hover:scale-105 transition-all active:scale-95 border-none outline-none"
      >
       JOIN NOW
      </button>
     )}
    </div>
   </header>
 );  
}    

 
