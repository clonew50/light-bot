import axios from 'axios'
import FormData from 'form-data'

let handler = async (m, { conn }) => {
    let q = m.quoted? m.quoted : m
    let mime = (q.msg || q).mimetype || q.mediaType || ''
    if (!mime) return conn.sendMessage(m.chat, { text: '*❌ Reply to a media to make it a link*' }, { quoted: m })

    await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

    try {
        let buffer = await q.download()
        if (!buffer) buffer = await conn.downloadMediaMessage(q)

        let ext = mime.split('/')[1] || 'jpg'
        let form = new FormData()
        form.append('reqtype', 'fileupload')
        form.append('userhash', '944145b0558412de8090cb6cb')
        form.append('fileToUpload', buffer, { filename: `nikolas.${ext}` })

        let { data } = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: {...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        })

        let link = data.toString().trim()
        if (!link.startsWith('http')) throw link

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

        // هنا نفس الدالة ديالك 100% غير بدلت النص الداخلي بـ link
        await conn.relayMessage(
          m.chat,
          {
            messageContextInfo: {
              messageSecret: "U7gfvEoQZ5jk2R+HsWI5AbRXfQYic6Cn/BRw5qHHbE0=",
              botMetadata: {
                verificationMetadata: {
                  proofs: [
                    {
                      version: 1,
                      useCase: 1,
                      signature: "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YSr9+hOdUVp0cA==",
                      certificateChain: [
                        "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHZcTcG78LyIsMhPnOzmFQrxbD7jqV+v9MP2G7hZJqj22v7DT1mgR20YCbA0FcfFt4RVuNWCUrnCbDvv81dO/QNEczsCUVbR8GVVEHhsQw76deJgCnNmhmamkMJyByS/jRLAhgFcKNzAa9x9KyiwFYrmQX/up9mNQQl3DYm8rVgIMoI91/RwL/nPQNFXjRPgAT6kPE+zEMa9o49Ug7KFjwJ9f+WzDSDZa29fT+Vo3HvQ5o50wCrYD5Fk9uWcOBJEUC6o1HNYX9WXt9jPdttupIRzwtkjdAKXGIlCPMso69DFUsToIQa1CAk+TWjldQ2MjPcXhQxPWqUab9laQgolgnBoBDsGoDwcYtddDUNGazfdgYv3tuNbUV5zVviO6DrEVbN9IENXz/w3g1nylPqgvWr+Ach0WNaLtJcwagxt3jrsUc1ao/j2NiEIa3MtopEjsxHDpIlnuyN1r6iyBZoYElCYpk/eiDP83JQyK9ibUvv4J0GUmogC59DL0GGEeibofDqD+Z00Y5gTUhaWmj1Nwbn+pnj5Qoap6pvtXGx067knJ+eyEpvi2VrXZ4uxNXV2A2t+4iwMHq2b2B0btyqz1XNHiwlXTiU9TqYWIayI+frzonXtSYbtRoIa7gZFrVJP6K/9xLes1L5HqY5oXbbeDcuypIrGCnC63MUIphhe4AW0/06K9d+zXCSFlJlP81pF+iCLj/meF/k3V1mO4RssQniu4znRSaI3zEAc1khoLgGD8fQLT8gFXmMgDtJgjmzgoxoj3infQJPGzqHP3LAmf8xUtl5MnpFUHOFe66I4uh6HxCx8j7T3Kcd4lcn+oJzJqQBID7khmkamcyM",
                        "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHI7NxDVJCCA1KyKalyR/Rpz9d//Zpy94U+S668fsBAQlwctfptDtZr6tEbQ3yoPFmYJdn0dVLZxJzg/zCkNhHpNDRXXyANiA9nPC4tIoOq0QdZRJs1FLUJh8EUrqGLTojDQq2l1+yCsUMLrXZQbJcqMITSf5BDOcUr9XdNw5el/njkvlhsaJJXPcFYQk6U15rGV1Ko3w6fwwym4Nz9X190i79+53VV39tkCFudvZnAr+vLi5eY357sJDsQttIGtOr8M1l5Z6ZD63b7tV7nN4nRVV9Bp3J6NyxvaINtzSXf35ADJoq8p3snbv3gpw2TgTucwSOjFdOuH7HjI0lJCj9pFx1ixf6w8gvU2zwcXbmr/32QcydZwahGsrCtCeVEFyiJ/vpcSZ/wE/EcMFELjqK/KDkYJFdSloePUF9eIE7RkVCy8qG27N5/oFCRVvyWAGhM8ouz9QNCz8WR61qDTjh6eet7lQDWDS5S4CzWVcuHzY6JsPQLxVc9dDmdoVtFanFqobhjg+EMD6bl+mIBcAIqurHQlgmqi7kixoqURlgVTX5sRF09e4IZLOy+AJ3De3gQBccv4BVH/SDdL1QM6aqKIfXi2UgPhBlkgMHfPQA6KbdOUrr9oe4TXQgaFUf4B5GvecTp335JPEs/sXrsbPuTtsBxgJd6WF1Tsf8+gqLSdpqWMKRFo7RmLQFv5sOPhlC+3p8g5GnTY+S8vWO8iwENYgpTYB8pc62i4TfKoKQJvl4+mo9zdIpvv5nc4ndi+f8wncIsvnb1s6so0ntodBiJjZcPebtoqj+MuGYy78geyJycios9fRyO1iDdeJgVaK5h9RLUgO75E7rOVMFYVqn/CpHokelA1sFeTxWU1KRHe1nYwePH/xUnRKGoWtLeNN31LsQaaY/sGsEW8SwULY1GbrNH3iAxulv7SvIclaY7RVdDd/bX8YtBq6eABLZhqsiLnShgIN3iZl6XXXn5HsjycyQUdZ450WmthZFjnO4DknmbKc9eMj3LlD2pIlgEJ8U4w5CgMQNk6nmh6XMrwbUN4XdGKbE60R2ph18UX0YvPjwZaE5qbp2FefZpL+eT8vkaBsSj5N2XV353J/wzRjHc0dUhNepi6HPQGg=="
                      ]
                    }
                  ]
                }
              },
              limitSharingV2: {
                sharingLimited: false,
                trigger: 1,
                limitSharingSettingTimestamp: 1791887225576,
                initiatedByMe: false
              }
            },
            botForwardedMessage: {
              message: {
                richResponseMessage: {
                  messageType: 1,
                  unifiedResponse: {
                    data: Buffer.from(JSON.stringify({
                      "response_id": "ffcb60ff-cc14-4fca-a0df-dd47a7652b54",
                      "sections": [
                        {
                          "view_model": {
                            "__typename": "GenAIAddonActionLayoutViewModel",
                            "addon_action_type": "COPY_TO_CLIPBOARD",
                            "addon_action_alignment": "END",
                            "primitives": [
                              {
                                "__typename": "GenAIMarkdownTextUXPrimitive",
                                "text": link,
                                "inline_entities": []
                              }
                            ]
                          }
                        }
                      ]
                    })).toString('base64')
                  },
                  contextInfo: {
                    forwardingScore: 2,
                    isForwarded: true,
                    expiration: 7776000,
                    disappearingMode: { initiator: 0, trigger: 0, initiatedByMe: false },
                    forwardOrigin: 4,
                    botMessageSharingInfo: { forwardScore: 2 }
                  }
                }
              }
            }
          },
          { additionalAttributes: { expiration: "7776000" } }
        )

    } catch (e) {
        console.log(e)
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
        return conn.sendMessage(m.chat, { text: `❌ *Upload failed:*\n${e.message || e}` }, { quoted: m })
    }
}
handler.command = ['tolink','catbox']
handler.tags = ['tools']
export default handler