'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { User, LogIn, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isAuthorizedAdminEmail } from '@/lib/admin-auth';
import { AuthModal } from '@/components/AuthModal';

export function HeaderUserNav() {
  const { user, loading } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  if (loading) {
    return <div className="w-16 h-7 rounded-lg bg-slate-800/50 animate-pulse" />;
  }

  const isAdmin = user?.email ? isAuthorizedAdminEmail(user.email) : false;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {isAdmin && (
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono font-medium rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition"
            title="Administrator Portal"
          >
            <Shield className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        )}
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:text-white transition"
          title={`Signed in as ${user.email}`}
        >
          <User className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden md:inline max-w-[120px] truncate">
            {user.displayName || user.email?.split('@')[0] || 'Account'}
          </span>
          <span className="md:hidden">Account</span>
        </Link>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsAuthModalOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:text-white transition cursor-pointer"
        title="Sign in to save dockets and track certified mail delivery"
      >
        <LogIn className="w-3.5 h-3.5 text-slate-400" />
        <span>Sign In</span>
      </button>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
}
