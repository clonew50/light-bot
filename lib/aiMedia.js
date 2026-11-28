import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { detectImageMimeFromBuffer, normalizeDigits } from './imageSearch.js';

const BROWSER_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const cooldownUntil = new Map();

function isCooling(key) {
	return (cooldownUntil.get(key) || 0) > Date.now();
}

function setCooldown(key, ms) {
	cooldownUntil.set(key, Date.now() + ms);
}

export function clearAiMediaCooldowns() {
	cooldownUntil.clear();
}

function createGeminiClient() {
	const apiKey = process.env.GEMINI_API_KEY?.trim();
	if (!apiKey) return null;
	return new GoogleGenAI({
		apiKey,
		httpOptions: {
			headers: {
				'User-Agent': 'aistudio-build',
			},
		},
	});
}

export function runFfmpeg(args, timeoutMs = 45000) {
	return new Promise((resolve, reject) => {
		const proc = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		let stderr = '';
		let settled = false;
		const timer = setTimeout(() => {
			if (!settled) {
				settled = true;
				proc.kill('SIGKILL');
				reject(new Error(`ffmpeg timed out after ${timeoutMs}ms`));
			}
		}, timeoutMs);

		proc.stderr.on('data', (chunk) => {
			stderr += chunk.toString();
		});
		proc.on('error', (err) => {
			if (!settled) {
				settled = true;
				clearTimeout(timer);
				reject(err);
			}
		});
		proc.on('close', (code) => {
			if (!settled) {
				settled = true;
				clearTimeout(timer);
				if (code === 0) resolve();
				else reject(new Error(`ffmpeg exited ${code}: ${stderr.trim().slice(0, 260)}`));
			}
		});
	});
}

async function parseGradioSseComplete(res) {
	const raw = await res.text();
	const lines = raw.split(/\r?\n/);
	let currentEvent = '';
	for (const line of lines) {
		if (line.startsWith('event:')) {
			currentEvent = line.slice(6).trim();
		} else if (line.startsWith('data:')) {
			const payloadStr = line.slice(5).trim();
			if (currentEvent === 'error') {
				throw new Error(`Gradio space error: ${payloadStr || 'unknown'}`);
			}
			if (currentEvent === 'complete') {
				return JSON.parse(payloadStr);
			}
		}
	}
	throw new Error(`Gradio SSE did not complete (${raw.slice(0, 140)})`);
}

