import axios from 'axios';
import yts from 'yt-search';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const execFileAsync = promisify(execFile);

const VISITOR_CACHE_TTL_MS = 10 * 60 * 1000;
let cachedVisitorData = { value: '', fetchedAt: 0 };

const BASE_CLIENTS = [
	{
		name: 'ANDROID_VR',
		userAgent:
			'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
		clientNameHeader: '28',
		clientVersion: '1.60.19',
		context: {
			client: {
				clientName: 'ANDROID_VR',
				clientVersion: '1.60.19',
				deviceMake: 'Oculus',
				deviceModel: 'Quest 3',
				androidSdkVersion: 32,
				osName: 'Android',
				osVersion: '12L',
				hl: 'en',
				gl: 'US',
			},
		},
	},
	{
		name: 'ANDROID_VR_ALT',
		userAgent:
			'com.google.android.apps.youtube.vr.oculus/1.57.29 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
		clientNameHeader: '28',
		clientVersion: '1.57.29',
		context: {
			client: {
				clientName: 'ANDROID_VR',
				clientVersion: '1.57.29',
				deviceMake: 'Oculus',
				deviceModel: 'Quest 3',
				androidSdkVersion: 32,
				osName: 'Android',
				osVersion: '12L',
				hl: 'en',
				gl: 'US',
			},
		},
	},
	{
		name: 'IOS',
		userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X)',
		clientNameHeader: '5',
		clientVersion: '20.10.4',
		context: {
			client: {
				clientName: 'IOS',
				clientVersion: '20.10.4',
				deviceMake: 'Apple',
				deviceModel: 'iPhone16,2',
				hl: 'en',
				gl: 'US',
			},
		},
	},
	{
		name: 'ANDROID',
		userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
		clientNameHeader: '3',
		clientVersion: '20.10.38',
		context: {
			client: {
				clientName: 'ANDROID',
				clientVersion: '20.10.38',
				androidSdkVersion: 30,
				hl: 'en',
				gl: 'US',
			},
		},
	},
];

export function extractYouTubeId(url) {
	if (!url || typeof url !== 'string') return null;
	const patterns = [
		/youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
		/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
		/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
		/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
		/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
		/youtu\.be\/([a-zA-Z0-9_-]{11})/,
		/^([a-zA-Z0-9_-]{11})$/,
	];
	for (const p of patterns) {
		const match = url.trim().match(p);
		if (match?.[1]) return match[1];
	}
	return null;
}

export async function searchYouTube(query, limit = 5) {
	const result = await yts(query);
	return (result?.videos || []).slice(0, limit).map((v) => ({
		id: v.videoId,
		title: v.title,
		url: v.url,
		channel: v.author?.name || 'Unknown',
		channelUrl: v.author?.url || '',
		duration: v.timestamp || '0:00',
		seconds: v.seconds || 0,
		views: v.views ? v.views.toLocaleString('en-US') : '0',
		thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
		ago: v.ago || '',
	}));
}

function formatSeconds(sec) {
	const total = Math.max(0, Number(sec) || 0);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = Math.floor(total % 60);
	if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	return `${m}:${String(s).padStart(2, '0')}`;
}

