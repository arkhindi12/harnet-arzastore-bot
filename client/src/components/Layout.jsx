import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Megaphone, LogOut, Menu, Facebook, ArrowUpCircle, Search, Flame, BarChart3, Settings, Crown, Calendar, SearchCode, CreditCard, Tag, Lightbulb, BookOpen, ShieldOff, Trophy, UsersRound, Library, Webhook, Gift, Code2, Store, Clock, Activity, Compass, Shield, Palette, Rocket, MessageCircle, Globe2, CalendarDays, Repeat, Mic, ShoppingBag, Timer, Bot, Server } from 'lucide-react';
import useBranding from '../hooks/useBranding';

const userNavGroups = [
  {
    label: 'Utama',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/accounts', icon: Users, label: 'Akun Facebook' },
    ],
  },
  {
    label: 'Otomasi',
    items: [
      { path: '/campaigns', icon: Megaphone, label: 'Auto Komentar' },
      { path: '/post-tools', icon: ArrowUpCircle, label: 'Post & UP Tools' },
      { path: '/smart-monitor', icon: Search, label: 'Smart Monitor' },
      { path: '/niche-groups', icon: Compass, label: 'Niche & Quality Grup' },
      { path: '/conversation-service', icon: Bot, label: 'Conversation Service' },
    ],
  },
  {
    label: 'Manajemen',
    items: [
      { path: '/warming', icon: Flame, label: 'Warming Akun' },
      { path: '/scheduler-logs', icon: Activity, label: 'Log Scheduler' },
      { path: '/anti-detection', icon: Shield, label: 'Anti-Detection' },
      { path: '/analytics', icon: BarChart3, label: 'Analitik & A/B Test' },
      { path: '/templates', icon: BookOpen, label: 'Template Komentar' },
      { path: '/campaign-library', icon: Library, label: 'Library Kampanye' },
      { path: '/blacklist', icon: ShieldOff, label: 'Blacklist URL' },
      { path: '/leaderboard', icon: Trophy, label: 'Leaderboard Akun' },
      { path: '/team', icon: UsersRound, label: 'Manajemen Tim' },
      { path: '/webhooks', icon: Webhook, label: 'Webhook & Integrasi' },
      { path: '/feature-requests', icon: Lightbulb, label: 'Request Fitur' },
      { path: '/settings', icon: Settings, label: 'Pengaturan' },
      { path: '/pricing', icon: Tag, label: 'Paket Langganan' },
    ],
  },
  {
    label: 'Pertumbuhan',
    items: [
      { path: '/referral', icon: Gift, label: 'Program Referral' },
      { path: '/reseller', icon: Store, label: 'Dashboard Reseller' },
      { path: '/api-keys', icon: Code2, label: 'Akses API' },
    ],
  },
  {
    label: 'Coming Soon',
    items: [
      { path: '/cookie-rotation', icon: Repeat, label: 'Cookie Pool Rotation', soon: true },
      { path: '/reply-chain', icon: MessageCircle, label: 'Reply Chain Multi-Turn', soon: true },
      { path: '/sentiment-guard', icon: ShieldOff, label: 'Sentiment Guard', soon: true },
      { path: '/smart-schedule', icon: Timer, label: 'Smart Schedule Timezone', soon: true },
      { path: '/post-predictor', icon: BarChart3, label: 'Post Predictor AI', soon: true },
      { path: '/content-calendar', icon: CalendarDays, label: 'AI Content Calendar', soon: true },
      { path: '/post-recycler', icon: Repeat, label: 'Post Recycler', soon: true },
      { path: '/cross-platform', icon: Globe2, label: 'Cross-Platform Sync', soon: true },
      { path: '/voice-comment', icon: Mic, label: 'Voice Comment', soon: true },
      { path: '/marketplace-crosslist', icon: ShoppingBag, label: 'Marketplace Cross-List', soon: true },
    ],
  },
];

