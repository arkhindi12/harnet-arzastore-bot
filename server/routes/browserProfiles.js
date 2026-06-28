const express = require('express');
const db = require('../db/database');
const { authMiddleware, subscriptionMiddleware } = require('../middleware/auth');
const { 
  getOrCreateProfile, 
  getProfileStats, 
  deleteProfile, 
  exportProfile,
  saveCookiesToProfile,
  updateProfileMetadata 
} = require('../services/browserProfileService');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get all profiles for current user
router.get('/', authMiddleware, subscriptionMiddleware, (req, res) => {
  try {
    const accounts = db.prepare(`
      SELECT id, name, status FROM fb_accounts WHERE user_id = ?
    `).all(req.userId);

    const profiles = accounts.map(acc => {
      const stats = getProfileStats(acc.id);
      return {
        accountId: acc.id,
        accountName: acc.name,
        accountStatus: acc.status,
        profile: stats,
      };
    }).filter(p => p.profile);

    res.json({ total: profiles.length, profiles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get profile for specific account
router.get('/:accountId', authMiddleware, subscriptionMiddleware, (req, res) => {
  try {
    const account = db.prepare(`
      SELECT id, name, status FROM fb_accounts WHERE id = ? AND user_id = ?
    `).get(req.params.accountId, req.userId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const stats = getProfileStats(account.id);
    if (!stats) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create or refresh profile for account
router.post('/:accountId/refresh', authMiddleware, subscriptionMiddleware, (req, res) => {
  try {
    const account = db.prepare(`
      SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?
    `).get(req.params.accountId, req.userId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const profile = getOrCreateProfile(account.id);
    res.json({ 
      message: 'Profile refreshed',
      profile 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete profile
router.delete('/:accountId', authMiddleware, (req, res) => {
  try {
    const account = db.prepare(`
      SELECT id, user_id FROM fb_accounts WHERE id = ? AND user_id = ?
    `).get(req.params.accountId, req.userId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const success = deleteProfile(account.id);
    if (!success) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ message: 'Profile deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Export profile as zip
router.post('/:accountId/export', authMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const account = db.prepare(`
      SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?
    `).get(req.params.accountId, req.userId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const { archiveFile, size } = await exportProfile(account.id);
    res.json({ 
      message: 'Profile exported',
      archiveFile,
      size,
      downloadUrl: `/api/browser-profiles/${account.id}/download`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update profile metadata (called after browser session)
router.post('/:accountId/update-metadata', authMiddleware, (req, res) => {
  try {
    const account = db.prepare(`
      SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?
    `).get(req.params.accountId, req.userId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const { sizeMb, cookiesCount, localStorageCount, sessionStorageCount } = req.body;
    
    updateProfileMetadata(account.id, {
      sizeMb: sizeMb || 0,
      cookiesCount: cookiesCount || 0,
      localStorageCount: localStorageCount || 0,
      sessionStorageCount: sessionStorageCount || 0,
    });

    res.json({ message: 'Metadata updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Sync cookies from fb_accounts.cookies to profile storage
router.post('/:accountId/sync-cookies', authMiddleware, (req, res) => {
  try {
    const account = db.prepare(`
      SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?
    `).get(req.params.accountId, req.userId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const { syncCookiesFromAccount } = require('../services/browserProfileService');
    const result = syncCookiesFromAccount(account.id);
    
    if (!result.synced) {
      return res.status(400).json({ error: result.reason });
    }

    res.json({ message: 'Cookies synced to profile', count: result.count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get profile usage summary
router.get('/:accountId/stats', authMiddleware, subscriptionMiddleware, (req, res) => {
  try {
    const account = db.prepare(`
      SELECT id FROM fb_accounts WHERE id = ? AND user_id = ?
    `).get(req.params.accountId, req.userId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const stats = getProfileStats(account.id);
    res.json(stats || { message: 'No profile yet' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
