const fs = require('fs');
const os = require('os');
const IncomingWebHook = require('hangouts-chat').IncomingWebHook;

let knownIncidents = {};
try {
    knownIncidents = require(`${os.homedir()}/known-incidents.json`);
} catch (e) {
    fs.writeFile(`${os.homedir()}/known-incidents.json`, "{}", function (err) {
        knownIncidents = require(`${os.homedir()}/known-incidents.json`);
    })
}

module.exports = function (app) {
    app.post('/webhooks/newrelic', function (req, res) {
        var event = req.body;
        if (req.query.webhook && req.query.token) {
            processAlerts(new IncomingWebHook(`${req.query.webhook}&token=${req.query.token}`), event);
            res.sendStatus(200);
        } else {
            res.status(500).json({ error: '\"webhook\" or \"token\" required parameter not found.' })
        }
    });

    const newrelicSupportedActions = ["open", "closed", "acknowledged"];
    const processAlerts = function (webhook, event) {
        const isTestNotification = event.event_type === "NOTIFICATION" && event.current_state === "test";
        const isValidIncident = event.event_type === "INCIDENT" && event.current_state && newrelicSupportedActions.indexOf(event.current_state) > -1;

        if (isTestNotification) {
            webhook.send({ text: `Test notification received! 🤙🏻 *#${event.policy_name}* for *${event.details}*` });
            return;
        }

        let knownIncidentsPromise = new Promise(function (resolve, reject) {
            incidentSavedData = knownIncidents[event.incident_id];
            if (!incidentSavedData) {
                if (isValidIncident) {
                    const response = webhook.send({ text: `Incident *#${event.incident_id} ${event.severity} ${event.current_state}* for *${event.details}*` });
                    response.then(function (data) {
                        knownIncidents[event.incident_id] = {
                            thread: data.thread.name
                        };
                        incidentSavedData = knownIncidents[event.incident_id];
                        resolve(incidentSavedData);
                    }).catch(function (err) {
                        console.log(err);
                    });
                }
            } else { resolve(incidentSavedData) };
        });

        const imagePerSituation = function (situation) {
            switch (situation) {
                case "open":
                    return "https://i.imgur.com/ax3thcf.png?1";
                case "closed":
                    return "https://i.imgur.com/vME8eoT.png?1";
                default:
                    return "https://i.imgur.com/T7Zp38r.png?1";
            }
        };

        knownIncidentsPromise.then(function (incidentData) {
            threadId = incidentData.thread;
            if (isValidIncident) {
                let widgets = [];
                let buttons = [{
                    "textButton": {
                        "text": "VIEW INCIDENT",
                        "onClick": {
                            "openLink": {
                                "url": event.incident_url
                            }
                        }
                    }
                }, {
                    "textButton": {
                        "text": "APPLICATION OVERVIEW",
                        "onClick": {
                            "openLink": {
                                "url": event.violation_callback_url
                            }
                        }
                    }
                }];
                if (event.current_state != 'acknowledged') {
                    widgets.push({
                        "keyValue": {
                            "topLabel": "Policy",
                            "content": event.policy_name,
                            "contentMultiline": true
                        }
                    });
                    widgets.push({
                        "keyValue": {
                            "topLabel": "Target",
                            "content": event.targets[0].name,
                            "contentMultiline": true
                        }
                    });
                    widgets.push({
                        "keyValue": {
                            "topLabel": "Condition",
                            "content": event.details,
                            "contentMultiline": true
                        }
                    });
                    if (event.current_state == 'closed') {
                        widgets.push({
                            "keyValue": {
                                "topLabel": "Duration",
                                "content": `${Math.round(event.duration / 60000)} minutes`,
                                "contentMultiline": true
                            }
                        });
                    };
                    if (event.violation_chart_url) {
                        widgets.push({
                            "image": {
                                "imageUrl": event.violation_chart_url.replace("config.legend.enabled=false", "config.legend.enabled=true")
                            }
                        });
                    }
                    if (event.current_state != 'closed') {
                        buttons.push({
                            "textButton": {
                                "text": "ACKNOWLEDGE",
                                "onClick": {
                                    "openLink": {
                                        "url": event.incident_acknowledge_url
                                    }
                                }
                            }
                        });
                    }
                } else {
                    widgets.push({
                        "keyValue": {
                            "topLabel": "Acknowledged by",
                            "content": event.owner,
                            "contentMultiline": true
                        }
                    });
                    widgets.push({
                        "keyValue": {
                            "topLabel": "Time to acknowledge",
                            "content": `${Math.round(event.time_to_ack / 60000)} minutes after incident opened`,
                            "contentMultiline": true
                        }
                    });
                    widgets.push({
                        "keyValue": {
                            "topLabel": "Condition",
                            "content": event.details,
                            "contentMultiline": true
                        }
                    });
                }
                let msjObjForG = {
                    "cards": [
                        {
                            "header": {
                                "title": `Incident #${event.incident_id}`,
                                "subtitle": `${event.severity} - ${event.current_state}`,
                                "imageUrl": imagePerSituation(event.current_state)
                            },
                            "sections": [
                                {
                                    "widgets": widgets
                                },
                                {
                                    "widgets": [
                                        {
                                            "buttons": buttons
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                };
                msjObjForG.thread = { name: threadId };
                webhook.send(msjObjForG).then(function (data) {
                    console.log(data);
                    if (event.current_state == 'closed') {
                        delete knownIncidents[event.incident_id];
                    }
                }).catch(function (err) {
                    console.log(err);
                });
            }
        })
    };

    setInterval(function () {
        fs.writeFile(`${os.homedir()}/known-incidents.json`, JSON.stringify(knownIncidents), 'utf8', function (err) {
            if (err) {
                console.log("An error occured while writing konwnPRs JSON Object to File.");
                return console.log(err);
            }

            console.log("KNOWN-INCIDENTS file has been saved.");
        });
    }, 60000);
}