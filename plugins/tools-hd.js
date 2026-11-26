import axios from 'axios';
import FormData from 'form-data';

let handler = async (m, { conn, usedPrefix, command }) => {
	let quoted = m.quoted ? m.quoted : m;
	let mime = (quoted.msg || quoted).mimetype || '';
	if (!/image/.test(mime)) throw `Send/Reply a photo with the caption ${usedPrefix + command}`;
	let media = await quoted.download();
	let res;
	if (/^hdr$/i.test(command)) {
		res = await upscale(media, 4);
	} else {
		res = await upscale(media, 2);
	}
	const outUrl = res?.data?.downloadUrls?.[0];
	if (!outUrl) throw new Error('Upscale returned no download URL');
	await conn.sendFile(m.chat, outUrl, 'hd.png', 'Here is the result', m);
};
handler.help = ['hd', 'hdr'];
handler.tags = ['tools'];
handler.command = /^(upscale|hd|hdr)$/i;
handler.limit = true;
export default handler;

async function upscale(buffer, rasio = 2) {
	const form = new FormData();
	form.append('myfile', buffer, Date.now() + '.jpg');
	form.append('scaleRadio', rasio);

	const upload = await axios.post('https://get1.imglarger.com/api/UpscalerNew/UploadNew', form, {
		headers: {
			...form.getHeaders(),
			Origin: 'https://imgupscaler.com',
		},
		timeout: 30000,
	});

	if (upload.status !== 200 || !upload.data?.data?.code) {
		throw new Error('Failed to Upload Image');
	}

	const code = upload.data.data.code;
	for (let i = 0; i < 20; i++) {
		const check = await axios.post(
			'https://get1.imglarger.com/api/UpscalerNew/CheckStatusNew',
			{
				code,
				scaleRadio: rasio,
			},
			{
				headers: {
					'Content-Type': 'application/json',
				},
				timeout: 20000,
			}
		);

		const result = check.data;

		if (result?.data?.status === 'success') {
			return result;
		}
		if (result?.data?.status === 'failed' || result?.data?.status === 'error') {
			throw new Error('Upscale failed on server');
		}

		await new Promise((resolve) => setTimeout(resolve, 5000));
	}

	throw new Error('Upscale Timeout');
}
