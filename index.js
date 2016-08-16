var Botkit = require('botkit');
var Promise = require("bluebird");

var controller = Botkit.slackbot({
  debug: false,
  log: false,
  logLevel: 0
});

// connect the bot to a stream of messages
controller.spawn({
  token: process.env.CHICO_TOKEN,
  retry: 32,
}).startRTM()

// Slack returns users as IDs, but they're not user-readable.
// This is a central "user ID" -> "Promise of a user name" list
// We never invalidate - once loaded, we assume username is right forever
var usernames = {};

// Get a promise that resolves to a username, given a userid
function getUserName(userid, bot) {
  if (usernames[userid]) return usernames[userid];

  return usernames[userid] = new Promise(function(resolve){
    bot.api.users.info({user: userid}, function(err, resp){
      resolve(resp.user.name);
    });
  });
}

// A two-level deep hash of inOut[channelid][userid] => username for every
// user that's currently checked in
var inOut = {};

function checkIn(chan, user, bot) {
  if (!inOut[chan]) inOut[chan] = {};

  inOut[chan][user] = '<pending>';
  getUserName(user, bot).then(function(name){
    if (inOut[chan][user] == '<pending>') inOut[chan][user] = name;
  });
}

function checkOut(chan, user) {
  if (inOut[chan]) delete inOut[chan][user];
}

// give the bot something to listen for.
controller.hears(['^\\s*ci', '^\\s*check\\s*in'], 'ambient', function(bot, msg) {
  checkIn(msg.channel, msg.user, bot);
});

controller.hears(['^\\s*co', '^\\s*check\\s*out'], 'ambient', function(bot, msg) {
  checkOut(msg.channel, msg.user);
});

controller.hears('who', 'direct_mention', function(bot, msg) {
  var channel = inOut[msg.channel] || {};
  var names = [];
  for (var k in channel) names[names.length] = channel[k];
  bot.reply(msg, {
    text: names.length ? names.join(', ') : "No one"
  });
});

function parseChannelHistory(channel, bot) {
  inOut[channel] = {};

  bot.api.channels.history({channel: channel}, function(err, rsp) {
    var i = rsp.messages.length;
    while (i--) {
      var message = rsp.messages[i];

      if (message.text.match(/^\s*(ci|(check\s*in))/i)) {
        checkIn(channel, message.user, bot);
      }

      if (message.text.match(/^\s*(co|(check\s*out))/i)) {
        checkOut(channel, message.user);
      }
    }
  });
}

controller.on('hello', function(bot, msg) {
  console.log('Chico Started - Holla!');

  setTimeout(function(){
    console.log('Initialised with status: ');
    console.dir(inOut);
  }, 8000);

  bot.api.channels.list({}, function(err, rsp) {
    for (var i = 0; i < rsp.channels.length; i++) {
      var channel = rsp.channels[i];
      if (channel.is_member) parseChannelHistory(channel.id, bot);
    }
  })

  setInterval(function(){ bot.rtm.ping(); }, 3000);
});
