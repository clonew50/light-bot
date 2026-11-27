import { generateWAMessageFromContent, generateMessageIDV2 } from 'baileys';
import crypto from 'crypto';

class AIRich {
	#client;

	constructor(client) {
		if (!client) {
			throw new Error('AIRich: connection is required');
		}
		this.#client = client;
		this.conn = client;
		this._title = '';
		this._footer = '';
		this._contextInfo = {};
		this._messageContextInfoExtra = {};
		this._sections = []; // { id, layout, sub }
		this._richResponseSources = [];
		this._loadedSubmessages = [];
		this._responseId = null;
		this._lastKey = null;
		this._lastJid = null;
	}

	setTitle(t) {
		this._title = t;
		return this;
	}

	setFooter(t) {
		this._footer = t;
		return this;
	}

	setContextInfo(o) {
		this._contextInfo = o || {};
		return this;
	}

	get items() {
		return this._sections.map((s) => s.layout.view_model);
	}

	static newLayout(name, data) {
		return {
			view_model: {
				[Array.isArray(data) ? 'primitives' : 'primitive']: data,
				__typename: `GenAI${name}LayoutViewModel`,
			},
		};
	}

	_upsert(id, layout, sub = null, opts = {}) {
		const { insertAt, replace } = opts || {};
		if (replace) {
			const idx = this._sections.findIndex((x) => x.id === replace);
			if (idx !== -1) {
				this._sections[idx] = { id: id || replace, layout, sub };
				return this;
			}
		}
		if (id) {
			const idx = this._sections.findIndex((x) => x.id === id);
			if (idx !== -1) {
				this._sections[idx] = { id, layout, sub };
				return this;
			}
		}
		const newItem = { id: id || crypto.randomUUID(), layout, sub };
		if (insertAt) {
			const idx = this._sections.findIndex((x) => x.id === insertAt);
			if (idx !== -1) {
				this._sections.splice(idx + 1, 0, newItem);
				return this;
			}
		}
		this._sections.push(newItem);
		return this;
	}

	addText(text, opts = {}) {
		const sub = { messageType: 2, messageText: text };
		const layout = AIRich.newLayout('Single', { text, __typename: 'GenAIMarkdownTextUXPrimitive' });
		return this._upsert(opts.id, layout, sub, opts);
	}

	addTip(text, opts = {}) {
		const sub = { messageType: 2, messageText: text };
		const layout = AIRich.newLayout('Single', { text, __typename: 'GenAIMetadataTextPrimitive' });
		return this._upsert(opts.id, layout, sub, opts);
	}

	addMetadata(text, opts = {}) {
		return this.addTip(text, opts);
	}

	addSuggest(arr, opts = {}) {
		const a = Array.isArray(arr) ? arr : [arr];
		const layout = AIRich.newLayout(
			'ActionRow',
			a.map((t) => ({
				prompt_text: t,
				prompt_type: 'SUGGESTED_PROMPT',
				__typename: 'GenAIFollowUpSuggestionPillPrimitive',
			}))
		);
		return this._upsert(opts.id, layout, null, opts);
	}

	addCode(lang, code, opts = {}) {
		const meta = AIRich.tokenizer(code, lang);
		const sub = { messageType: 5, codeMetadata: { codeLanguage: lang, codeBlocks: meta.codeBlock } };
		const layout = AIRich.newLayout('Single', {
			language: lang,
			code_blocks: meta.unified_codeBlock,
			__typename: 'GenAICodeUXPrimitive',
		});
		return this._upsert(opts.id, layout, sub, opts);
	}

	addTable(table, opts = {}) {
		const meta = AIRich.toTableMetadata(table);
		const sub = { messageType: 4, tableMetadata: { title: meta.title, rows: meta.rows } };
		const layout = AIRich.newLayout('Single', { rows: meta.unified_rows, __typename: 'GenATableUXPrimitive' });
		return this._upsert(opts.id, layout, sub, opts);
	}

	addImage(urlOrEmpty, opts = {}) {
		const isGenerating = !urlOrEmpty;
		const url = urlOrEmpty || 'https://placehold.co/600x400';
		const status = opts.status || (isGenerating ? 'GENERATING' : 'READY');
		const sub = {
			messageType: 1,
			gridImageMetadata: {
				gridImageUrl: { imagePreviewUrl: url },
				imageUrls: [{ imagePreviewUrl: url, imageHighResUrl: url, sourceUrl: 'https://fiora.nixel.my.id/' }],
			},
		};
		const layout = AIRich.newLayout('Single', {
			media: { url, mime_type: 'image/png' },
			imagine_type: 'IMAGE',
			status: {
				status,
				update_text: opts.update_text || '',
				estimated_time_remaining: opts.estimatedTime || 0,
			},
			__typename: 'GenAIImaginePrimitive',
		});
		return this._upsert(opts.id, layout, sub, opts);
	}

