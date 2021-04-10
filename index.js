const request = (process.type === 'renderer') ? require('ut-browser-request') : require('request');
const crypto = require('crypto');
const path = require('path');
const URL = require('url').URL;
const mime = require('mime-types');
const uuid = require('uuid').v4;

const sendMessage = (msg, {auth}) => {
    const url = '/send_message';
    const headers = {
        'X-Viber-Auth-Token': auth.accessToken
    };
    const receiver = msg && msg.receiver && msg.receiver.conversationId;
    const location = attachments => {
        const found = attachments.find(location => location.contentType === 'application/x.location' && location.details);
        return found && {
            lat: found.details.lat,
            lon: found.details.lon
        };
    };
    const image = attachments => {
        const found = attachments.find(image => typeof image === 'string' || /^image\/(jpeg|png|gif)$/.test(image.contentType));
        if (typeof found === 'string') {
            return {
                media: found,
                thumbnail: found
            };
        }
        return found && {
            media: found.url,
            thumbnail: found.thumbnail
        };
    };
    const quickButtons = attachments => {
        return attachments.map(button => {
            if (typeof button === 'string') {
                return {
                    Text: button,
                    Columns: 1,
                    ActionType: 'reply',
                    ActionBody: button
                };
            }
            switch (button.contentType) {
                case 'application/x.button': return {
                    Text: button.title || button.value,
                    Columns: button.columns || 1,
                    ActionType: 'reply',
                    ActionBody: button.value
                };
            }
        }).filter(x => x);
    };
    const richButtons = attachments => {
        return attachments.map(button => {
            if (typeof button === 'string') {
                return {
                    Columns: 6,
                    Rows: 3,
                    ActionType: 'reply',
                    ActionBody: button,
                    Text: button
                };
            }
            switch (button.contentType) {
                case 'application/x.button': return {
                    Columns: 6,
                    Rows: 3,
                    ActionType: 'open-url',
                    Silent: true,
                    ActionBody: button.url,
                    Text: button.title,
                    Image: button.thumbnail
                };
            }
        }).filter(x => x);
    };
    const list = attachments => {
        return [].concat(...attachments.map(button => {
            switch (button.contentType) {
                case 'application/x.button': return [{
                    Columns: 6,
                    Rows: 3,
                    Image: button.thumbnail,
                    ActionType: 'none'
                }, {
                    Columns: 6,
                    Rows: 1,
                    Text: '<b>' + button.title + '</b>',
                    TextHAlign: 'left',
                    TextVAlign: 'top',
                    TextSize: 'medium',
                    ActionType: button.url ? 'open-url' : 'reply',
                    ActionBody: button.url || button.value
                }, {
                    Columns: 6,
                    Rows: 2,
                    ActionType: 'none',
                    Text: button.details && button.details.subtitle.replace(/\n/g, '<br>'),
                    TextHAlign: 'left',
                    TextVAlign: 'top',
                    TextSize: 'small'
                }, button.details && Array.isArray(button.details.actions) && {
                    Columns: 6,
                    Rows: 1,
                    Text: button.details.actions[0].title,
                    ActionType: button.details.actions[0].url ? 'open-url' : 'none',
                    Silent: true,
                    ActionBody: button.details.actions[0].url
                }].filter(x => x);
            }
        }).filter(x => x));
    };
    switch (msg && msg.type) {
        case 'text': return {
            url,
            headers,
            body: {
                receiver,
                type: 'text',
                text: msg.text
            }
        };
        case 'location': return {
            url,
            headers,
            body: {
                receiver,
                type: 'location',
                location: location(msg.attachments)
            }
        };
        case 'image': return {
            url,
            headers,
            body: {
                receiver,
                type: 'picture',
                text: msg.text,
                ...image(msg.attachments)
            }
        };
        case 'quick': return {
            url,
            headers,
            body: {
                receiver,
                type: 'text',
                text: msg.text,
                keyboard: {
                    Type: 'keyboard',
                    DefaultHeight: false,
                    Buttons: quickButtons(msg.attachments)
                }
            }
        };
        case 'actions': return {
            url,
            headers,
            body: {
                receiver,
                min_api_version: 7,
                alt_text: 'You need newer viber for this function',
                type: 'rich_media',
                rich_media: {
                    Type: 'rich_media',
                    ButtonsGroupColumns: 6,
                    ButtonsGroupRows: 3,
                    // BgColor:"#FFFFFF",
                    Buttons: richButtons(msg.attachments)
                }
            }
        };
        case 'list': return {
            url,
            headers,
            body: {
                receiver,
                min_api_version: 7,
                alt_text: 'You need newer viber for this function',
                type: 'rich_media',
                rich_media: {
                    Type: 'rich_media',
                    ButtonsGroupColumns: 6,
                    ButtonsGroupRows: 7,
                    // BgColor:"#FFFFFF",
                    Buttons: list(msg.attachments)
                }
            }
        };
        default: return false;
    }
};

