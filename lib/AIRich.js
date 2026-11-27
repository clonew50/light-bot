import { proto, generateWAMessageFromContent, prepareWAMessageMedia } from 'baileys';

class AIRich {
    constructor(conn) {
        if (!conn) {
            throw new Error("AIRich: connection is required");
        }

        this.conn = conn;
        this.items = [];
        this.options = {};
        this._image = null;
        this._imageOpts = {};
    }

    addContent(items, opts = {}) {
        if (!Array.isArray(items)) {
            throw new TypeError("AIRich.addContent() expects an array");
        }

        this.items.push(...items);
        this.options = {
            ...this.options,
            ...opts
        };

        return this;
    }

    addImage(url, opts = {}) {
        this._image = url;
        this._imageOpts = opts || {};

        return this;
    }

    async send(jid) {
        if (!jid) {
            throw new Error("AIRich.send(): jid is required");
        }

        if (this._image !== null) {
            return this._sendImage(jid);
        }

        if (!this.items.length) {
            throw new Error(
                "AIRich: no content. Use addContent() or addImage()."
            );
        }

        if (this.options.layout === "ActionRow") {
            return this._sendActionRow(jid);
        }

        return this._sendDefault(jid);
    }

    async sendEdit(jid, messageId) {
        if (!jid) {
            throw new Error("AIRich.sendEdit(): jid is required");
        }

        if (!messageId) {
            throw new Error("AIRich.sendEdit(): messageId is required");
        }

        const key = {
            remoteJid: jid,
            fromMe: true,
            id: messageId
        };

        if (
            this._imageOpts.status ||
            this._imageOpts.update_text
        ) {
            const text =
                this._imageOpts.update_text ||
                `⏳ ${this._imageOpts.status || "جاري التحميل..."}`;

            return this.conn.sendMessage(jid, {
                text,
                edit: key
            });
        }

        await this.conn.sendMessage(jid, {
            delete: key
        });

        if (!this._image) {
            return this.conn.sendMessage(jid, {
                text: this._imageOpts.caption || ""
            });
        }

        return this.conn.sendMessage(jid, {
            image: {
                url: this._image
            },
            caption: this._imageOpts.caption || ""
        });
    }

    async _sendImage(jid) {
        if (!this._image) {
            const text =
                this._imageOpts.update_text
                    ? `⏳ ${this._imageOpts.update_text}`
                    : `⏳ ${
                          this._imageOpts.status ||
                          "جاري التحميل..."
                      }`;

            return this.conn.sendMessage(jid, {
                text
            });
        }

        return this.conn.sendMessage(jid, {
            image: {
                url: this._image
            },
            caption: this._imageOpts.caption || ""
        });
    }

    async _sendDefault(jid) {
        const results = [];

        for (const item of this.items) {
            if (!item) continue;

            if (item.type === "product") {
                if (!item.content?.image) continue;

                const result = await this.conn.sendMessage(jid, {
                    image: {
                        url: item.content.image
                    },
                    caption: item.content.caption || ""
                });

                results.push(result);
            }

            if (item.type === "text") {
                const result = await this.conn.sendMessage(jid, {
                    text: item.content?.text || ""
                });

                results.push(result);
            }
        }

        return results;
    }

    async _sendActionRow(jid) {
        const cards = [];

        for (const item of this.items) {
            if (
                !item ||
                item.type !== "product" ||
                !item.content?.image
            ) {
                continue;
            }

            const media =
                await prepareWAMessageMedia(
                    {
                        image: {
                            url: item.content.image
                        }
                    },
                    {
                        upload:
                            this.conn.waUploadToServer
                    }
                );

            cards.push({
                body:
                    proto.Message.InteractiveMessage.Body.fromObject(
                        {
                            text:
                                item.content.caption || ""
                        }
                    ),

                header:
                    proto.Message.InteractiveMessage.Header.fromObject(
                        {
                            imageMessage:
                                media.imageMessage,
                            hasMediaAttachment: true
                        }
                    ),

                nativeFlowMessage:
                    proto.Message.InteractiveMessage.NativeFlowMessage.fromObject(
                        {
                            buttons: []
                        }
                    )
            });
        }

        if (!cards.length) {
            throw new Error(
                "AIRich ActionRow: no valid product cards"
            );
        }

        const message =
            generateWAMessageFromContent(
                jid,
                {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadataVersion: 2,
                                deviceListMetadata: {}
                            },

                            interactiveMessage:
                                proto.Message.InteractiveMessage.fromObject(
                                    {
                                        body:
                                            proto.Message.InteractiveMessage.Body.fromObject(
                                                {
                                                    text:
                                                        this.options
                                                            .title ||
                                                        ""
                                                }
                                            ),

                                        carouselMessage: {
                                            cards
                                        }
                                    }
                                )
                        }
                    }
                },
                {
                    userJid:
                        this.conn.user?.id
                }
            );

        await this.conn.relayMessage(
            jid,
            message.message,
            {
                messageId: message.key.id
            }
        );

        return message;
    }
}

export { AIRich };
export default AIRich;

// Hi