	addVideo(urlOrEmpty, opts = {}) {
		const url = urlOrEmpty || 'https://placehold.co/600x400.mp4';
		const status = opts.status || (!urlOrEmpty ? 'GENERATING' : 'READY');
		const sub = { messageType: 2, messageText: '[ CANNOT_LOAD_VIDEO ]' };
		const layout = AIRich.newLayout('Single', {
			media: { url, mime_type: 'video/mp4', duration: 0 },
			imagine_type: 'ANIMATE',
			status: { status, estimated_time_remaining: opts.estimatedTime || 0 },
			__typename: 'GenAIImaginePrimitive',
		});
		return this._upsert(opts.id, layout, sub, opts);
	}

	addSource(sources = [], opts = {}) {
		let src = sources;
		if (Array.isArray(sources) && sources.length && typeof sources[0] === 'object' && !Array.isArray(sources[0])) {
			src = sources.map((s) => [s.icon || s.favicon || '', s.url || '', s.title || '']);
		}
		if (src.every((i) => typeof i === 'string')) src = [src];
		const mapped = src.map(([p, u, t]) => ({
			source_type: 'THIRD_PARTY',
			source_display_name: t || '',
			source_subtitle: 'AI',
			source_url: u || '',
			favicon: { url: p || '', mime_type: 'image/jpeg', width: 16, height: 16 },
		}));
		const layout = AIRich.newLayout('Single', { sources: mapped, __typename: 'GenAISearchResultPrimitive' });
		return this._upsert(opts.id, layout, null, opts);
	}

	addProduct(data = {}, opts = {}) {
		const items = Array.isArray(data) ? data : [data];
		const sub = { messageType: 2, messageText: '[ CANNOT_LOAD_PRODUCT ]' };
		const product = items.map((item) => ({
			title: item.title,
			brand: item.brand,
			price: item.price,
			sale_price: item.sale_price,
			product_url: item.product_url || item.url,
			image: { url: item.image_url || item.image },
			additional_images: [{ url: item.icon_url || item.icon }],
			__typename: 'GenAIProductItemCardPrimitive',
		}));
		const layout = AIRich.newLayout(
			Array.isArray(data) ? 'HScroll' : 'Single',
			Array.isArray(data) ? product : product[0]
		);
		return this._upsert(opts.id, layout, sub, opts);
	}

	addPost(data = {}, opts = {}) {
		const posts = Array.isArray(data) ? data : [data];
		const sub = { messageType: 2, messageText: '[ CANNOT_LOAD_POST ]' };
		const layout = AIRich.newLayout(
			'HScroll',
			posts.map((p) => ({
				title: p.title || '',
				subtitle: p.subtitle || '',
				username: p.username || '',
				profile_picture_url: p.profile || p.profile_picture_url || p.profile_url || '',
				is_verified: !!(p.verified || p.is_verified),
				thumbnail_url: p.thumbnail || p.thumbnail_url || '',
				post_caption: p.caption || p.post_caption || '',
				likes_count: p.likes_count || 0,
				comments_count: p.comments_count || 0,
				shares_count: p.shares_count || 0,
				post_url: p.url || p.post_url || '',
				post_deeplink: p.deeplink || '',
				source_app: p.source_app || 'INSTAGRAM',
				footer_label: '',
				footer_icon: '',
				is_carousel: posts.length > 1,
				orientation: 'LANDSCAPE',
				post_type: 'VIDEO',
				__typename: 'GenAIPostPrimitive',
			}))
		);
		return this._upsert(opts.id, layout, sub, opts);
	}

	addReels(reelsItems = [], opts = {}) {
		const arr = Array.isArray(reelsItems) ? reelsItems : [reelsItems];
		const sub = {
			messageType: 9,
			contentItemsMetadata: {
				contentType: 1,
				itemsMetadata: arr.map((item) => ({
					reelItem: {
						title: item.username || '',
						profileIconUrl: item.profile || item.profileIconUrl || '',
						thumbnailUrl: item.thumbnail || item.thumbnailUrl || '',
						videoUrl: item.url || item.videoUrl || '',
					},
				})),
			},
		};
		const layout = AIRich.newLayout(
			'HScroll',
			arr.map((item) => ({
				reels_url: item.url || item.videoUrl || '',
				thumbnail_url: item.thumbnail || item.thumbnailUrl || '',
				creator: item.username || '',
				avatar_url: item.profile || item.profileIconUrl || '',
				reels_title: item.title || '',
				likes_count: 0,
				shares_count: 0,
				view_count: 0,
				reel_source: 'IG',
				is_verified: !!item.verified,
				__typename: 'GenAIReelPrimitive',
			}))
		);
		return this._upsert(opts.id, layout, sub, opts);
	}

