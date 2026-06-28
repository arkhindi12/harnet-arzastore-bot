import { useEffect } from 'react';

function setMeta(name, content, attr = 'name') {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel, href, type = null) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  if (type) el.setAttribute('type', type);
}

export function applySEO(seo) {
  if (!seo) return;

  if (seo.site_title) document.title = seo.site_title;

  setMeta('description', seo.meta_description);
  setMeta('keywords', seo.meta_keywords);
  setMeta('author', seo.meta_author);
  setMeta('robots', seo.meta_robots);
  setMeta('theme-color', seo.theme_color);

  setMeta('og:title', seo.og_title, 'property');
  setMeta('og:description', seo.og_description, 'property');
  setMeta('og:image', seo.og_image, 'property');
  setMeta('og:url', seo.og_url, 'property');
  setMeta('og:type', seo.og_type || 'website', 'property');
  setMeta('og:site_name', seo.og_site_name, 'property');

  setMeta('twitter:card', seo.twitter_card || 'summary_large_image');
  setMeta('twitter:title', seo.twitter_title);
  setMeta('twitter:description', seo.twitter_description);
  setMeta('twitter:image', seo.twitter_image);
  if (seo.twitter_site) setMeta('twitter:site', seo.twitter_site);

  if (seo.canonical_url) setLink('canonical', seo.canonical_url);
  if (seo.favicon_url) setLink('icon', seo.favicon_url, 'image/svg+xml');
}

export default function useSEO() {
  useEffect(() => {
    fetch('/api/seo/public')
      .then(r => r.json())
      .then(seo => applySEO(seo))
      .catch(() => {});
  }, []);
}
