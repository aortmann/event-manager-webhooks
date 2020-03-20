let newrelic = {};
try {
    newrelic = require('newrelic');
} catch (e) {
    console.log("Newrelic Library not found. If this is a dev environment, ignore me :)")
}
const express = require('express');
const bodyParser = require('body-parser');

const app = express();

app.set('port', process.env.PORT || 9290);
app.use(bodyParser.json({ limit: '50MB' }));
app.use(bodyParser.urlencoded({
    extended: true,
}));

require('./routes/github')(app);
require('./routes/newrelic')(app);
require('./routes/threads')(app);

app.get('/health-check', function (req, res) {
    newrelic.getTransaction().ignore();
    res.sendStatus(200);
});

var server = app.listen(app.get('port'), function () {
    console.log('Listening on port %d', server.address().port);
});