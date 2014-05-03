////////// Server only logic //////////


Meteor.methods({
  start_new_game: function (id1, id2) {
    // create a new game w/ fresh board
    var game_id = Games.insert({board: new_board(),
                                clock: 10});

    // move everyone who is ready in the lobby to the game
    Players.update({game_id: null, idle: false, _id: {$in: [id1, id2]}},
                   {$set: {game_id: game_id}},
                   {multi: true});
    // Save a record of who is in the game, so when they leave we can
    // still show them.
    var p = Players.find({game_id: game_id},
                         {fields: {_id: true, name: true}}).fetch();
    Games.update({_id: game_id}, {$set: {players: p}});


    // wind down the game clock
    var clock = 10;
    var interval = Meteor.setInterval(function () {
      clock -= 1;
      Games.update(game_id, {$set: {clock: clock}});

      // end of game
      if (clock === 0) {
        // stop the clock
        Meteor.clearInterval(interval);
        // declare zero or more winners
        var scores = {};
        scores[id1] = 0;
        scores[id2] = 0;

        Words.find({game_id: game_id}).forEach(function (word) {
          if (!scores[word.player_id])
            scores[word.player_id] = 0;
          scores[word.player_id] += word.score;
        });

        if ( scores[id1] > scores[id2] ) {
          Meteor.call('post_facebook', id2);
          winner = id1;
          losers = [id2];
        } else if ( scores[id1] < scores[id2] ) {
          Meteor.call('post_facebook', id1);
          winner = id2;
          losers = [id1];
        } else {
          Meteor.call('post_facebook', id1);
          Meteor.call('post_facebook', id2);
          winner = {};
          losers = [id1, id2];
        }

        Players.update({_id: {$in: [id1, id2]}},
                       {$set: {game_id: null}},
                       {multi: true} );
        Games.update(game_id, {$set: {losers: losers, winners: [winner]}});
      }
    }, 1000);

    return game_id;
  },


  keepalive: function (player_id) {
    check(player_id, String);
    Players.update({_id: player_id},
                  {$set: {last_keepalive: (new Date()).getTime(),
                          idle: false}});
  }
});

Meteor.setInterval(function () {
  var now = (new Date()).getTime();
  var idle_threshold = now - 70*1000; // 70 sec
  var remove_threshold = now - 60*60*1000; // 1hr

  Players.update({last_keepalive: {$lt: idle_threshold}},
                 {$set: {idle: true}});

  // XXX need to deal with people coming back!
  // Players.remove({$lt: {last_keepalive: remove_threshold}});

}, 30*1000);
