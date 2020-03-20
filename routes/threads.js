const IncomingWebHook = require('hangouts-chat').IncomingWebHook;
module.exports = function (app) {
    app.post('/v3/webhooks/threads', function (req, res) {
        const event = req.body;
        let threadUrl= `https://chat.google.com/room/${event.message.thread.name.split(/(spaces\/)(.*)(\/threads\/)(.*)/)[2]}/${event.message.thread.name.split(/(spaces\/)(.*)(\/threads\/)(.*)/)[4]}`;
        threadUrl = `<${threadUrl}|${threadUrl}>`;
        console.log(threadUrl);
        res.send({text:threadUrl});
    });
}
