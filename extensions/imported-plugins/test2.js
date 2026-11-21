// Credits: Rem Bot - Developer 212674375708
let handler = async (m, { conn }) => {
  await conn.relayMessage(
    m.chat,
    {
      messageContextInfo: {
        },
      interactiveMessage: {
        header: { title: "Rem Bot - Uji Semua Tombol", subtitle: "Semua tipe native-flow" },
        body: { text: "Ini adalah tes semua tombol WhatsApp yang ada, termasuk tombol langka yang belum banyak diketahui.\n\n© Rem Bot - 212674375708" },
        footer: { text: "Rem Bot - Semua Tombol Lengkap" },
        nativeFlowMessage: {
          buttons: [
            // === QUICK REPLY ===
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "⚡ Balas Cepat Menu", id: ".menu" }) },
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🏓 Balas Cepat Ping", id: ".ping" }) },
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "👑 Balas Cepat Owner", id: ".owner" }) },

            // === URL / CTA ===
            { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "📢 Channel Resmi", url: "https://whatsapp.com/channel/0029VbDd8Iw5Ejxwlvjl3l1r", merchant_url: "https://whatsapp.com/channel/0029VbDd8Iw5Ejxwlvjl3l1r" }) },
            { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "👑 Developer", url: "https://wa.me/212674375708", merchant_url: "https://wa.me/212674375708" }) },
            { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "🌐 Website", url: "https://github.com", merchant_url: "https://github.com" }) },

            // === WEBVIEW ===
            { name: "open_webview", buttonParamsJson: JSON.stringify({ title: "Buka WebView", link: { in_app_webview: true, url: "https://whatsapp.com/channel/0029VbDd8Iw5Ejxwlvjl3l1r" } }) },

            // === COPY ===
            { name: "cta_copy", buttonParamsJson: JSON.stringify({ display_text: "📋 Salin Nomor Dev", copy_code: "+212674375708" }) },
            { name: "cta_copy", buttonParamsJson: JSON.stringify({ display_text: "📋 Salin Channel", copy_code: "https://whatsapp.com/channel/0029VbDd8Iw5Ejxwlvjl3l1r" }) },
            { name: "cta_copy", buttonParamsJson: JSON.stringify({ display_text: "📋 Salin Script", copy_code: "Rem Bot MD" }) },

            // === CALL ===
            { name: "cta_call", buttonParamsJson: JSON.stringify({ display_text: "📞 Telepon Owner", phone_number: "+212674375708" }) },

            // === REMINDER ===
            { name: "cta_reminder", buttonParamsJson: JSON.stringify({ display_text: "⏰ Atur Pengingat" }) },
            { name: "cta_cancel_reminder", buttonParamsJson: JSON.stringify({ display_text: "❌ Batal Pengingat" }) },

            // === LOKASI & ALAMAT (Jarang) ===
            { name: "send_location", buttonParamsJson: JSON.stringify({}) },
            { name: "address_message", buttonParamsJson: JSON.stringify({}) },

            // === KATALOG / PRODUK ===
            { name: "mpm", buttonParamsJson: JSON.stringify({ product_id: "8816262248471474" }) },
            { name: "automated_greeting_message_view_catalog", buttonParamsJson: JSON.stringify({ business_phone_number: "212674375708", catalog_product_id: "8816262248471474" }) },

            // === PEMBAYARAN ===
            { name: "wa_payment_transaction_details", buttonParamsJson: JSON.stringify({ transaction_id: "REMBOT123" }) },
            {
              name: "review_and_pay",
              buttonParamsJson: JSON.stringify({
                currency: "IDR", payment_type: "upr",
                total_amount: { value: 0, offset: 100 },
                reference_id: "REMBOT-ALLBTN",
                type: "physical-goods",
                order: { status: "pending", order_type: "PAYMENT_REQUEST" },
                payment_settings: [{ type: "payment_account", payment_account: { account_type: "digital_wallet", identifier_type: "phone_number", identifier_value: "+212674375708", institution_name: "Rem Bot - Total Fitur", beneficiary_name: "https://whatsapp.com/channel/0029VbDd8Iw5Ejxwlvjl3l1r" } }]
              })
            },

            // === GALAXY / PAYMENT LEBIH DALAM (Tombol Langka) ===
            { name: "galaxy", buttonParamsJson: JSON.stringify({}) },

            // === SINGLE SELECT - DEFAULT ===
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                title: "📋 Menu Utama",
                sections: [{
                  title: "Rem Bot", highlight_label: "Utama",
                  rows: [
                    { header: "BOT", title: "Semua Menu", description: "Lihat semua perintah", id: ".menu" },
                    { header: "BOT", title: "Ping Bot", description: "Cek kecepatan bot", id: ".ping" },
                    { header: "BOT", title: "Info Bot", description: "Info runtime", id: ".info" }
                  ]
                }],
                icon: "DEFAULT"
              })
            },

            // === SINGLE SELECT - REVIEW ===
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                title: "⭐ Menu Alat",
                sections: [{
                  title: "Alat Canggih", highlight_label: "Alat",
                  rows: [
                    { header: "ALAT", title: "To URL", description: "Upload jadi link", id: ".tourl" },
                    { header: "ALAT", title: "Stiker", description: "Buat stiker", id: ".s" },
                    { header: "ALAT", title: "To Image", description: "Ubah jadi gambar", id: ".toimg" }
                  ]
                }],
                icon: "REVIEW"
              })
            },

            // === SINGLE SELECT - PROMOTION ===
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                title: "🎁 Menu Promo",
                sections: [{
                  title: "Promo Rem Bot", highlight_label: "Promo",
                  rows: [
                    { header: "PROMO", title: "Join Channel", description: "Masuk channel resmi", id: ".channel" },
                    { header: "PROMO", title: "Hubungi Dev", description: "Chat developer", id: ".owner" }
                  ]
                }],
                icon: "PROMOTION"
              })
            },

            // === SINGLE SELECT - DOCUMENT ===
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                title: "📄 Menu Dokumen",
                sections: [{
                  title: "Dokumentasi", highlight_label: "Docs",
                  rows: [
                    { header: "DOCS", title: "Bantuan", description: "Panduan penggunaan", id: ".help" },
                    { header: "DOCS", title: "Syarat", description: "Syarat & ketentuan", id: ".rules" }
                  ]
                }],
                icon: "DOCUMENT"
              })
            }
          ],
          messageParamsJson: JSON.stringify({ limited_time_offer: { text: "Rem Bot - Versi Terbaru", url: "https://whatsapp.com/channel/0029VbDd8Iw5Ejxwlvjl3l1r", copy_code: "Rem Bot MD", expiration_time: 4102444800000 } }),
          messageVersion: 1
        },
        contextInfo: { expiration: 7776000, disappearingMode: { initiator: 0 } }
      }
    },
    {
      additionalAttributes: { expiration: "7776000" },
      additionalNodes: [{
        tag: "biz", attrs: {},
        content: [{ tag: "interactive", attrs: { type: "native_flow", v: "1" }, content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }] }]
      }]
    }
  );
};

handler.usage = ["test2"];
handler.category = 'owner';
handler.command = /^(test2|allbutton|semuatombol)$/i;
export default handler;