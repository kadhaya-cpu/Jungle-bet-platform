import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UserPlus, User, Lock, Mail, MapPin, ArrowRight, AlertCircle } from 'lucide-react';
import { registerUser } from '../services/auth';
import { useAuthStore } from '../store/useAuthStore';
import { useWalletStore } from '../store/useWalletStore';
import { SUPPORTED_CURRENCIES } from '../utils/constants';
import { validateRegisterForm } from '../utils/validateForm';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

/**
 * Registration Page connected to POST /register with username, email, password,
 * preferred currency, validation, and automatic redirect to /wallet.
 */
export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { login: storeLogin } = useAuthStore();
  const { setBalance } = useWalletStore();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [preferredCurrency, setPreferredCurrency] = useState('UGX');
  const [location, setLocation] = useState('Kampala, Uganda');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const registerMutation = useMutation({
    mutationFn: async () => {
      const validation = validateRegisterForm({
        username,
        email,
        password,
        confirmPassword,
        preferredCurrency,
      });
      if (!validation.isValid) {
        setErrors(validation.errors);
        throw new Error('VALIDATION_ERROR');
      }
      setErrors({});
      return registerUser({
        username: username.trim(),
        email: email.trim(),
        password,
        preferred_currency: preferredCurrency,
        location: location.trim() || undefined,
      });
    },
    onSuccess: ({ token, refreshToken, user }) => {
      storeLogin(user, token, refreshToken);
      setBalance(user.balance_usd, user.preferred_currency);
      toast.success(`Account created! Welcome to Jungle Bet, ${user.username}!`);
      navigate('/wallet', { replace: true });
    },
    onError: (err: unknown) => {
      if ((err as Error)?.message === 'VALIDATION_ERROR') return;
      const detail =
        (err as { response?: { data?: { detail?: string; message?: string } } })?.response
          ?.data?.detail ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Registration failed. Please check your details and try again.';
      setErrors({ general: detail });
      toast.error(detail);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate();
  };

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-md rounded-3xl bg-[#1a1a1a] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#FFD700] text-[#0f0f0f] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(255,215,0,0.35)]">
            <UserPlus className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Create Racer Account
          </h1>
          <p className="text-xs text-gray-400">
            Instant registration with multi-currency vault conversion
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="Username"
            placeholder="Choose a unique username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (errors.username) {
                setErrors((prev) => ({ ...prev, username: '' }));
              }
            }}
            leftIcon={<User className="w-4 h-4 text-[#FFD700]" />}
            error={errors.username}
            autoComplete="username"
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="racer@junglebet.io"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) {
                setErrors((prev) => ({ ...prev, email: '' }));
              }
            }}
            leftIcon={<Mail className="w-4 h-4 text-[#FFD700]" />}
            error={errors.email}
            autoComplete="email"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Password"
              type="password"
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) {
                  setErrors((prev) => ({ ...prev, password: '' }));
                }
              }}
              leftIcon={<Lock className="w-4 h-4 text-[#FFD700]" />}
              error={errors.password}
              autoComplete="new-password"
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) {
                  setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }
              }}
              leftIcon={<Lock className="w-4 h-4 text-[#FFD700]" />}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Preferred Currency
              </label>
              <select
                value={preferredCurrency}
                onChange={(e) => setPreferredCurrency(e.target.value)}
                className="w-full rounded-xl bg-[#141414] border border-white/10 text-white text-sm py-2.5 px-3 focus:outline-none focus:border-[#FFD700]"
              >
                {['UGX', 'KES', 'TZS', 'USD', 'EUR', 'GBP', 'NGN'].map((code) => {
                  const c = SUPPORTED_CURRENCIES[code];
                  return (
                    <option key={code} value={code} className="bg-[#1a1a1a]">
                      {c.code} ({c.symbol})
                    </option>
                  );
                })}
              </select>
            </div>

            <Input
              label="City / Region"
              placeholder="e.g. Kampala, UG"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              leftIcon={<MapPin className="w-4 h-4 text-[#FFD700]" />}
            />
          </div>

          {errors.general && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={registerMutation.isPending}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Complete Registration
          </Button>
        </form>

        <div className="pt-4 border-t border-white/10 text-center text-xs text-gray-400">
          Already registered?{' '}
          <Link to="/login" className="text-[#FFD700] font-bold hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