export function parseNetscapeCookies(raw, targetDomains = ['youtube.com', 'google.com']) {
	const text = String(raw || '').trim();
	if (!text) return '';
	if (!text.includes('\t') && text.includes('=')) {
		return text
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter((l) => l && !l.startsWith('#'))
			.join('; ');
	}
	const cookieMap = new Map();
	const rows = [];
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || (trimmed.startsWith('#') && !trimmed.startsWith('#HttpOnly_'))) continue;
		const cols = trimmed.replace(/^#HttpOnly_/, '').split('\t');
		if (cols.length < 7) continue;
		const domain = cols[0].toLowerCase();
		const cookiePath = cols[2] || '/';
		if (cookiePath !== '/') continue;
		const matchesDomain = targetDomains.some((d) => domain === d || domain === `.${d}` || domain.endsWith(`.${d}`));
		if (!matchesDomain) continue;
		// Skip unrelated Google subdomains (chromewebstore, support, accounts) when collecting YouTube cookies
		if (targetDomains.includes('youtube.com') && domain.endsWith('google.com') && domain !== '.google.com' && domain !== 'google.com' && domain !== 'www.google.com') {
			continue;
		}
		const name = cols[5]?.trim();
		const value = cols[6]?.trim();
		if (name && value !== undefined) {
			const priority = domain.includes('youtube.com') ? 2 : 1;
			rows.push({ name, value, priority });
		}
	}
	rows.sort((a, b) => a.priority - b.priority);
	for (const r of rows) cookieMap.set(r.name, r.value);
	return [...cookieMap.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function getCookieFilePath() {
	const candidates = [
		process.env.YT_COOKIES_FILE,
		path.join(ROOT_DIR, 'data', 'youtube-cookies.txt'),
		path.join(ROOT_DIR, 'cookies.txt'),
		path.join(process.cwd(), 'data', 'youtube-cookies.txt'),
		path.join(process.cwd(), 'cookies.txt'),
	].filter(Boolean);
	for (const p of candidates) {
		try {
			if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
		} catch {}
	}
	return null;
}

function loadYouTubeAuthHeaders() {
	let cookieHeader = '';
	if (process.env.YT_COOKIES) {
		cookieHeader = parseNetscapeCookies(process.env.YT_COOKIES);
	}
	if (!cookieHeader) {
		const file = getCookieFilePath();
		if (file) {
			try {
				cookieHeader = parseNetscapeCookies(fs.readFileSync(file, 'utf8'));
			} catch {}
		}
	}
	if (!cookieHeader) return {};
	const headers = { Cookie: cookieHeader };
	const sapisidMatch = cookieHeader.match(/(?:^|;\s*)(?:__Secure-3PAPISID|SAPISID)=([^;]+)/);
	if (sapisidMatch?.[1]) {
		const ts = Math.floor(Date.now() / 1000);
		const hash = crypto.createHash('sha1').update(`${ts} ${sapisidMatch[1]} https://www.youtube.com`).digest('hex');
		headers.Authorization = `SAPISIDHASH ${ts}_${hash}`;
		headers.Origin = 'https://www.youtube.com';
		headers['X-Origin'] = 'https://www.youtube.com';
	}
	return headers;
}

async function fetchVisitorData(videoId, forceRefresh = false) {
	if (!forceRefresh && cachedVisitorData.value && Date.now() - cachedVisitorData.fetchedAt < VISITOR_CACHE_TTL_MS) {
		return cachedVisitorData.value;
	}
	try {
		const { data } = await axios.post(
			'https://www.youtube.com/youtubei/v1/visitor_id?prettyPrint=false',
			{
				context: {
					client: {
						clientName: 'ANDROID_VR',
						clientVersion: '1.60.19',
						hl: 'en',
						gl: 'US',
					},
				},
			},
			{ timeout: 8000, headers: { 'Content-Type': 'application/json' } }
		);
		const vd = data?.responseContext?.visitorData;
		if (vd) {
			cachedVisitorData = { value: vd, fetchedAt: Date.now() };
			return vd;
		}
	} catch {}

	if (videoId) {
		try {
			const { data: html } = await axios.get(`https://www.youtube.com/embed/${videoId}`, {
				timeout: 8000,
				headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
			});
			const m = String(html || '').match(/"VISITOR_DATA":"([^"]+)"/);
			if (m?.[1]) {
				cachedVisitorData = { value: m[1], fetchedAt: Date.now() };
				return m[1];
			}
		} catch {}
	}
	return '';
}

