"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {  
 Zap, ShieldCheck, Globe, ArrowRight, Car, Clock, Star, 
 LogIn, UserPlus, X, CheckCircle, AlertTriangle, TrendingUp, WifiOff, Volume2, Settings, Trophy, Skull
} from 'lucide-react';
import { useStore } from '@/lib/store';
import axios from 'axios';
import CelebrationOverlay from './components/CelebrationOverlay'; // Ensure path matches your structure

export default function Home() {
 const { balance, placeBet, isAuthenticated, token, fetchBalance, login, register } = useStore();

 // --- STATE MANAGEMENT ---
 const [showAuthModal, setShowAuthModal] = useState(false);
 const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
 const [username, setUsername] = useState("");
 const [password, setPassword] = useState("");
 const [authLoading, setAuthLoading] = useState(false);

 const [currentCount, setCurrentCount] = useState(0);
 const [roadName, setRoadName] = useState("North Ring Road, Lyon");
 const [isConnected, setIsConnected] = useState(false);
 const [selectedChip, setSelectedChip] = useState(100);

 // BET MODAL STATE
 const [betModalOpen, setBetModalOpen] = useState(false);
 const [pendingBet, setPendingBet] = useState<{type: string, target: number, operator: string, odds: string} | null>(null);
 const [placingBet, setPlacingBet] = useState(fal                                                                                                           // --- EFFECTS ---
 
