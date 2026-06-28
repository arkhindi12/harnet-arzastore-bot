/**
 * obscuraService.js
 * Engine ringan Obscura untuk task headless FB
 */
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const OBSCURA_BIN = path.join(__dirname, '../../bin/obscura');
const PROFILE_ROOT = path.join(__dirname, '../../data/browser-profiles');

function parseCookies(raw) {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p.map(normalizeCookie);
    if (p.cookies) return p.cookies.map(normalizeCookie);
  } catch (e) {}
  return raw.split(';').map(pair => {
    const [name, ...rest] = pair.trim().split('=');
    return normalizeCookie({ name: name.trim(), value: rest.join('=').trim() });
  }).filter(c => c.name);
}

function normalizeCookie(c) {
  return {
    name: c.name, value: c.value,
    domain: c.domain || '.facebook.com', path: c.path || '/',
    httpOnly: c.httpOnly || false, secure: c.secure !== undefined ? c.secure : true,
    sameSite: c.sameSite || 'None',
  };
}

function prepareProfile(accountId, cookiesRaw) {
  const profileDir = path.join(PROFILE_ROOT, accountId, 'obscura');
  fs.mkdirSync(profileDir, { recursive: true });
  fs.writeFileSync(path.join(profileDir, 'cookies.json'), JSON.stringify(parseCookies(cookiesRaw), null, 2));
  return profileDir;
}

function obscuraFetch({ url, storageDir, proxy, evalExpr, wait = 8, timeout = 30 }) {
  return new Promise((resolve, reject) => {
    const args = ['fetch', url, '--stealth', '--storage-dir', storageDir, '--wait', String(wait), '--timeout', String(timeout)];
    if (proxy) args.push('--proxy', proxy);
    if (evalExpr) args.push('--eval', evalExpr);
    execFile(OBSCURA_BIN, args, { timeout: (timeout + 10) * 1000 }, (err, stdout) => {
      if (err && !stdout) return reject(err);
      const lines = (stdout || '').split('\n').filter(l => l.trim().startsWith('{'));
      const last = lines[lines.length - 1];
      try { resolve(last ? JSON.parse(last) : { raw: stdout }); }
      catch (e) { resolve({ raw: stdout }); }
    });
  });
}

// Eval: detect join/leave/member via button text (works on full FB site)
const JOIN_EVAL = `(function(){
  var btns=Array.from(document.querySelectorAll('[role=button],button'));
  var joinKw=['Bergabung','Join','Minta bergabung','Request to join'];
  var leaveKw=['Keluar','Leave','Sudah bergabung','Joined','Following','Mengikuti'];
  var hasJoin=btns.some(function(b){var t=b.innerText.trim();return joinKw.some(function(k){return t===k||t.startsWith(k);});});
  var isMember=btns.some(function(b){var t=b.innerText.trim();return leaveKw.some(function(k){return t===k||t.startsWith(k);});});
  return JSON.stringify({
    url:location.href,title:document.title,
    isMember:isMember,hasJoin:hasJoin,
    loginOk:!location.href.includes('login')&&!document.querySelector('#login_form,#loginbutton'),
    btnTexts:btns.map(function(b){return b.innerText.trim();}).filter(function(t){return t.length>0&&t.length<40;}).slice(0,15)
  });
})()`;

const CLICK_JOIN_EVAL = `(function(){
  var joinKw=['Bergabung','Join','Minta bergabung','Request to join'];
  var btns=Array.from(document.querySelectorAll('[role=button],button'));
  var btn=btns.find(function(b){var t=b.innerText.trim();return joinKw.some(function(k){return t===k||t.startsWith(k);});});
  if(!btn) return JSON.stringify({clicked:false,reason:'btn not found'});
  btn.click();
  return JSON.stringify({clicked:true,btnText:btn.innerText.trim().slice(0,50)});
})()`;

async function checkLogin(account) {
  const storageDir = prepareProfile(account.id, account.cookies);
  try {
    const r = await obscuraFetch({
      url: 'https://mbasic.facebook.com/', storageDir, proxy: account.proxy,
      evalExpr: 'JSON.stringify({loggedIn:!location.href.includes("login")&&!document.querySelector("#login_form,#loginbutton"),url:location.href})',
      wait: 8, timeout: 30,
    });
    return r.loggedIn === true;
  } catch (e) { return false; }
}

async function getGroupInfo(account, groupUrl) {
  const storageDir = prepareProfile(account.id, account.cookies);
  try {
    return await obscuraFetch({ url: groupUrl, storageDir, proxy: account.proxy, evalExpr: JOIN_EVAL, wait: 10, timeout: 35 });
  } catch (e) { return { error: e.message }; }
}

async function joinGroup(account, groupUrl) {
  const storageDir = prepareProfile(account.id, account.cookies);
  try {
    const check = await obscuraFetch({ url: groupUrl, storageDir, proxy: account.proxy, evalExpr: JOIN_EVAL, wait: 10, timeout: 35 });
    if (!check.loginOk) return { success: false, message: 'Cookie expired / tidak login' };
    if (check.isMember) return { success: false, message: 'Sudah member grup ini' };
    if (!check.hasJoin) return { success: false, message: `Tombol join tidak ditemukan. Buttons: ${JSON.stringify(check.btnTexts)}` };

    const join = await obscuraFetch({ url: groupUrl, storageDir, proxy: account.proxy, evalExpr: CLICK_JOIN_EVAL, wait: 5, timeout: 25 });
    if (join.clicked) return { success: true, message: `${groupUrl} → join request sent (${join.btnText})` };
    return { success: false, message: `Gagal klik: ${join.reason}` };
  } catch (e) { return { success: false, message: `Error: ${e.message}` }; }
}


/**
 * searchGroups - cari grup FB via keyword (Obscura)
 */
async function searchGroups(account, keyword, maxItems) {
  const max = maxItems || 20;
  await prepareProfile(account);
  const url = 'https://www.facebook.com/search/groups/?q=' + encodeURIComponent(keyword);
  const evalJs = 'JSON.stringify((function(){ var cards=Array.from(document.querySelectorAll("a[href*=\"/groups/\"]")).filter(function(a){var h=a.href||"";return /\/groups\/[^/?#]+/.test(h)&&!h.includes("/groups/feed")&&!h.includes("/groups/discover");}); var seen={}; var res=[]; for(var i=0;i<cards.length;i++){var a=cards[i]; var m=a.href.match(/\/groups\/([^/?#]+)/); var gid=m?m[1]:null; if(!gid||seen[gid]) continue; seen[gid]=1; res.push({group_id:gid,url:"https://www.facebook.com/groups/"+gid,name:(a.innerText||"").split("\\n")[0].trim()}); if(res.length>='+max+') break;} return res;})())';
  const result = await obscuraFetch(url, {
    storageDir: getProfileDir(account.id),
    eval: evalJs,
    wait: 6,
    timeout: 40,
    extraArgs: ['--stealth'],
  });
  try {
    const parsed = JSON.parse(result.evalResult || '[]');
    return { success: true, groups: parsed };
  } catch(e) {
    return { success: false, groups: [], message: e.message };
  }
}

module.exports = {checkLogin, joinGroup, getGroupInfo, prepareProfile, parseCookies,
  searchGroups
};
