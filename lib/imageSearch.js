import fs from 'fs';
import path from 'path';
import { parseNetscapeCookies } from './ytdl.js';

const BROWSER_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MOBILE_UA =
	'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36';
const WIKI_UA = 'WhatsAppBot-ImageSearch/1.0 (https://github.com; bot@localhost)';

export const DEFAULT_IMAGE_COUNT = 3;
export const MAX_IMAGE_COUNT = 12;

export function normalizeDigits(str) {
	return String(str || '').replace(/[٠-٩۰-۹]/g, (d) => {
		const code = d.charCodeAt(0);
		if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
		if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
		return d;
	});
}

function decodeHtmlEntities(str) {
	return String(str || '')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>');
}

export function isValidImageUrl(url) {
	if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
	if (/\.(svg|ico|mp4|webm|m3u8|html?|php|js|css)(?:$|\?)/i.test(url)) return false;
	if (/gstatic\.com\/images\?|bing\.com\/th\?id=OIP_placeholder/i.test(url)) return false;
	return true;
}

export function detectImageMimeFromBuffer(buf) {
	if (!Buffer.isBuffer(buf) || buf.length < 16) return null;
	if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
	if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
	if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
	if (buf.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif';
	return null;
}

function getPinterestSavedCookies() {
	try {
		const cookiePath = path.join(process.cwd(), 'data', 'pinterest-cookies.txt');
		if (!fs.existsSync(cookiePath)) return { cookieHeader: '', csrftoken: '' };
		const savedHeader = parseNetscapeCookies(fs.readFileSync(cookiePath, 'utf8'), ['pinterest.com']);
		const m = savedHeader.match(/(?:^|;\s*)csrftoken=([^;]+)/);
		return { cookieHeader: savedHeader, csrftoken: m?.[1] || '' };
	} catch {
		return { cookieHeader: '', csrftoken: '' };
	}
}

async function searchBing(query, limit, fetchFn) {
	const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
	const res = await fetchFn(url, {
		headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8' },
		signal: AbortSignal.timeout(12000),
	});
	if (!res.ok) throw new Error(`Bing HTTP ${res.status}`);
	const html = await res.text();
	const out = [];
	const seen = new Set();
	for (const match of html.matchAll(/murl&quot;:&quot;(https?:\/\/[^&"]+)&quot;(?:[^}]{0,250}?t&quot;:&quot;([^&"]*?)&quot;)?/g)) {
		const imgUrl = decodeHtmlEntities(match[1]);
		if (!isValidImageUrl(imgUrl) || seen.has(imgUrl)) continue;
		seen.add(imgUrl);
		out.push({
			url: imgUrl,
			title: decodeHtmlEntities(match[2] || '').trim(),
			source: 'bing',
			sourceLabel: 'Bing Images',
			referer: 'https://www.bing.com/',
		});
		if (out.length >= limit * 2) break;
	}
	return out;
}