function extractGradioMediaUrl(data, baseUrl) {
	const stack = [data];
	while (stack.length) {
		const cur = stack.shift();
		if (!cur) continue;
		if (Array.isArray(cur)) {
			stack.push(...cur);
		} else if (typeof cur === 'object') {
			if (typeof cur.url === 'string' && /^https?:\/\//i.test(cur.url)) return cur.url;
			if (typeof cur.path === 'string' && cur.path.startsWith('/')) {
				return `${baseUrl}/gradio_api/file=${cur.path}`;
			}
			for (const val of Object.values(cur)) {
				if (val && typeof val === 'object') stack.push(val);
			}
		}
	}
	return null;
}

const ASPECT_PRESETS = {
	'1:1': { width: 1024, height: 1024, zRatio: '1024x1024 ( 1:1 )', fluxW: 768, fluxH: 768 },
	'16:9': { width: 1024, height: 576, zRatio: '1280x720 ( 16:9 )', fluxW: 1024, fluxH: 576 },
	'9:16': { width: 576, height: 1024, zRatio: '720x1280 ( 9:16 )', fluxW: 576, fluxH: 1024 },
	'4:3': { width: 1024, height: 768, zRatio: '1152x864 ( 4:3 )', fluxW: 896, fluxH: 672 },
	'3:4': { width: 768, height: 1024, zRatio: '864x1152 ( 3:4 )', fluxW: 672, fluxH: 896 },
};

export function parseAspectSpec(token) {
	const t = String(token || '').trim().toLowerCase();
	if (/^(16:9|wide|landscape|عرضي|أفقي|افقي)$/i.test(t)) return '16:9';
	if (/^(9:16|tall|portrait|vertical|طولي|عمودي|ستوري)$/i.test(t)) return '9:16';
	if (/^(4:3)$/i.test(t)) return '4:3';
	if (/^(3:4)$/i.test(t)) return '3:4';
	return '1:1';
}

export function parseAiMediaOptions(rawText, defaultMode = 'image') {
	const text = normalizeDigits(String(rawText || '').trim());
	let mode = defaultMode;
	let model = 'auto';
	let aspect = '1:1';
	let lang = null;
	let voice = null;
	let count = 1;
	let withVoice = false;
	let asPtt = true;
	let duration = defaultMode === 'music' ? 12 : 4;

	if (!text) {
		return { mode, model, aspect, lang, voice, count, withVoice, asPtt, duration, prompt: '', showHelp: true };
	}
	if (/^(help|مساعدة|شرح|المساعدة)$/i.test(text)) {
		return { mode, model, aspect, lang, voice, count, withVoice, asPtt, duration, prompt: '', showHelp: true };
	}

	let working = text;

	working = working.replace(/(?:^|\s)(?:-m|--model|model|موديل|محرك|مصدر)\s*[:=\s]\s*([^\s]+)/gi, (_, val) => {
		model = val.toLowerCase();
		return ' ';
	});
	working = working.replace(/(?:^|\s)(?:-a|--aspect|aspect|ratio|مقاس|ابعاد|أبعاد)\s*[:=\s]\s*([^\s]+)/gi, (_, val) => {
		aspect = parseAspectSpec(val);
		return ' ';
	});
	working = working.replace(/(?:^|\s)(?:-l|--lang|lang|لغة|اللغة)\s*[:=\s]\s*([^\s]+)/gi, (_, val) => {
		lang = val.toLowerCase();
		return ' ';
	});
	working = working.replace(/(?:^|\s)(?:-v|--voice|voice|صوت)\s*[:=\s]\s*([^\s]+)/gi, (_, val) => {
		voice = val;
		return ' ';
	});
	working = working.replace(/(?:^|\s)(?:-n|--count|count|عدد)\s*[:=\s]\s*(\d+)/gi, (_, val) => {
		count = Math.min(4, Math.max(1, parseInt(val, 10) || 1));
		return ' ';
	});
	working = working.replace(/(?:^|\s)(?:-d|--duration|duration|مدة)\s*[:=\s]\s*(\d+)/gi, (_, val) => {
		duration = Math.min(20, Math.max(2, parseInt(val, 10) || 4));
		return ' ';
	});
	working = working.replace(/(?:^|\s)(?:--tts|-tts|بصوت|مع_صوت)\b/gi, () => {
		withVoice = true;
		return ' ';
	});
	working = working.replace(/(?:^|\s)(?:--mp3|-mp3)\b/gi, () => {
		asPtt = false;
		return ' ';
	});

	const tokens = working.trim().split(/\s+/).filter(Boolean);
	if (tokens.length > 1 && defaultMode === 'hub') {
		const first = tokens[0].toLowerCase();
		if (/^(img|image|صورة|صوره|رسم)$/i.test(first)) {
			mode = 'image';
			tokens.shift();
		} else if (/^(vid|video|فيديو|مقطع|انيميشن)$/i.test(first)) {
			mode = 'video';
			tokens.shift();
		} else if (/^(tts|audio|voice|speech|صوت|نطق|كلام)$/i.test(first)) {
			mode = 'tts';
			tokens.shift();
		} else if (/^(music|song|beat|لحن|موسيقى|موسيقي|اغنية|أغنية)$/i.test(first)) {
			mode = 'music';
			tokens.shift();
		}
	}

	if (mode === 'hub') mode = 'image';

	return {
		mode,
		model,
		aspect,
		lang,
		voice,
		count,
		withVoice,
		asPtt,
		duration,
		prompt: tokens.join(' ').trim(),
		showHelp: false,
	};
}

// ---------- AI IMAGE GENERATION ----------

async function generateImageViaHfZImage(prompt, aspect, fetchFn) {
	const baseUrl = 'https://tongyi-mai-z-image-turbo.hf.space';
	const preset = ASPECT_PRESETS[aspect] || ASPECT_PRESETS['1:1'];
	const submitRes = await fetchFn(`${baseUrl}/gradio_api/call/generate`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA },
		body: JSON.stringify({
			data: [prompt, preset.zRatio, Math.floor(Math.random() * 1e7), 8, 3, true, []],
		}),
		signal: AbortSignal.timeout(15000),
	});
	if (!submitRes.ok) throw new Error(`Z-Image HTTP ${submitRes.status}`);
	const { event_id: eventId } = await submitRes.json();
	if (!eventId) throw new Error('Z-Image missing event_id');

	const sseRes = await fetchFn(`${baseUrl}/gradio_api/call/generate/${eventId}`, {
		headers: { 'User-Agent': BROWSER_UA },
		signal: AbortSignal.timeout(40000),
	});
	if (!sseRes.ok) throw new Error(`Z-Image SSE HTTP ${sseRes.status}`);
	const completeData = await parseGradioSseComplete(sseRes);
	const fileUrl = extractGradioMediaUrl(completeData, baseUrl);
	if (!fileUrl) throw new Error('Z-Image returned no image URL');

	const imgRes = await fetchFn(fileUrl, { signal: AbortSignal.timeout(20000) });
	if (!imgRes.ok) throw new Error(`Z-Image download HTTP ${imgRes.status}`);
	const buffer = Buffer.from(await imgRes.arrayBuffer());
	const mime = detectImageMimeFromBuffer(buffer);
	if (!mime || buffer.length < 1500) throw new Error('Z-Image returned invalid image data');
	return { buffer, mimetype: mime, provider: 'Z-Image-Turbo (HuggingFace)' };
}

async function generateImageViaHfFlux(prompt, aspect, fetchFn) {
	const baseUrl = 'https://black-forest-labs-flux-1-schnell.hf.space';
	const preset = ASPECT_PRESETS[aspect] || ASPECT_PRESETS['1:1'];
	const submitRes = await fetchFn(`${baseUrl}/gradio_api/call/infer`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA },
		body: JSON.stringify({
			data: [prompt, 0, true, preset.fluxW, preset.fluxH, 4],
		}),
		signal: AbortSignal.timeout(15000),
	});
	if (!submitRes.ok) throw new Error(`HF FLUX HTTP ${submitRes.status}`);
	const { event_id: eventId } = await submitRes.json();
	if (!eventId) throw new Error('HF FLUX missing event_id');

	const sseRes = await fetchFn(`${baseUrl}/gradio_api/call/infer/${eventId}`, {
		headers: { 'User-Agent': BROWSER_UA },
		signal: AbortSignal.timeout(40000),
	});
	if (!sseRes.ok) throw new Error(`HF FLUX SSE HTTP ${sseRes.status}`);
	const completeData = await parseGradioSseComplete(sseRes);
	const fileUrl = extractGradioMediaUrl(completeData, baseUrl);
	if (!fileUrl) throw new Error('HF FLUX returned no image URL');

	const imgRes = await fetchFn(fileUrl, { signal: AbortSignal.timeout(20000) });
	if (!imgRes.ok) throw new Error(`HF FLUX download HTTP ${imgRes.status}`);
	const buffer = Buffer.from(await imgRes.arrayBuffer());
	const mime = detectImageMimeFromBuffer(buffer);
	if (!mime || buffer.length < 1500) throw new Error('HF FLUX returned invalid image data');
	return { buffer, mimetype: mime, provider: 'FLUX.1-Schnell (HuggingFace)' };
}

