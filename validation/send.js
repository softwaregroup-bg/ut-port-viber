const joi = require('joi');

const common = joi.object({
    url: joi.string().required().valid('https://chatapi.viber.com/pa/send_message'),
    headers: joi.object({
        'X-Viber-Auth-Token': joi.string().required()
    }),
    body: joi.object({
        min_api_version: joi.number().valid(1),
        receiver: joi.string().required(),
        type: joi.string().required(),
        sender: joi.object({
            name: joi.string().max(28),
            avatar: joi.string().uri({scheme: ['http', 'https']})
        }),
        tracking_data: joi.string().max(4000),
        keyboard: joi.object({
            Type: 'keyboard',
            DefaultHeight: joi.boolean(),
            Buttons: joi.array().items(joi.object({
                Columns: joi.number().min(1).max(6),
                Rows: joi.number().min(1).max(2),
                Text: joi.string().max(250),
                Image: joi.string().uri({scheme: ['http', 'https']}),
                ActionType: joi.string().allow([
                    'reply',
                    'open-url',
                    'share-phone',
                    'location-picker',
                    'reply',
                    'none'
                ]),
                ActionBody: joi.string().required()
            }))
        })
    }).required().meta({
        apiDoc: 'https://viber.github.io/docs/tools/keyboards/'
    })
})
    .meta({
        apiDoc: 'https://developers.viber.com/docs/api/rest-bot-api/#general-send-message-parameters'
    });

module.exports = joi.alternatives().try([
    joi.object({
        body: joi.object({
            type: 'text',
            text: joi.string().required()
        })
    })
        .concat(common)
        .meta({
            apiDoc: 'https://developers.viber.com/docs/api/rest-bot-api/#text-message'
        })
        .description('Text message'),
    joi.object({
        body: joi.object({
            type: 'picture',
            text: joi.string().optional(),
            media: joi.string().uri({scheme: ['http', 'https']}).required(),
            thumbnail: joi.string().uri({scheme: ['http', 'https']}).required()
        })
    })
        .concat(common)
        .meta({
            apiDoc: 'https://developers.viber.com/docs/api/rest-bot-api/#picture-message'
        })
        .description('Image message'),
    joi.object({
        body: joi.object({
            type: 'location',
            location: joi.object({
                lat: joi.number().required().min(-90).max(90),
                lon: joi.number().required().min(-180).max(180)
            })
        })
    })
        .concat(common)
        .meta({
            apiDoc: 'https://developers.viber.com/docs/api/rest-bot-api/#location-message'
        })
        .description('Location message')
])
    .description('Message sent to Viber');
