import axios from 'axios';
import yts from 'yt-search';

const CLIENTS = [
	{
		name: 'ANDROID',
		userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
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
	{
		name: 'IOS',
		userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X)',
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

export async function getYouTubeStreams(urlOrId) {
	const videoId = extractYouTubeId(urlOrId);
	if (!videoId) throw new Error('Invalid YouTube URL');

	let lastError = null;
	for (const client of CLIENTS) {
		try {
			const { data } = await axios.post(
				'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
				{
					context: client.context,
					videoId,
					contentCheckOk: true,
					racyCheckOk: true,
				},
				{
					timeout: 25000,
					headers: {
						'Content-Type': 'application/json',
						'User-Agent': client.userAgent,
					},
				}
			);

			const status = data?.playabilityStatus?.status;
			if (status !== 'OK' || !data?.streamingData) {
				lastError = new Error(data?.playabilityStatus?.reason || `Playability status: ${status || 'UNKNOWN'}`);
				continue;
			}

			const details = data.videoDetails || {};
			const muxed = (data.streamingData.formats || []).filter((f) => f.url);
			const adaptive = (data.streamingData.adaptiveFormats || []).filter((f) => f.url);

			const audioFormats = adaptive
				.filter((f) => String(f.mimeType || '').startsWith('audio/'))
				.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

			const videoFormats = muxed
				.filter((f) => String(f.mimeType || '').startsWith('video/mp4'))
				.sort((a, b) => (b.height || 0) - (a.height || 0));

			if (!audioFormats.length && !videoFormats.length) {
				lastError = new Error('No playable streams returned by YouTube');
				continue;
			}

			const thumbs = details.thumbnail?.thumbnails || [];
			const bestThumb = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

			return {
				videoId,
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
		} catch (e) {
			lastError = e;
		}
	}

	throw lastError || new Error('Failed to resolve YouTube media');
}

export async function downloadYouTubeMedia(urlOrId, type = 'audio') {
	const info = await getYouTubeStreams(urlOrId);
	const selected = type === 'video' ? info.video : info.audio;
	if (!selected?.url) throw new Error(`No ${type} stream found for this video`);

	const res = await axios.get(selected.url, {
		responseType: 'arraybuffer',
		timeout: 120000,
		maxContentLength: 95 * 1024 * 1024,
		headers: {
			'User-Agent': info.userAgent,
		},
	});

	const buffer = Buffer.from(res.data);
	if (!buffer.length) throw new Error('Downloaded media stream is empty');

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
}