async function generateImageViaPollinations(prompt, aspect, fetchFn, endpointType = 'legacy') {
	const cooldownKey = `poll_${endpointType}`;
	if (isCooling(cooldownKey)) {
		throw new Error(`Pollinations (${endpointType}) cooling down`);
	}
	const preset = ASPECT_PRESETS[aspect] || ASPECT_PRESETS['1:1'];
	const seed = Math.floor(Math.random() * 1e7);
	const url =
		endpointType === 'gen'
			? `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=tongyi-mai/z-image-turbo&width=${preset.width}&height=${preset.height}&seed=${seed}`
			: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=flux&width=${preset.width}&height=${preset.height}&seed=${seed}&nologo=true`;

	const res = await fetchFn(url, {
		headers: { 'User-Agent': BROWSER_UA },
		signal: AbortSignal.timeout(25000),
	});
	if (res.status === 401 || res.status === 402 || res.status === 429) {
		setCooldown(cooldownKey, 50000);
		throw new Error(`Pollinations (${endpointType}) rate-limited (${res.status})`);
	}
	if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`);
	const buffer = Buffer.from(await res.arrayBuffer());
	const mime = detectImageMimeFromBuffer(buffer);
	if (!mime || buffer.length < 1500) throw new Error('Pollinations returned non-image response');
	return {
		buffer,
		mimetype: mime,
		provider: endpointType === 'gen' ? 'Pollinations Gen' : 'Pollinations Flux',
	};
}

async function generateImageViaAiHorde(prompt, aspect, fetchFn) {
	const preset = ASPECT_PRESETS[aspect] || ASPECT_PRESETS['1:1'];
	const w = Math.max(512, Math.round(preset.fluxW / 64) * 64);
	const h = Math.max(512, Math.round(preset.fluxH / 64) * 64);

	const submitRes = await fetchFn('https://aihorde.net/api/v2/generate/async', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			apikey: '0000000000',
			'Client-Agent': 'WhatsAppBot:2.0:open',
		},
		body: JSON.stringify({
			prompt,
			params: { steps: 18, width: w, height: h, n: 1 },
			nsfw: false,
		}),
		signal: AbortSignal.timeout(15000),
	});
	if (!submitRes.ok) throw new Error(`AI Horde HTTP ${submitRes.status}`);
	const { id } = await submitRes.json();
	if (!id) throw new Error('AI Horde missing job id');

	for (let attempt = 0; attempt < 16; attempt++) {
		await new Promise((r) => setTimeout(r, 2000));
		const statusRes = await fetchFn(`https://aihorde.net/api/v2/generate/status/${id}`, {
			headers: { 'Client-Agent': 'WhatsAppBot:2.0:open' },
			signal: AbortSignal.timeout(10000),
		});
		if (!statusRes.ok) continue;
		const statusJson = await statusRes.json();
		if (statusJson.faulted) throw new Error('AI Horde generation faulted');
		if (statusJson.done && statusJson.generations?.[0]?.img) {
			const gen = statusJson.generations[0];
			let buffer;
			if (/^https?:\/\//i.test(gen.img)) {
				const imgRes = await fetchFn(gen.img, { signal: AbortSignal.timeout(15000) });
				if (!imgRes.ok) throw new Error(`AI Horde asset HTTP ${imgRes.status}`);
				buffer = Buffer.from(await imgRes.arrayBuffer());
			} else {
				buffer = Buffer.from(gen.img, 'base64');
			}
			const mime = detectImageMimeFromBuffer(buffer);
			if (!mime || buffer.length < 1500) throw new Error('AI Horde returned invalid image');
			return { buffer, mimetype: mime, provider: `AI Horde (${gen.model || 'SD'})` };
		}
	}
	throw new Error('AI Horde timed out');
}

async function generateImageViaGemini(prompt, aspect, referenceImage, referenceMime = 'image/jpeg') {
	const ai = createGeminiClient();
	if (!ai) throw new Error('GEMINI_API_KEY not configured');
	const parts = [];
	if (referenceImage && Buffer.isBuffer(referenceImage)) {
		parts.push({
			inlineData: {
				data: referenceImage.toString('base64'),
				mimeType: referenceMime,
			},
		});
	}
	parts.push({ text: prompt });

	const response = await ai.models.generateContent({
		model: 'gemini-3.1-flash-lite-image',
		contents: { parts },
		config: {
			imageConfig: {
				aspectRatio: aspect,
			},
		},
	});
	for (const part of response?.candidates?.[0]?.content?.parts || []) {
		if (part?.inlineData?.data) {
			const buffer = Buffer.from(part.inlineData.data, 'base64');
			const mime = detectImageMimeFromBuffer(buffer) || part.inlineData.mimeType || 'image/png';
			return { buffer, mimetype: mime, provider: 'Gemini Flash Image' };
		}
	}
	throw new Error('Gemini returned no image part');
}