async function searchDuckDuckGo(query, limit, fetchFn) {
	const initRes = await fetchFn(
		`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
		{ headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(12000) }
	);
	if (!initRes.ok) throw new Error(`DDG init HTTP ${initRes.status}`);
	const html = await initRes.text();
	const vqdMatch =
		html.match(/vqd=["']?([0-9-]+)["']?/) ||
		html.match(/vqd%3D([0-9-]+)/);
	if (!vqdMatch?.[1]) throw new Error('DDG vqd token missing');

	const apiUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqdMatch[1])}&f=,,,,,&p=1`;
	const apiRes = await fetchFn(apiUrl, {
		headers: { 'User-Agent': BROWSER_UA, Referer: 'https://duckduckgo.com/' },
		signal: AbortSignal.timeout(12000),
	});
	if (!apiRes.ok) throw new Error(`DDG API HTTP ${apiRes.status}`);
	const json = await apiRes.json();
	const items = Array.isArray(json?.results) ? json.results : [];
	return items
		.filter((it) => isValidImageUrl(it?.image))
		.slice(0, limit * 2)
		.map((it) => ({
			url: it.image,
			title: String(it.title || '').trim(),
			source: 'ddg',
			sourceLabel: 'DuckDuckGo',
			referer: 'https://duckduckgo.com/',
		}));
}

async function searchPinterest(query, limit, fetchFn) {
	let { cookieHeader, csrftoken } = getPinterestSavedCookies();
	if (!cookieHeader || !csrftoken) {
		const pageRes = await fetchFn(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`, {
			headers: { 'User-Agent': MOBILE_UA, Accept: 'text/html,application/xhtml+xml' },
			signal: AbortSignal.timeout(12000),
		});
		const setCookies =
			typeof pageRes.headers?.getSetCookie === 'function'
				? pageRes.headers.getSetCookie()
				: pageRes.headers?.get?.('set-cookie')
					? [pageRes.headers.get('set-cookie')]
					: [];
		const pairs = [];
		for (const c of setCookies) {
			const kv = String(c).split(';')[0].trim();
			if (!kv) continue;
			pairs.push(kv);
			if (kv.startsWith('csrftoken=')) csrftoken = kv.slice('csrftoken='.length);
		}
		cookieHeader = [cookieHeader, pairs.join('; ')].filter(Boolean).join('; ');
	}

	const options = { query, scope: 'pins', page_size: Math.min(40, Math.max(15, limit * 3)) };
	const params = new URLSearchParams({
		source_url: `/search/pins/?q=${encodeURIComponent(query)}`,
		data: JSON.stringify({ options, context: {} }),
		_: String(Date.now()),
	});
	const res = await fetchFn(`https://www.pinterest.com/resource/BaseSearchResource/get/?${params}`, {
		headers: {
			'User-Agent': MOBILE_UA,
			Accept: 'application/json',
			'X-Requested-With': 'XMLHttpRequest',
			'X-Pinterest-PWS-Handler': 'www/search/[scope].js',
			...(csrftoken ? { 'X-CSRFToken': csrftoken } : {}),
			...(cookieHeader ? { Cookie: cookieHeader } : {}),
			Referer: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
		},
		signal: AbortSignal.timeout(12000),
	});
	if (!res.ok) throw new Error(`Pinterest HTTP ${res.status}`);
	const json = await res.json();
	const results = json?.resource_response?.data?.results || [];
	return results
		.map((r) => ({
			url: r.images?.orig?.url || r.images?.['736x']?.url || r.images?.['474x']?.url || r.images?.['236x']?.url,
			title: String(r.grid_title || r.title || '').trim(),
			source: 'pinterest',
			sourceLabel: 'Pinterest',
			referer: 'https://www.pinterest.com/',
		}))
		.filter((it) => isValidImageUrl(it.url))
		.slice(0, limit * 2);
}

async function searchYandex(query, limit, fetchFn) {
	const url = `https://yandex.com/images/search?text=${encodeURIComponent(query)}`;
	const res = await fetchFn(url, {
		headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8' },
		signal: AbortSignal.timeout(12000),
	});
	if (!res.ok) throw new Error(`Yandex HTTP ${res.status}`);
	const html = await res.text();
	const out = [];
	const seen = new Set();
	for (const match of html.matchAll(/img_url=(https?%3A%2F%2F[^&"\\]+)/gi)) {
		let imgUrl = '';
		try {
			imgUrl = decodeURIComponent(match[1]);
		} catch {
			continue;
		}
		if (!isValidImageUrl(imgUrl) || seen.has(imgUrl)) continue;
		seen.add(imgUrl);
		out.push({
			url: imgUrl,
			title: '',
			source: 'yandex',
			sourceLabel: 'Yandex Images',
			referer: 'https://yandex.com/',
		});
		if (out.length >= limit * 2) break;
	}
	return out;
}

async function searchWallhaven(query, limit, fetchFn) {
	const url = `https://wallhaven.cc/api/v1/search?q=${encodeURIComponent(query)}&purity=100`;
	const res = await fetchFn(url, {
		headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
		signal: AbortSignal.timeout(12000),
	});
	if (!res.ok) throw new Error(`Wallhaven HTTP ${res.status}`);
	const json = await res.json();
	const items = Array.isArray(json?.data) ? json.data : [];
	return items
		.filter((it) => isValidImageUrl(it?.path))
		.slice(0, limit * 2)
		.map((it) => ({
			url: it.path,
			title: String(it.resolution || it.category || '').trim(),
			source: 'wallhaven',
			sourceLabel: 'Wallhaven',
			referer: 'https://wallhaven.cc/',
		}));
}

async function searchOpenverse(query, limit, fetchFn) {
	const pageSize = Math.min(20, Math.max(6, limit * 2));
	const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=${pageSize}`;
	const res = await fetchFn(url, {
		headers: { 'User-Agent': WIKI_UA, Accept: 'application/json' },
		signal: AbortSignal.timeout(12000),
	});
	if (!res.ok) throw new Error(`Openverse HTTP ${res.status}`);
	const json = await res.json();
	const items = Array.isArray(json?.results) ? json.results : [];
	return items
		.filter((it) => isValidImageUrl(it?.url))
		.slice(0, limit * 2)
		.map((it) => ({
			url: it.url,
			title: String(it.title || '').trim(),
			source: 'openverse',
			sourceLabel: 'Openverse',
		}));
}

async function searchWikimedia(query, limit, fetchFn) {
	const gsrlimit = Math.min(25, Math.max(8, limit * 2));
	const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=${gsrlimit}&prop=imageinfo&iiprop=url|mime&format=json`;
	const res = await fetchFn(url, {
		headers: { 'User-Agent': WIKI_UA, Accept: 'application/json' },
		signal: AbortSignal.timeout(12000),
	});
	if (!res.ok) throw new Error(`Wikimedia HTTP ${res.status}`);
	const json = await res.json();
	const pages = Object.values(json?.query?.pages || {});
	return pages
		.map((p) => {
			const info = p?.imageinfo?.[0];
			const mime = String(info?.mime || '');
			if (mime && !/^image\/(jpeg|jpg|png|webp|gif)$/i.test(mime)) return null;
			return {
				url: info?.url,
				title: String(p?.title || '').replace(/^File:/i, '').replace(/\.[^.]+$/, ''),
				source: 'wikimedia',
				sourceLabel: 'Wikimedia Commons',
			};
		})
		.filter((it) => it && isValidImageUrl(it.url))
		.slice(0, limit * 2);
}

async function searchWikipedia(query, limit, fetchFn) {
	const isAr = /[\u0600-\u06FF]/.test(query);
	const host = isAr ? 'ar.wikipedia.org' : 'en.wikipedia.org';
	const gsrlimit = Math.min(20, Math.max(8, limit * 2));
	const url = `https://${host}/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=${gsrlimit}&prop=pageimages&piprop=original&format=json`;
	const res = await fetchFn(url, {
		headers: { 'User-Agent': WIKI_UA, Accept: 'application/json' },
		signal: AbortSignal.timeout(12000),
	});
	if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
	const json = await res.json();
	const pages = Object.values(json?.query?.pages || {});
	return pages
		.filter((p) => isValidImageUrl(p?.original?.source))
		.slice(0, limit * 2)
		.map((p) => ({
			url: p.original.source,
			title: String(p.title || '').trim(),
			source: 'wikipedia',
			sourceLabel: 'Wikipedia',
		}));
}

async function searchFlickr(query, limit, fetchFn) {
	const url = `https://www.flickr.com/services/feeds/photos_public.gne?format=json&nojsoncallback=1&tags=${encodeURIComponent(query)}`;
	const res = await fetchFn(url, {
		headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
		signal: AbortSignal.timeout(12000),
	});
	if (!res.ok) throw new Error(`Flickr HTTP ${res.status}`);
	const json = await res.json();
	const items = Array.isArray(json?.items) ? json.items : [];
	return items
		.map((it) => {
			const raw = it?.media?.m;
			if (!raw) return null;
			return {
				url: raw.replace(/_m\.(jpg|jpeg|png)$/i, '_b.$1'),
				fallbackUrl: raw,
				title: String(it.title || '').trim(),
				source: 'flickr',
				sourceLabel: 'Flickr',
			};
		})
		.filter((it) => it && isValidImageUrl(it.url))
		.slice(0, limit * 2);
}

async function searchNasa(query, limit, fetchFn) {
	const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image`;
	const res = await fetchFn(url, {
		headers: { 'User-Agent': WIKI_UA, Accept: 'application/json' },
		signal: AbortSignal.timeout(12000),
	});
	if (!res.ok) throw new Error(`NASA HTTP ${res.status}`);
	const json = await res.json();
	const items = json?.collection?.items || [];
	return items
		.map((it) => {
			const href = it?.links?.find((l) => /image/i.test(l?.render || 'image') && isValidImageUrl(l?.href))?.href;
			if (!href) return null;
			return {
				url: href,
				title: String(it?.data?.[0]?.title || '').trim(),
				source: 'nasa',
				sourceLabel: 'NASA Images',
			};
		})
		.filter(Boolean)
		.slice(0, limit * 2);
}

async function searchArtic(query, limit, fetchFn) {
	const url = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(query)}&fields=id,title,image_id&limit=${Math.min(20, Math.max(6, limit * 2))}`;
	const res = await fetchFn(url, {
		headers: { 'User-Agent': WIKI_UA, Accept: 'application/json' },
		signal: AbortSignal.timeout(12000),
	});
	if (!res.ok) throw new Error(`ArtIC HTTP ${res.status}`);
	const json = await res.json();
	const iiifBase = json?.config?.iiif_url || 'https://www.artic.edu/iiif/2';
	return (json?.data || [])
		.filter((it) => it?.image_id)
		.slice(0, limit * 2)
		.map((it) => ({
			url: `${iiifBase}/${it.image_id}/full/843,/0/default.jpg`,
			title: String(it.title || '').trim(),
			source: 'artic',
			sourceLabel: 'Art Institute of Chicago',
		}));
}

async function searchCleveland(query, limit, fetchFn) {
	const url = `https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(query)}&has_image=1&limit=${Math.min(20, Math.max(6, limit * 2))}`;
	const res = await fetchFn(url, {
		headers: { 'User-Agent': WIKI_UA, Accept: 'application/json' },
		signal: AbortSignal.timeout(12000),
	});
	if (!res.ok) throw new Error(`Cleveland HTTP ${res.status}`);
	const json = await res.json();
	return (json?.data || [])
		.filter((it) => isValidImageUrl(it?.images?.web?.url))
		.slice(0, limit * 2)
		.map((it) => ({
			url: it.images.web.url,
			title: String(it.title || '').trim(),
			source: 'cleveland',
			sourceLabel: 'Cleveland Museum',
		}));
}

async function searchSafebooru(query, limit, fetchFn) {
	const tags = query.trim().replace(/\s+/g, '_');
	const url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=${Math.min(25, Math.max(8, limit * 2))}&tags=${encodeURIComponent(tags)}`;
	const res = await fetchFn(url, {
		headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
		signal: AbortSignal.timeout(12000),
	});
	if (!res.ok) throw new Error(`Safebooru HTTP ${res.status}`);
	const text = await res.text();
	if (!text.trim()) return [];
	const items = JSON.parse(text);
	if (!Array.isArray(items)) return [];
	return items
		.map((it) => {
			const imgUrl =
				it.sample_url ||
				it.file_url ||
				(it.directory && it.image ? `https://safebooru.org/images/${it.directory}/${it.image}` : '');
			return {
				url: imgUrl,
				title: String(it.tags || '').split(/\s+/).slice(0, 5).join(', '),
				source: 'safebooru',
				sourceLabel: 'Safebooru',
			};
		})
		.filter((it) => isValidImageUrl(it.url))
		.slice(0, limit * 2);
}

async function searchKonachan(query, limit, fetchFn) {
	const tags = `${query.trim().replace(/\s+/g, '_')} rating:s`;
	const url = `https://konachan.net/post.json?limit=${Math.min(20, Math.max(8, limit * 2))}&tags=${encodeURIComponent(tags)}`;
	const res = await fetchFn(url, {
		headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
		signal: AbortSignal.timeout(12000),
	});
	if (!res.ok) throw new Error(`Konachan HTTP ${res.status}`);
	const items = await res.json();
	if (!Array.isArray(items)) return [];
	return items
		.filter((it) => it?.rating === 's' && isValidImageUrl(it?.sample_url || it?.file_url))
		.slice(0, limit * 2)
		.map((it) => ({
			url: it.sample_url || it.file_url,
			title: String(it.tags || '').split(/\s+/).slice(0, 5).join(', '),
			source: 'konachan',
			sourceLabel: 'Konachan (Safe)',
			referer: 'https://konachan.net/',
		}));
}

export const IMAGE_SOURCES = {
	bing: {
		id: 'bing',
		label: 'Bing Images',
		arLabel: 'بينج (Bing)',
		category: 'general',
		aliases: ['bing', 'بينج'],
		search: searchBing,
	},
	ddg: {
		id: 'ddg',
		label: 'DuckDuckGo',
		arLabel: 'داك داك جو (DDG)',
		category: 'general',
		aliases: ['ddg', 'duckduckgo', 'duck', 'داك', 'دك'],
		search: searchDuckDuckGo,
	},
	pinterest: {
		id: 'pinterest',
		label: 'Pinterest',
		arLabel: 'بنترست (Pinterest)',
		category: 'aesthetic',
		aliases: ['pinterest', 'pin', 'بنترست', 'بينتريست', 'بنترس'],
		search: searchPinterest,
	},
	yandex: {
		id: 'yandex',
		label: 'Yandex Images',
		arLabel: 'ياندكس (Yandex)',
		category: 'general',
		aliases: ['yandex', 'ياندكس'],
		search: searchYandex,
	},
	wallhaven: {
		id: 'wallhaven',
		label: 'Wallhaven',
		arLabel: 'وولهيفن (خلفيات HD)',
		category: 'wallpapers',
		aliases: ['wallhaven', 'wh', 'وولهيفن'],
		flagAliases: ['wallpaper', 'wallpapers', 'خلفيات'],
		search: searchWallhaven,
	},
	openverse: {
		id: 'openverse',
		label: 'Openverse',
		arLabel: 'أوبنفرس (Openverse)',
		category: 'stock',
		aliases: ['openverse', 'ov', 'اوبنفرس', 'أوبنفرس'],
		search: searchOpenverse,
	},
	wikimedia: {
		id: 'wikimedia',
		label: 'Wikimedia Commons',
		arLabel: 'ويكيميديا كومنز',
		category: 'encyclopedia',
		aliases: ['wikimedia', 'commons', 'ويكيميديا', 'كومنز'],
		search: searchWikimedia,
	},
	wikipedia: {
		id: 'wikipedia',
		label: 'Wikipedia',
		arLabel: 'ويكيبيديا',
		category: 'encyclopedia',
		aliases: ['wikipedia', 'wiki', 'ويكيبيديا', 'ويكي'],
		search: searchWikipedia,
	},
	flickr: {
		id: 'flickr',
		label: 'Flickr',
		arLabel: 'فليكر (Flickr)',
		category: 'photography',
		aliases: ['flickr', 'فليكر'],
		search: searchFlickr,
	},
	nasa: {
		id: 'nasa',
		label: 'NASA Images',
		arLabel: 'ناسا للفضاء (NASA)',
		category: 'science',
		aliases: ['nasa', 'ناسا'],
		flagAliases: ['space', 'فضاء'],
		search: searchNasa,
	},
	artic: {
		id: 'artic',
		label: 'Art Institute of Chicago',
		arLabel: 'متحف شيكاغو للفن',
		category: 'art',
		aliases: ['artic', 'chicago'],
		flagAliases: ['art', 'فن'],
		search: searchArtic,
	},
	cleveland: {
		id: 'cleveland',
		label: 'Cleveland Museum',
		arLabel: 'متحف كليفلاند للفن',
		category: 'art',
		aliases: ['cleveland', 'كليفلاند'],
		flagAliases: ['museum', 'متحف'],
		search: searchCleveland,
	},
	safebooru: {
		id: 'safebooru',
		label: 'Safebooru',
		arLabel: 'سيف بورو (أنمي)',
		category: 'anime',
		aliases: ['safebooru', 'سيفبورو'],
		flagAliases: ['anime', 'انمي', 'أنمي'],
		search: searchSafebooru,
	},
	konachan: {
		id: 'konachan',
		label: 'Konachan (Safe)',
		arLabel: 'كوناشان (خلفيات أنمي)',
		category: 'anime',
		aliases: ['konachan', 'kona', 'كوناشان'],
		search: searchKonachan,
	},
};

const BARE_SOURCE_ALIAS_MAP = new Map();
const FLAG_SOURCE_ALIAS_MAP = new Map();
for (const src of Object.values(IMAGE_SOURCES)) {
	for (const alias of src.aliases) {
		BARE_SOURCE_ALIAS_MAP.set(alias.toLowerCase(), src.id);
		FLAG_SOURCE_ALIAS_MAP.set(alias.toLowerCase(), src.id);
	}
	for (const alias of src.flagAliases || []) {
		FLAG_SOURCE_ALIAS_MAP.set(alias.toLowerCase(), src.id);
	}
}
for (const autoAlias of ['auto', 'all', 'اوتو', 'أوتو', 'تلقائي', 'الكل']) {
	BARE_SOURCE_ALIAS_MAP.set(autoAlias, 'auto');
	FLAG_SOURCE_ALIAS_MAP.set(autoAlias, 'auto');
}

export function resolveImageSource(token, allowGeneric = false) {
	if (!token) return null;
	const clean = String(token).trim().toLowerCase().replace(/^[@#]/, '');
	return (allowGeneric ? FLAG_SOURCE_ALIAS_MAP : BARE_SOURCE_ALIAS_MAP).get(clean) || null;
}

export function parseImageSearchInput(rawText) {
	const text = normalizeDigits(String(rawText || '').trim());
	if (!text) {
		return { source: 'auto', count: DEFAULT_IMAGE_COUNT, query: '', showSources: false };
	}
	if (/^(sources|list|المصادر|مصادر|مواقع|المواقع)$/i.test(text)) {
		return { source: 'auto', count: DEFAULT_IMAGE_COUNT, query: '', showSources: true };
	}

	let source = 'auto';
	let sourceExplicit = false;
	let count = DEFAULT_IMAGE_COUNT;
	let working = text;

	// Extract explicit flag pairs like -s bing / --source pinterest / source:nasa / مصدر:ياندكس
	working = working.replace(/(?:^|\s)(?:-s|--source|source|src|مصدر|المصدر)\s*[:=\s]\s*([^\s]+)/gi, (_, val) => {
		const resolved = resolveImageSource(val, true);
		if (resolved) {
			source = resolved;
			sourceExplicit = true;
		}
		return ' ';
	});

	// Extract explicit count flags like -n 5 / --count 4 / count:5 / عدد:6
	working = working.replace(/(?:^|\s)(?:-n|-c|--count|count|num|limit|عدد|العدد)\s*[:=\s]\s*(\d+)/gi, (_, val) => {
		const n = parseInt(val, 10);
		if (n > 0) count = Math.min(MAX_IMAGE_COUNT, Math.max(1, n));
		return ' ';
	});

	// Handle source:count shorthand e.g. pinterest:5 or bing=4
	const tokens = working.trim().split(/\s+/).filter(Boolean);
	const remaining = [];

	for (let i = 0; i < tokens.length; i++) {
		const tok = tokens[i];
		const comboMatch = tok.match(/^([^:=]+)[:=](\d+)$/);
		if (comboMatch) {
			const maybeSrc = resolveImageSource(comboMatch[1], true);
			const n = parseInt(comboMatch[2], 10);
			if (maybeSrc && n >= 1 && n <= MAX_IMAGE_COUNT) {
				source = maybeSrc;
				sourceExplicit = true;
				count = n;
				continue;
			}
		}

		const isEdge = remaining.length === 0 || i === tokens.length - 1;
		if (isEdge) {
			const maybeSrc = !sourceExplicit ? resolveImageSource(tok, false) : null;
			if (maybeSrc && tokens.length > 1) {
				source = maybeSrc;
				sourceExplicit = true;
				continue;
			}
			if (/^\d{1,2}$/.test(tok)) {
				const n = parseInt(tok, 10);
				if (n >= 1 && n <= MAX_IMAGE_COUNT && tokens.length > 1) {
					count = n;
					continue;
				}
			}
		}

		// Second token immediately after a leading source/count (e.g. ".صور bing 5 cats" or ".صور 5 bing cats")
		if (remaining.length === 0 && i === 1 && tokens.length > 2) {
			const maybeSrc = !sourceExplicit ? resolveImageSource(tok, false) : null;
			if (maybeSrc) {
				source = maybeSrc;
				sourceExplicit = true;
				continue;
			}
			if (/^\d{1,2}$/.test(tok)) {
				const n = parseInt(tok, 10);
				if (n >= 1 && n <= MAX_IMAGE_COUNT) {
					count = n;
					continue;
				}
			}
		}

		remaining.push(tok);
	}

	return {
		source,
		count,
		query: remaining.join(' ').trim(),
		showSources: false,
	};
}

export async function downloadAndValidateImage(candidate, fetchFn = fetch) {
	const tryUrls = [candidate.url, candidate.fallbackUrl].filter(Boolean);
	for (const url of tryUrls) {
		try {
			const res = await fetchFn(url, {
				headers: {
					'User-Agent': candidate.source === 'wikimedia' || candidate.source === 'wikipedia' ? WIKI_UA : BROWSER_UA,
					Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
					...(candidate.referer ? { Referer: candidate.referer } : {}),
				},
				signal: AbortSignal.timeout(12000),
			});
			if (!res.ok) continue;
			const buf = Buffer.from(await res.arrayBuffer());
			if (buf.length < 1500) continue;
			const mimeFromMagic = detectImageMimeFromBuffer(buf);
			const contentType = String(res.headers?.get?.('content-type') || '').split(';')[0].trim().toLowerCase();
			if (!mimeFromMagic && !/^image\/(jpeg|jpg|png|webp|gif)$/i.test(contentType)) {
				continue;
			}
			return {
				...candidate,
				url,
				buffer: buf,
				mimetype: mimeFromMagic || contentType || 'image/jpeg',
			};
		} catch {
			// try next candidate URL
		}
	}
	return null;
}

const AUTO_WAVES = [
	['bing', 'ddg', 'pinterest', 'yandex'],
	['openverse', 'wallhaven', 'flickr', 'wikipedia'],
	['wikimedia', 'nasa', 'artic', 'cleveland', 'safebooru', 'konachan'],
];

function interleaveRoundRobin(buckets) {
	const queues = buckets.filter((b) => Array.isArray(b) && b.length > 0).map((b) => [...b]);
	const merged = [];
	let added = true;
	while (added) {
		added = false;
		for (const q of queues) {
			if (q.length > 0) {
				merged.push(q.shift());
				added = true;
			}
		}
	}
	return merged;
}

export async function searchImages({ query, source = 'auto', count = DEFAULT_IMAGE_COUNT, fetchFn = fetch, validateImages = true } = {}) {
	const cleanQuery = String(query || '').trim();
	const targetCount = Math.min(MAX_IMAGE_COUNT, Math.max(1, Number(count) || DEFAULT_IMAGE_COUNT));
	if (!cleanQuery) {
		throw new Error('يرجى كتابة كلمة البحث.');
	}

	const normalizedSource = resolveImageSource(source, true) || 'auto';
	const seenUrls = new Set();
	const collected = [];
	const errors = [];
	const usedSources = new Set();

	const acceptCandidates = async (candidates) => {
		const unique = [];
		for (const c of candidates) {
			if (!c?.url || seenUrls.has(c.url)) continue;
			seenUrls.add(c.url);
			unique.push(c);
		}
		if (!unique.length) return;

		if (!validateImages) {
			for (const c of unique) {
				if (collected.length >= targetCount) break;
				collected.push(c);
				usedSources.add(c.source);
			}
			return;
		}

		// Download & verify images in small parallel chunks of 4 until we satisfy targetCount
		for (let i = 0; i < unique.length && collected.length < targetCount; i += 4) {
			const needed = targetCount - collected.length;
			const batch = unique.slice(i, i + Math.min(4, needed + 2));
			const settled = await Promise.all(batch.map((c) => downloadAndValidateImage(c, fetchFn)));
			for (const item of settled) {
				if (!item) continue;
				if (collected.length >= targetCount) break;
				collected.push(item);
				usedSources.add(item.source);
			}
		}
	};

	if (normalizedSource !== 'auto') {
		const spec = IMAGE_SOURCES[normalizedSource];
		if (!spec) {
			throw new Error(`مصدر غير معروف: ${source}`);
		}
		try {
			const raw = await spec.search(cleanQuery, targetCount, fetchFn);
			await acceptCandidates(raw);
		} catch (err) {
			errors.push({ source: spec.id, error: err?.message || String(err) });
		}
		return {
			query: cleanQuery,
			requestedSource: normalizedSource,
			requestedCount: targetCount,
			images: collected,
			usedSources: [...usedSources],
			errors,
		};
	}

	// Auto mode: run source waves, interleave for diversity across sites, stop once targetCount is reached
	for (const wave of AUTO_WAVES) {
		if (collected.length >= targetCount) break;
		const settled = await Promise.allSettled(
			wave.map(async (srcId) => {
				const spec = IMAGE_SOURCES[srcId];
				return { srcId, items: await spec.search(cleanQuery, targetCount, fetchFn) };
			})
		);
		const buckets = [];
		for (let i = 0; i < settled.length; i++) {
			const r = settled[i];
			if (r.status === 'fulfilled' && r.value.items?.length) {
				buckets.push(r.value.items);
			} else if (r.status === 'rejected') {
				errors.push({ source: wave[i], error: r.reason?.message || 'failed' });
			}
		}
		const interleaved = interleaveRoundRobin(buckets);
		await acceptCandidates(interleaved);
	}

	return {
		query: cleanQuery,
		requestedSource: 'auto',
		requestedCount: targetCount,
		images: collected,
		usedSources: [...usedSources],
		errors,
	};
}

export function formatSourcesHelp(usedPrefix = '.') {
	const lines = [
		`🖼️ *أمر البحث عن الصور من مصادر متعددة (${Object.keys(IMAGE_SOURCES).length} موقعاً)*`,
		'',
		'📌 *طريقة الاستخدام:*',
		`• \`${usedPrefix}صور قطط\` ← بحث تلقائي (auto) من أفضل المواقع (3 صور)`,
		`• \`${usedPrefix}صور 6 سيارات\` ← تحديد العدد (من 1 إلى ${MAX_IMAGE_COUNT})`,
		`• \`${usedPrefix}صور pinterest خلفيات سوداء 4\` ← تحديد المصدر والعدد`,
		`• \`${usedPrefix}img -s wallhaven -n 5 cyberpunk\` ← باستخدام الأعلام الإنجليزية`,
		`• \`${usedPrefix}صور auto طبيعة 5\` ← توزيع تلقائي متنوع بين المواقع`,
		'',
		'🌐 *المصادر المتوفرة (بدون مفتاح API):*',
	];
	for (const src of Object.values(IMAGE_SOURCES)) {
		lines.push(`• \`${src.id}\` — ${src.arLabel} _(${src.aliases.slice(0, 3).join(' / ')})_`);
	}
	return lines.join('\n');
}
