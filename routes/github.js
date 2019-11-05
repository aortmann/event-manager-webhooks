const fs = require('fs');
const os = require('os');
const IncomingWebHook = require('hangouts-chat').IncomingWebHook;

let knownPRs = {};
try {
    knownPRs = require(`${os.homedir()}/known-prs.json`);
} catch (e) {
    fs.writeFile(`${os.homedir()}/known-prs.json`, "{}", function (err) {
        knownPRs = require(`${os.homedir()}/known-prs.json`);
    }); 
}

module.exports = function (app) {
    app.post('/webhooks/github', function (req, res) {
        var event = req.body;
        if (req.query.webhook && req.query.token) {
            processPRs(new IncomingWebHook(`${req.query.webhook}&token=${req.query.token}`), event);
            res.sendStatus(200);
        } else {
            res.status(500).json({ error: '\"webhook\" or \"token\" required parameter not found.' })
        }
    });

    const githubSupportedActions = ["opened", "closed"];
    const processPRs = function (webhook, event) {
        let prSavedDataPromise = new Promise(function (resolve, reject) {
            prSavedData = knownPRs[event.number];
            if (!prSavedData) {
                if (event.action && githubSupportedActions.indexOf(event.action) > -1) {
                    const response = webhook.send({ text: `*${event.pull_request.title.trim()}*` });
                    response.then(function (data) {
                        knownPRs[event.number] = {
                            thread: data.thread.name, branch: event.pull_request.head.ref
                        };
                        prSavedData = knownPRs[event.number];
                        resolve(prSavedData);
                    }).catch(function (err) {
                        console.log(err);
                    });
                } else if (event.ref) {
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

        prSavedDataPromise.then(function (prData) {
            threadId = prData.thread;
            if (event.ref) {
                let filesInvolved = `<${event.head_commit.url}|see modified files.>`;
                webhook.send({ text: `*New commit:* ${event.head_commit.message} by <${event.sender.html_url}|${event.sender.login}>, ${filesInvolved}`, thread: { name: threadId } }).then(function (data) {
                    console.log(data);
                }).catch(function (err) {
                    console.log(err);
                });
            } else if (event.action && githubSupportedActions.indexOf(event.action) > -1 && event.action == "opened") {
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
                                                "content": '' + event.pull_request.commits,
                                                "contentMultiline": true
                                            }
                                        },
                                        {
                                            "keyValue": {
                                                "topLabel": "Additions",
                                                "content": '' + event.pull_request.additions,
                                                "contentMultiline": true
                                            }
                                        },
                                        {
                                            "keyValue": {
                                                "topLabel": "Deletions",
                                                "content": '' + event.pull_request.deletions,
                                                "contentMultiline": true
                                            }
                                        },
                                        {
                                            "keyValue": {
                                                "topLabel": "Changed files",
                                                "content": '' + event.pull_request.changed_files,
                                                "contentMultiline": true
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
                                                        "text": "SEE ON GITHUB",
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
                                "content": event.pull_request.body,
                                "contentMultiline": true
                            }
                        })
                };
                msjObjForG.thread = { name: threadId };
                webhook.send(msjObjForG).then(function (data) {
                    console.log(data);
                }).catch(function (err) {
                    console.log(err);
                });
            } else if (event.action && githubSupportedActions.indexOf(event.action) > -1 && event.action == "closed") {
                let closedMessage;
                if (event.pull_request.merged_at) {
                    closedMessage = "*Merged* to *" + event.pull_request.base.ref + "* and *closed*."
                } else {
                    closedMessage = "*Not merged. Closed.*"
                }
                webhook.send({ text: closedMessage, thread: { name: threadId } }).then(function (data) {
                    console.log(data);
                    delete knownPRs[event.number];
                }).catch(function (err) {
                    console.log(err);
                });
            } else if (event.action && event.action == "submitted") {
                let submittedMessage = `*<${event.review.user.html_url}|${event.review.user.login}>* <${event.review.html_url}|${event.review.state}>`;
                if (event.review.body) {
                    submittedMessage += `: *${event.review.body}*`;
                }
                webhook.send({ text: submittedMessage, thread: { name: threadId } }).then(function (data) {
                    console.log(data);
                }).catch(function (err) {
                    console.log(err);
                });
            }
        })
    };

    setInterval(function () {
        fs.writeFile(`${os.homedir()}/known-prs.json`, JSON.stringify(knownPRs), 'utf8', function (err) {
            if (err) {
                console.log("An error occured while writing konwnPRs JSON Object to File.");
                return console.log(err);
            }

            console.log("KNOWN-PRS file has been saved.");
        });
    }, 60000);
}