export async function generateAiImage({
	prompt,
	model = 'auto',
	aspect = '1:1',
	referenceImage = null,
	referenceMime = 'image/jpeg',
	fetchFn = fetch,
} = {}) {
	const cleanPrompt = String(prompt || '').trim();
	if (!cleanPrompt) throw new Error('يرجى كتابة وصف الصورة المطلوب توليدها.');

	const reqModel = String(model || 'auto').toLowerCase();
	const providers = [];

	if (reqModel === 'gemini') {
		providers.push(() => generateImageViaGemini(cleanPrompt, aspect, referenceImage, referenceMime));
	} else if (reqModel === 'flux') {
		providers.push(() => generateImageViaHfFlux(cleanPrompt, aspect, fetchFn));
		providers.push(() => generateImageViaPollinations(cleanPrompt, aspect, fetchFn, 'legacy'));
	} else if (reqModel === 'zimage' || reqModel === 'z-image') {
		providers.push(() => generateImageViaHfZImage(cleanPrompt, aspect, fetchFn));
		providers.push(() => generateImageViaPollinations(cleanPrompt, aspect, fetchFn, 'gen'));
	} else if (reqModel === 'horde' || reqModel === 'aihorde') {
		providers.push(() => generateImageViaAiHorde(cleanPrompt, aspect, fetchFn));
	} else if (reqModel === 'pollinations' || reqModel === 'poll') {
		providers.push(() => generateImageViaPollinations(cleanPrompt, aspect, fetchFn, 'gen'));
		providers.push(() => generateImageViaPollinations(cleanPrompt, aspect, fetchFn, 'legacy'));
	} else {
		if (referenceImage && process.env.GEMINI_API_KEY) {
			providers.push(() => generateImageViaGemini(cleanPrompt, aspect, referenceImage, referenceMime));
		}
		providers.push(() => generateImageViaHfZImage(cleanPrompt, aspect, fetchFn));
		providers.push(() => generateImageViaHfFlux(cleanPrompt, aspect, fetchFn));
		providers.push(() => generateImageViaPollinations(cleanPrompt, aspect, fetchFn, 'gen'));
		providers.push(() => generateImageViaPollinations(cleanPrompt, aspect, fetchFn, 'legacy'));
		providers.push(() => generateImageViaAiHorde(cleanPrompt, aspect, fetchFn));
		if (!referenceImage && process.env.GEMINI_API_KEY) {
			providers.push(() => generateImageViaGemini(cleanPrompt, aspect, null, referenceMime));
		}
	}

	const failures = [];
	for (const run of providers) {
		try {
			return await run();
		} catch (err) {
			failures.push(err?.message || String(err));
		}
	}
	throw new Error(`تعذر توليد الصورة حالياً:\n${failures.slice(0, 3).join(' | ')}`);
}

// ---------- AI SPEECH / TTS GENERATION ----------

export function splitTextIntoChunks(text, maxLen = 170) {
	const normalized = String(text || '').replace(/\s+/g, ' ').trim();
	if (!normalized) return [];
	if (normalized.length <= maxLen) return [normalized];
	const chunks = [];
	let current = '';
	for (const word of normalized.split(' ')) {
		if (word.length > maxLen) {
			if (current) {
				chunks.push(current);
				current = '';
			}
			for (let i = 0; i < word.length; i += maxLen) {
				chunks.push(word.slice(i, i + maxLen));
			}
			continue;
		}
		if ((current + ' ' + word).trim().length > maxLen) {
			chunks.push(current);
			current = word;
		} else {
			current = current ? `${current} ${word}` : word;
		}
	}
	if (current) chunks.push(current);
	return chunks;
}

export function detectSpeechLanguage(text, explicitLang = null) {
	if (explicitLang) {
		const l = String(explicitLang).trim().toLowerCase();
		if (/^(ar|arabic|عربي|عربى)$/i.test(l)) return 'ar';
		if (/^(en|english|انجليزي|إنجليزي)$/i.test(l)) return 'en';
		if (/^(fr|french|فرنسي)$/i.test(l)) return 'fr';
		if (/^(es|spanish|اسباني|إسباني)$/i.test(l)) return 'es';
		if (/^(de|german|الماني|ألماني)$/i.test(l)) return 'de';
		if (/^(tr|turkish|تركي)$/i.test(l)) return 'tr';
		if (/^(id|indonesian|اندونيسي)$/i.test(l)) return 'id';
		return l.slice(0, 5);
	}
	return /[\u0600-\u06FF]/.test(String(text || '')) ? 'ar' : 'en';
}

const TIKTOK_VOICE_ALIASES = {
	sing: 'en_female_f08_salut_damour',
	غناء: 'en_female_f08_salut_damour',
	female: 'en_us_001',
	بنت: 'en_us_001',
	male: 'en_us_006',
	رجل: 'en_us_006',
	narrator: 'en_male_narration',
	راوي: 'en_male_narration',
};

async function generateSpeechViaGoogleTts(text, lang, fetchFn) {
	const chunks = splitTextIntoChunks(text, 175).slice(0, 8);
	const buffers = [];
	for (const chunk of chunks) {
		const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;
		const res = await fetchFn(url, {
			headers: { 'User-Agent': BROWSER_UA },
			signal: AbortSignal.timeout(12000),
		});
		if (!res.ok) throw new Error(`Google TTS HTTP ${res.status}`);
		const buf = Buffer.from(await res.arrayBuffer());
		if (buf.length < 400) throw new Error('Google TTS returned empty audio');
		buffers.push(buf);
	}
	if (buffers.length === 1) {
		return { buffer: buffers[0], ext: 'mp3', mimetype: 'audio/mpeg', provider: `Google TTS (${lang})` };
	}
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-gtts-'));
	try {
		const listPath = path.join(tempDir, 'list.txt');
		const outPath = path.join(tempDir, 'joined.mp3');
		const entries = [];
		for (let i = 0; i < buffers.length; i++) {
			const f = path.join(tempDir, `p${i}.mp3`);
			fs.writeFileSync(f, buffers[i]);
			entries.push(`file '${f.replace(/'/g, "'\\''")}'`);
		}
		fs.writeFileSync(listPath, entries.join('\n'));
		await runFfmpeg(['-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outPath]);
		return {
			buffer: fs.readFileSync(outPath),
			ext: 'mp3',
			mimetype: 'audio/mpeg',
			provider: `Google TTS (${lang})`,
		};
	} finally {
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
}

async function generateSpeechViaTikTokTts(text, voice, fetchFn) {
	const resolvedVoice = TIKTOK_VOICE_ALIASES[String(voice || '').toLowerCase()] || voice || 'en_us_001';
	const chunks = splitTextIntoChunks(text, 220).slice(0, 5);
	const buffers = [];
	for (const chunk of chunks) {
		const res = await fetchFn('https://tiktok-tts.weilnet.workers.dev/api/generation', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: chunk, voice: resolvedVoice }),
			signal: AbortSignal.timeout(12000),
		});
		if (!res.ok) throw new Error(`TikTok TTS HTTP ${res.status}`);
		const json = await res.json();
		if (!json?.success || !json?.data) throw new Error(json?.error || 'TikTok TTS failed');
		buffers.push(Buffer.from(json.data, 'base64'));
	}
	return {
		buffer: Buffer.concat(buffers),
		ext: 'mp3',
		mimetype: 'audio/mpeg',
		provider: `TikTok Voice (${resolvedVoice})`,
	};
}

