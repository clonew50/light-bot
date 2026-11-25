// Credits: Rem Bot - Developer 212674375708
let handler = async (m, { conn }) => {
  await conn.relayMessage(
    m.chat,
    {
      messageContextInfo: {
        messageSecret: "DgGbJ00h42ew+1F/8IPvbv/L0bTRGjk3SZiblG2a40U="
      },
      interactiveMessage: {
        header: { title: "Rem Bot - Test All Buttons", subtitle: "All native-flow types" },
        body: { text: "This is a test of all available WhatsApp buttons, including rare buttons not widely known.\n\n© Rem Bot - 212674375708" },
        footer: { text: "Rem Bot - All Complete Buttons" },
        nativeFlowMessage: {
          buttons: [
            // === QUICK REPLY ===
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "⚡ Quick Reply Menu", id: ".menu" }) },
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🏓 Quick Reply Ping", id: ".ping" }) },
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "👑 Quick Reply Owner", id: ".owner" }) },

            // === URL / CTA ===
            { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "📢 Official Channel", url: "https://whatsapp.com/channel/0029VbDd8Iw5Ejxwlvjl3l1r", merchant_url: "https://whatsapp.com/channel/0029VbDd8Iw5Ejxwlvjl3l1r" }) },
            { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "👑 Developer", url: "https://wa.me/212674375708", merchant_url: "https://wa.me/212674375708" }) },
            { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "🌐 Website", url: "https://github.com", merchant_url: "https://github.com" }) },

            // === WEBVIEW ===
            { name: "open_webview", buttonParamsJson: JSON.stringify({ title: "Open WebView", link: { in_app_webview: true, url: "https://whatsapp.com/channel/0029VbDd8Iw5Ejxwlvjl3l1r" } }) },

            // === COPY ===
            { name: "cta_copy", buttonParamsJson: JSON.stringify({ display_text: "📋 Copy Dev Number", copy_code: "+212674375708" }) },
            { name: "cta_copy", buttonParamsJson: JSON.stringify({ display_text: "📋 Copy Channel", copy_code: "https://whatsapp.com/channel/0029VbDd8Iw5Ejxwlvjl3l1r" }) },
            { name: "cta_copy", buttonParamsJson: JSON.stringify({ display_text: "📋 Copy Script", copy_code: "Rem Bot MD" }) },

            // === CALL ===
            { name: "cta_call", buttonParamsJson: JSON.stringify({ display_text: "📞 Call Owner", phone_number: "+212674375708" }) },

            // === REMINDER ===
            { name: "cta_reminder", buttonParamsJson: JSON.stringify({ display_text: "⏰ Set Reminder" }) },
            { name: "cta_cancel_reminder", buttonParamsJson: JSON.stringify({ display_text: "❌ Cancel Reminder" }) },

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
                title: "📋 Main Menu",
                sections: [{
                  title: "Rem Bot", highlight_label: "Main",
                  rows: [
                    { header: "BOT", title: "All Menu", description: "See all commands", id: ".menu" },
                    { header: "BOT", title: "Ping Bot", description: "Check bot speed", id: ".ping" },
                    { header: "BOT", title: "Bot Info", description: "Runtime info", id: ".info" }
                  ]
                }],
                icon: "DEFAULT"
              })
            },

            // === SINGLE SELECT - REVIEW ===
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                title: "⭐ Tools Menu",
                sections: [{
                  title: "Advanced Tools", highlight_label: "Tools",
                  rows: [
                    { header: "TOOLS", title: "To URL", description: "Upload to link", id: ".tourl" },
                    { header: "TOOLS", title: "Sticker", description: "Make sticker", id: ".s" },
                    { header: "TOOLS", title: "To Image", description: "Convert to image", id: ".toimg" }
                  ]
                }],
                icon: "REVIEW"
              })
            },

            // === SINGLE SELECT - PROMOTION ===
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                title: "🎁 Promo Menu",
                sections: [{
                  title: "Rem Bot Promo", highlight_label: "Promo",
                  rows: [
                    { header: "PROMO", title: "Join Channel", description: "Join official channel", id: ".channel" },
                    { header: "PROMO", title: "Contact Dev", description: "Chat developer", id: ".owner" }
                  ]
                }],
                icon: "PROMOTION"
              })
            },

            // === SINGLE SELECT - DOCUMENT ===
            {
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                title: "📄 Document Menu",
                sections: [{
                  title: "Documentation", highlight_label: "Docs",
                  rows: [
                    { header: "DOCS", title: "Help", description: "Usage guide", id: ".help" },
                    { header: "DOCS", title: "Terms", description: "Terms & conditions", id: ".rules" }
                  ]
                }],
                icon: "DOCUMENT"
              })
            }
          ],
          messageParamsJson: JSON.stringify({ limited_time_offer: { text: "Rem Bot - Latest Version", url: "https://whatsapp.com/channel/0029VbDd8Iw5Ejxwlvjl3l1r", copy_code: "Rem Bot MD", expiration_time: 4102444800000 } }),
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

handler.help = ["test2"];
handler.tags = ["owner"];
handler.command = /^(test2|allbutton|semuatombol)$/i;
export default handler;