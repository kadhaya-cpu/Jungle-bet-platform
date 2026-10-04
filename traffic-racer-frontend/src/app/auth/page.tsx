"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { toast } from 'sonner';
import { LogIn, UserPlus } from 'lucide-react'; // Icons

export default function AuthPage() {
 const router = useRouter();
 const { login, register } = useStore();

 const [isRegistering, setIsRegistering] = useState(false);
 const [username, setUsername] = useState("");
 const [password, setPassword] = useState("");
 const [loading, setLoading] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
   if (isRegistering) {
     await register(username, password);
     toast.success("Account Created! Welcome racer.");
   } else {
     await login(username, password);
     toast.success("Logged in successfully!");
   }

   // Redirect home after success
   setTimeout(() => router.push('/'), 800);

 } catch (err: any) {
   toast.error(err.response?.data?.detail || "Authentication failed");
 } finally {
   setLoading(false);
 }
};

return (
 <div className="min-h-screen flex items-center justify-center bg-[var(--background)] relative overflow-hidden">
  {/* Background Glows */}
  <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-[var(--primary)]/10 rounded-full blur-[120px]" />

  <div className="glass-card p-8 rounded-2xl max-w-md w-full z-10 shadow-2xl border border-white/10">
   <h2 className="text-3xl font-bold mb-6 text-center neon-text-green uppercase tracking-tight">
    {isRegistering ? "Join The Race" : "Enter Garage"}
   </h2>

   <form onSubmit={handleSubmit} className="space-y-4">
    <div>
     <label className="block text-xs uppercase text-gray-400 mb-1">Username</label>
     <input
      type="text"
      value={username}
      onChange={(e) => setUsername(e.target.value)}
      required
      className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-[var(--primary)] outline-none transition-all"
      placeholder="racer_pro_99"
     />
    </div>

    <div>
      <label className="block text-xs uppercase text-gray-400 mb-1">Password</label>
      <input
       type="password" 
       value={password}
       onChange={(e) => setPassword(e.target.value)}
       required
       minLength={6}
       className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-[var(--primary)] outline-none transition-all"
       placeholder="••••••••"
      />
     </div>

     <button
      type="submit"
      disabled={loading}
      className="w-full mt-4 bg-gradient-to-r from-[var(--primary)] to-emerald-400 text-black font-bold py-3 rounded-xl hover:shadow-[0_0_15px_rgba(0,255,157,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
     >
      {loading ? "Processing..." : (
        <>
         {isRegistering ? <UserPlus size={18}/> : <LogIn size={18}/>}
         {isRegistering ? "Create Account" : "Sign In"}
        </>
      )}
     </button>
    </form>

    <div className="mt-6 text-center">
     <button
      onClick={() => setIsRegistering(!isRegistering)}
      className="text-sm text-gray-400 hover:text-[var(--primary)] underline decoration-dotted transition-colors"
     >
      {isRegistering ? "Already have an account? Sign In" : "New here? Register now"}
     </button>
    </div>
   </div>
  </div>
 );
}       