async function generateSpeechViaPollinations(text, voice, fetchFn) {
	if (isCooling('poll_audio')) throw new Error('Pollinations audio cooling down');
	const chosenVoice = voice || 'onyx';
	const url = `https://gen.pollinations.ai/audio/${encodeURIComponent(text)}?model=tts-1&voice=${encodeURIComponent(chosenVoice)}`;
	const res = await fetchFn(url, {
		headers: { 'User-Agent': BROWSER_UA },
		signal: AbortSignal.timeout(20000),
	});
	if (res.status === 401 || res.status === 402 || res.status === 429) {
		setCooldown('poll_audio', 50000);
		throw new Error(`Pollinations audio rate-limited (${res.status})`);
	}
	if (!res.ok) throw new Error(`Pollinations audio HTTP ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	if (buf.length < 500) throw new Error('Pollinations audio empty');
	return { buffer: buf, ext: 'mp3', mimetype: 'audio/mpeg', provider: `Pollinations TTS (${chosenVoice})` };
}

async function generateSpeechViaSoundOfText(text, lang, fetchFn) {
	const sotVoiceMap = { ar: 'ar-AE', en: 'en-US', fr: 'fr-FR', es: 'es-ES', de: 'de-DE', tr: 'tr-TR', id: 'id-ID' };
	const voiceCode = sotVoiceMap[lang] || (lang.includes('-') ? lang : 'en-US');
	const shortText = String(text || '').slice(0, 195);
	const res = await fetchFn('https://api.soundoftext.com/sounds', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ engine: 'Google', data: { text: shortText, voice: voiceCode } }),
		signal: AbortSignal.timeout(10000),
	});
	if (!res.ok) throw new Error(`SoundOfText HTTP ${res.status}`);
	const { id } = await res.json();
	if (!id) throw new Error('SoundOfText missing id');

	for (let i = 0; i < 8; i++) {
		await new Promise((r) => setTimeout(r, 800));
		const poll = await fetchFn(`https://api.soundoftext.com/sounds/${id}`, { signal: AbortSignal.timeout(8000) });
		if (!poll.ok) continue;
		const statusJson = await poll.json();
		if (statusJson.status === 'Done' && statusJson.location) {
			const audioRes = await fetchFn(statusJson.location, { signal: AbortSignal.timeout(12000) });
			if (!audioRes.ok) throw new Error(`SoundOfText file HTTP ${audioRes.status}`);
			return {
				buffer: Buffer.from(await audioRes.arrayBuffer()),
				ext: 'mp3',
				mimetype: 'audio/mpeg',
				provider: `SoundOfText (${voiceCode})`,
			};
		}
		if (statusJson.status === 'Error') throw new Error(statusJson.message || 'SoundOfText error');
	}
	throw new Error('SoundOfText timed out');
}

async function generateSpeechViaGemini(text, voiceName = 'Kore') {
	const ai = createGeminiClient();
	if (!ai) throw new Error('GEMINI_API_KEY not configured');
	const prebuilt = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].includes(voiceName) ? voiceName : 'Kore';
	const response = await ai.models.generateContent({
		model: 'gemini-3.8-flash-lite-tts',
		contents: [{ role: 'user', parts: [{ text }] }],
		config: {
			responseModalities: ['AUDIO'],
			speechConfig: {
				voiceConfig: {
					prebuiltVoiceConfig: { voiceName: prebuilt },
				},
			},
		},
	});
	const b64 = response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
	if (!b64) throw new Error('Gemini TTS returned no audio');
	return {
		buffer: Buffer.from(b64, 'base64'),
		ext: 'wav',
		mimetype: 'audio/wav',
		provider: `Gemini 3.8 TTS (${prebuilt})`,
	};
}