	addSection(layout, opts = {}) {
		const wrapped = layout?.view_model ? layout : { view_model: layout };
		return this._upsert(opts.id, wrapped, null, opts);
	}

	addWidget(widget, opts = {}) {
		const layout = AIRich.newLayout('Single', { ...widget, __typename: 'GenAIWidgetPrimitive' });
		return this._upsert(opts.id, layout, null, opts);
	}

	addFooterAction(action, opts = {}) {
		const layout = AIRich.newLayout('Single', { ...action, __typename: 'GenAIFooterActionPrimitive' });
		return this._upsert(opts.id, layout, null, opts);
	}

	addContent(items = [], opts = {}) {
		if (!Array.isArray(items)) {
			throw new TypeError('AIRich.addContent() expects an array');
		}
		if (opts?.title) this.setTitle(opts.title);
		const products = [];
		for (const item of items) {
			if (!item) continue;
			if (item.type === 'text') {
				this.addText(item.content?.text || '');
			} else if (item.type === 'product') {
				products.push({
					title: item.content?.caption || '',
					image_url: item.content?.image || '',
					url: item.content?.url || '',
				});
			}
		}
		if (products.length) {
			this.addProduct(products.length === 1 && opts?.layout !== 'ActionRow' ? products[0] : products);
		}
		return this;
	}

	delete(id) {
		this._sections = this._sections.filter((x) => x.id !== id);
		return this;
	}

	loadFrom(rawPayload = {}) {
		if (!rawPayload || typeof rawPayload !== 'object') return this;
		if (rawPayload.messageContextInfo && typeof rawPayload.messageContextInfo === 'object') {
			const { deviceListMetadata: _dlm, deviceListMetadataVersion: _dlmv, botMetadata: _bm, ...extra } =
				rawPayload.messageContextInfo;
			this._messageContextInfoExtra = { ...this._messageContextInfoExtra, ...extra };
			if (_bm?.messageDisclaimerText) this._title = _bm.messageDisclaimerText;
			if (Array.isArray(_bm?.richResponseSourcesMetadata?.sources)) {
				this._richResponseSources = _bm.richResponseSourcesMetadata.sources;
			}
		}

		const rich =
			rawPayload.botForwardedMessage?.message?.richResponseMessage ||
			rawPayload.message?.botForwardedMessage?.message?.richResponseMessage ||
			rawPayload.richResponseMessage;

		if (!rich) return this;

		if (rich.contextInfo && typeof rich.contextInfo === 'object') {
			this._contextInfo = { ...this._contextInfo, ...rich.contextInfo };
		}
		if (Array.isArray(rich.submessages)) {
			this._loadedSubmessages.push(...rich.submessages);
		}
		const b64 = rich.unifiedResponse?.data;
		if (b64) {
			try {
				const rawStr = Buffer.isBuffer(b64)
					? b64.toString('utf8')
					: Buffer.from(String(b64), 'base64').toString('utf8');
				const parsed = JSON.parse(rawStr);
				if (parsed.response_id) this._responseId = parsed.response_id;
				if (Array.isArray(parsed.sections)) {
					for (const sec of parsed.sections) {
						this.addSection(sec);
					}
				}
			} catch {}
		}
		return this;
	}

