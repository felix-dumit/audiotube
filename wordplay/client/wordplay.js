////////// Main client application logic //////////

//////
////// Utility functions
//////

var loggedIn = function() {
  if (typeof FB === 'undefined') return false;
  return !!FB && !! FB.getAuthResponse();
};

var player = function() {
  return Players.findOne(Session.get('player_id'));
};

var game = function() {
  var me = player();
  return me && me.game_id && Games.findOne(me.game_id);
};  

var challenge = function(){
  pid = Session.get('player_id')
  var c = Challenges.findOne({$or:[{sent:pid},{received:pid}], accepted:true, textdone:null});
  if(c){
    Session.set('challenge_id', c._id);
  }
  return c;
}

var setPosts = function(){  
  return Challenges.findOne({_id:Session.get('challenge_id'), accepted:true, sentDone:true, receiveDone:true});
}



var set_selected_positions = function(word) {
  var paths = paths_for_word(game().board, word.toUpperCase());
  var in_a_path = [];
  var last_in_a_path = [];

  for (var i = 0; i < paths.length; i++) {
    in_a_path = in_a_path.concat(paths[i]);
    last_in_a_path.push(paths[i].slice(-1)[0]);
  }

  for (var pos = 0; pos < 16; pos++) {
    if (_.indexOf(last_in_a_path, pos) !== -1)
      Session.set('selected_' + pos, 'last_in_path');
    else if (_.indexOf(in_a_path, pos) !== -1)
      Session.set('selected_' + pos, 'in_path');
    else
      Session.set('selected_' + pos, false);
  }
};

var clear_selected_positions = function() {
  for (var pos = 0; pos < 16; pos++)
    Session.set('selected_' + pos, false);
};

///
/// Login template
///

Template.login.show = function() {
  return !loggedIn();
};

Template.login.events({
  'click button.fbLogin': function() {
    if (!loggedIn()) {
      FB.login(function() {
        if (loggedIn()) {

          console.log(FB.getUserID())
          console.log(Players.find(FB.getUserID()));
          if (Players.find(FB.getUserID()).count() === 0) {
            var player_id = Players.insert({
              name: '',
              _id: FB.getUserID(),
              fbToken: FB.getAccessToken(),
              idle: false
            });
          } else {
            player_id = FB.getUserID();
          }
          
          Session.set('player_id', player_id);

          $.get("http://graph.facebook.com/" + player_id, function(user) {
            Players.update(Session.get('player_id'), {
              $set: {
                name: user.name,
                message: "Eu, " + user.name + ", sou boboca"
              }
            });
          });

          //Meteor.call('post_facebook', player_id);


          $("#login").hide();
          ["#lobby", "#scratchpad", "#postgame", "#scores"].forEach(function(entry) {
            $(entry).show();
          });
          
        }
      }, {
        scope: 'publish_actions'
      });
     }
  }
});





Template.playerLobby.events({
  'click button': function(e) {
    Challenges.insert({sent:Session.get('player_id'), received:e.currentTarget.id, accepted:false});
    console.log('im here');
    //Meteor.call('start_new_game', e.currentTarget.id, Session.get('player_id'));
  }

});


Template.receivedChallenge.events({
  'click button': function(e){
      Meteor.call('remove_challenge',e.currentTarget.id, Session.get('player_id') );
      Challenges.insert({sent:e.currentTarget.id, received:Session.get('player_id'), accepted:true});

      //Meteor.call('start_new_game', e.currentTarget.id, Session.get('player_id'));
  }
});

Template.sentChallenge.events({
  'click button': function(e){
      Meteor.call('remove_challenge',Session.get('player_id'),e.currentTarget.id  )
  }
});

//1417953998469411
//////
////// lobby template: shows everyone not currently playing, and
////// offers a button to start a fresh game.
//////})

Template.postPick.show = function(){
  return challenge() && !game();
}

Template.postPick.events = ({
  'click button': function(e){
    var txt = $('#post_input').val();

    $('#submitOpPost').html('waiting for other player').prop('disabled', true);
    $('#post_input').prop("disabled", true);

    var c = Challenges.findOne({_id:Session.get('challenge_id')});
    //Challenges.remove(c._id);

    pid = Session.get('player_id');
    
    console.log(pid + " " + c.sent + " " + c.received);

    if(pid == c.sent){
      Players.update({_id:c.received},{$set:{message:txt}});
      Challenges.update({_id:Session.get("challenge_id")},{$set:{sentDone:true}});
      c.sentDone = true;
    }else{
      Players.update({_id:c.sent},{$set:{message:txt}});
      Challenges.update({_id:Session.get("challenge_id")},{$set:{receiveDone:true}});
    }

    var c = Challenges.findOne({_id:Session.get('challenge_id')});
    console.log(c.sentDone + ' ' + c.receiveDone);

    if(c.sentDone && c.receiveDone){
      //Meteor.call('remove_challenge',c.sent, c.received );
      Session.set("challenge_id", null);
      Meteor.call('start_new_game', c.sent, c.received);
    }

  }
});




Template.lobby.has_challenges = function () {
  var p = Challenges.find({received:Session.get('player_id')});
  //console.log('has_challenges  ' + p);
  return p.count() != 0;

}

Template.lobby.challenger = function(){
    var ps = [];
    var p = Challenges.find({received:Session.get('player_id')}).forEach(function(a){
      var x = Players.findOne({_id: a.sent});
      ps.push(x);
    });
    console.log(ps);
    return ps;
}


