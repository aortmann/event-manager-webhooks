
# event-manager-webhooks
A webhook listener and forwarder for google chat.

At this moment, support NewRelic Alerts and Github PRs.

<img src="https://i.imgur.com/49AvCbh.png" width="350">
<img src="https://i.imgur.com/HqcytKR.png" width="350">

### How can I use it?

~~~
npm install
node app
~~~
Now, the app will listen in the port 9290 by default, but you can start the app with environment variables and override it, like this:
~~~
PORT=8080 node app
~~~
It supports NewRelic alerts and GitHub PRs, in each case:


Create a new Notification Channel in NewRelic of the Webhook type and set the URL: 
**yourhost.com/webhooks/newrelic?webhook=**{[google chat incoming webhook](https://developers.google.com/hangouts/chat/how-tos/webhooks#define_an_incoming_webhook)}

Go to your project settings, webhook section, create a new one with individual events, and enable Pull Request and pushes, with the URL:
**yourhost.com/webhooks/github?webhook=**{[google chat incoming webhook](https://developers.google.com/hangouts/chat/how-tos/webhooks#define_an_incoming_webhook)}

The app will use the NewRelic agent if found it in the main directory, you can see the configuration [here]([https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/install-nodejs-agent](https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/install-nodejs-agent)). It's not mandatory, but highly recommended ;)


This project was created in my spare time, so I wouldn't be surprised if you find some issues, submit it. Additionally, pull requests will be well received.
