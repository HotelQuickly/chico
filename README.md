Basic slack check in / check out robot

To run, do
  npm install
  CHICO_TOKEN='{your slack bot token}' node ./index.js

Invite chico to a channel. He'll look for "check in" and "check out" messages
and remember who's checked in.
(He'll understand any shortening too, like "chckin" or even "ci")

You can say "who's in?" to chico and he'll tell you who's checked into the
current channel.

You can also say "john in?" (or any other name) to chico, and he'll tell
you if someone with that nick is checked in, or the last time they were
seen if they're checked out.
