import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ShieldAlert, Ban, CheckCircle2, Users, Search } from 'lucide-react';
import { performAdminUserAction } from '../../services/betting';
import { formatCurrency } from '../../utils/formatCurrency';
import { Button } from '../common/Button';

export interface AdminUserItem {
  id: string;
  username: string;
  phone?: string | null;
  email?: string | null;
  balance: number;
  isFlagged: boolean;
  flagReason?: string | null;
  isBanned: boolean;
  role?: string;
}

export interface UserTableProps {
  users: AdminUserItem[];
}

/**
 * Admin User Dossier & Leo AI Fraud Enforcement Table
 */
export const UserTable: React.FC<UserTableProps> = ({ users = [] }) => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'flagged' | 'banned'>('all');
  const [search, setSearch] = useState<string>('');

  const actionMutation = useMutation({
    mutationFn: ({
      userId,
      action,
    }: {
      userId: string;
      action: 'ban' | 'unban' | 'unflag';
    }) => performAdminUserAction(userId, action),
    onSuccess: (res) => {
      toast.success(`Updated security status for ${res.username}`);
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
    onError: () => {
      toast.error('Failed to update user security status.');
    },
  });

  const filteredUsers = users.filter((u) => {
    if (filter === 'flagged' && !u.isFlagged) return false;
    if (filter === 'banned' && !u.isBanned) return false;
    if (
      search.trim() &&
      !u.username.toLowerCase().includes(search.toLowerCase()) &&
      !String(u.id).includes(search)
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#FFD700]" />
          <div>
            <h3 className="text-base font-bold text-white">
              Registered Racers & Leo AI Fraud Dossier
            </h3>
            <p className="text-xs text-gray-400">
              One-click ban & flag enforcement connected to /api/admin/ban
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl bg-[#141414] border border-white/10 pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFD700]"
            />
          </div>

          {(['all', 'flagged', 'banned'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                filter === tab
                  ? 'bg-[#FFD700] text-[#0f0f0f]'
                  : 'bg-[#141414] text-gray-400 hover:text-white border border-white/10'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 uppercase tracking-wider text-[10px]">
              <th className="py-3 px-3">ID</th>
              <th className="py-3 px-3">Racer</th>
              <th className="py-3 px-3">Vault Balance</th>
              <th className="py-3 px-3">Security Status</th>
              <th className="py-3 px-3">Leo AI Flag Reason</th>
              <th className="py-3 px-3 text-right">Enforcement Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No matching user accounts found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-3 font-mono text-gray-400">#{u.id}</td>
                  <td className="py-3 px-3 font-bold text-white">{u.username}</td>
                  <td className="py-3 px-3 font-mono text-[#FFD700] font-semibold">
                    {formatCurrency(u.balance, 'USD')}
                  </td>
                  <td className="py-3 px-3">
                    {u.isBanned ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 font-bold">
                        <Ban className="w-3 h-3" />
                        BANNED
                      </span>
                    ) : u.isFlagged ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                        <ShieldAlert className="w-3 h-3" />
                        FLAGGED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        CLEAN
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-gray-400 max-w-xs truncate">
                    {u.flagReason || '—'}
                  </td>
                  <td className="py-3 px-3 text-right space-x-2">
                    {u.isFlagged && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          actionMutation.mutate({ userId: u.id, action: 'unflag' })
                        }
                      >
                        Dismiss Flag
                      </Button>
                    )}
                    {u.isBanned ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          actionMutation.mutate({ userId: u.id, action: 'unban' })
                        }
                      >
                        Unban
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() =>
                          actionMutation.mutate({ userId: u.id, action: 'ban' })
                        }
                      >
                        Ban User
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserTable;