const adminNavGroups = [
  {
    label: 'Utama',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/accounts', icon: Users, label: 'Akun Facebook' },
    ],
  },
  {
    label: 'Otomasi',
    items: [
      { path: '/campaigns', icon: Megaphone, label: 'Auto Komentar' },
      { path: '/post-tools', icon: ArrowUpCircle, label: 'Post & UP Tools' },
      { path: '/smart-monitor', icon: Search, label: 'Smart Monitor' },
      { path: '/niche-groups', icon: Compass, label: 'Niche & Quality Grup' },
      { path: '/conversation-service', icon: Bot, label: 'Conversation Service' },
    ],
  },
  {
    label: 'Manajemen',
    items: [
      { path: '/warming', icon: Flame, label: 'Warming Akun' },
      { path: '/scheduler-logs', icon: Activity, label: 'Log Scheduler' },
      { path: '/anti-detection', icon: Shield, label: 'Anti-Detection' },
      { path: '/analytics', icon: BarChart3, label: 'Analitik & A/B Test' },
      { path: '/templates', icon: BookOpen, label: 'Template Komentar' },
      { path: '/campaign-library', icon: Library, label: 'Library Kampanye' },
      { path: '/blacklist', icon: ShieldOff, label: 'Blacklist URL' },
      { path: '/leaderboard', icon: Trophy, label: 'Leaderboard Akun' },
      { path: '/team', icon: UsersRound, label: 'Manajemen Tim' },
      { path: '/webhooks', icon: Webhook, label: 'Webhook & Integrasi' },
      { path: '/feature-requests', icon: Lightbulb, label: 'Request Fitur' },
      { path: '/settings', icon: Settings, label: 'Pengaturan' },
      { path: '/pricing', icon: Tag, label: 'Halaman Harga' },
    ],
  },
  {
    label: 'Pertumbuhan',
    items: [
      { path: '/referral', icon: Gift, label: 'Program Referral' },
      { path: '/reseller', icon: Store, label: 'Dashboard Reseller' },
      { path: '/api-keys', icon: Code2, label: 'Akses API' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { path: '/admin', icon: Crown, label: 'Panel Admin', admin: true },
      { path: '/admin/plans', icon: CreditCard, label: 'Langganan & Harga', admin: true },
      { path: '/admin/resellers', icon: Store, label: 'Manajemen Reseller', admin: true },
      { path: '/admin/landing', icon: LayoutDashboard, label: 'Builder Landing Page', admin: true },
      { path: '/admin/branding', icon: Palette, label: 'Branding & Logo', admin: true },
      { path: '/admin/system-config', icon: Server, label: 'Konfigurasi Server', admin: true },
      { path: '/seo', icon: SearchCode, label: 'Pengaturan SEO', admin: true },
    ],
  },
  {
    label: 'Coming Soon',
    items: [
      { path: '/cookie-rotation', icon: Repeat, label: 'Cookie Pool Rotation', soon: true },
      { path: '/reply-chain', icon: MessageCircle, label: 'Reply Chain Multi-Turn', soon: true },
      { path: '/sentiment-guard', icon: ShieldOff, label: 'Sentiment Guard', soon: true },
      { path: '/smart-schedule', icon: Timer, label: 'Smart Schedule Timezone', soon: true },
      { path: '/post-predictor', icon: BarChart3, label: 'Post Predictor AI', soon: true },
      { path: '/content-calendar', icon: CalendarDays, label: 'AI Content Calendar', soon: true },
      { path: '/post-recycler', icon: Repeat, label: 'Post Recycler', soon: true },
      { path: '/cross-platform', icon: Globe2, label: 'Cross-Platform Sync', soon: true },
      { path: '/voice-comment', icon: Mic, label: 'Voice Comment', soon: true },
      { path: '/marketplace-crosslist', icon: ShoppingBag, label: 'Marketplace Cross-List', soon: true },
    ],
  },
];

function ExpiryBadge({ user }) {
  const { expires_at, is_trial, trial_end } = user || {};

  if (is_trial && trial_end) {
    const trialDays = Math.ceil((new Date(trial_end) - new Date()) / 86400000);
    if (trialDays >= 0) return (
      <div className="mx-3 mb-3 bg-purple-900/40 border border-purple-700/50 rounded-lg p-2 text-xs text-purple-300 flex items-center gap-1">
        <Clock size={11} /> Mode Trial — {trialDays} hari tersisa
      </div>
    );
  }

  if (!expires_at) return null;
  const days = Math.ceil((new Date(expires_at) - new Date()) / 86400000);
  if (days < 0) return (
    <div className="mx-3 mb-3 bg-red-900/40 border border-red-700/50 rounded-lg p-2 text-xs text-red-300 flex items-center gap-1">
      <Calendar size={11} /> Langganan habis
    </div>
  );
  if (days <= 7) return (
    <div className="mx-3 mb-3 bg-yellow-900/40 border border-yellow-700/50 rounded-lg p-2 text-xs text-yellow-300 flex items-center gap-1">
      <Calendar size={11} /> Habis {days} hari lagi
    </div>
  );
  return null;
}

