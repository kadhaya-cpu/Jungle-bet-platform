"use client";
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Car, Clock } from 'lucide-react';
import { useStore } from '@/lib/store';
import { toast } from 'sonner';
import PaymentModal from './PaymentModal';

 export default function BettingPanel() {
  const { isAuthenticated, fetchBalance, formatAmount, currency } = useStore();
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [betType, setBetType] = useState<'count_prediction' | 'time_prediction'>('count_prediction');
  const [targetCount, setTargetCount] = useState(5);
  const [operator, setOperator] = useState<'exact' | 'over' | 'under'>('over');
  const [amount, setAmount] = useState(10);

  const handleSubmit = (e: React.FormEvent) => {
   e.preventDefault();
   if (!isAuthenticated) { toast.error("Please log in first!"); return; }
   setIsPaymentOpen(true);
  };

  const handlePaymentSuccess = (details: { paymentId: string; betId?: string }) => {
    toast.success(`Bet Placed & Confirmed! ID: ${details.betId || details.paymentId}`);
    fetchBalance();
  };

  return (
   <div className="max-w-md mx-auto mt-24 mb-12">
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 rounded-2xl shadow-2xl gradient-border">
     <h2 className="text-2xl font-bold mb-6 flex items-center gap-3"><Car className="text-[var(--primary)]" /> Place Your Bet</h2>

     <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
       <button type="button" onClick={() => setBetType('count_prediction')} className={`p-4 rounded-xl border transition-all ${betType === 'count_prediction' ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-white/10 text-gray-400 hover:border-white/30'}`}>
        <Car size={24} className="mx-auto mb-2" /><span className="block text-sm font-semibold">Vehicle Count</span>
       </button>
       <button type="button" onClick={() => setBetType('time_prediction')} className={`p-4 rounded-xl border transition-all ${betType === 'time_prediction' ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-white/10 text-gray-400 hover:border-white/30'}`}>
        <Clock size={24} className="mx-auto mb-2" /><span className="block text-sm font-semibold">Light Duration</span>
       </button>
      </div>

      <AnimatePresence mode="wait">
       {betType === 'count_prediction' && (
        <motion.div key="count" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
         <div><label className="text-xs uppercase tracking-wider text-gray-400 mb-2 block">Target Vehicles</label><input type="number" value={targetCount} onChange={(e) => setTargetCount(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-[var(--primary)] outline-none transition-colors" /></div>
         <div><label className="text-xs uppercase tracking-wider text-gray-400 mb-2 block">Condition</label><div className="flex gap-2">{(['exact', 'over', 'under'] as const).map(op => (<button key={op} type="button" onClick={() => setOperator(op)} className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${operator === op ? 'bg-[var(--primary)] text-black' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}>{op}</button>))}</div></div>
        </motion.div>
      )}
      {betType === 'time_prediction' && (
        <motion.div key="time" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
         <label className="text-xs uppercase tracking-wider text-gray-400 mb-2 block">Threshold Seconds (&gt; X sec)</label><input type="number" value={targetCount} onChange={(e) => setTargetCount(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-[var(--accent)] outline-none transition-colors" />
        </motion.div>
      )}
     </AnimatePresence>

     <div><label className="text-xs uppercase tracking-wider text-gray-400 mb-2 block">Wager Amount ({currency})</label><div className="relative"><input type="number" step="0.1" min="1" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-lg p-3 pl-10 text-white focus:border-[var(--primary)] outline-none transition-colors font-mono text-lg" /><span className="absolute left-3 top-3.5 text-[var(--primary)] font-bold">$</span></div></div>

     <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" className="w-full bg-gradient-to-r from-[var(--primary)] to-emerald-400 text-black font-bold py-4 rounded-xl shadow-lg hover:shadow-[0_0_20px_rgba(0,255,157,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer">
      Launch Bet ({formatAmount(amount)}) <Car size={20} />
     </motion.button>
    </form>
   </motion.div>

   <PaymentModal
     isOpen={isPaymentOpen}
     onClose={() => setIsPaymentOpen(false)}
     betData={{
       betType,
       criteria:
         betType === 'count_prediction'
           ? { target_count: parseInt(targetCount.toString()), operator, feed_id: 1 }
           : { threshold_seconds: parseInt(targetCount.toString()), feed_id: 1 },
       amount: parseFloat(amount.toString()),
       title: betType === 'count_prediction' ? `Count: ${operator} ${targetCount}` : `Light: > ${targetCount}s`,
     }}
     amount={parseFloat(amount.toString())}
     mode="bet"
     onPaymentSuccess={handlePaymentSuccess}
   />
  </div>
 );
}