function buildStreamEntry(client, data, videoId) {
	const details = data.videoDetails || {};
	const muxed = (data.streamingData.formats || []).filter((f) => f.url);
	const adaptive = (data.streamingData.adaptiveFormats || []).filter((f) => f.url);

	const audioFormats = adaptive
		.filter((f) => String(f.mimeType || '').startsWith('audio/'))
		.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

	const videoFormats = muxed
		.filter((f) => String(f.mimeType || '').startsWith('video/mp4'))
		.sort((a, b) => (b.height || 0) - (a.height || 0));

	if (!audioFormats.length && !videoFormats.length && !muxed.length) return null;

	const thumbs = details.thumbnail?.thumbnails || [];
	const bestThumb = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

	return {
		videoId,
		clientName: client.name,
		title: details.title || 'YouTube Media',
		uploader: details.author || 'YouTube',
		duration: formatSeconds(details.lengthSeconds),
		seconds: Number(details.lengthSeconds || 0),
		views: details.viewCount ? Number(details.viewCount).toLocaleString('en-US') : '0',
		thumbnail: bestThumb,
		userAgent: client.userAgent,
		audio: audioFormats[0] || muxed[0] || null,
		video: videoFormats.find((f) => (f.height || 0) <= 720) || videoFormats[0] || muxed[0] || null,
		audioFormats,
		videoFormats,
	};
}

async function queryInnertubeClient(client, videoId, visitorData, authHeaders) {
	const clonedContext = structuredClone(client.context);
	if (visitorData) clonedContext.client.visitorData = visitorData;

	const headers = {
		'Content-Type': 'application/json',
		'User-Agent': client.userAgent,
		'X-YouTube-Client-Name': client.clientNameHeader,
		'X-YouTube-Client-Version': client.clientVersion,
		...authHeaders,
	};
	if (visitorData) headers['X-Goog-Visitor-Id'] = visitorData;

	const { data } = await axios.post(
		'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
		{
			context: clonedContext,
			videoId,
			contentCheckOk: true,
			racyCheckOk: true,
		},
		{ timeout: 25000, headers }
	);

	const status = data?.playabilityStatus?.status;
	if (status !== 'OK' || !data?.streamingData) {
		const reason = data?.playabilityStatus?.reason || `Playability status: ${status || 'UNKNOWN'}`;
		const err = new Error(reason);
		err.playabilityStatus = status;
		throw err;
	}

	const entry = buildStreamEntry(client, data, videoId);
	if (!entry) throw new Error('No playable streams returned by YouTube');
	return entry;
}

function getYtDlpRunner() {
	const localBinCandidates = [
		path.join(ROOT_DIR, 'bin', 'yt-dlp'),
		path.join(process.cwd(), 'bin', 'yt-dlp'),
	];
	for (const localBin of localBinCandidates) {
		if (fs.existsSync(localBin)) {
			try { fs.chmodSync(localBin, 0o755); } catch {}
			return { executable: localBin, localBin };
		}
	}
	return { executable: 'yt-dlp', localBin: null };
}