export async function transcodeAudioToOggOpus(inputBuffer, inputExt = 'mp3') {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-ptt-'));
	try {
		const inPath = path.join(tempDir, `in.${inputExt}`);
		const outPath = path.join(tempDir, 'out.ogg');
		fs.writeFileSync(inPath, inputBuffer);
		await runFfmpeg(['-i', inPath, '-c:a', 'libopus', '-b:a', '48k', '-ac', '1', '-ar', '24000', outPath]);
		return fs.readFileSync(outPath);
	} finally {
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
}

export async function generateAiSpeech({
	text,
	lang = null,
	voice = null,
	model = 'auto',
	asPtt = true,
	fetchFn = fetch,
} = {}) {
	const cleanText = String(text || '').trim();
	if (!cleanText) throw new Error('يرجى كتابة النص المطلوب تحويله إلى صوت.');

	const resolvedLang = detectSpeechLanguage(cleanText, lang);
	const reqModel = String(model || 'auto').toLowerCase();
	const hasTikTokVoice = voice && (voice in TIKTOK_VOICE_ALIASES || /^en_|^es_|^fr_|^de_/.test(voice));

	const providers = [];
	if (reqModel === 'gemini') {
		providers.push(() => generateSpeechViaGemini(cleanText, voice || 'Kore'));
	} else if (reqModel === 'tiktok' || (hasTikTokVoice && resolvedLang !== 'ar')) {
		providers.push(() => generateSpeechViaTikTokTts(cleanText, voice || 'en_us_001', fetchFn));
		providers.push(() => generateSpeechViaGoogleTts(cleanText, resolvedLang, fetchFn));
	} else if (reqModel === 'pollinations' || reqModel === 'poll') {
		providers.push(() => generateSpeechViaPollinations(cleanText, voice || 'onyx', fetchFn));
		providers.push(() => generateSpeechViaGoogleTts(cleanText, resolvedLang, fetchFn));
	} else {
		if (process.env.GEMINI_API_KEY) {
			providers.push(() => generateSpeechViaGemini(cleanText, voice || 'Kore'));
		}
		if (resolvedLang === 'en' && voice) {
			providers.push(() => generateSpeechViaTikTokTts(cleanText, voice, fetchFn));
		}
		providers.push(() => generateSpeechViaGoogleTts(cleanText, resolvedLang, fetchFn));
		providers.push(() => generateSpeechViaSoundOfText(cleanText, resolvedLang, fetchFn));
		providers.push(() => generateSpeechViaPollinations(cleanText, voice || 'onyx', fetchFn));
		if (resolvedLang !== 'ar') {
			providers.push(() => generateSpeechViaTikTokTts(cleanText, voice || 'en_us_001', fetchFn));
		}
	}

	let rawResult = null;
	const failures = [];
	for (const run of providers) {
		try {
			rawResult = await run();
			break;
		} catch (err) {
			failures.push(err?.message || String(err));
		}
	}
	if (!rawResult) {
		throw new Error(`تعذر توليد الصوت حالياً:\n${failures.slice(0, 3).join(' | ')}`);
	}

	if (asPtt) {
		try {
			const ogg = await transcodeAudioToOggOpus(rawResult.buffer, rawResult.ext);
			return {
				buffer: ogg,
				mimetype: 'audio/ogg; codecs=opus',
				ptt: true,
				provider: rawResult.provider,
				lang: resolvedLang,
			};
		} catch {
			// Fallback cleanly to MP3/WAV if libopus fails on any edge input
		}
	}

	return {
		buffer: rawResult.buffer,
		mimetype: rawResult.mimetype,
		ptt: false,
		provider: rawResult.provider,
		lang: resolvedLang,
	};
}

// ---------- AI MUSIC GENERATION ----------

export async function generateAiMusic({
	prompt,
	duration = 12,
	model = 'auto',
	fetchFn: _fetchFn = fetch,
} = {}) {
	const cleanPrompt = String(prompt || '').trim();
	if (!cleanPrompt) throw new Error('يرجى كتابة وصف الموسيقى المطلوبة (مثال: موسيقى هادئة للتركيز أو لحن إلكتروني حماسي).');

	const clippedSec = Math.min(20, Math.max(5, Number(duration) || 12));

	// Optional Lyria Pro/Clip when GEMINI_API_KEY is available
	if (process.env.GEMINI_API_KEY && model !== 'synth' && model !== 'ffmpeg') {
		try {
			const ai = createGeminiClient();
			const response = await ai.models.generateContentStream({
				model: 'lyria-3-clip-preview',
				contents: cleanPrompt,
			});
			const audioChunks = [];
			let lyrics = '';
			let mimeType = 'audio/mpeg';
			for await (const chunk of response) {
				const parts = chunk?.candidates?.[0]?.content?.parts || [];
				for (const part of parts) {
					if (part?.inlineData?.data) {
						if (audioChunks.length === 0 && part.inlineData.mimeType) {
							mimeType = part.inlineData.mimeType;
						}
						audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
					}
					if (part?.text) lyrics += part.text;
				}
			}
			if (audioChunks.length > 0) {
				return {
					buffer: Buffer.concat(audioChunks),
					mimetype: mimeType,
					provider: 'Lyria 3 Clip',
					lyrics: lyrics.trim(),
					duration: clippedSec,
				};
			}
		} catch {
			// Fall back cleanly to procedural FFmpeg synthesizer
		}
	}

	// Guaranteed keyless procedural stereo synthesizer via FFmpeg
	const p = cleanPrompt.toLowerCase();
	let baseFreq = 220;
	let pulseHz = 2;
	let label = 'Ambient Synth';
	let exprL;
	let exprR;

	if (/(حزين|درامي|sad|melancholy|piano|بيانو)/i.test(p)) {
		baseFreq = 196; // G3 minor feel
		pulseHz = 1.2;
		label = 'Emotional Synth';
		exprL = `0.28*sin(2*PI*${baseFreq}*t)*exp(-0.2*mod(t,2)) + 0.18*sin(2*PI*${baseFreq * 1.189}*t) + 0.14*sin(2*PI*${baseFreq * 1.498}*t*(1+0.002*sin(2*PI*3*t)))`;
		exprR = `0.26*sin(2*PI*${baseFreq * 0.998}*t)*exp(-0.2*mod(t,2)) + 0.18*sin(2*PI*${baseFreq * 1.189}*t+0.4) + 0.14*sin(2*PI*${baseFreq * 1.498}*t)`;
	} else if (/(حماسي|اكشن|أكشن|راب|تيكنو|electronic|upbeat|beat|synth|مبهج)/i.test(p)) {
		baseFreq = 146.83; // D3 electronic pulse
		pulseHz = 4;
		label = 'Electronic Beat Synth';
		exprL = `0.30*sin(2*PI*${baseFreq}*t)*(0.5+0.5*sin(2*PI*${pulseHz}*t)) + 0.18*sin(2*PI*${baseFreq * 2}*t)*exp(-4*mod(t,0.5)) + 0.12*sin(2*PI*${baseFreq * 3}*t)*exp(-8*mod(t,0.25))`;
		exprR = `0.30*sin(2*PI*${baseFreq}*t+0.2)*(0.5+0.5*cos(2*PI*${pulseHz}*t)) + 0.18*sin(2*PI*${baseFreq * 2.5}*t)*exp(-4*mod(t,0.5)) + 0.12*sin(2*PI*${baseFreq * 3.01}*t)*exp(-8*mod(t+0.125,0.25))`;
	} else {
		// Calm atmospheric pad
		baseFreq = 261.63; // C4
		label = 'Ambient Chill Pad';
		exprL = `0.22*sin(2*PI*${baseFreq}*t) + 0.18*sin(2*PI*${baseFreq * 1.25}*t) + 0.15*sin(2*PI*${baseFreq * 1.5}*t) + 0.10*sin(2*PI*${baseFreq * 0.5}*t)`;
		exprR = `0.22*sin(2*PI*${baseFreq * 1.003}*t+0.5) + 0.18*sin(2*PI*${baseFreq * 1.25}*t+0.3) + 0.15*sin(2*PI*${baseFreq * 1.502}*t) + 0.10*sin(2*PI*${baseFreq * 0.5}*t)`;
	}

	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-music-'));
	try {
		const outPath = path.join(tempDir, 'synth.mp3');
		const fadeOutStart = Math.max(1, clippedSec - 1.5);
		await runFfmpeg([
			'-f', 'lavfi',
			'-i', `aevalsrc='${exprL}|${exprR}':s=44100:d=${clippedSec}`,
			'-af', `afade=t=in:st=0:d=0.6,afade=t=out:st=${fadeOutStart}:d=1.5,aecho=0.8:0.7:60:0.35`,
			'-c:a', 'libmp3lame',
			'-b:a', '128k',
			outPath,
		]);
		return {
			buffer: fs.readFileSync(outPath),
			mimetype: 'audio/mpeg',
			provider: `FFmpeg ${label}`,
			lyrics: '',
			duration: clippedSec,
		};
	} finally {
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
}

// ---------- AI VIDEO GENERATION ----------

async function generateVideoViaHfLtx(prompt, aspect, fetchFn) {
	const baseUrl = 'https://lightricks-ltx-video-distilled.hf.space';
	const width = aspect === '9:16' ? 448 : 704;
	const height = aspect === '9:16' ? 704 : aspect === '16:9' ? 448 : 512;

	const submitRes = await fetchFn(`${baseUrl}/gradio_api/call/text_to_video`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA },
		body: JSON.stringify({
			data: [
				prompt,
				'worst quality, inconsistent motion, blurry, jittery, distorted',
				null,
				null,
				height,
				width,
				'text-to-video',
				2,
				9,
				Math.floor(Math.random() * 1e6),
				true,
				1,
				true,
			],
		}),
		signal: AbortSignal.timeout(15000),
	});
	if (!submitRes.ok) throw new Error(`LTX-Video HTTP ${submitRes.status}`);
	const { event_id: eventId } = await submitRes.json();
	if (!eventId) throw new Error('LTX-Video missing event_id');

	const sseRes = await fetchFn(`${baseUrl}/gradio_api/call/text_to_video/${eventId}`, {
		headers: { 'User-Agent': BROWSER_UA },
		signal: AbortSignal.timeout(60000),
	});
	if (!sseRes.ok) throw new Error(`LTX-Video SSE HTTP ${sseRes.status}`);
	const completeData = await parseGradioSseComplete(sseRes);
	const videoUrl = extractGradioMediaUrl(completeData, baseUrl);
	if (!videoUrl) throw new Error('LTX-Video returned no video URL');

	const vidRes = await fetchFn(videoUrl, { signal: AbortSignal.timeout(30000) });
	if (!vidRes.ok) throw new Error(`LTX-Video download HTTP ${vidRes.status}`);
	const buffer = Buffer.from(await vidRes.arrayBuffer());
	if (buffer.length < 4000) throw new Error('LTX-Video file too small');
	return { buffer, mimetype: 'video/mp4', provider: 'LTX-Video Distilled (AI Video)' };
}