module.exports = function viber({utMethod}) {
    return class viber extends require('ut-port-webhook')(...arguments) {
        get defaults() {
            return {
                path: '/viber/{appId}/{clientId}',
                hook: 'viberIn',
                namespace: 'viber',
                server: {
                    port: 8081
                },
                request: {
                    baseUrl: 'https://chatapi.viber.com/pa/'
                }
            };
        }

        handlers() {
            const {namespace, hook} = this.config;
            return {
                async ready() {
                    const botContext = await utMethod('bot.botContext.fetch#[]')({
                        platform: 'viber'
                    }, {
                        forward: {
                            'x-b3-traceid': uuid().replace(/-/g, '')
                        }
                    });
                    return botContext && Promise.all(botContext.map(({clientId, appId, accessToken}) => {
                        const url = typeof this.config.url === 'object' ? this.config.url[clientId] : this.config.url;
                        return url && typeof url === 'string' && new Promise((resolve, reject) => request.post({
                            baseUrl: this.config.request.baseUrl,
                            url: '/set_webhook',
                            json: true,
                            body: {
                                auth_token: accessToken,
                                url: url + '/' + appId + '/' + clientId,
                                event_types: ['conversation_started']
                            }
                        }, (error, response, body) => {
                            if (error || response.statusCode < 200 || response.statusCode >= 300) {
                                this.error(new Error(body));
                                reject(new Error('Bot registration error'));
                            }
                            resolve();
                        }));
                    }));
                },
                [`${hook}.identity.request.receive`]: (msg, {params, request: {headers}}) => {
                    if (typeof headers['x-viber-content-signature'] !== 'string') {
                        throw this.errors['webhook.missingHeader']({params: {header: 'x-viber-content-signature'}});
                    }
                    return {
                        clientId: params.clientId,
                        appId: params.appId,
                        platform: 'viber'
                    };
                },
                [`${hook}.identity.response.send`]: async(msg, {request: {headers, payload}}) => {
                    const signature = headers['x-viber-content-signature'];
                    const serverSignature = crypto
                        .createHmac('sha256', msg.secret)
                        .update(payload)
                        .digest();
                    if (crypto.timingSafeEqual(Buffer.from(signature, 'hex'), serverSignature)) {
                        return msg;
                    }
                    throw this.errors['webhook.integrityValidationFailed']();
                },
                [`${hook}.message.request.receive`]: (msg, $meta) => {
                    if (msg.event === 'webhook' || msg.silent) {
                        $meta.dispatch = (_, $meta) => [false, {...$meta, mtid: 'response'}];
                        return false;
                    }
                    const message = {
                        messageId: msg.message_token,
                        timestamp: msg.timestamp,
                        sender: {
                            id: msg.sender && msg.sender.id,
                            platform: 'viber',
                            conversationId: msg.sender && msg.sender.id,
                            contextId: $meta.auth.contextId
                        },
                        receiver: {
                            id: $meta.params && $meta.params.clientId
                        },
                        request: msg
                    };
                    if (msg.message) {
                        message.type = {
                            text: 'text',
                            location: 'location',
                            picture: 'image'
                        }[msg.message.type] || 'text';

                        switch (msg.message.type) {
                            case 'text':
                                message.text = msg.message.text;
                                break;
                            case 'picture':
                            case 'video':
                            case 'file': {
                                const attachment = {
                                    url: msg.message.media
                                };
                                if (msg.message.file_name) {
                                    attachment.contentType = mime.lookup(msg.message.file_name);
                                    attachment.filename = msg.message.file_name;
                                } else {
                                    const url = new URL(attachment.url);
                                    attachment.contentType = mime.lookup(url.pathname);
                                    attachment.filename = path.basename(url.pathname);
                                }
                                message.attachments = [attachment];
                                break;
                            }
                            case 'contact':
                                // TODO
                                break;
                            case 'location':
                                // TODO
                                break;
                            case 'url':
                                // TODO
                                break;
                            case 'sticker':
                                // TODO
                                break;
                            case 'rich_media':
                                // TODO
                                break;
                            default:
                                break;
                        }
                    }
                    return message;
                },
                [`${namespace}.message.send.request.send`]: sendMessage,
                [`${hook}.message.response.send`]: sendMessage
            };
        }
    };
};
