const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
router.use(authMiddleware);

function genCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

router.get('/', (req, res) => {
  const owned = db.prepare('SELECT * FROM teams WHERE owner_id = ?').all(req.userId);
  const memberships = db.prepare(`
    SELECT t.*, tm.role FROM teams t
    JOIN team_members tm ON t.id = tm.team_id
    WHERE tm.user_id = ? AND t.owner_id != ?
  `).all(req.userId, req.userId);

  const enrichTeam = (team, role) => {
    const members = db.prepare(`
      SELECT tm.id, tm.role, tm.joined_at, u.username, u.full_name
      FROM team_members tm JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
    `).all(team.id);
    const owner = db.prepare('SELECT username, full_name FROM users WHERE id = ?').get(team.owner_id);
    return { ...team, role, members, owner };
  };

  res.json({
    owned: owned.map(t => enrichTeam(t, 'owner')),
    member: memberships.map(t => enrichTeam(t, t.role)),
  });
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nama tim wajib diisi' });
  const existing = db.prepare('SELECT id FROM teams WHERE owner_id = ?').get(req.userId);
  if (existing) return res.status(400).json({ error: 'Anda sudah memiliki satu tim. Hapus tim lama untuk membuat baru.' });
  const id = uuidv4();
  let code = genCode();
  while (db.prepare('SELECT id FROM teams WHERE invite_code = ?').get(code)) code = genCode();
  db.prepare('INSERT INTO teams (id, owner_id, name, invite_code) VALUES (?,?,?,?)').run(id, req.userId, name.trim(), code);
  db.prepare('INSERT INTO team_members (id, team_id, user_id, role) VALUES (?,?,?,?)').run(uuidv4(), id, req.userId, 'owner');
  res.json({ id, invite_code: code, message: 'Tim berhasil dibuat' });
});

router.post('/join', (req, res) => {
  const { invite_code } = req.body;
  if (!invite_code?.trim()) return res.status(400).json({ error: 'Kode undangan wajib diisi' });
  const team = db.prepare('SELECT * FROM teams WHERE invite_code = ?').get(invite_code.trim().toUpperCase());
  if (!team) return res.status(404).json({ error: 'Kode undangan tidak ditemukan atau sudah tidak berlaku' });
  if (team.owner_id === req.userId) return res.status(400).json({ error: 'Anda adalah owner tim ini' });
  const already = db.prepare('SELECT id FROM team_members WHERE team_id = ? AND user_id = ?').get(team.id, req.userId);
  if (already) return res.status(400).json({ error: 'Anda sudah bergabung dengan tim ini' });
  db.prepare('INSERT INTO team_members (id, team_id, user_id, role) VALUES (?,?,?,?)').run(uuidv4(), team.id, req.userId, 'member');
  res.json({ message: `Berhasil bergabung dengan tim "${team.name}"` });
});

router.post('/:id/regenerate-code', (req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ? AND owner_id = ?').get(req.params.id, req.userId);
  if (!team) return res.status(403).json({ error: 'Hanya owner yang bisa mereset kode undangan' });
  let code = genCode();
  while (db.prepare('SELECT id FROM teams WHERE invite_code = ?').get(code)) code = genCode();
  db.prepare('UPDATE teams SET invite_code = ? WHERE id = ?').run(code, team.id);
  res.json({ invite_code: code, message: 'Kode undangan diperbarui' });
});

router.delete('/:id/members/:memberId', (req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ? AND owner_id = ?').get(req.params.id, req.userId);
  if (!team) return res.status(403).json({ error: 'Hanya owner yang bisa mengeluarkan anggota' });
  const member = db.prepare('SELECT * FROM team_members WHERE id = ? AND team_id = ?').get(req.params.memberId, req.params.id);
  if (!member) return res.status(404).json({ error: 'Anggota tidak ditemukan' });
  if (member.role === 'owner') return res.status(400).json({ error: 'Tidak bisa mengeluarkan owner' });
  db.prepare('DELETE FROM team_members WHERE id = ?').run(req.params.memberId);
  res.json({ message: 'Anggota dikeluarkan dari tim' });
});

router.post('/leave/:id', (req, res) => {
  const member = db.prepare('SELECT * FROM team_members WHERE team_id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!member) return res.status(404).json({ error: 'Anda tidak ada dalam tim ini' });
  if (member.role === 'owner') return res.status(400).json({ error: 'Owner tidak bisa meninggalkan tim. Hapus tim jika ingin keluar.' });
  db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ message: 'Berhasil keluar dari tim' });
});

router.delete('/:id', (req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ? AND owner_id = ?').get(req.params.id, req.userId);
  if (!team) return res.status(403).json({ error: 'Hanya owner yang bisa menghapus tim' });
  db.prepare('DELETE FROM team_members WHERE team_id = ?').run(req.params.id);
  db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
  res.json({ message: 'Tim dihapus' });
});

module.exports = router;