Template.lobby.has_sent_challenges = function(){
  var p = Challenges.find({sent:Session.get('player_id')});
  //console.log('has_challenges  ' + p);
  return p.count() != 0;
}

Template.lobby.sent_challenger = function(){
    var ps = [];
    var p = Challenges.find({sent:Session.get('player_id')}).forEach(function(a){
      var x = Players.findOne({_id: a.received});
      ps.push(x);
    });
    console.log(ps);
    return ps;
}

Template.lobby.show = function() {
  // only show lobby if we're not in a game
  return !game() && !challenge();
};

Template.lobby.waiting = function() {

  var players = Players.find({
    _id: {
      $ne:Session.get('player_id')
    },
    name: {
      $ne: ''
    },
    game_id: null,
    //sent_challenges: {$not: {$elemMatch:Session.get('player_id')}}
  });

  ps =[]
  players.forEach(function(player){
    console.log(player);
    if(Challenges.find({sent:player['_id']}).count() == 0 && Challenges.find({received:player['_id']}).count() == 0){
      ps.push(player);
    }
  });  

  return ps;
};

Template.lobby.count = function() {
  var players = Players.find({
    _id: {
      $ne: Session.get('player_id')
    },
    name: {
      $ne: ''
    },
    game_id: null
  });

  return players.count();
};

Template.lobby.disabled = function() {
  var me = player();
  if (me && me.name)
    return '';
  return 'disabled';
};

var trim = function(string) {
  return string.replace(/^\s+|\s+$/g, '');
};

//////
////// board template: renders the board and the clock given the
////// current game.  if there is no game, show a splash screen.
//////
var SPLASH = 
 ['', 'F', 'B', '',
  'H', 'A', 'C', 'K',
  '2', '0', '1', '4',
  '', 'S', 'P', ''];

Template.board.square = function(i) {
  var g = game();
  return g && g.board && g.board[i] || SPLASH[i];
};

Template.board.selected = function(i) {
  return Session.get('selected_' + i);
};

Template.board.clock = function() {
  var clock = game() && game().clock;

  if (!clock || clock === 0)
    return;

  // format into M:SS
  var min = Math.floor(clock / 60);
  var sec = clock % 60;
  return min + ':' + (sec < 10 ? ('0' + sec) : sec);
};

Template.board.events({
  'click .square': function(evt) {
    var textbox = $('#scratchpad input');
    // Note: Getting the letter out of the DOM is kind of a hack
    var letter = evt.target.textContent || evt.target.innerText;
    textbox.val(textbox.val() + letter);
    textbox.focus();
  }
});

//////
////// scratchpad is where we enter new words.
//////

Template.scratchpad.show = function() {
  return game() && game().clock > 0;
};

Template.scratchpad.events({
  'click button, keyup input': function(evt) {
    var textbox = $('#scratchpad input');
    // if we clicked the button or hit enter
    if ((evt.type === "click" || (evt.type === "keyup" && evt.which === 13)) && textbox.val()) {
      var word_id = Words.insert({
        player_id: Session.get('player_id'),
        game_id: game() && game()._id,
        word: textbox.val().toUpperCase(),
        state: 'pending'
      });
      Meteor.call('score_word', word_id);
      textbox.val('');
      textbox.focus();
      clear_selected_positions();
    } else {
      set_selected_positions(textbox.val());
    }
  }
});

Template.postgame.show = function() {
  return game() && game().clock === 0;
};

Template.postgame.events({
  'click button': function(evt) {
    Players.update(Session.get('player_id'), {
      $set: {
        game_id: null
      }
    });
  }
});

//////
////// scores shows everyone's score and word list.
//////

Template.scores.show = function() {
  return !!game();
};

Template.scores.players = function() {
  return game() && game().players;
};

Template.player.total_score = function() {
  var words = Words.find({
    game_id: game() && game()._id,
    player_id: this._id
  });

  var score = 0;
  words.forEach(function(word) {
    if (word.score)
      score += word.score;
  });
  return score;
};

Template.words.words = function() {
  return Words.find({
    game_id: game() && game()._id,
    player_id: this._id
  });
};


//////
////// Initialization
//////

Meteor.startup(function() {
  window.fbAsyncInit = function() {
    FB.init({
      appId: 288282888015010,
      xfbml: true,
      version: 'v2.0'
    });
  };

  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) {
      return;
    }
    js = d.createElement(s);
    js.id = id;
    js.src = "//connect.facebook.net/en_US/sdk.js";
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'facebook-jssdk'));

  // Allocate a new player id.
  //
  // XXX this does not handle hot reload. In the reload case,
  // Session.get('player_id') will return a real id. We should check for
  // a pre-existing player, and if it exists, make sure the server still
  // knows about us.


  // subscribe to all the players, the game i'm in, and all
  // the words in that game.
  Deps.autorun(function() {
    Meteor.subscribe('players');
    Meteor.subscribe('challenges');


    if (Session.get('player_id')) {
      var me = player();
      if (me && me.game_id) {
        Meteor.subscribe('games', me.game_id);
        Meteor.subscribe('words', me.game_id, Session.get('player_id'));
      }
    }
  });

  if (!loggedIn()) {
    ["#lobby", "#scratchpad", "#postgame", "#scores"].forEach(function(entry) {
      $(entry).hide();
    });
  }

  // send keepalives so the server can tell when we go away.
  //
  // XXX this is not a great idiom. meteor server does not yet have a
  // way to expose connection status to user code. Once it does, this
  // code can go away.
  Meteor.setInterval(function() {
    if (Meteor.status().connected)
      Meteor.call('keepalive', Session.get('player_id'));
  }, 20 * 1000);
});
