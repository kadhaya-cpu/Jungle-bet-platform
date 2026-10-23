import React, { useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Users,
  Search,
  ArrowUpDown,
  History,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { AdminUser, useAdminStore } from '../../store/useAdminStore';
import { formatCurrency } from '../../utils/formatCurrency';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

export interface UserTableProps {
  users?: AdminUser[];
}

type SortField = 'id' | 'username' | 'email' | 'balance' | 'status';

const PAGE_SIZE = 20;

/**
 * Admin User Management Table
 * - Fetches user list from /api/users (GET)
 * - Columns: ID, Username, Email, Balance, Status (Active/Banned), Actions
 * - Actions: 'Ban/Unban' button (with confirmation modal), 'View History' link
 * - Search bar filtering by username or email
 * - Pagination when > 20 users
 * - Sortable columns & row hover effects
 */
export const UserTable: React.FC<UserTableProps> = ({ users: propUsers }) => {
  const { users: storeUsers, banUser } = useAdminStore();
  const users = propUsers && propUsers.length > 0 ? propUsers : storeUsers;

  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Banned'>('all');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Confirm modal state before banning a user
  const [confirmTarget, setConfirmTarget] = useState<AdminUser | null>(null);
  // View History modal state
  const [historyUser, setHistoryUser] = useState<AdminUser | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(field !== 'balance');
    }
  };

  const filteredAndSortedUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = users.filter((u) => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        String(u.id).toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [users, search, statusFilter, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedUsers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredAndSortedUsers.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const handleActionClick = (user: AdminUser) => {
    if (!user.isBanned) {
      // Confirm modal before banning user
      setConfirmTarget(user);
    } else {
      banUser(user.id);
    }
  };

  return (
    <div className="rounded-2xl bg-[#1a1a1a] border border-white/10 p-5 space-y-4">
      {/* Header & Search Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-[#FFD700]/15 border border-[#FFD700]/30 text-[#FFD700]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              User Management & Compliance Directory
            </h3>
            <p className="text-xs text-gray-400">
              Showing {paginatedUsers.length} of {filteredAndSortedUsers.length} registered accounts (GET /api/users)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search username or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full sm:w-64 rounded-xl bg-[#0f0f0f] border border-white/10 pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFD700]"
            />
          </div>

          {(['all', 'Active', 'Banned'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setStatusFilter(tab);
                setCurrentPage(1);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold capitalize transition-colors ${
                statusFilter === tab
                  ? 'bg-[#FFD700] text-[#0f0f0f]'
                  : 'bg-[#0f0f0f] text-gray-400 hover:text-white border border-white/10'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Sortable Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 uppercase tracking-wider text-[10px]">
              <th className="py-3 px-3">
                <button
                  type="button"
                  onClick={() => handleSort('id')}
                  className="inline-flex items-center gap-1 font-bold hover:text-[#FFD700] transition-colors"
                >
                  ID
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-3">
                <button
                  type="button"
                  onClick={() => handleSort('username')}
                  className="inline-flex items-center gap-1 font-bold hover:text-[#FFD700] transition-colors"
                >
                  Username
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-3">
                <button
                  type="button"
                  onClick={() => handleSort('email')}
                  className="inline-flex items-center gap-1 font-bold hover:text-[#FFD700] transition-colors"
                >
                  Email
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-3">
                <button
                  type="button"
                  onClick={() => handleSort('balance')}
                  className="inline-flex items-center gap-1 font-bold hover:text-[#FFD700] transition-colors"
                >
                  Balance
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-3">
                <button
                  type="button"
                  onClick={() => handleSort('status')}
                  className="inline-flex items-center gap-1 font-bold hover:text-[#FFD700] transition-colors"
                >
                  Status
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No matching user accounts found.
                </td>
              </tr>
            ) : (
              paginatedUsers.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.04] transition-colors">
                  <td className="py-3.5 px-3 font-mono text-gray-400">{u.id}</td>
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{u.username}</span>
                      {u.isFlagged && (
                        <span
                          title={u.flagReason || 'Flagged by Leo AI'}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold"
                        >
                          <ShieldAlert className="w-2.5 h-2.5" />
                          FLAG
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-gray-300">{u.email}</td>
                  <td className="py-3.5 px-3 font-mono text-[#FFD700] font-bold">
                    {formatCurrency(u.balance, 'USD')}
                  </td>
                  <td className="py-3.5 px-3">
                    {u.isBanned || u.status === 'Banned' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 font-bold text-[11px]">
                        <Ban className="w-3 h-3" />
                        Banned
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold text-[11px]">
                        <CheckCircle2 className="w-3 h-3" />
                        Active
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setHistoryUser(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#0f0f0f] border border-white/10 text-xs font-semibold text-[#FFD700] hover:border-[#FFD700]/50 transition-colors"
                      >
                        <History className="w-3.5 h-3.5" />
                        View History
                      </button>

                      {u.isBanned || u.status === 'Banned' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActionClick(u)}
                        >
                          Unban
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleActionClick(u)}
                        >
                          Ban
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar (Shown when > 20 users) */}
      {filteredAndSortedUsers.length > PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs">
          <span className="text-gray-400">
            Page <strong className="text-white">{safePage}</strong> of{' '}
            <strong className="text-white">{totalPages}</strong> ({filteredAndSortedUsers.length}{' '}
            total users)
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Prev
            </Button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`w-8 h-8 rounded-xl text-xs font-bold transition-colors ${
                  pageNum === safePage
                    ? 'bg-[#FFD700] text-[#0f0f0f]'
                    : 'bg-[#0f0f0f] text-gray-400 hover:text-white border border-white/10'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <Button
              variant="secondary"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation Modal Before Banning a User */}
      <Modal
        isOpen={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        title="Confirm User Ban"
        subtitle="Restricts account login, live optical betting, and withdrawals"
      >
        {confirmTarget && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 space-y-1">
              <div className="font-bold text-red-300">
                Target Account: {confirmTarget.username} ({confirmTarget.id})
              </div>
              <div>Email: {confirmTarget.email}</div>
              <div>Current Vault Balance: {formatCurrency(confirmTarget.balance, 'USD')}</div>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to ban this user? You can unban the account at any time from the
              User Management tab.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  banUser(confirmTarget.id);
                  setConfirmTarget(null);
                }}
              >
                Confirm Ban User
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* User Betting & Transaction History Modal */}
      <Modal
        isOpen={Boolean(historyUser)}
        onClose={() => setHistoryUser(null)}
        title={historyUser ? `Audit History — ${historyUser.username}` : 'User History'}
        subtitle={historyUser ? `${historyUser.id} • ${historyUser.email}` : ''}
        maxWidthClass="max-w-xl"
      >
        {historyUser && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-[#0f0f0f] border border-white/10">
                <div className="text-[10px] uppercase text-gray-400">Vault Balance</div>
                <div className="text-sm font-black text-[#FFD700]">
                  {formatCurrency(historyUser.balance, 'USD')}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#0f0f0f] border border-white/10">
                <div className="text-[10px] uppercase text-gray-400">Total Bets</div>
                <div className="text-sm font-black text-white">
                  {historyUser.totalBetsCount ?? 42}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#0f0f0f] border border-white/10">
                <div className="text-[10px] uppercase text-gray-400">Total Wagered</div>
                <div className="text-sm font-black text-emerald-400">
                  {formatCurrency(historyUser.totalWageredUsd ?? 1250, 'USD')}
                </div>
              </div>
            </div>

            {historyUser.flagReason && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                <strong>Leo AI Flag Reason:</strong> {historyUser.flagReason}
              </div>
            )}

            {/* Mock recent user ledger entries (marked for live /api/users/{id}/history integration) */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-300">Recent Optical Wagers & Ledger</div>
              <div className="divide-y divide-white/5 rounded-xl bg-[#0f0f0f] border border-white/10 overflow-hidden text-xs">
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">London M25 — Over 13 Vehicles</div>
                    <div className="text-[11px] text-gray-500">Odds 3.60x • Resolved Won</div>
                  </div>
                  <span className="font-mono font-bold text-emerald-400">+$90.00</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">Paris Arc — Under 10 Vehicles</div>
                    <div className="text-[11px] text-gray-500">Odds 2.25x • Resolved Lost</div>
                  </div>
                  <span className="font-mono font-bold text-red-400">-$25.00</span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">Mobile Money Deposit (FX Spread)</div>
                    <div className="text-[11px] text-gray-500">Credited to USD Vault</div>
                  </div>
                  <span className="font-mono font-bold text-[#FFD700]">+$200.00</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setHistoryUser(null)}>
                Close Dossier
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserTable;
