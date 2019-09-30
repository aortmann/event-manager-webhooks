const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
let knownPRs = require('./known-prs.json');
const IncomingWebHook = require('hangouts-chat').IncomingWebHook;

const app = express();

app.set('port', process.env.PORT || 3000);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
})); 

app.post('/github', function (req, res) {
    var event = req.body;
    if (req.query.webhook && req.query.token) {
        processPRs(new IncomingWebHook(`${req.query.webhook}&token=${req.query.token}`), event);
        res.sendStatus(200);
    } else {
        res.status(500).json({ error: '\"webhook\" or \"token\" required parameter not found.' })
    }
});

app.post('/newrelic', function (req, res) {
    var event = req.body;
    processAlerts(event);
    res.sendStatus(200);
    // todo
});

const supportedActions = ["opened", "closed"];
const processPRs = function (webhook, event) {
    let prSavedDataPromise = new Promise(function (resolve, reject) {
        prSavedData = knownPRs[event.number];
        if (!prSavedData) {
            if (event.action && supportedActions.indexOf(event.action) > -1) {
                const response = webhook.send({ text: `*${event.pull_request.title}*` });
                response.then(function (data) {
                    knownPRs[event.number] = {
                        thread: data.thread.name, branch: event.pull_request.head.ref
                    };
                    prSavedData = knownPRs[event.number];
                    resolve(prSavedData);
                }).catch(function (err) {
                    console.log(err);
                });
            } else if(event.ref) {
                for (var i in knownPRs) {
                    if (knownPRs[i].branch == event.ref.split("/")[event.ref.split("/").length - 1]) {
                        prSavedData = knownPRs[i];
                        resolve(prSavedData);
                        break;
                    }
                }
            } else if (event.action == "submitted") {
                for (var i in knownPRs) {
                    if (knownPRs[i].branch == event.pull_request.head.ref) {
                        prSavedData = knownPRs[i];
                        resolve(prSavedData);
                        break;
                    }
                }
            }
        } else { resolve(prSavedData) };
    });

    prSavedDataPromise.then(function(prData) {
        threadId = prData.thread;
        if (event.ref) {
            for (var i in event.commits) {
                let filesInvolved = `<${event.commits[i].url}|see modified files.>`;
                webhook.send({ text: `*New commit:* ${event.commits[i].message} by <${event.sender.html_url}|${event.sender.login}>, ${filesInvolved}`, thread: { name: threadId } }).then(function (data) {
                }).catch(function (err) {
                    console.log(err);
                });
            }
        } else if (event.action && supportedActions.indexOf(event.action) > -1 && event.action == "opened") {
            let msjObjForG = {
                "cards": [
                    {
                        "header": {
                            "title": event.repository.name,
                            "subtitle": `#${event.number} by ${event.pull_request.user.login}`,
                            "imageUrl": event.pull_request.user.avatar_url || "https://github.com/webdog/octicons-png/raw/master/black/git-pull-request.png"
                        },
                        "sections": [
                            {
                                "widgets": [
                                    {
                                        "keyValue": {
                                            "topLabel": "Commits",
                                            "content": '' + event.pull_request.commits
                                        }
                                    },
                                    {
                                        "keyValue": {
                                            "topLabel": "Additions",
                                            "content": '' + event.pull_request.additions
                                        }
                                    },
                                    {
                                        "keyValue": {
                                            "topLabel": "Deletions",
                                            "content": '' + event.pull_request.deletions
                                        }
                                    },
                                    {
                                        "keyValue": {
                                            "topLabel": "Changed files",
                                            "content": '' + event.pull_request.changed_files
                                        }
                                    }
                                ]
                            },
                            {
                                "widgets": [
                                    {
                                        "buttons": [
                                            {
                                                "textButton": {
                                                    "text": "OPEN IN GITHUB",
                                                    "onClick": {
                                                        "openLink": {
                                                            "url": event.pull_request.html_url
                                                        }
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };
            if (event.pull_request.body) {
                msjObjForG.cards[0].sections[0].widgets.unshift(
                    {
                        "keyValue": {
                            "topLabel": "Description",
                            "content": event.pull_request.body
                        }
                    })
            };
            msjObjForG.thread = { name: threadId };
            webhook.send(msjObjForG).then(function (data) {
            }).catch(function (err) {
                console.log(err);
            });
        } else if (event.action && supportedActions.indexOf(event.action) > -1 && event.action == "closed") {
            let closedMessage;
            if (event.pull_request.merged_at) {
                closedMessage = "*Merged* and *closed*."
            } else {
                closedMessage = "*Not merged. Closed.*"
            }
            webhook.send({ text: closedMessage, thread: { name: threadId } }).then(function (data) {
            }).catch(function (err) {
                console.log(err);
            });
        } else if (event.action && event.action == "submitted") {
            let submittedMessage;
            switch (event.review.state) {
                case "commented":
                    submittedMessage = `*<${event.review.user.html_url}|${event.review.user.login}>* <${event.review.html_url}|commented>: *${event.review.body}*`;
                    break;
            }
            webhook.send({ text: submittedMessage, thread: { name: threadId } }).then(function (data) {
            }).catch(function (err) {
                console.log(err);
            });
        }
    })
};

setInterval(function () {
    fs.writeFile("known-prs.json", JSON.stringify(knownPRs), 'utf8', function (err) {
        if (err) {
            console.log("An error occured while writing konwnPRs JSON Object to File.");
            return console.log(err);
        }

        console.log("JSON file has been saved.");
    });
}, 10000);

const processAlerts = function (event) {
    //todo
};

app.get('/health-check', function (req, res) {
    res.sendStatus(200);
});

var server = app.listen(app.get('port'), function() {
  console.log('Listening on port %d', server.address().port);
});