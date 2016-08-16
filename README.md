Basic slack check in / check out robot

To run, do
  npm install
  CHICO_TOKEN='{your slack bot token}' node ./index.js

Invite chico to a channel. He'll look for "check in" and "check out" messages
and remember who's checked in.
(He'll also see "ci", "co", "checkin" and "checkout")

You can say "who's in?" to chico and he'll tell you who's checked into the
current channel.
