const tap = require('tap');
const schema = require('./send');

const request = body => ({
    url: 'https://chatapi.viber.com/pa/send_message',
    headers: {
        'X-Viber-Auth-Token': '445da6az1s345z78-dazcczb2542zv51a-e0vc5fva17480im9'
    },
    body: Object.assign({
        receiver: '01234567890A=',
        min_api_version: 1,
        sender: {
            name: 'John McClane',
            avatar: 'http://avatar.example.com'
        },
        tracking_data: 'tracking data'
    }, body)
});

tap.test('valid text message', () => schema.validate(request({
    type: 'text',
    text: 'Hello world'
})));

tap.test('valid picture message', () => schema.validate(request({
    type: 'picture',
    text: 'Photo description',
    media: 'http://www.images.com/img.jpg',
    thumbnail: 'http://www.images.com/thumb.jpg'
})));

tap.test('valid location message', () => schema.validate(request({
    type: 'location',
    location: {
        lat: '37.7898',
        lon: '-122.3942'
    }
})));