async function tryYtDlpFallback(videoId, type = 'audio') {
	const cookieFile = getCookieFilePath();
	const url = `https://www.youtube.com/watch?v=${videoId}`;
	const runner = getYtDlpRunner();
	const baseArgs = [
		'--no-warnings',
		'--no-playlist',
		'--extractor-args',
		'youtube:player_client=android_vr,ios,android,web',
		'-f',
		type === 'video' ? 'best[ext=mp4][height<=720]/best[ext=mp4]/best' : 'bestaudio[ext=m4a]/bestaudio/best',
		'--dump-single-json',
	];
	if (cookieFile) baseArgs.push('--cookies', cookieFile);
	baseArgs.push(url);

	let stdout;
	try {
		const res = await execFileAsync(runner.executable, baseArgs, { timeout: 35000, maxBuffer: 16 * 1024 * 1024 });
		stdout = res.stdout;
	} catch (execErr) {
		if (runner.localBin && fs.existsSync(runner.localBin)) {
			const res = await execFileAsync('python3', [runner.localBin, ...baseArgs], { timeout: 35000, maxBuffer: 16 * 1024 * 1024 });
			stdout = res.stdout;
		} else {
			throw execErr;
		}
	}

	const meta = JSON.parse(stdout);
	const directUrl = meta?.url;
	if (!directUrl) throw new Error('yt-dlp returned no stream URL');

	const headers = { ...(meta.http_headers || {}) };
	const res = await axios.get(directUrl, {
		responseType: 'arraybuffer',
		timeout: 120000,
		maxContentLength: 95 * 1024 * 1024,
		headers,
	});
	const buffer = Buffer.from(res.data);
	if (!buffer.length) throw new Error('Downloaded media stream is empty');

	const ext = meta.ext || (type === 'video' ? 'mp4' : 'm4a');
	const mime = type === 'video' ? 'video/mp4' : ext === 'webm' ? 'audio/webm' : 'audio/mp4';
	return {
		status: true,
		title: meta.title || 'YouTube Media',
		uploader: meta.uploader || meta.channel || 'YouTube',
		duration: formatSeconds(meta.duration),
		views: meta.view_count ? Number(meta.view_count).toLocaleString('en-US') : '0',
		thumbnail: meta.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
		download_url: directUrl,
		buffer,
		mime,
		ext,
		size: `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`,
		quality: meta.format_note || (type === 'video' ? 'HD' : 'High'),
	};
}

export async function getYouTubeStreams(urlOrId) {
	const videoId = extractYouTubeId(urlOrId);
	if (!videoId) throw new Error('Invalid YouTube URL');

	const authHeaders = loadYouTubeAuthHeaders();
	let visitorData = await fetchVisitorData(videoId);
	let lastError = null;

	for (const client of BASE_CLIENTS) {
		try {
			return await queryInnertubeClient(client, videoId, visitorData, authHeaders);
		} catch (e) {
			lastError = e;
			if (/sign in|bot/i.test(String(e?.message || ''))) {
				visitorData = await fetchVisitorData(videoId, true);
			}
		}
	}

	throw lastError || new Error('Failed to resolve YouTube media');
}

async function fetchMediaStreamBuffer(url, userAgent, formatInfo = {}, maxBytes = 95 * 1024 * 1024) {
	const total = Number(formatInfo.contentLength || 0);
	const headers = { 'User-Agent': userAgent || 'Mozilla/5.0' };

	try {
		const chunkSize = 2 * 1024 * 1024;
		const parts = [];
		let start = 0;
		while (true) {
			const end = total ? Math.min(start + chunkSize - 1, total - 1) : start + chunkSize - 1;
			const r = await fetch(url, {
				headers: { ...headers, Range: `bytes=${start}-${end}` },
				signal: AbortSignal.timeout(20000),
			});
			if (!r.ok && r.status !== 206) break;
			const ab = await r.arrayBuffer();
			if (!ab.byteLength) break;
			parts.push(Buffer.from(ab));
			start += ab.byteLength;
			if (start > maxBytes) throw new Error('File exceeds maximum allowed size');
			const cr = r.headers.get('content-range') || '';
			const fullLen = Number(cr.split('/')[1] || total || 0);
			if ((fullLen && start >= fullLen) || (!fullLen && ab.byteLength < chunkSize)) break;
		}
		if (parts.length > 0) {
			const combined = Buffer.concat(parts);
			if (combined.length > 0) return combined;
		}
	} catch (e) {
		if (e.message?.includes('maximum allowed size')) throw e;
	}

	const res = await axios.get(url, {
		responseType: 'arraybuffer',
		timeout: 120000,
		maxContentLength: maxBytes,
		headers,
	});
	return Buffer.from(res.data);
}

