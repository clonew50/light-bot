import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const emoji = '⚠️';
const msm = '❌';

const handler = async (m, { conn, text, usedPrefix, command }) => {
	if (!global.db?.data?.chats?.[m.chat]?.nsfw && m.isGroup) {
		return conn.reply(
			m.chat,
			`${emoji} El contenido *NSFW* está desactivado en este grupo.\n> Un administrador puede activarlo con el comando » *${usedPrefix}nsfw on*`,
			m
		);
	}

	if (!text) {
		return conn.reply(m.chat, `${emoji} Por favor, ingrese la búsqueda.\n> Ejemplo de uso: ${usedPrefix + command} query`, m);
	}

	try {
		const vids_ = {
			from: m.sender,
			urls: [],
		};

		if (!global.videoListXXX) {
			global.videoListXXX = [];
		}

		if (global.videoListXXX[0]?.from === m.sender) {
			global.videoListXXX.splice(0, global.videoListXXX.length);
		}

		const res = await xnxxsearch(text);
		const json = res.result || [];
		if (!json.length) {
			return conn.reply(m.chat, `${emoji} No se encontraron resultados para: *${text}*`, m);
		}

		let cap = `*${emoji} Resultados de la búsqueda:* ${text.toUpperCase()}\n\n`;
		let count = 1;

		for (const v of json) {
			vids_.urls.push(v.link);
			cap += `*[${count}]*\n• *🎬 Titulo:* ${v.title}\n• *🔗 Link:* ${v.link}\n• *❗ Info:* ${v.info}\n\n`;
			cap += '••••••••••••••••••••••••••••••••\n\n';
			count++;
		}

		await conn.reply(m.chat, cap, m);
		global.videoListXXX.push(vids_);
	} catch (e) {
		return conn.reply(m.chat, `${msm} Ocurrió un error: ${e.message}`, m);
	}
};

handler.help = ['xnxxsearch'].map((v) => v + ' <query>');
handler.tags = ['buscador'];
handler.command = ['xnxxsearch', 'xnxxs'];
handler.register = true;
handler.group = false;

export default handler;

async function xnxxsearch(query) {
	const baseurl = 'https://www.xnxx.com';
	const res = await fetch(`${baseurl}/search/${encodeURIComponent(query)}/${Math.floor(Math.random() * 3) + 1}`, {
		method: 'get',
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
		},
		signal: AbortSignal.timeout(15000),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const html = await res.text();
	const $ = cheerio.load(html, { xmlMode: false });
	const title = [];
	const url = [];
	const desc = [];
	const results = [];

	$('div.mozaique').each(function (a, b) {
		$(b)
			.find('div.thumb')
			.each(function (c, d) {
				const href = $(d).find('a').attr('href');
				if (href) url.push(baseurl + href.replace('/THUMBNUM/', '/'));
			});
	});

	$('div.mozaique').each(function (a, b) {
		$(b)
			.find('div.thumb-under')
			.each(function (c, d) {
				desc.push($(d).find('p.metadata').text().trim());
				$(d)
					.find('a')
					.each(function (e, f) {
						const t = $(f).attr('title');
						if (t) title.push(t);
					});
			});
	});

	const len = Math.min(title.length, url.length);
	for (let i = 0; i < len; i++) {
		results.push({ title: title[i], info: desc[i] || '', link: url[i] });
	}

	return { code: 200, status: true, result: results };
}