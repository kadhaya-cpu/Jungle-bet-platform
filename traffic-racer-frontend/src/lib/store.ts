import { create } from 'zustand';
import axios from 'axios';

const API_URL = 'http://localhost:8000'; // Your FastAPI Backend

interface UserState {
 token: string | null;
 username: string | null;
 balance: number;
 isAuthenticated: boolean;

 login: (username: string, password: string) => Promise<void>;
 register: (username: string, password: string) => Promise<void>;
 fetchBalance: () => Promise<void>;
 placeBet: (betType: string, criteria: object, amount: number) => Promise<any>;
 logout: () => void;
}

export const useStore = create<UserState>((set, get) => ({
 token: typeof window !== 'undefined' ? localStorage.getItem('tr_token') : null,
 username: typeof window !== 'undefined' ? localStorage.getItem('tr_username') : null,
 balance: 0,
 isAuthenticated: false,

 login: async (username, password) => {
  try {
    const res = await axios.post(`${API_URL}/login`, { username, password });
    const token = res.data.access_token;

    localStorage.setItem('tr_token', token);
    localStorage.setItem('tr_username', username);

    set({ token, username, isAuthenticated: true });
    await get().fetchBalance();
  } catch (error) { throw error; }
},

register: async (username, password) => {
 await axios.post(`${API_URL}/register`, { username, password });
 await get().login(username, password);
},

fetchBalance: async () => {
 const { token } = get();
 if (!token) return;
 try {
   const res = await axios.get(`${API_URL}/me/balance`, { headers: { Authorization: `Bearer ${token}` } });
   set({ balance: res.data.v_coins });
 } catch (error) { console.error(error); }
},

placeBet: async (betType, criteria, amount) => {
 const { token } = get();
 if (!token) throw new Error("Not authenticated");

 const res = await axios.post(`${API_URL}/bet/place`,
  { bet_type: betType, criteria, amount },
  { headers: { Authorization: `Bearer ${token}` } }
 );
 set((state) => ({ balance: state.balance - amount }));
 return res.data;
},

logout: () => {
 localStorage.removeItem('tr_token');
 localStorage.removeItem('tr_username');
 set({ token: null, username: null, isAuthenticated: false, balance: 0 });
 }
}));          
