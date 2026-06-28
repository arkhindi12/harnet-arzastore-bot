import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage';
import LandingSettingsPage from './pages/LandingSettingsPage';
import LandingBuilderPage from './pages/LandingBuilderPage';
import Dashboard from './pages/Dashboard';
import AccountsPage from './pages/AccountsPage';
import CampaignsPage from './pages/CampaignsPage';
import CampaignDetailPage from './pages/CampaignDetailPage';
import PostToolsPage from './pages/PostToolsPage';
import SmartMonitorPage from './pages/SmartMonitorPage';
import SchedulerLogsPage from './pages/SchedulerLogsPage';
import NicheGroupsPage from './pages/NicheGroupsPage';
import AntiDetectionPage from './pages/AntiDetectionPage';
import WarmingPage from './pages/WarmingPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import BrandingPage from './pages/BrandingPage';
import SystemConfigPage from './pages/SystemConfigPage';
import ComingSoonPage from './pages/ComingSoonPage';
import CookieRotationPage from './pages/CookieRotationPage';
import ReplyChainPage from './pages/ReplyChainPage';
import ContentCalendarPage from './pages/ContentCalendarPage';
import ProxyManagerPage from './pages/ProxyManagerPage';
import ConversationPage from './pages/ConversationPage';
import SEOPage from './pages/SEOPage';
import PricingPage from './pages/PricingPage';
import PlansAdminPage from './pages/PlansAdminPage';
import PaymentResultPage from './pages/PaymentResultPage';
import ManualPaymentPage from './pages/ManualPaymentPage';
import PendingPaymentPage from './pages/PendingPaymentPage';
import FeatureRequestPage from './pages/FeatureRequestPage';
import BlacklistPage from './pages/BlacklistPage';
import TemplatesPage from './pages/TemplatesPage';
import LeaderboardPage from './pages/LeaderboardPage';
import TeamPage from './pages/TeamPage';
import CampaignLibraryPage from './pages/CampaignLibraryPage';
import WebhookPage from './pages/WebhookPage';
import ReferralPage from './pages/ReferralPage';
import APIPage from './pages/APIPage';
import ResellerPage from './pages/ResellerPage';
import AdminResellersPage from './pages/AdminResellersPage';
import Layout from './components/Layout';
import PaywallOverlay from './components/PaywallOverlay';
import OnboardingModal from './components/OnboardingModal';
import useSEO from './hooks/useSEO';
import api from './utils/api';

export default function App() {
  useSEO();
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); }
    catch { return null; }
  });
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', userData.token);
    // Cek apakah user baru (belum punya akun FB) → tampilkan onboarding
    setTimeout(async () => {
      try {
        const res = await api.get('/accounts');
        if ((res.data || []).length === 0) {
          // Cek apakah sudah pernah lihat onboarding
          const seen = localStorage.getItem('onboarding_seen');
          if (!seen) setShowOnboarding(true);
        }
      } catch {}
    }, 500);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('onboarding_seen', '1');
  };

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route path="/register" element={<RegisterPage onLogin={handleLogin} />} />
        <Route path="/pricing" element={<PricingPage user={null} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <Layout user={user} onLogout={handleLogout}>
      <PaywallOverlay />
      <Routes>
        <Route path="/" element={<Dashboard user={user} />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="/post-tools" element={<PostToolsPage />} />
        <Route path="/smart-monitor" element={<SmartMonitorPage />} />
        <Route path="/warming" element={<WarmingPage />} />
        <Route path="/scheduler-logs" element={<SchedulerLogsPage />} />
        <Route path="/niche-groups" element={<NicheGroupsPage />} />
        <Route path="/anti-detection" element={<AntiDetectionPage />} />
        <Route path="/cookie-rotation" element={<CookieRotationPage />} />
        <Route path="/post-predictor" element={<ComingSoonPage />} />
        <Route path="/reply-chain" element={<ReplyChainPage />} />
        <Route path="/sentiment-guard" element={<ComingSoonPage />} />
        <Route path="/cross-platform" element={<ComingSoonPage />} />
        <Route path="/content-calendar" element={<ContentCalendarPage />} />
        <Route path="/post-recycler" element={<ComingSoonPage />} />
        <Route path="/voice-comment" element={<ComingSoonPage />} />
        <Route path="/marketplace-crosslist" element={<ComingSoonPage />} />
        <Route path="/smart-schedule" element={<ComingSoonPage />} />
        <Route path="/conversation-service" element={<ConversationPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/pricing" element={<PricingPage user={user} />} />
        <Route path="/payment/finish" element={<PaymentResultPage type="finish" />} />
        <Route path="/payment/pending" element={<PaymentResultPage type="pending" />} />
        <Route path="/payment/error" element={<PaymentResultPage type="error" />} />
        <Route path="/payment/manual" element={<ManualPaymentPage />} />
        <Route path="/payment/pending-info" element={<PendingPaymentPage />} />
        <Route path="/feature-requests" element={<FeatureRequestPage user={user} />} />
        <Route path="/blacklist" element={<BlacklistPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/campaign-library" element={<CampaignLibraryPage />} />
        <Route path="/webhooks" element={<WebhookPage />} />
        <Route path="/referral" element={<ReferralPage />} />
        <Route path="/api-keys" element={<APIPage />} />
        <Route path="/reseller" element={<ResellerPage />} />
        {isAdmin && <Route path="/admin" element={<AdminPage />} />}
        {isAdmin && <Route path="/seo" element={<SEOPage />} />}
        {isAdmin && <Route path="/admin/branding" element={<BrandingPage />} />}
        {isAdmin && <Route path="/admin/system-config" element={<SystemConfigPage />} />}
        {isAdmin && <Route path="/admin/plans" element={<PlansAdminPage />} />}
        {isAdmin && <Route path="/admin/resellers" element={<AdminResellersPage />} />}
        {isAdmin && <Route path="/admin/landing" element={<LandingBuilderPage />} />}
        {isAdmin && <Route path="/admin/landing/settings" element={<LandingSettingsPage />} />}
        <Route path="/proxy-manager" element={<ProxyManagerPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      {showOnboarding && <OnboardingModal onClose={handleCloseOnboarding} />}
    </Layout>
  );
}
