import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Flame,
  Wallet,
  ShieldCheck,
  Sparkles,
  Radio,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { getGames } from '../services/betting';
import { useBettingStore } from '../store/useBettingStore';
import { useAuthStore } from '../store/useAuthStore';
import { VideoPlayer } from '../components/map/VideoPlayer';
import { InteractiveEuropeMap } from '../components/map/InteractiveEuropeMap';
import { GameCard } from '../components/betting/GameCard';
import { Button } from '../components/common/Button';
import { Loader } from '../components/common/Loader';

/**
 * RUSH HOUR BET Arena Home Page — Live Optical Feed Showcase, Interactive Europe Map & Featured Markets
 */
export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { games, selectedFeedId, setGames, setSelectedFeedId } = useBettingStore();

  const { data: fetchedFeeds, isLoading } = useQuery({
    queryKey: ['cameraFeeds'],
    queryFn: getGames,
  });

  useEffect(() => {
    if (fetchedFeeds && fetchedFeeds.length > 0) {
      setGames(fetchedFeeds);
    }
  }, [fetchedFeeds, setGames]);

  const activeFeed =
    games.find((g) => g.id === selectedFeedId) || games[0] || null;

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1f1a08] via-[#161616] to-[#0f0f0f] border border-[#FFD700]/30 p-6 sm:p-8 shadow-2xl"
      >
        <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-[#FFD700]/10 blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFD700]/15 border border-[#FFD700]/40 text-xs font-extrabold text-[#FFD700]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>WORLD-CLASS OPTICAL TRAFFIC WAGERING</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Predict Real-Time Traffic Crossings.{' '}
              <span className="text-[#FFD700]">Win Up to 36.0x Instantly.</span>
            </h1>

            <p className="text-sm sm:text-base text-gray-300 max-w-2xl leading-relaxed">
              Powered by live highway cameras and YOLOv8 computer vision telemetry. Watch vehicles
              cross the superimposed <span className="text-emerald-400 font-semibold">Optical Green Line</span>{' '}
              with sub-second settlement directly to your USD vault.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/betting')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Enter Live Betting Arena
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate(isAuthenticated ? '/wallet' : '/register')}
                leftIcon={<Wallet className="w-4 h-4 text-[#FFD700]" />}
              >
                {isAuthenticated ? 'Open Player Vault' : 'Create Free Account'}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10 text-xs">
              <div>
                <div className="text-lg font-black text-[#FFD700]">36.0x</div>
                <div className="text-gray-400">Max Exact Multiplier</div>
              </div>
              <div>
                <div className="text-lg font-black text-emerald-400">&lt; 1s</div>
                <div className="text-gray-400">WebSocket Resolution</div>
              </div>
              <div>
                <div className="text-lg font-black text-white">25% Float</div>
                <div className="text-gray-400">Protected Treasury</div>
              </div>
            </div>
          </div>

          {/* Live Stream Spotlight */}
          <div className="lg:col-span-5">
            <VideoPlayer feed={activeFeed} />
          </div>
        </div>
      </motion.section>

      {/* Interactive Europe & Global Telemetry Map */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#FFD700]" />
              Live European & Global Optical Corridors
            </h2>
            <p className="text-xs text-gray-400">
              Select a city marker to preview its highway camera stream and live vehicle count
            </p>
          </div>
        </div>
        <InteractiveEuropeMap
          feeds={games}
          onSelectFeed={(id) => setSelectedFeedId(id)}
        />
      </section>

      {/* Live Camera Markets Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-[#FFD700]" />
              Verified Camera Feeds & Multipliers
            </h2>
            <p className="text-xs text-gray-400">
              Direct feeds from backend /camera-feeds registry
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/betting')}
            rightIcon={<Zap className="w-3.5 h-3.5" />}
          >
            Full Betting Console
          </Button>
        </div>

        {isLoading ? (
          <Loader variant="skeleton" rows={3} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {games.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                isSelected={game.id === selectedFeedId}
                onSelectGame={() => navigate('/betting')}
                onOpenBetModal={() => navigate('/betting')}
              />
            ))}
          </div>
        )}
      </section>

      {/* Security & Compliance Banner */}
      <section className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#FFD700]/15 text-[#FFD700]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              Provably Fair Computer Vision & Segregated Player Wallets
            </h3>
            <p className="text-xs text-gray-400">
              Every crossing is verified by YOLOv8 centroid tracking and settled via atomic PostgreSQL
              double-entry transactions.
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/betting')}>
          Place Live Wager
        </Button>
      </section>
    </div>
  );
};

export default Home;