export async function downloadYouTubeMedia(urlOrId, type = 'audio') {
	const videoId = extractYouTubeId(urlOrId);
	if (!videoId) throw new Error('Invalid YouTube URL');

	const authHeaders = loadYouTubeAuthHeaders();
	let visitorData = await fetchVisitorData(videoId);
	let lastError = null;

	// Attempt 1: Innertube clients with authHeaders (cookies)
	for (const client of BASE_CLIENTS) {
		try {
			const info = await queryInnertubeClient(client, videoId, visitorData, authHeaders);
			const candidates =
				type === 'video'
					? [info.video, ...(info.videoFormats || [])].filter(Boolean)
					: [info.audio, ...(info.audioFormats || [])].filter(Boolean);

			for (const selected of candidates) {
				if (!selected?.url) continue;
				try {
					const buffer = await fetchMediaStreamBuffer(selected.url, info.userAgent, selected);
					if (!buffer.length) continue;

					const mime = String(selected.mimeType || '').split(';')[0] || (type === 'video' ? 'video/mp4' : 'audio/mp4');
					const ext = mime.includes('webm') ? 'webm' : type === 'video' ? 'mp4' : 'm4a';
					const sizeMB = `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`;

					return {
						status: true,
						title: info.title,
						uploader: info.uploader,
						duration: info.duration,
						views: info.views,
						thumbnail: info.thumbnail,
						download_url: selected.url,
						buffer,
						mime,
						ext,
						size: sizeMB,
						quality: selected.qualityLabel || (selected.audioQuality ? 'High' : 'Standard'),
					};
				} catch (dlErr) {
					lastError = dlErr;
				}
			}
		} catch (e) {
			lastError = e;
			if (/sign in|bot/i.test(String(e?.message || ''))) {
				visitorData = await fetchVisitorData(videoId, true);
			}
		}
	}

	// Attempt 2: If cookies were present and Innertube blocked, retry unauthenticated across clients
	if (authHeaders && Object.keys(authHeaders).length > 0) {
		for (const client of BASE_CLIENTS) {
			try {
				const info = await queryInnertubeClient(client, videoId, visitorData, {});
				const candidates =
					type === 'video'
						? [info.video, ...(info.videoFormats || [])].filter(Boolean)
						: [info.audio, ...(info.audioFormats || [])].filter(Boolean);

				for (const selected of candidates) {
					if (!selected?.url) continue;
					try {
						const buffer = await fetchMediaStreamBuffer(selected.url, info.userAgent, selected);
						if (!buffer.length) continue;

						const mime = String(selected.mimeType || '').split(';')[0] || (type === 'video' ? 'video/mp4' : 'audio/mp4');
						const ext = mime.includes('webm') ? 'webm' : type === 'video' ? 'mp4' : 'm4a';
						const sizeMB = `${(buffer.length / (1024 * 1024)).toFixed(2)} MB`;

						return {
							status: true,
							title: info.title,
							uploader: info.uploader,
							duration: info.duration,
							views: info.views,
							thumbnail: info.thumbnail,
							download_url: selected.url,
							buffer,
							mime,
							ext,
							size: sizeMB,
							quality: selected.qualityLabel || (selected.audioQuality ? 'High' : 'Standard'),
						};
					} catch (dlErr) {
						lastError = dlErr;
					}
				}
			} catch (e) {
				lastError = e;
			}
		}
	}

	// Attempt 3: Local or system yt-dlp fallback
	try {
		return await tryYtDlpFallback(videoId, type);
	} catch (ytErr) {
		if (ytErr && !lastError) lastError = ytErr;
	}

	const rawMsg = String(lastError?.message || 'Failed to resolve YouTube media');
	if (/sign in to confirm|not a bot/i.test(rawMsg)) {
		throw new Error(`${rawMsg} (Add YouTube cookies to data/youtube-cookies.txt or cookies.txt, or run update)`);
	}
	throw lastError || new Error(rawMsg);
}

// Hi
