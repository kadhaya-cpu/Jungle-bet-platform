import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Activity, Lock } from 'lucide-react';

/**
 * Platform Footer with Telemetry Status & Compliance Notice
 */
export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#0f0f0f] border-t border-white/10 py-6 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-start">
          <span className="font-bold text-white">
            RUSH HOUR <span className="text-[#FFD700]">BET</span> © {new Date().getFullYear()}
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <Activity className="w-3.5 h-3.5" />
            YOLOv8 Optical Telemetry Active
          </span>
          <span className="flex items-center gap-1.5 text-gray-400">
            <Lock className="w-3.5 h-3.5 text-[#FFD700]" />
            25% Treasury Safety Float Enforced
          </span>
        </div>

        <div className="flex items-center gap-4 flex-wrap justify-center">
          <Link to="/betting" className="hover:text-[#FFD700] transition-colors">
            Live Markets
          </Link>
          <Link to="/wallet" className="hover:text-[#FFD700] transition-colors">
            Vault
          </Link>
          <Link to="/terms" className="hover:text-[#FFD700] transition-colors">
            Terms & FX Clauses
          </Link>
          <Link to="/privacy" className="hover:text-[#FFD700] transition-colors">
            Privacy Policy
          </Link>
          <Link to="/responsible-gaming" className="hover:text-[#FFD700] transition-colors">
            Responsible Gaming
          </Link>
          <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
            <Shield className="w-3.5 h-3.5 text-[#FFD700]" />
            18+ Play Responsibly
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
