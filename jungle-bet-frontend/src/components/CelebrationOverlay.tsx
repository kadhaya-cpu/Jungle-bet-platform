"use client";
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Skull } from 'lucide-react';
const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  y: -100 - ((i * 29) % 150),
  x: (((i * 53) % 300) - 150),
  rotate: (i * 67) % 360,
}));

export default function CelebrationOverlay() {
 const [celebration, setCelebration] = useState<{type: 'win'|'loss', amount?: number} | null>(null);

 // Listen for custom events dispatched by GameBoard when bets resolve
 useEffect(() => {
  const handler = (e: CustomEvent) => {
   setCelebration(e.detail);
   // Auto-dismiss after 3 seconds
   setTimeout(() => setCelebration(null), 3000);
  };

   window.addEventListener('jungle-celebrate', handler as EventListener);
   return () => window.removeEventListener('jungle-celebrate', handler as EventListener);
 }, []);

 if (!celebration) return null;

 return (
   <AnimatePresence>
    <motion.div 
     initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
     className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
    >
     {/* Backdrop Blur */}
     <div className={`absolute inset-0 backdrop-blur-sm transition-colors duration-500 ${
      celebration.type === 'win' ? 'bg-yellow-900/30' : 'bg-red-900/30'
    }`} />

    {/* Content Container */}
    <motion.div 
     initial={{ scale: 0.5, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0 }}
     className="relative glass-card p-8 rounded-3xl border-2 shadow-2xl max-w-sm w-full mx-4 text-center"
     style={{ borderColor: celebration.type === 'win' ? '#fbbf24' : '#ef4444' }}
    >
     {/* Icon with Glow */}
     <motion.div 
      animate={celebration.type === 'win' ? { rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] } : { x: [-5, 5, -5, 5, 0] }}
      transition={{ repeat: Infinity, duration: 0.5 }}
      className="mb-4 inline-block"
     >
      {celebration.type === 'win' ? (
       <Trophy size={64} className="text-yellow-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]" />
     ) : (
       <Skull size={64} className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
      )}
      </motion.div>

      {/* Title */}
      <h2 className={`text-3xl font-black uppercase tracking-tight mb-2 ${
       celebration.type === 'win' ? 'text-yellow-400 neon-text-gold' : 'text-red-500 neon-text-red'
     }`}>
      {celebration.type === 'win' ? 'JACKPOT!' : 'BUSTED'}
     </h2>

     {/* Amount Display */}
     {celebration.amount !== undefined && (
      <p className="text-xl font-bold text-white mb-4">
       {celebration.type === 'win' ? '+' : '-'}${Math.abs(celebration.amount).toFixed(2)} VC
      </p>
     )}

     {/* Particle Effects (CSS Only for Performance) */}
     {celebration.type === 'win' && PARTICLES.map((p) => (
      <motion.div
       key={p.id}
       initial={{ opacity: 1, y: 0, x: 0 }}
       animate={{ 
        opacity: 0, 
        y: p.y, 
        x: p.x,
        rotate: p.rotate
       }}
       transition={{ duration: 1.5, ease: "easeOut" }}
       className="absolute top-1/2 left-1/2 w-3 h-3 bg-yellow-400 rounded-full shadow-lg"
       style={{ transformOrigin: 'center' }}
      />
     ))}
    </motion.div>
   </motion.div>
  </AnimatePresence>                                                                                                                                        
 );
}       