async function muxAudioIntoVideo(videoBuffer, audioBuffer, audioExt = 'mp3') {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-mux-'));
	try {
		const vidIn = path.join(tempDir, 'in.mp4');
		const audIn = path.join(tempDir, `aud.${audioExt}`);
		const outPath = path.join(tempDir, 'muxed.mp4');
		fs.writeFileSync(vidIn, videoBuffer);
		fs.writeFileSync(audIn, audioBuffer);
		await runFfmpeg([
			'-i', vidIn,
			'-i', audIn,
			'-map', '0:v:0',
			'-map', '1:a:0',
			'-c:v', 'copy',
			'-c:a', 'aac',
			'-b:a', '128k',
			'-shortest',
			'-movflags', '+faststart',
			outPath,
		]);
		return fs.readFileSync(outPath);
	} finally {
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
}

export async function animateImageBufferToVideo({
	imageBuffer,
	audioBuffer = null,
	audioExt = 'mp3',
	duration = 4,
	aspect = '1:1',
} = {}) {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `wa-vid-${randomUUID().slice(0, 6)}-`));
	try {
		const mime = detectImageMimeFromBuffer(imageBuffer) || 'image/jpeg';
		const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
		const imgPath = path.join(tempDir, `frame.${ext}`);
		const outPath = path.join(tempDir, 'animated.mp4');
		fs.writeFileSync(imgPath, imageBuffer);

		const secs = Math.min(10, Math.max(2, Number(duration) || 4));
		const frames = secs * 25;
		const size = aspect === '16:9' ? '1024x576' : aspect === '9:16' ? '576x1024' : '720x720';
		const [w, h] = size.split('x');

		const args = [
			'-i', imgPath,
		];
		if (audioBuffer) {
			const audPath = path.join(tempDir, `voice.${audioExt}`);
			fs.writeFileSync(audPath, audioBuffer);
			args.push('-i', audPath);
		}
		args.push(
			'-vf',
			`scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},zoompan=z='min(zoom+0.0018,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${size}:fps=25`,
			'-t', String(secs),
			'-c:v', 'libx264',
			'-pix_fmt', 'yuv420p',
			'-preset', 'veryfast'
		);
		if (audioBuffer) {
			args.push('-c:a', 'aac', '-b:a', '128k', '-shortest');
		} else {
			args.push('-an');
		}
		args.push('-movflags', '+faststart', outPath);

		await runFfmpeg(args, 45000);
		return fs.readFileSync(outPath);
	} finally {
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
}

