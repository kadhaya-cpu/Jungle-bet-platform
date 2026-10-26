import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Lock, User, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';
import { loginUser } from '../services/auth';
import { useAuthStore } from '../store/useAuthStore';
import { useWalletStore } from '../store/useWalletStore';
import { validateLoginForm } from '../utils/validateForm';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

/**
 * Login Page connected to POST /login with JWT storage & automatic redirect to /wallet
 */
export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login: storeLogin } = useAuthStore();
  const { setBalance } = useWalletStore();

  const stateError = (location.state as { error?: string })?.error;
  const fromPath =
    (location.state as { from?: { pathname?: string } })?.from?.pathname || '/wallet';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>(
    stateError ? { general: stateError } : {}
  );

  const loginMutation = useMutation({
    mutationFn: async () => {
      const validation = validateLoginForm(username, password);
      if (!validation.isValid) {
        setErrors(validation.errors);
        throw new Error('VALIDATION_ERROR');
      }
      setErrors({});
      return loginUser({ username: username.trim(), password });
    },
    onSuccess: ({ token, refreshToken, user }) => {
      storeLogin(user, token, refreshToken);
      setBalance(user.balance_usd, user.preferred_currency);
      toast.success(`Welcome back, ${user.username}!`);
      navigate(fromPath, { replace: true });
    },
    onError: (err: unknown) => {
      if ((err as Error)?.message === 'VALIDATION_ERROR') return;
      const detail =
        (err as { response?: { data?: { detail?: string; message?: string } } })?.response
          ?.data?.detail ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error)?.message ||
        'Login failed. Please verify your credentials.';
      setErrors({ general: detail });
      toast.error(detail);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-md rounded-3xl bg-[#1a1a1a] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#FFD700] text-[#0f0f0f] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(255,215,0,0.35)]">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Sign In to RUSH HOUR <span className="text-[#FFD700]">BET</span>
          </h1>
          <p className="text-xs text-gray-400">
            Access live optical traffic betting &amp; your segregated USD vault
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="Username"
            placeholder="Enter your racer username"
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
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) {
                setErrors((prev) => ({ ...prev, password: '' }));
              }
            }}
            leftIcon={<Lock className="w-4 h-4 text-[#FFD700]" />}
            error={errors.password}
            autoComplete="current-password"
          />

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
            isLoading={loginMutation.isPending}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Sign In to Vault
          </Button>
        </form>

        <div className="pt-4 border-t border-white/10 text-center text-xs text-gray-400">
          Don&apos;t have a RUSH HOUR BET account yet?{' '}
          <Link to="/register" className="text-[#FFD700] font-bold hover:underline">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
