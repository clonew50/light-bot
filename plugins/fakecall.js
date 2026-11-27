import axios from 'axios';
import { createCanvas, loadImage } from '@napi-rs/canvas';

export async function renderFakeCallImage({ name, duration, avatarBuffer, ios = false }) {
	const W = 720;
	const H = 1280;
	const canvas = createCanvas(W, H);
	const ctx = canvas.getContext('2d');

	// Dark WhatsApp call background
	const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
	if (ios) {
		bgGrad.addColorStop(0, '#101c22');
		bgGrad.addColorStop(0.5, '#0b141a');
		bgGrad.addColorStop(1, '#080e12');
	} else {
		bgGrad.addColorStop(0, '#0f2027');
		bgGrad.addColorStop(0.5, '#0b141a');
		bgGrad.addColorStop(1, '#091015');
	}
	ctx.fillStyle = bgGrad;
	ctx.fillRect(0, 0, W, H);

	let avatarImg = null;
	if (avatarBuffer?.length) {
		try {
			avatarImg = await loadImage(avatarBuffer);
			ctx.save();
			ctx.globalAlpha = 0.22;
			ctx.filter = 'blur(28px)';
			const scale = Math.max(W / avatarImg.width, H / avatarImg.height);
			const bw = avatarImg.width * scale;
			const bh = avatarImg.height * scale;
			ctx.drawImage(avatarImg, (W - bw) / 2, (H - bh) / 2, bw, bh);
			ctx.restore();
		} catch {}
	}

	// Subtle dark overlay
	ctx.fillStyle = 'rgba(11, 20, 26, 0.62)';
	ctx.fillRect(0, 0, W, H);

	// Top header: End-to-end encrypted badge
	ctx.textAlign = 'center';
	ctx.fillStyle = 'rgba(233, 237, 239, 0.68)';
	ctx.font = '500 22px sans-serif';
	ctx.fillText('🔒 End-to-end encrypted', W / 2, 110);

	// Caller name
	ctx.fillStyle = '#ffffff';
	ctx.font = '600 50px sans-serif';
	const safeName = String(name || 'Caller').slice(0, 26);
	ctx.fillText(safeName, W / 2, 210);

	// Call status / duration
	ctx.fillStyle = 'rgba(233, 237, 239, 0.85)';
	ctx.font = '400 32px sans-serif';
	ctx.fillText(String(duration || '00:00'), W / 2, 268);

	// Circular avatar in center
	const cx = W / 2;
	const cy = 540;
	const radius = 155;

	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
	ctx.fill();
	ctx.restore();

	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy, radius, 0, Math.PI * 2);
	ctx.closePath();
	ctx.clip();
	if (avatarImg) {
		const scale = Math.max((radius * 2) / avatarImg.width, (radius * 2) / avatarImg.height);
		const dw = avatarImg.width * scale;
		const dh = avatarImg.height * scale;
		ctx.drawImage(avatarImg, cx - dw / 2, cy - dh / 2, dw, dh);
	} else {
		ctx.fillStyle = '#202c33';
		ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
		ctx.fillStyle = '#8696a0';
		ctx.font = 'bold 120px sans-serif';
		ctx.textBaseline = 'middle';
		ctx.fillText(safeName[0]?.toUpperCase() || '?', cx, cy);
	}
	ctx.restore();

	// Bottom control tray
	const trayY = H - 235;
	if (!ios) {
		ctx.fillStyle = 'rgba(32, 44, 51, 0.94)';
		ctx.beginPath();
		ctx.roundRect(44, trayY, W - 88, 165, 36);
		ctx.fill();
	}

	const btns = [
		{ x: 140, label: '⋯', bg: 'rgba(255,255,255,0.14)' },
		{ x: 280, label: '🔊', bg: 'rgba(255,255,255,0.14)' },
		{ x: 420, label: '🎙️', bg: 'rgba(255,255,255,0.14)' },
		{ x: 580, label: '📞', bg: '#ef4444' },
	];

	const btnY = trayY + 82;
	for (const b of btns) {
		ctx.save();
		ctx.beginPath();
		ctx.arc(b.x, btnY, 44, 0, Math.PI * 2);
		ctx.fillStyle = b.bg;
		ctx.fill();
		ctx.fillStyle = '#ffffff';
		ctx.font = '32px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(b.label, b.x, btnY);
		ctx.restore();
	}

	return canvas.toBuffer('image/png');
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
	const cmd = command.toLowerCase();

	if (!text || !text.includes('|')) {
		let helpText = `Hello! Wrong format.\n\n`;
		helpText += `*Command List:*\n`;
		helpText += `- *${usedPrefix}fakecall* (Android)\n`;
		helpText += `- *${usedPrefix}fakecall-ios* (iPhone)\n\n`;
		helpText += `*How to Use:*\n`;
		helpText += `Type Name | Duration\n\n`;
		helpText += `*Example:*\n`;
		helpText += `- *${usedPrefix}fakecall Zann | 03:33:33*\n`;
		helpText += `- *${usedPrefix}fakecall-ios Sayangku | 12:00:00*\n\n`;
		helpText += `*Tips:* Reply to an image to use it as the caller's avatar!`;
		return m.reply(helpText);
	}

	const [nama, durasi] = text.split('|').map((s) => s.trim());

	if (!nama) return m.reply(`Name cannot be empty!`);
	if (!durasi) return m.reply(`Duration cannot be empty!`);

	await conn.sendMessage(m.chat, { react: { text: '🕕', key: m.key } });

	try {
		let bufferBase = null;

		if (m.quoted && m.quoted.mtype && m.quoted.mtype.includes('image')) {
			try {
				bufferBase = await m.quoted.download();
			} catch {}
		} else if (m.mtype && m.mtype.includes('image')) {
			try {
				bufferBase = await m.download();
			} catch {}
		}

		if (!bufferBase) {
			try {
				const ppUrl = await conn.profilePictureUrl(m.sender, 'image', 'buffer');
				if (Buffer.isBuffer(ppUrl)) {
					bufferBase = ppUrl;
				} else if (typeof ppUrl === 'string' && ppUrl.startsWith('http')) {
					const res = await axios.get(ppUrl, { responseType: 'arraybuffer', timeout: 10000 });
					bufferBase = Buffer.from(res.data);
				}
			} catch {}
		}

		const isIos = cmd === 'fakecall-ios' || cmd === 'fakecallwa-ios';
		const outputBuffer = await renderFakeCallImage({
			name: nama,
			duration: durasi,
			avatarBuffer: bufferBase,
			ios: isIos,
		});

		await conn.sendMessage(m.chat, { image: outputBuffer, caption: `✅ Fake call: ${nama} | ${durasi}` }, { quoted: m });
		await conn.sendMessage(m.chat, { react: { text: '📞', key: m.key } });
	} catch (err) {
		console.error(err);
		await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
		return m.reply(`❌ Failed to create fake call: ${err.message}`);
	}
};

handler.help = ['fakecall', 'fakecall-ios'];
handler.tags = ['canvas', 'fun'];
handler.command = /^(fakecall|fakecall-android|fakecall-ios|fakecallwa|fakecallwa-ios)$/i;

export default handler;

// Hi
