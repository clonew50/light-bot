/**
 * plugins/native/whatsapp_pro.js — مزايا وبروتوكولات واتساب الرسمية المتقدمة (25 أمر)
 * ---------------------------------------------------------------------------------
 * أوامر تعتمد على واجهات Baileys و meowsab الفعلية (بدون كول داون):
 * - استطلاع متعدد الخيارات، رسائل العرض لمرة واحدة، فيديو دائري PTV، الرسائل المؤقتة
 * - تثبيت/فك تثبيت الرسائل، الفعاليات الأصلية، روابط المكالمات، حظر المشاركة المتقدم
 * - إدارة القنوات (Channels/Newsletter)، فحص أرقام واتساب وحسابات الأعمال، طلبات الانضمام، إلخ
 */

const sockOf = (conn) => conn?.sock || conn;

function resolveTargetJid(m, text) {
  if (Array.isArray(m?.mentionedJid) && m.mentionedJid.length > 0) return m.mentionedJid[0];
  if (m?.quoted?.sender) return m.quoted.sender;
  const digits = String(text || '').replace(/[^0-9]/g, '');
  if (digits.length >= 7 && digits.length <= 15) return `${digits}@s.whatsapp.net`;
  return m?.sender || '';
}

function parseNewsletterKey(raw) {
  const clean = String(raw || '').trim();
  if (!clean) return { type: 'invite', key: '' };
  const urlMatch = clean.match(/whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i);
  if (urlMatch) return { type: 'invite', key: urlMatch[1] };
  if (clean.endsWith('@newsletter')) return { type: 'jid', key: clean };
  if (/^\d{10,}$/.test(clean)) return { type: 'jid', key: `${clean}@newsletter` };
  return { type: 'invite', key: clean };
}

function makeCmd({ command, usage, description, group = false, admin = false, botAdmin = false, execute }) {
  return {
    command,
    usage,
    description,
    category: 'whatsapp',
    usePrefix: true,
    group,
    admin,
    botAdmin,
    execute
  };
}