export async function generateAiVideo({
	prompt,
	imageBuffer = null,
	aspect = '16:9',
	duration = 4,
	model = 'auto',
	withVoice = false,
	lang = null,
	fetchFn = fetch,
} = {}) {
	const cleanPrompt = String(prompt || '').trim();
	if (!cleanPrompt && !imageBuffer) {
		throw new Error('يرجى كتابة وصف الفيديو المطلوب أو الرد على صورة لتحريكها.');
	}

	let audioBuffer = null;
	let audioExt = 'mp3';
	if (withVoice && cleanPrompt) {
		try {
			const tts = await generateAiSpeech({
				text: cleanPrompt,
				lang,
				asPtt: false,
				fetchFn,
			});
			audioBuffer = tts.buffer;
			audioExt = tts.mimetype?.includes('wav') ? 'wav' : 'mp3';
		} catch {
			audioBuffer = null;
		}
	}

	// 1. Try true AI text-to-video (LTX-Video) unless user replied to a photo or requested ffmpeg animation directly
	if (!imageBuffer && cleanPrompt && model !== 'ffmpeg' && model !== 'motion') {
		try {
			const aiVid = await generateVideoViaHfLtx(cleanPrompt, aspect, fetchFn);
			if (audioBuffer) {
				try {
					const muxed = await muxAudioIntoVideo(aiVid.buffer, audioBuffer, audioExt);
					return { ...aiVid, buffer: muxed, provider: `${aiVid.provider} + TTS` };
				} catch {
					return aiVid;
				}
			}
			return aiVid;
		} catch {
			// Fall back cleanly to AI image -> FFmpeg cinematic zoompan animation
		}
	}

	// 2. Guaranteed motion-video pipeline: generate AI scene image (or use quoted photo) + FFmpeg Ken Burns zoompan
	let baseImg = imageBuffer;
	let imgProvider = 'الصورة المرفقة';
	if (!baseImg) {
		const gen = await generateAiImage({ prompt: cleanPrompt, aspect, fetchFn });
		baseImg = gen.buffer;
		imgProvider = gen.provider;
	}

	const mp4Buffer = await animateImageBufferToVideo({
		imageBuffer: baseImg,
		audioBuffer,
		audioExt,
		duration,
		aspect,
	});
	return {
		buffer: mp4Buffer,
		mimetype: 'video/mp4',
		provider: `${imgProvider} + FFmpeg Motion`,
	};
}

export function formatAiMediaHelp(usedPrefix = '.') {
	return [
		'✨ *استوديو التوليد بالذكاء الاصطناعي (صور • فيديو • صوت • موسيقى)*',
		'',
		'🖼️ *1) توليد الصور:*',
		`• \`${usedPrefix}ارسم أسد يطير فوق أهرامات الجيزة وقت الغروب\``,
		`• \`${usedPrefix}imagine -a 16:9 -m zimage cyberpunk cairo\``,
		'_(الموديلات: auto, zimage, flux, pollinations, horde | المقاسات: 1:1, 16:9, 9:16, 4:3, 3:4)_',
		'',
		'🎬 *2) توليد الفيديوهات (AI Video):*',
		`• \`${usedPrefix}فيديو_ai أمواج المحيط وقت الغروب بأسلوب سينمائي\``,
		`• \`${usedPrefix}aivideo --tts صحراء ذهبية وجمال تسير وقت الشروق\` _(مع تعليق صوتي)_`,
		'• أو اعمل ريبلاي على أي صورة واكتب `.فيديو_ai` لتحريكها!',
		'',
		'🎙️ *3) توليد الصوت والكلام (TTS):*',
		`• \`${usedPrefix}انطق أهلاً بكم في البوت الذكي\``,
		`• \`${usedPrefix}tts -l en Welcome to the future of AI\``,
		`• \`${usedPrefix}say -m tiktok -v sing Happy birthday to you\` _(صوت غنائي/تمثيلي)_`,
		'',
		'🎵 *4) توليد الموسيقى والألحان:*',
		`• \`${usedPrefix}موسيقى_ai موسيقى إلكترونية حماسية -d 15\``,
		`• \`${usedPrefix}aimusic calm ambient piano melody\``,
		'',
		'⚡ *الأمر الشامل:*',
		`• \`${usedPrefix}توليد صورة ...\` | \`${usedPrefix}توليد فيديو ...\` | \`${usedPrefix}توليد صوت ...\` | \`${usedPrefix}توليد موسيقى ...\``,
	].join('\n');
}