	build(jid, { forwarded = true, quoted, ...options } = {}) {
		const forward = forwarded
			? { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: '0@bot' }, forwardOrigin: 4 }
			: {};
		const qObj = quoted
			? {
					stanzaId: quoted?.key?.id || quoted?.id,
					participant: quoted?.key?.participant || quoted?.key?.remoteJid || quoted?.sender,
					quotedType: 0,
					quotedMessage: quoted.message ?? quoted,
				}
			: {};
		const sections = this._footer
			? [
					...this._sections.map((s) => s.layout),
					AIRich.newLayout('Single', { text: this._footer, __typename: 'GenAIMetadataTextPrimitive' }),
				]
			: this._sections.map((s) => s.layout);
		const submessages = [...this._loadedSubmessages, ...this._sections.map((s) => s.sub).filter(Boolean)];
		const message = {
			messageContextInfo: {
				deviceListMetadata: {},
				deviceListMetadataVersion: 2,
				botMetadata: {
					messageDisclaimerText: this._title,
					richResponseSourcesMetadata: { sources: this._richResponseSources },
				},
				...this._messageContextInfoExtra,
			},
			botForwardedMessage: {
				message: {
					richResponseMessage: {
						messageType: 1,
						submessages,
						unifiedResponse: {
							data: Buffer.from(
								JSON.stringify({ response_id: this._responseId || crypto.randomUUID(), sections })
							).toString('base64'),
						},
						contextInfo: { ...forward, ...qObj, ...this._contextInfo },
					},
				},
			},
		};
		return generateWAMessageFromContent(jid, message, {
			userJid: this.#client?.user?.id || jid,
			messageId: this._lastKey?.id || generateMessageIDV2(),
			...options,
		});
	}

	async send(jid, options = {}) {
		if (!jid) {
			throw new Error('AIRich.send(): jid is required');
		}
		const msg = this.build(jid, options);
		this._lastKey = msg.key;
		this._lastJid = jid;
		return this.#client.relayMessage(jid, msg.message, { messageId: msg.key.id, ...options });
	}

	async sendEdit(jidOrOptions = {}, maybeMessageId) {
		if (typeof jidOrOptions === 'string') {
			const jid = jidOrOptions;
			const messageId = maybeMessageId;
			if (!jid) throw new Error('AIRich.sendEdit(): jid is required');
			if (!messageId) throw new Error('AIRich.sendEdit(): messageId is required');
			const msg = this.build(jid, { messageId });
			return this.#client.relayMessage(jid, msg.message, { messageId });
		}
		if (!this._lastKey) throw new Error('No message to edit');
		const options = jidOrOptions || {};
		const msg = this.build(this._lastJid, { ...options, messageId: this._lastKey.id });
		return this.#client.relayMessage(this._lastJid, msg.message, { messageId: this._lastKey.id, ...options });
	}

	static tokenizer(code, _lang = 'javascript') {
		const keywords = new Set([
			'break', 'case', 'catch', 'continue', 'debugger', 'delete', 'do', 'else', 'finally', 'for',
			'function', 'if', 'in', 'instanceof', 'new', 'return', 'switch', 'this', 'throw', 'try',
			'typeof', 'var', 'void', 'while', 'with', 'true', 'false', 'null', 'undefined', 'class',
			'const', 'let', 'super', 'extends', 'export', 'import', 'yield', 'static', 'constructor',
			'async', 'await', 'get', 'set',
		]);
		const TYPE_MAP = { 0: 'DEFAULT', 1: 'KEYWORD', 2: 'METHOD', 3: 'STR', 4: 'NUMBER', 5: 'COMMENT' };
		const tokens = [];
		let i = 0;
		const push = (content, type) => {
			if (!content) return;
			const last = tokens[tokens.length - 1];
			if (last && last.highlightType === type) last.codeContent += content;
			else tokens.push({ codeContent: content, highlightType: type });
		};
		while (i < code.length) {
			const c = code[i];
			if (/\s/.test(c)) {
				let s = i;
				while (i < code.length && /\s/.test(code[i])) i++;
				push(code.slice(s, i), 0);
				continue;
			}
			if (c === '/' && code[i + 1] === '/') {
				let s = i;
				i += 2;
				while (i < code.length && code[i] !== '\n') i++;
				push(code.slice(s, i), 5);
				continue;
			}
			if (c === '"' || c === "'" || c === '`') {
				let s = i;
				const q = c;
				i++;
				while (i < code.length) {
					if (code[i] === '\\' && i + 1 < code.length) i += 2;
					else if (code[i] === q) {
						i++;
						break;
					} else i++;
				}
				push(code.slice(s, i), 3);
				continue;
			}
			if (/[0-9]/.test(c)) {
				let s = i;
				while (i < code.length && /[0-9.]/.test(code[i])) i++;
				push(code.slice(s, i), 4);
				continue;
			}
			if (/[a-zA-Z_$]/.test(c)) {
				let s = i;
				while (i < code.length && /[a-zA-Z0-9_$]/.test(code[i])) i++;
				const word = code.slice(s, i);
				let type = 0;
				if (keywords.has(word)) type = 1;
				else {
					let j = i;
					while (j < code.length && /\s/.test(code[j])) j++;
					if (code[j] === '(') type = 2;
				}
				push(word, type);
				continue;
			}
			push(c, 0);
			i++;
		}
		return {
			codeBlock: tokens,
			unified_codeBlock: tokens.map((t) => ({ content: t.codeContent, type: TYPE_MAP[t.highlightType] })),
		};
	}

	static toTableMetadata(arr) {
		const [header, ...rows] = arr;
		const maxLen = Math.max(header.length, ...rows.map((r) => r.length));
		const normalize = (r) => [...r, ...new Array(maxLen - r.length).fill('')];
		const unified_rows = [
			{ is_header: true, cells: normalize(header) },
			...rows.map((r) => ({ is_header: false, cells: normalize(r) })),
		];
		return {
			title: '',
			rows: unified_rows.map((r) => ({ items: r.cells, ...(r.is_header ? { isHeading: true } : {}) })),
			unified_rows,
		};
	}
}

export { AIRich };
export default AIRich;
