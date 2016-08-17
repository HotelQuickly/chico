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
var users = {};

function initUsers(bot) {
  bot.api.users.list({}, function(err, rsp){
    rsp.members.forEach(member => users[member.id] = member.name);
  })
}

controller.on(['user_change', 'team_join'], function(bot, msg){
  users[msg.user.id] = msg.user.name;
})

// A two-level deep hash of inOut[channelid][userid] => true (for
// users that are currently checked in) or a Date object (for every
// user has been checked in before, when they checked out)
var inOut = {};

function checkIn(chan, user, bot) {
  if (!inOut[chan]) inOut[chan] = {};
  inOut[chan][user] = true;
}

function checkOut(chan, user, timestamp) {
  if (inOut[chan]) inOut[chan][user] = new Date(parseInt(timestamp) * 1000);
}

// give the bot something to listen for.
controller.hears('^\\s*ch?e?c?k?\\s*i', 'ambient', function(bot, msg) {
  checkIn(msg.channel, msg.user, bot);
});

controller.hears('^\\s*ch?e?c?k?\\s*o', 'ambient', function(bot, msg) {
  checkOut(msg.channel, msg.user, msg.ts);
});

controller.hears('who', 'direct_mention', function(bot, msg) {
  var channel = inOut[msg.channel] || {};
  var names = [];
  for (var user in channel) {
    if (channel[user] === true) names[names.length] = users[user];
  }

  bot.reply(msg, {
    text: names.length ? names.join(', ') : "No one"
  });
});

controller.hears('(.*) in', 'direct_mention', function(bot, msg) {
  var channel = inOut[msg.channel] || {};
  var names = [];
  var who = msg.match[1].toLowerCase();

  for (var user in channel) {
    if (users[user].toLowerCase().indexOf(who) !== -1) {
      var suffix = (channel[user] === true) ?
        'is in' :
        'is out (last seen '+channel[user].toLocaleString()+')';

      names[names.length] = users[user] + ' ' + suffix;
    }
  }

  bot.reply(msg, {
    text: names.length ? names.join("\n") : "Sorry, I don't recognise the name"
  });
});

function parseChannelHistory(channel, bot) {
  inOut[channel] = {};

  bot.api.channels.history({channel: channel}, function(err, rsp) {
    var i = rsp.messages.length;
    while (i--) {
      var message = rsp.messages[i];

      if (message.text.match(/^\s*ch?e?c?k?\s*i/i)) {
        checkIn(channel, message.user, bot);
      }

      if (message.text.match(/^\s*ch?e?c?k?\s*o/i)) {
        checkOut(channel, message.user, message.ts);
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

  initUsers(bot);

  bot.api.channels.list({}, function(err, rsp) {
    rsp.channels.forEach(channel => {
      if (channel.is_member) {
        parseChannelHistory(channel.id, bot);
      }
    })
  });

  setInterval(function(){ bot.rtm.ping(); }, 3000);
});
