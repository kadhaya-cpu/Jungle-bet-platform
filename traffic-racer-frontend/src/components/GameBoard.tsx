"use client";
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Volume2, Settings, TrendingUp, WifiOff, Trophy, Skull } from 'lucide-react';
import { useStore } from '@/lib/store';
import axios from 'axios'; // Ensure axios is imported
import CelebrationOverlay from './CelebrationOverlay'; // Import our new component

export default function GameBoard() {
 const { balance, placeBet, isAuthenticated, token, fetchBalance } = useStore();

 // STATE FOR LIVE DATA (Now via Polling instead of SSE)
 const [currentCount, setCurrentCount] = useState(0);
 const [roadName, setRoadName] = useState("North Ring Road, Lyon");
 const [isConnected, setIsConnected] = useState(false); // Simulated connection status

 const [selectedChip, setSelectedChip] = useState(100);

 // SIMULATE CONNECTION & POLLING LOGIC
 useEffect(() => {
  if (!isAuthenticated || !token) return;

  // Mark as connected after short delay
  setTimeout(() => setIsConnected(true), 500);

  // POLLING INTERVAL: Check history every 3 seconds for resolved bets
  const interval = setInterval(async () => {
   try {
     const res = await axios.get('http://localhost:8000/bets/history', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const history = res.data.history || [];
    if (history.length > 0) { 
      const latestBet = history[0]; // Most recent bet

      // If the latest bet was just resolved (not pending anymore)
      if (latestBet.status !== 'pending') {
        // Dispatch Custom Event for Celebration Overlay
        window.dispatchEvent(new CustomEvent('jungle-celebrate', {
         detail: {
          type: latestBet.status === 'won' ? 'win' : 'loss',
          amount: latestBet.status === 'won' 
           ? parseFloat(latestBet.resolution_data?.payout || 0)
           : latestBet.amount
         }
       }));

       // Refresh Balance in Header
       fetchBalance();
      }
     }
    } catch (err) {
      console.error("Polling failed:", err);
    }
  }, 3000); // Every 3 seconds

  return () => clearInterval(interval);
 }, [isAuthenticated, token, fetchBalance]);

 const handleQuickBet = async (type: string, target: number, operator: string) => {
  if (!isAuthenticated) return alert("Login First");
  try {
    await placeBet(type, { target_count: target, operator }, selectedChip);
    // Optional: Reset counter visually or wait for server response
  } catch(e){ console.error(e)}
};

return (
 <div className="app-layout-wrapper">

  {/* RENDER CELEBRATION OVERLAY HERE */}
  <CelebrationOverlay />

  {/* LEFT / TOP: VIDEO STAGE */}
  <div className="jungle-video-stage relative bg-black overflow-hidden">

   <div className="absolute inset-0 opacity-40 pointer-events-none">
    <img src="/road-bg.jpg" alt="Cam" className="w-full h-full object-cover" onError={(e)=>{e.currentTarget.style.display='none'}}/>
   </div>

   {/* Top Bar HUD - BRANDED FOR JUNGLE BET WITH LIVE STATUS INDICATOR */}
   <div className="absolute top-0 left-0 right-0 p-4 md:p-6 flex justify-between items-start z-20 bg-gradient-to-b from-black/90 via-black/50 to-transparent">

    <div className="flex flex-col gap-1">
     <h1 className="text-xl md:text-2xl font-black italic tracking-tighter text-white drop-shadow-lg">
      JUNGLE<span className="text-[var(--jungle-green)]">BET</span>
     </h1>

     <div className="flex items-center gap-2 mt-1">
      <span className={`relative flex h-2 w-2 ${isConnected ? '' : 'opacity-50'}`}>
       {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
       <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-red-500' : 'bg-gray-500'}`}></span>
      </span>
      <span className="text-[10px] md:text-xs font-bold tracking-widest uppercase text-gray-300">
       {isConnected ? 'LIVE FEED ACTIVE' : 'CONNECTING...'}
      </span>
     </div>

     <p className="text-xs md:text-sm font-medium text-gray-400 italic pl-4 border-l-2 border-[var(--jungle-green)]/30 ml-1 transition-all duration-500">
      {roadName}
     </p>
    </div>

    <div className="flex gap-3">
     <button className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors border border-white/10"><Volume2 size={18} className="text-white"/></button>
     <button className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors border border-white/10"><Settings size={18} className="text-white"/></button>
    </div>
   </div>

   {/* CENTER COUNTER DISPLAY */}
   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
    <motion.div 
     key={currentCount}
     initial={{ scale: 0.9, opacity: 0 }}
     animate={{ scale: 1, opacity: 1 }}
     className="bg-black/70 backdrop-blur-xl border-2 border-[var(--jungle-green)] shadow-[0_0_40px_rgba(204,255,0,0.2)] px-10 py-6 rounded-3xl flex flex-col items-center min-w-[160px]"
    >
     <span className="text-6xl md:text-7xl font-black text-white tabular-nums leading-none drop-shadow-lg">{currentCount}</span>
     <span className="text-[10px] md:text-xs uppercase tracking-[0.3em] text-[var(--jungle-green)] mt-2 font-bold">VEHICLES DETECTED</span>
    </motion.div>
   </div>

   {/* GREEN LINE VISUALIZER */}
   <div className="absolute bottom-[30%] left-0 right-0 h-1 bg-[var(--jungle-green)] shadow-[0_0_20px_var(--jungle-green)] z-10 transform skew-y-[-2deg] origin-left opacity-90"></div>
  </div>


  {/* RIGHT / BOTTOM: CONTROLS CONTAINER */}
  <div className="jungle-controls-container panel-glass p-4 flex flex-col gap-4">

  <div className="pb-4 border-b border-white/10">
   <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Available Balance</p>
   <h2 className="text-2xl md:text-3xl font-bold text-white">${balance.toFixed(2)}</h2>
  </div>

  </div>
    <p className="text-xs text-gray-400 uppercase font-semibold mb-3">Select Stake</p>
    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
     {[50, 100, 200, 500, 1000].map(chip => (
      <button 
       key={chip}
       onClick={() => setSelectedChip(chip)}
       className={`py-2 rounded-lg text-sm font-bold border transition-all ${selectedChip === chip ? 'bg-[var(--jungle-green)] text-black border-transparent shadow-lg' : 'border-white/10 text-gray-300 hover:border-white/30'}`}
      >
       {chip}
      </button>
    ))}     
   </div>
  </div>

  <div className="flex-1 overflow-hidden">
   <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Active Markets</p>

   <div className="jungle-scroll-row">
    <MarketCard title="UNDER 10" odds="2.25x" color="blue" onClick={() => handleQuickBet('count_prediction', 10, 'under')} />
    <MarketCard title="OVER 13" odds="3.60x" color="lime" highlight onClick={() => handleQuickBet('count_prediction', 13, 'over')} />
    <MarketCard title="STAR PICK" odds="18x" color="purple" onClick={() => handleQuickBet('count_prediction', 7, 'exact')} />
    <MarketCard title="EXACT HIGH" odds="36x" color="red" onClick={() => handleQuickBet('count_prediction', 20, 'exact')} />
   </div>
  </div>

  {/* SYSTEM STATUS PANEL */}
  <div className="mt-auto pt-4 border-t border-white/10 hidden md:block">
   <div className="flex items-center justify-between mb-2">
    <p className="text-xs text-gray-400 uppercase font-semibold">System Status</p>
    {isConnected ? (
      <TrendingUp size={14} className="text-[var(--jungle-green)]"/>
    ) : (
      <WifiOff size={14} className="text-red-400"/>
    )}
    </div>
    <div className="space-y-2">
     <div className="flex justify-between text-xs p-2 bg-white/5 rounded">
      <span className="text-gray-300">Connection:</span>
      <span className={`font-bold ${isConnected ? 'text-[var(--jungle-green)]' : 'text-red-400'}`}>{isConnected ? 'STABLE' : 'OFFLINE'}</span>
     </div>
    </div>
   </div>
  </div>

 </div>
 );
}    

function MarketCard({ title, odds, color, onClick, highlight }: any) {
  const bgMap = {
   blue: "bg-blue-900/40 border-blue-500/30",
   lime: "bg-[#1a2e05] border-[var(--jungle-green)]/50", 
   purple: "bg-purple-900/40 border-purple-500/30",
   red: "bg-red-900/40 border-red-500/30"
  };

  return (
   <motion.button
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`snap-start shrink-0 w-32 md:w-full h-24 md:h-auto md:p-4 rounded-xl border flex flex-col md:flex-row justify-between items-center relative overflow-hidden ${bgMap[color]} ${highlight ? 'shadow-[0_0_15px_rgba(204,255,0,0.3)] ring-1 ring-[var(--jungle-green)]' : ''}`}
   >
    {highlight && <div className="absolute top-0 right-0 bg-[var(--jungle-green)] text-black text-[8px] font-black px-1.5 py-0.5 rounded-bl-lg">HOT</div>}

    <div className="md:hidden flex flex-col items-start">
     <span className="text-[10px] uppercase font-bold opacity-70 text-white">{title.split(' ')[0]}</span>
     <span className="text-2xl font-black text-white block leading-none mt-1">{odds}</span>
     <span className="text-[9px] uppercase font-bold text-gray-300 block mt-1">{title.split(' ').slice(1).join(' ')}</span>
    </div>

    <div className="hidden md:flex justify-between w-full items-center">
     <span className="font-bold text-sm text-white uppercase tracking-wide">{title}</span>
     <span className={`font-black text-lg ${color === 'lime' ? 'text-[var(--jungle-green)]' : 'text-white'}`}>{odds}</span>
    </div>
   </motion.button>
  );
}
 