const whatsappProCommands = [
  makeCmd({
    command: ['استطلاع_متعدد', 'multipoll'],
    usage: ['استطلاع_متعدد 2 | السؤال | خيار 1 | خيار 2 | خيار 3'],
    description: 'إنشاء تصويت واتساب رسمي يدعم اختيار أكثر من إجابة',
    execute: async (m, { conn, text }) => {
      const parts = String(text || '').split('|').map((s) => s.trim()).filter(Boolean);
      let selectableCount = 2;
      let question = '';
      let options = [];
      if (parts.length >= 4 && /^\d+$/.test(parts[0])) {
        selectableCount = Math.max(1, Math.min(12, parseInt(parts[0], 10) || 2));
        question = parts[1];
        options = parts.slice(2, 14);
      } else if (parts.length >= 3) {
        question = parts[0];
        options = parts.slice(1, 13);
      } else {
        question = 'أفضل مزايا لايت بوت؟';
        options = ['⚡ السرعة بدون انتظار', '📲 أوامر واتساب الرسمية', '🤖 الذكاء الاصطناعي', '🎮 الألعاب والتسلية'];
      }
      selectableCount = Math.min(selectableCount, options.length);
      await conn.sendMessage(m.chat, {
        poll: { name: question, values: options, selectableCount }
      }, { quoted: m });
    }
  }),

  makeCmd({
    command: ['رسالة_لمرة_واحدة', 'sendvo'],
    usage: ['رسالة_لمرة_واحدة (بالرد على صورة أو فيديو أو صوت)'],
    description: 'إعادة إرسال الوسائط المقتبسة كرسالة عرض لمرة واحدة (View Once)',
    execute: async (m, { conn }) => {
      const q = m.quoted;
      if (!q || (!q.imageMessage && !q.videoMessage && !q.audioMessage && !/image|video|audio/.test(q.mtype || ''))) {
        return m.reply('👁️ رد على صورة أو فيديو أو مقطع صوتي مع الأمر:\n.رسالة_لمرة_واحدة');
      }
      const media = typeof q.download === 'function' ? await q.download() : null;
      if (!media) {
        return m.reply('⚠️ تعذّر تنزيل الوسائط المقتبسة — تأكد من الرد على وسائط صالحة.');
      }
      const mtype = String(q.mtype || '');
      if (mtype.includes('video') || q.videoMessage) {
        await conn.sendMessage(m.chat, { video: media, viewOnce: true, caption: q.text || '' }, { quoted: m });
      } else if (mtype.includes('audio') || q.audioMessage) {
        await conn.sendMessage(m.chat, { audio: media, viewOnce: true, ptt: true }, { quoted: m });
      } else {
        await conn.sendMessage(m.chat, { image: media, viewOnce: true, caption: q.text || '' }, { quoted: m });
      }
    }
  }),

  makeCmd({
    command: ['فيديو_دائري', 'ptv'],
    usage: ['فيديو_دائري (بالرد على فيديو)'],
    description: 'تحويل أي فيديو مقتبس إلى رسالة فيديو دائرية رسمية (Video Note PTV)',
    execute: async (m, { conn }) => {
      const q = m.quoted;
      if (!q || (!q.videoMessage && !/video/.test(q.mtype || ''))) {
        return m.reply('🎥 رد على مقطع فيديو قصير مع الأمر:\n.فيديو_دائري');
      }
      const media = typeof q.download === 'function' ? await q.download() : null;
      if (!media) return m.reply('⚠️ تعذّر تنزيل الفيديو المقتبس.');
      await conn.sendMessage(m.chat, { video: media, ptv: true }, { quoted: m });
    }
  }),

  makeCmd({
    command: ['رسائل_مؤقتة', 'disappearing'],
    usage: ['رسائل_مؤقتة <24س|7ي|90ي|ايقاف>'],
    description: 'ضبط مؤقت الرسائل ذاتية الاختفاء في الدردشة أو المجموعة',
    admin: true,
    botAdmin: true,
    execute: async (m, { conn, args }) => {
      const mode = String(args[0] || '').trim().toLowerCase();
      const map = { '24س': 86400, '24h': 86400, 'يوم': 86400, '7ي': 604800, '7d': 604800, 'اسبوع': 604800, '90ي': 7776000, '90d': 7776000, 'ايقاف': 0, 'off': 0, '0': 0 };
      if (!(mode in map)) {
        return m.reply('⏳ *الرسائل المؤقتة*\nاختر المدة:\n• `.رسائل_مؤقتة 24س`\n• `.رسائل_مؤقتة 7ي`\n• `.رسائل_مؤقتة 90ي`\n• `.رسائل_مؤقتة ايقاف`');
      }
      const secs = map[mode];
      const sock = sockOf(conn);
      if (m.isGroup && typeof sock?.groupToggleEphemeral === 'function') {
        await sock.groupToggleEphemeral(m.chat, secs);
      } else {
        await conn.sendMessage(m.chat, { disappearingMessagesInChat: secs || false });
      }
      await m.reply(secs ? `⏳ تم تفعيل الرسائل المؤقتة لمدة *${mode}* بنجاح.` : '✅ تم إيقاف الرسائل المؤقتة في هذه الدردشة.');
    }
  }),

  makeCmd({
    command: ['تثبيت_رسالة', 'pinmsg'],
    usage: ['تثبيت_رسالة [24س|7ي|30ي] (بالرد على رسالة)'],
    description: 'تثبيت الرسالة المقتبسة أعلى الدردشة عبر بروتوكول PinInChat الرسمي',
    execute: async (m, { conn, args }) => {
      const quoted = m.quoted;
      const key = quoted?.key || { remoteJid: m.chat, id: m.key?.id || 'PIN_MSG_ID', fromMe: false };
      if (!quoted && !m.chat) return m.reply('📌 رد على الرسالة المطلوب تثبيتها.');
      const dur = String(args[0] || '7ي').toLowerCase();
      const time = dur === '24س' || dur === '24h' ? 86400 : dur === '30ي' || dur === '30d' ? 2592000 : 604800;
      await conn.sendMessage(m.chat, { pin: key, type: 1, time });
    }
  }),

  makeCmd({
    command: ['فك_تثبيت_رسالة', 'unpinmsg'],
    usage: ['فك_تثبيت_رسالة (بالرد على الرسالة المثبتة)'],
    description: 'إلغاء تثبيت الرسالة المقتبسة من أعلى الدردشة',
    execute: async (m, { conn }) => {
      const key = m.quoted?.key || { remoteJid: m.chat, id: m.key?.id || 'PIN_MSG_ID', fromMe: false };
      await conn.sendMessage(m.chat, { pin: key, type: 2 });
    }
  }),

  makeCmd({
    command: ['معلومات_قناة', 'channelinfo'],
    usage: ['معلومات_قناة <رابط_أو_كود_القناة>'],
    description: 'عرض تفاصيل قناة واتساب الرسمية وعدد المتابعين والوصف',
    execute: async (m, { conn, text }) => {
      const { type, key } = parseNewsletterKey(text);
      if (!key) return m.reply('📢 أرسل رابط القناة أو معرّفها:\n.معلومات_قناة https://whatsapp.com/channel/...');
      const sock = sockOf(conn);
      if (typeof sock?.newsletterMetadata !== 'function') return m.reply('⚠️ واجهة القنوات غير متوفرة حالياً.');
      const meta = await sock.newsletterMetadata(type, key);
      if (!meta) return m.reply('❌ لم يتم العثور على القناة.');
      await m.reply(
        `📢 *معلومات قناة واتساب*\n\n` +
        `🏷️ *الاسم:* ${meta.name || meta.thread_metadata?.name?.text || 'غير معروف'}\n` +
        `🆔 *المعرّف:* \`${meta.id || key}\`\n` +
        `👥 *المتابعون:* ${(meta.subscribers ?? meta.thread_metadata?.subscribers_count ?? 0).toLocaleString()}\n` +
        `☑️ *التوثيق:* ${meta.verification || meta.thread_metadata?.verification || 'عادي'}\n` +
        `📝 *الوصف:* ${meta.description || meta.thread_metadata?.description?.text || 'لا يوجد وصف'}`
      );
    }
  }),

  makeCmd({
    command: ['متابعة_قناة', 'followchannel'],
    usage: ['متابعة_قناة <رابط_أو_JID_القناة>'],
    description: 'متابعة قناة واتساب رسمية عبر البوت',
    execute: async (m, { conn, text }) => {
      const sock = sockOf(conn);
      const { type, key } = parseNewsletterKey(text);
      if (!key) return m.reply('📢 اكتب رابط القناة أو JID الخاص بها.');
      if (typeof sock?.newsletterFollow !== 'function') return m.reply('⚠️ واجهة متابعة القنوات غير متوفرة.');
      let jid = key;
      if (type === 'invite' && typeof sock.newsletterMetadata === 'function') {
        const meta = await sock.newsletterMetadata('invite', key);
        if (meta?.id) jid = meta.id;
      }
      await sock.newsletterFollow(jid);
      await m.reply(`✅ تم الانضمام ومتابعة القناة بنجاح: \`${jid}\``);
    }
  }),

  makeCmd({
    command: ['الغاء_قناة', 'unfollowchannel'],
    usage: ['الغاء_قناة <رابط_أو_JID_القناة>'],
    description: 'إلغاء متابعة قناة واتساب',
    execute: async (m, { conn, text }) => {
      const sock = sockOf(conn);
      const { type, key } = parseNewsletterKey(text);
      if (!key) return m.reply('📢 اكتب رابط القناة أو JID الخاص بها.');
      if (typeof sock?.newsletterUnfollow !== 'function') return m.reply('⚠️ واجهة القنوات غير متوفرة.');
      let jid = key;
      if (type === 'invite' && typeof sock.newsletterMetadata === 'function') {
        const meta = await sock.newsletterMetadata('invite', key);
        if (meta?.id) jid = meta.id;
      }
      await sock.newsletterUnfollow(jid);
      await m.reply(`🚪 تم إلغاء متابعة القناة: \`${jid}\``);
    }
  }),

  makeCmd({
    command: ['كتم_قناة', 'mutechannel'],
    usage: ['كتم_قناة <JID_القناة> [فك]'],
    description: 'كتم إشعارات قناة واتساب أو إلغاء كتمها',
    execute: async (m, { conn, args }) => {
      const sock = sockOf(conn);
      const { type, key } = parseNewsletterKey(args[0]);
      if (!key) return m.reply('🔕 اكتب رابط أو JID القناة: `.كتم_قناة <رابط> [فك]`');
      const unmute = ['فك', 'unmute', 'off'].includes(String(args[1] || '').toLowerCase());
      let jid = key;
      if (type === 'invite' && typeof sock?.newsletterMetadata === 'function') {
        const meta = await sock.newsletterMetadata('invite', key);
        if (meta?.id) jid = meta.id;
      }
      if (unmute) {
        await sock.newsletterUnmute?.(jid);
        await m.reply(`🔔 تم إلغاء كتم القناة: \`${jid}\``);
      } else {
        await sock.newsletterMute?.(jid);
        await m.reply(`🔕 تم كتم إشعارات القناة: \`${jid}\``);
      }
    }
  }),

  makeCmd({
    command: ['فحص_واتساب', 'checkwa'],
    usage: ['فحص_واتساب <رقم_الهاتف_مع_رمز_الدولة>'],
    description: 'التحقق رسمياً من وجود حساب واتساب فعّال للرقم وإحضار JID الخاص به',
    execute: async (m, { conn, text }) => {
      const num = String(text || '').replace(/[^0-9]/g, '');
      if (num.length < 7) return m.reply('🔎 اكتب الرقم برمز الدولة:\n.فحص_واتساب 201012345678');
      const sock = sockOf(conn);
      const res = await sock.onWhatsApp?.(num);
      const hit = Array.isArray(res) ? res[0] : null;
      if (!hit || !hit.exists) return m.reply(`❌ الرقم *+${num}* غير مسجل على واتساب.`);
      await m.reply(`✅ *حساب واتساب متاح!*\n\n📱 الرقم: +${num}\n🆔 JID: \`${hit.jid}\``);
    }
  }),

  makeCmd({
    command: ['حساب_اعمال', 'bizinfo'],
    usage: ['حساب_اعمال <رقم_أو_منشن>'],
    description: 'جلب بيانات ملف WhatsApp Business (الفئة، البريد، الموقع، الوصف)',
    execute: async (m, { conn, text }) => {
      const jid = resolveTargetJid(m, text);
      const sock = sockOf(conn);
      const profile = await sock.getBusinessProfile?.(jid);
      if (!profile) return m.reply(`ℹ️ الحساب \`${jid}\` لا يملك ملف واتساب أعمال (Business) عام.`);
      const sites = Array.isArray(profile.website) ? profile.website.join(' ، ') : (profile.website || '—');
      await m.reply(
        `🏢 *ملف حساب الأعمال*\n\n` +
        `🆔 *الحساب:* \`${profile.wid || jid}\`\n` +
        `🏷️ *الفئة:* ${profile.category || 'غير محدد'}\n` +
        `📧 *البريد:* ${profile.email || '—'}\n` +
        `🌐 *الموقع:* ${sites}\n` +
        `📝 *الوصف:* ${profile.description || '—'}`
      );
    }
  }),

  makeCmd({
    command: ['بايو_المستخدم', 'userbio'],
    usage: ['بايو_المستخدم <رقم_أو_منشن>'],
    description: 'قراءة نبذة (About / Bio) لحساب واتساب وتاريخ آخر تحديث لها',
    execute: async (m, { conn, text }) => {
      const jid = resolveTargetJid(m, text);
      const sock = sockOf(conn);
      const res = await sock.fetchStatus?.(jid);
      const info = Array.isArray(res) ? res[0] : res;
      if (!info) return m.reply(`ℹ️ تعذّر جلب النبذة للمستخدم \`${jid}\` (ربما الخصوصية مقفلة).`);
      await m.reply(
        `💬 *نبذة واتساب (About)*\n\n` +
        `👤 *المستخدم:* @${jid.split('@')[0]}\n` +
        `📝 *النص:* ${info.status || 'لا توجد نبذة'}\n` +
        `🕒 *آخر تحديث:* ${info.setAt || 'غير متاح'}`,
        { mentions: [jid] }
      );
    }
  }),

  makeCmd({
    command: ['طلبات_الجروب', 'joinrequests'],
    usage: ['طلبات_الجروب'],
    description: 'عرض قائمة طلبات الانضمام المعلّقة في المجموعة',
    group: true,
    admin: true,
    botAdmin: true,
    execute: async (m, { conn }) => {
      const sock = sockOf(conn);
      const list = (await sock.groupRequestParticipantsList?.(m.chat)) || [];
      if (!list.length) return m.reply('✅ لا توجد أي طلبات انضمام معلّقة حالياً.');
      const lines = list.slice(0, 30).map((r, i) => `${i + 1}. @${String(r.jid || '').split('@')[0]} (${r.request_method || 'invite'})`);
      await conn.sendMessage(m.chat, {
        text: `📥 *طلبات الانضمام المعلّقة (${list.length}):*\n\n${lines.join('\n')}`,
        mentions: list.slice(0, 30).map((r) => r.jid).filter(Boolean)
      }, { quoted: m });
    }
  }),

  makeCmd({
    command: ['قبول_الطلبات', 'approveall'],
    usage: ['قبول_الطلبات'],
    description: 'الموافقة الفورية على جميع طلبات الانضمام المعلّقة في المجموعة',
    group: true,
    admin: true,
    botAdmin: true,
    execute: async (m, { conn }) => {
      const sock = sockOf(conn);
      const list = (await sock.groupRequestParticipantsList?.(m.chat)) || [];
      const jids = list.map((r) => r.jid).filter(Boolean);
      if (!jids.length) return m.reply('✅ لا توجد طلبات معلّقة للموافقة عليها.');
      await sock.groupRequestParticipantsUpdate?.(m.chat, jids, 'approve');
      await m.reply(`✅ تمت الموافقة على *${jids.length}* طلب انضمام بنجاح!`);
    }
  }),

  makeCmd({
    command: ['رفض_الطلبات', 'rejectall'],
    usage: ['رفض_الطلبات'],
    description: 'رفض جميع طلبات الانضمام المعلّقة في المجموعة',
    group: true,
    admin: true,
    botAdmin: true,
    execute: async (m, { conn }) => {
      const sock = sockOf(conn);
      const list = (await sock.groupRequestParticipantsList?.(m.chat)) || [];
      const jids = list.map((r) => r.jid).filter(Boolean);
      if (!jids.length) return m.reply('✅ لا توجد طلبات معلّقة لرفضها.');
      await sock.groupRequestParticipantsUpdate?.(m.chat, jids, 'reject');
      await m.reply(`🚫 تم رفض *${jids.length}* طلب انضمام.`);
    }
  }),

  makeCmd({
    command: ['وضع_الموافقة', 'approvalmode'],
    usage: ['وضع_الموافقة <تفعيل|ايقاف>'],
    description: 'تفعيل أو إيقاف شرط موافقة المشرفين قبل دخول أي عضو جديد للمجموعة',
    group: true,
    admin: true,
    botAdmin: true,
    execute: async (m, { conn, args }) => {
      const arg = String(args[0] || '').toLowerCase();
      const mode = ['تفعيل', 'تشغيل', 'on', '1'].includes(arg) ? 'on' : ['ايقاف', 'تعطيل', 'off', '0'].includes(arg) ? 'off' : '';
      if (!mode) return m.reply('🛡️ اكتب: `.وضع_الموافقة تفعيل` أو `.وضع_الموافقة ايقاف`');
      await sockOf(conn).groupJoinApprovalMode?.(m.chat, mode);
      await m.reply(mode === 'on' ? '🔐 تم تفعيل *موافقة المشرفين* على طلبات الانضمام.' : '🔓 تم فتح الانضمام المباشر بدون موافقة مسبقة.');
    }
  }),

  makeCmd({
    command: ['صلاحية_الاضافة', 'addmode'],
    usage: ['صلاحية_الاضافة <مشرفين|الكل>'],
    description: 'تحديد من يملك صلاحية إضافة أعضاء للمجموعة (المشرفون فقط أم الجميع)',
    group: true,
    admin: true,
    botAdmin: true,
    execute: async (m, { conn, args }) => {
      const arg = String(args[0] || '').toLowerCase();
      const mode = ['مشرفين', 'ادمن', 'admin', 'admins'].includes(arg)
        ? 'admin_add'
        : ['الكل', 'الجميع', 'all'].includes(arg)
          ? 'all_member_add'
          : '';
      if (!mode) return m.reply('👥 اكتب: `.صلاحية_الاضافة مشرفين` أو `.صلاحية_الاضافة الكل`');
      await sockOf(conn).groupMemberAddMode?.(m.chat, mode);
      await m.reply(mode === 'admin_add' ? '🛡️ إضافة الأعضاء مقصورة الآن على *المشرفين فقط*.' : '👥 يمكن الآن لجميع الأعضاء إضافة مشاركين جدد.');
    }
  }),

  makeCmd({
    command: ['حدث_واتس', 'waevent'],
    usage: ['حدث_واتس العنوان | الوصف | المكان'],
    description: 'إنشاء وإرسال بطاقة فعالية واتساب أصلية (WhatsApp Event Card)',
    execute: async (m, { conn, text }) => {
      const [name, description, locName] = String(text || '').split('|').map((s) => s.trim());
      const eventName = name || 'اجتماع أبطال لايت بوت';
      const startDate = new Date(Date.now() + 3600 * 1000);
      const endDate = new Date(Date.now() + 7200 * 1000);
      await conn.sendMessage(m.chat, {
        event: {
          name: eventName,
          description: description || 'فعالية مجدولة عبر لايت بوت التفاعلي',
          startDate,
          endDate,
          ...(locName ? { location: { name: locName, degreesLatitude: 30.0444, degreesLongitude: 31.2357 } } : {})
        }
      }, { quoted: m });
    }
  }),

  makeCmd({
    command: ['رابط_مكالمة', 'calllink'],
    usage: ['رابط_مكالمة [صوت|فيديو]'],
    description: 'إنشاء رابط مكالمة واتساب رسمية فورية (صوتية أو مرئية)',
    execute: async (m, { conn, args }) => {
      const kind = ['فيديو', 'video', 'v'].includes(String(args[0] || '').toLowerCase()) ? 'video' : 'audio';
      const sock = sockOf(conn);
      const url = typeof sock?.createCallLink === 'function'
        ? await sock.createCallLink(kind, { startTime: Math.floor(Date.now() / 1000) + 60 })
        : null;
      if (!url) return m.reply(`📞 وضع المحاكاة أو السوكيت لا يدعم إنشاء رابط مكالمة ${kind === 'video' ? 'مرئية' : 'صوتية'} حالياً.`);
      await m.reply(`📞 *تم إنشاء رابط المكالمة الرسمية (${kind === 'video' ? 'فيديو 🎥' : 'صوت 🎙️'}):*\n\n🔗 ${url}`);
    }
  }),

  makeCmd({
    command: ['اعدادات_الخصوصية', 'privacycheck'],
    usage: ['اعدادات_الخصوصية'],
    description: 'فحص وعرض إعدادات خصوصية حساب البوت الحالية على واتساب',
    execute: async (m, { conn }) => {
      const sock = sockOf(conn);
      const s = (typeof sock?.fetchPrivacySettings === 'function' ? await sock.fetchPrivacySettings(true) : null) || {};
      await m.reply(
        `🔒 *تقرير خصوصية حساب واتساب*\n\n` +
        `👀 *آخر ظهور:* ${s.last || 'غير محدد'}\n` +
        `🟢 *متصل الآن:* ${s.online || 'غير محدد'}\n` +
        `🖼️ *صورة الملف:* ${s.profile || 'غير محدد'}\n` +
        `💬 *الحالة:* ${s.status || 'غير محدد'}\n` +
        `✓✓ *مؤشرات القراءة:* ${s.readreceipts || 'غير محدد'}\n` +
        `👥 *الإضافة للمجموعات:* ${s.groupadd || 'غير محدد'}`
      );
    }
  }),

  makeCmd({
    command: ['حظر_مشاركة_متقدم', 'limitsharing'],
    usage: ['حظر_مشاركة_متقدم <تفعيل|ايقاف>'],
    description: 'تفعيل أو إيقاف خصوصية الدردشة المتقدمة (منع تصدير ومشاركة الدردشة)',
    execute: async (m, { conn, args }) => {
      const arg = String(args[0] || '').toLowerCase();
      const enable = !['ايقاف', 'off', '0', 'لا'].includes(arg);
      await conn.sendMessage(m.chat, { limitSharing: enable });
      await m.reply(enable ? '🛡️ تم تفعيل *حماية الدردشة المتقدمة* (Limit Sharing).' : '🔓 تم إلغاء وضع تقييد المشاركة.');
    }
  }),

  makeCmd({
    command: ['ارسال_موقع', 'sendloc'],
    usage: ['ارسال_موقع <خط_العرض> <خط_الطول> [اسم_المكان]'],
    description: 'إرسال دبوس موقع جغرافي تفاعلي على خريطة واتساب',
    execute: async (m, { conn, args }) => {
      const lat = parseFloat(args[0]);
      const lng = parseFloat(args[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return m.reply('📍 اكتب الإحداثيات:\n.ارسال_موقع 30.0444 31.2357 القاهرة');
      }
      const name = args.slice(2).join(' ').trim() || 'موقع مرسل عبر لايت بوت';
      await conn.sendMessage(m.chat, {
        location: { degreesLatitude: lat, degreesLongitude: lng, name, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` }
      }, { quoted: m });
    }
  }),

  makeCmd({
    command: ['بطاقة_جهة', 'sendvcard'],
    usage: ['بطاقة_جهة الاسم | رقم_الهاتف'],
    description: 'توليد وإرسال بطاقة جهة اتصال واتساب (vCard) احترافية قابلة للحفظ فوراً',
    execute: async (m, { conn, text }) => {
      const [rawName, rawPhone] = String(text || '').split('|').map((s) => s.trim());
      const digits = String(rawPhone || '').replace(/[^0-9]/g, '');
      if (!rawName || digits.length < 7) {
        return m.reply('📇 الصيغة الصحيحة:\n.بطاقة_جهة أحمد | 201012345678');
      }
      const vcard = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${rawName}`,
        `TEL;type=CELL;type=VOICE;waid=${digits}:+${digits}`,
        'END:VCARD'
      ].join('\n');
      await conn.sendMessage(m.chat, {
        contacts: { displayName: rawName, contacts: [{ displayName: rawName, vcard }] }
      }, { quoted: m });
    }
  }),

  makeCmd({
    command: ['رسالة_سبويلر', 'spoiler'],
    usage: ['رسالة_سبويلر العنوان | النص_المخفي'],
    description: 'تنسيق رسالة واتساب تخفي المحتوى خلف زر «قراءة المزيد» (Spoiler)',
    execute: async (m, { conn, text }) => {
      const [head, body] = String(text || '').split('|').map((s) => s.trim());
      if (!head || !body) {
        return m.reply('🫣 الصيغة:\n.رسالة_سبويلر تنبيه حرق! | البطل انتصر في النهاية');
      }
      const pad = '\u200B'.repeat(4000);
      await conn.sendMessage(m.chat, { text: `🫣 *${head}*${pad}\n\n${body}` }, { quoted: m });
    }
  })
];

export default whatsappProCommands;
