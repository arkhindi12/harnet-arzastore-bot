const axios = require('axios');
const { getCookieHeader, getUserId, getDtsgToken, randomUA, randomLang, calculateJazoest, normalizeFacebookError } = require('./facebookService');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];
const ACCEPT_LANGS = [
  'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'id-ID,id;q=0.9,en;q=0.8',
  'en-US,en;q=0.9,id;q=0.8',
];

const CLASSIC_MBASIC_UA = 'Nokia3110c/2.0 (05.10) Profile/MIDP-2.0 Configuration/CLDC-1.1';

function rUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }
function rLang() { return ACCEPT_LANGS[Math.floor(Math.random() * ACCEPT_LANGS.length)]; }

function formatFbError(error, context = 'post_service') {
  if (!error) return null;
  if (typeof error === 'object' && error.code) return error;
  return normalizeFacebookError(error, context);
}

function extractGroupId(url) {
  const m = url.match(/facebook\.com\/groups\/([^/?#]+)/);
  return m ? m[1] : null;
}

function processSpintax(text) {
  return text.replace(/\{([^{}]+)\}/g, (_, opts) => {
    const choices = opts.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(cookieString, url) {
  const cookieHeader = getCookieHeader(cookieString);
  const attempts = [
    {
      url,
      ua: rUA(),
      referer: 'https://www.facebook.com/',
    },
  ];

  // Facebook often returns 400 on www pages, while classic mbasic still exposes DTSG.
  if (url.includes('facebook.com')) {
    attempts.push({
      url: url.replace('https://www.facebook.com', 'https://mbasic.facebook.com').replace('https://m.facebook.com', 'https://mbasic.facebook.com'),
      ua: CLASSIC_MBASIC_UA,
      referer: 'https://mbasic.facebook.com/',
    });
  }

  let lastError = 'Permintaan ke Facebook gagal';
  for (const attempt of attempts) {
    try {
      const res = await axios.get(attempt.url, {
        headers: {
          'Cookie': cookieHeader,
          'User-Agent': attempt.ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': rLang(),
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': attempt.referer,
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 15000,
        validateStatus: () => true,
      });
      if (res.status >= 400) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      const dtsg = getDtsgToken(res.data);
      return { html: res.data, dtsg, ua: attempt.ua, resolvedUrl: attempt.url };
    } catch (err) {
      lastError = err.message;
    }
  }

  return { html: null, dtsg: null, error: lastError };
}

async function upPost(cookieString, postUrl, upText = 'UP') {
  const userId = getUserId(cookieString);
  if (!userId) return { success: false, error: 'Tidak ada User ID dari cookies' };

  const { html, dtsg, ua, error } = await fetchPage(cookieString, postUrl);
  if (!html) return { success: false, error: `Gagal memuat halaman: ${error}` };
  if (!dtsg) return { success: false, error: 'Token DTSG tidak ditemukan - cookies mungkin expired' };

  const postIdPatterns = [/\/posts\/(\d+)/, /story_fbid=(\d+)/, /pfbid([A-Za-z0-9]+)/, /\/(\d{15,})/, /v=(\d+)/];
  let postId = null;
  for (const p of postIdPatterns) {
    const m = postUrl.match(p);
    if (m) { postId = m[1]; break; }
  }
  if (!postId) return { success: false, error: 'Tidak bisa ekstrak Post ID dari URL' };

  const comment = processSpintax(upText);

  try {
    const res = await axios.post('https://www.facebook.com/api/graphql/', new URLSearchParams({
      'fb_dtsg': dtsg,
      'variables': JSON.stringify({
        'feedbackID': Buffer.from(`feedback:${postId}`).toString('base64'),
        'message': { 'text': comment },
        'isPage': false,
        'UFI2CommentsProvider_commentsKey': 'UFI2CommentsProvider/default',
      }),
      'doc_id': '7834038266652962',
      '__user': userId,
      '__a': '1',
      'jazoest': calculateJazoest(dtsg),
    }), {
      headers: {
        'Cookie': getCookieHeader(cookieString),
        'User-Agent': ua || randomUA(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': postUrl,
        'Origin': 'https://www.facebook.com',
        'Accept': '*/*',
        'Accept-Language': randomLang(),
        'X-FB-Friendly-Name': 'CometUFICreateCommentMutation',
      },
      timeout: 20000,
    });

    const txt = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    if (txt.includes('"comment"') || txt.includes('"id"')) {
      return { success: true, message: 'Post berhasil di-UP', comment };
    }
    return { success: false, error: 'Response tidak dikenal dari Facebook' };
  } catch (err) {
    if (err.response?.status === 400) return { success: false, error: 'Bad Request - cookies expired' };
    if (err.response?.status === 403) return { success: false, error: 'Akses ditolak - akun dibatasi' };
    return { success: false, error: err.message };
  }
}

async function postToGroup(cookieString, groupUrl, content) {
  const userId = getUserId(cookieString);
  if (!userId) return { success: false, error: 'Tidak ada User ID dari cookies' };

  const groupId = extractGroupId(groupUrl);
  if (!groupId) return { success: false, error: 'Tidak bisa ekstrak Group ID dari URL' };

  const { html, dtsg, ua, error } = await fetchPage(cookieString, groupUrl);
  if (!html) return { success: false, error: `Gagal memuat halaman grup: ${error}` };
  if (!dtsg) return { success: false, error: 'Token DTSG tidak ditemukan' };

  const rawText = typeof content === 'string' ? content : (content?.text || '');
  const text = processSpintax(rawText);

  try {
    const variables = {
      input: {
        composer_entry_point: 'inline_composer',
        composer_source_surface: 'group',
        idempotence_token: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        message: { text },
        with_tags_data: [],
        audience: { privacy: { allow: [], base_state: 'CUSTOM', deny: [], tag_expansion_state: 'UNSPECIFIED' } },
        to: { id: groupId },
      },
      feedLocation: 'GROUP',
      feedbackSource: 0,
      groupID: groupId,
      tracking: [null],
      UFI2CommentsProvider_commentsKey: `UFI2CommentsProvider/group:${groupId}`,
      useDefaultActor: false,
    };

    const res = await axios.post('https://www.facebook.com/api/graphql/', new URLSearchParams({
      'fb_dtsg': dtsg,
      'variables': JSON.stringify(variables),
      'doc_id': '7711610262190099',
      '__user': userId,
      '__a': '1',
      'jazoest': calculateJazoest(dtsg),
    }), {
      headers: {
        'Cookie': getCookieHeader(cookieString),
        'User-Agent': ua || randomUA(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': groupUrl,
        'Origin': 'https://www.facebook.com',
        'Accept': '*/*',
        'Accept-Language': randomLang(),
        'X-FB-Friendly-Name': 'ComposerStoryCreateMutation',
      },
      timeout: 25000,
    });

    const txt = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    if (txt.includes('"story"') || txt.includes('"post_id"') || txt.includes('"id"')) {
      return { success: true, message: 'Postingan berhasil dikirim ke grup' };
    }
    if (txt.includes('not a member') || txt.includes('join') || txt.includes('bergabung')) {
      return { success: false, error: 'Akun bukan anggota grup ini', code: 'ACCESS_DENIED', recommendation: 'Bergabung ke grup terlebih dahulu sebelum posting.' };
    }
    if (txt.includes('pending') || txt.includes('approval') || txt.includes('persetujuan')) {
      return { success: true, message: 'Postingan dikirim, menunggu persetujuan admin grup' };
    }
    if (txt.includes('spam') || txt.includes('blocked') || txt.includes('diblokir')) {
      const e = formatFbError('Facebook menolak postingan (spam/rate limited)', 'post_service.group_post');
      return { success: false, error: e.message, code: e.code, recommendation: e.recommendation };
    }
    const eu = formatFbError('Response tidak dikenal dari Facebook', 'post_service.group_post');
    return { success: false, error: eu.message, code: eu.code, recommendation: eu.recommendation };
  } catch (err) {
    const e = formatFbError(err.response?.status === 400 ? 'Bad Request - cookies expired' : err.response?.status === 403 ? 'Akses ditolak - akun tidak bisa posting di grup ini' : err.message, 'post_service.group_post');
    return { success: false, error: e.message, code: e.code, recommendation: e.recommendation };
  }
}

const CATEGORY_MAP = {
  'Kendaraan': 'vehicles',
  'Properti': 'propertyrentals',
  'Elektronik': 'electronics',
  'Pakaian': 'clothing',
  'Perabotan': 'furniture',
  'Taman': 'garden',
  'Hobi': 'hobbies',
  'Mainan': 'toys',
  'Lainnya': 'misc',
};

function randomPrice(min, max) {
  if (!min && !max) return 0;
  if (!max || min === max) return parseInt(min) || 0;
  const lo = Math.min(parseInt(min), parseInt(max));
  const hi = Math.max(parseInt(min), parseInt(max));
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function randomOffset(val, offset) {
  if (!offset) return val;
  return val + (Math.random() * 2 - 1) * offset;
}

async function postToMarketplace(cookieString, listing) {
  const userId = getUserId(cookieString);
  if (!userId) return { success: false, error: 'Tidak ada User ID dari cookies' };

  const { html, dtsg, ua, error } = await fetchPage(cookieString, 'https://www.facebook.com/marketplace/');
  if (!html) return { success: false, error: `Gagal memuat Marketplace: ${error}` };
  if (!dtsg) return { success: false, error: 'Token DTSG tidak ditemukan' };

  const title = processSpintax(listing.title || '');
  const description = processSpintax(listing.description || '');
  const price = randomPrice(listing.price_min ?? listing.price, listing.price_max ?? listing.price);
  const categoryKey = CATEGORY_MAP[listing.category] || 'misc';

  const baseLat = listing.latitude || -6.2088;
  const baseLng = listing.longitude || 106.8456;
  const offsetVal = listing.location_random_offset || 0;
  const lat = randomOffset(baseLat, offsetVal);
  const lng = randomOffset(baseLng, offsetVal);

  const listingPhotos = [];
  if (Array.isArray(listing.images) && listing.images.length > 0) {
    for (const imgUrl of listing.images.slice(0, 8)) {
      if (imgUrl && imgUrl.trim()) {
        listingPhotos.push({ url: imgUrl.trim() });
      }
    }
  }

  try {
    const variables = {
      input: {
        listing_type: 'PRODUCT_LISTING',
        title,
        description,
        price: { amount: String(price), currency: 'IDR' },
        condition: listing.condition || 'USED_GOOD',
        category_id: categoryKey,
        location: { latitude: lat, longitude: lng },
        listing_photos: listingPhotos,
        custom_fields: [],
        hide_from_friends: listing.hide_from_friends || false,
        viewer_actor_id: userId,
      },
    };

    const res = await axios.post('https://www.facebook.com/api/graphql/', new URLSearchParams({
      'fb_dtsg': dtsg,
      'variables': JSON.stringify(variables),
      'doc_id': '8425073700873210',
      '__user': userId,
      '__a': '1',
      'jazoest': calculateJazoest(dtsg),
    }), {
      headers: {
        'Cookie': getCookieHeader(cookieString),
        'User-Agent': ua || randomUA(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://www.facebook.com/marketplace/create/item',
        'Origin': 'https://www.facebook.com',
        'Accept': '*/*',
        'Accept-Language': randomLang(),
        'X-FB-Friendly-Name': 'MarketplaceAddListingMutation',
      },
      timeout: 25000,
    });

    const txt = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const listingIdMatch = txt.match(/"marketplace_listing":\{"id":"(\d+)"/);
    if (listingIdMatch) {
      return { success: true, message: `Listing berhasil (ID: ${listingIdMatch[1]})`, listingId: listingIdMatch[1], price };
    }
    if (txt.includes('"listing"') || txt.includes('"id"')) {
      return { success: true, message: `Listing berhasil diposting (Rp ${price.toLocaleString('id-ID')})`, price };
    }
    if (txt.includes('spam') || txt.includes('blocked')) {
      const e = formatFbError('Facebook menolak listing — akun perlu jeda atau verifikasi', 'post_service.marketplace');
      return { success: false, error: e.message, code: e.code, recommendation: e.recommendation };
    }
    const eu = formatFbError('Response tidak dikenal dari Facebook Marketplace', 'post_service.marketplace');
    return { success: false, error: eu.message, code: eu.code, recommendation: eu.recommendation };
  } catch (err) {
    const e = formatFbError(err.response?.status === 400 ? 'Bad Request - cookies expired' : err.response?.status === 403 ? 'Akses ditolak - aktifkan Marketplace di akun ini dulu' : err.message, 'post_service.marketplace');
    return { success: false, error: e.message, code: e.code, recommendation: e.recommendation };
  }
}

module.exports = { upPost, postToGroup, postToMarketplace, processSpintax };
