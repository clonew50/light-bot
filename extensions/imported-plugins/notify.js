/**
	* from Nixel
	* source https://pastebin(.)com/KSdKf6sT
	* © NIXCODE
**/

import { delay } from '@whiskeysockets/baileys'

let handler = async (m, { conn, args, text, usedPrefix, command }) => {
	if (!text || !parseInt(args[0])) {
		return m.reply(`Contoh penggunaan: *${usedPrefix + command} <jumlah> <?target> <?delay>*`)
	}

	const [jump, target, dely] = args
	const much = parseInt(jump)
	const sendto = (target == 'here' ? m.chat : target) || m.chat
	const sabar = parseInt(dely) || 500

	const notif = {
		sessionTransparencyMetadata: {
			disclaimerText: '~ let me know',
			hcaId: `hca_${Date.now()}`,
			sessionTransparencyType: 1
		}
	}

	const mContextInfo = {
		messageContextInfo: {
			botMetadata: {
				...notif
			}
		}
	}

	const reaction = {
		...mContextInfo,
		reactionMessage: {
			key: {
				remoteJid: sendto,
				id: m.id,
				fromMe: false
			},
			text: ''
		}
	}

	await m.react('⏳')

	for (let i = 0; i < much; i++) {
		await conn.relayMessage(
			sendto,
			reaction,
			{
				additionalAttributes: {
					type: 'reaction'
				}
			}
		)

		await delay(sabar)
	}

	await m.react('')
}

handler.command = ['notify']
handler.usage = ['notify <jumlah> <?target> <?delay>']
handler.category = 'owner'
handler.owner = true

export default handler