export default function Layout({ children, user, onLogout }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = user?.role === 'admin';
  const navGroups = isAdmin ? adminNavGroups : userNavGroups;
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const branding = useBranding();

  const activeGroupLabels = useMemo(() => new Set(navGroups.filter(group => group.items.some(item => item.path === location.pathname)).map(group => group.label)), [location.pathname, navGroups]);

  const isGroupCollapsed = (label) => collapsedGroups[label] && !activeGroupLabels.has(label);
  const toggleGroup = (label) => setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 transform transition-transform duration-300 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}>
        <div className="sticky top-0 z-10 border-b border-gray-800 flex-shrink-0 bg-gray-900/95 backdrop-blur-sm">
          {branding.brand_logo_url ? (
            <div className="px-4 py-4">
              <img src={branding.brand_logo_url} alt={branding.brand_name || 'Logo'} style={{ width: `${branding.brand_logo_size || 100}%` }} className="object-contain" />
            </div>
          ) : branding.brand_icon_url ? (
            <div className="flex items-center gap-3 px-6 py-5">
              <img src={branding.brand_icon_url} alt="" className="w-9 h-9 rounded-xl object-cover" />
              <div>
                <h1 className="text-white font-bold text-lg leading-none">{branding.brand_name || 'ArzaBot'}</h1>
                <p className="text-gray-400 text-xs">{branding.brand_tagline || 'Multi Akun Manager'}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-6 py-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: branding.brand_primary_color || '#2563eb' }}>
                <Facebook size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-none">{branding.brand_name || 'ArzaBot'}</h1>
                <p className="text-gray-400 text-xs">{branding.brand_tagline || 'Multi Akun Manager'}</p>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-4 pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-700 hover:scrollbar-thumb-gray-600">
          {navGroups.map(group => {
            const collapsed = isGroupCollapsed(group.label);
            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 mb-1 text-left"
                >
                  <p className={`text-xs font-semibold uppercase tracking-wider ${group.label === 'Admin' ? 'text-yellow-600' : group.label === 'Coming Soon' ? 'text-purple-500' : 'text-gray-600'}`}>{group.label}</p>
                  <span className={`text-gray-600 transition-transform ${collapsed ? '' : 'rotate-180'}`}>⌃</span>
                </button>
                {!collapsed && (
                  <div className="space-y-0.5">
                    {group.items.map(({ path, icon: Icon, label, admin: isAdminItem, soon }) => {
                      const isActive = location.pathname === path;
                      return (
                        <Link
                          key={path}
                          to={path}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                            isAdminItem
                              ? isActive
                                ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-600/20'
                                : 'text-yellow-500 hover:text-yellow-300 hover:bg-yellow-900/30'
                              : isActive
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                : 'text-gray-400 hover:text-white hover:bg-gray-800'
                          }`}
                        >
                          <Icon size={17} />
                          <span className="font-medium text-sm flex-1">{label}</span>
                          {soon && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-600/30 text-purple-300 border border-purple-500/40 uppercase">Soon</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex-shrink-0">
          <ExpiryBadge user={user} />
          <div className="p-4 border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${isAdmin ? 'bg-gradient-to-br from-yellow-500 to-orange-600' : 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
                  {user?.username?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{user?.username}</p>
                  <p className={`text-xs font-medium ${isAdmin ? 'text-yellow-500' : 'text-gray-500'}`}>
                    {isAdmin ? '👑 Admin' : 'User'}
                  </p>
                </div>
              </div>
              <button onClick={onLogout} className="text-gray-400 hover:text-red-400 transition-colors flex-shrink-0 ml-2" title="Logout">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white"><Menu size={22} /></button>
          {branding.brand_logo_url ? <img src={branding.brand_logo_url} alt={branding.brand_name} className="h-7 max-w-[130px] object-contain" /> : <span className="text-white font-semibold">{branding.brand_name || 'ArzaBot'}</span>}
          <div className="w-8" />
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
