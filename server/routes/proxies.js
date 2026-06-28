const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const db = require("../db/database");
const { authMiddleware } = require("../middleware/auth");
router.use(authMiddleware);

// GET /api/proxies
router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM proxies WHERE user_id=? ORDER BY created_at DESC").all(req.userId);
  res.json(rows);
});

// POST /api/proxies
router.post("/", (req, res) => {
  const { label, url, country } = req.body;
  if (!url) return res.status(400).json({ error: "url wajib diisi" });
  const id = uuidv4();
  db.prepare("INSERT INTO proxies (id,user_id,label,url,country) VALUES (?,?,?,?,?)").run(id, req.userId, label||null, url, country||null);
  res.json({ id, message: "Proxy ditambahkan" });
});

// POST /api/proxies/bulk — import banyak sekaligus (1 per baris)
router.post("/bulk", (req, res) => {
  const { lines } = req.body;
  if (!lines?.length) return res.status(400).json({ error: "lines wajib diisi" });
  let added = 0;
  for (const line of lines) {
    const url = line.trim();
    if (!url) continue;
    const id = uuidv4();
    db.prepare("INSERT INTO proxies (id,user_id,url) VALUES (?,?,?)").run(id, req.userId, url);
    added++;
  }
  res.json({ added, message: added + " proxy ditambahkan" });
});

// PUT /api/proxies/:id
router.put("/:id", (req, res) => {
  const { label, url, country } = req.body;
  db.prepare("UPDATE proxies SET label=?,url=?,country=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").run(label||null, url, country||null, req.params.id, req.userId);
  res.json({ message: "Proxy diperbarui" });
});

// DELETE /api/proxies/:id
router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM proxies WHERE id=? AND user_id=?").run(req.params.id, req.userId);
  res.json({ message: "Proxy dihapus" });
});

// POST /api/proxies/:id/test — ping test
router.post("/:id/test", async (req, res) => {
  const proxy = db.prepare("SELECT * FROM proxies WHERE id=? AND user_id=?").get(req.params.id, req.userId);
  if (!proxy) return res.status(404).json({ error: "Tidak ditemukan" });
  try {
    const { testProxy } = require("../services/proxyTestService");
    const result = await testProxy(proxy.url);
    db.prepare("UPDATE proxies SET status=?,latency_ms=?,last_checked=CURRENT_TIMESTAMP,fail_count=? WHERE id=?")
      .run(result.status, result.latency_ms||null, result.status==="dead" ? (proxy.fail_count||0)+1 : 0, proxy.id);
    res.json(result);
  } catch(e) {
    db.prepare("UPDATE proxies SET status=?,last_checked=CURRENT_TIMESTAMP,fail_count=fail_count+1 WHERE id=?").run("dead", proxy.id);
    res.json({ status: "dead", error: e.message });
  }
});

// POST /api/proxies/test-all
router.post("/test-all", async (req, res) => {
  const proxies = db.prepare("SELECT * FROM proxies WHERE user_id=?").all(req.userId);
  if (!proxies.length) return res.json({ tested: 0 });
  const { testProxy } = require("../services/proxyTestService");
  let alive = 0, dead = 0;
  for (const proxy of proxies) {
    try {
      const r = await testProxy(proxy.url);
      db.prepare("UPDATE proxies SET status=?,latency_ms=?,last_checked=CURRENT_TIMESTAMP,fail_count=? WHERE id=?")
        .run(r.status, r.latency_ms||null, r.status==="dead"?(proxy.fail_count||0)+1:0, proxy.id);
      if (r.status === "alive") alive++; else dead++;
    } catch { dead++; db.prepare("UPDATE proxies SET status=?,last_checked=CURRENT_TIMESTAMP,fail_count=fail_count+1 WHERE id=?").run("dead", proxy.id); }
  }
  res.json({ tested: proxies.length, alive, dead });
});

// POST /api/proxies/:id/assign — assign proxy ke akun
router.post("/:id/assign", (req, res) => {
  const { account_id } = req.body;
  const proxy = db.prepare("SELECT * FROM proxies WHERE id=? AND user_id=?").get(req.params.id, req.userId);
  if (!proxy) return res.status(404).json({ error: "Proxy tidak ditemukan" });
  const account = db.prepare("SELECT id FROM fb_accounts WHERE id=? AND user_id=?").get(account_id, req.userId);
  if (!account) return res.status(404).json({ error: "Akun tidak ditemukan" });
  db.prepare("UPDATE fb_accounts SET proxy=? WHERE id=?").run(proxy.url, account_id);
  res.json({ message: "Proxy berhasil di-assign ke akun" });
});

module.exports = router;
