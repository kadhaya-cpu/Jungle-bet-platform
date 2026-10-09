"use client";
import Header from '@/components/Header';
import GameBoard from '@/components/GameBoard';
import LeoChatWidget from '@/components/LeoChatWidget';

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-white flex flex-col">
      <Header />
      <main className="flex-1 pt-16">
        <GameBoard />
      </main>
      <LeoChatWidget />
    </div>
  );
}
