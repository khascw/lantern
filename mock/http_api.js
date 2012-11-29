'use strict';

var url = require('url')
  , util = require('util')
  , sleep = require('./node_modules/sleep')
  , helpers = require('./helpers')
  , getByPath = helpers.getByPath
  , merge = helpers.merge
  ;


// enums
var MODE = {give: 'give', get: 'get'};
var MODAL = {
  settingsUnlock: 'settingsUnlock',
  settingsLoadFailure: 'settingsLoadFailure',
  welcome: 'welcome',
  authorize: 'authorize',
  gtalkConnecting: 'gtalkConnecting',
  gtalkUnreachable: 'gtalkUnreachable',
  authorizeLater: 'authorizeLater',
  notInvited: 'notInvited',
  requestInvite: 'requestInvite',
  requestSent: 'requestSent',
  firstInviteReceived: 'firstInviteReceived',
  proxiedSites: 'proxiedSites',
  systemProxy: 'systemProxy',
  passwordCreate: 'passwordCreate',
  inviteFriends: 'inviteFriends',
  finished: 'finished',
  contactDevs: 'contactDevs',
  settings: 'settings',
  confirmReset: 'confirmReset',
  giveModeForbidden: 'giveModeForbidden',
  about: 'about',
  updateAvailable: 'updateAvailable',
  scenarios: 'scenarios',
  none: ''
};
var INTERACTION = {
  inviteFriends: 'inviteFriends',
  contactDevs: 'contactDevs',
  settings: 'settings',
  proxiedSites: 'proxiedSites',
  reset: 'reset',
  about: 'about',
  updateAvailable: 'updateAvailable',
  requestInvite: 'requestInvite',
  retryNow: 'retryNow',
  retryLater: 'retryLater',
  cancel: 'cancel',
  continue: 'continue',
  close: 'close',
  quit: 'quit',
  scenarios: 'scenarios'
};
var CONNECTIVITY = {
  connected: 'connected',
  connecting: 'connecting',
  notConnected: 'notConnected'
};
var OS = {
  windows: 'windows',
  ubuntu: 'ubuntu',
  osx: 'osx'
};


function ApiServlet(bayeuxBackend) {
  this._bayeuxBackend = bayeuxBackend;
  this._reset = ApiServlet._reset.bind(this);
  this._reset();
  this._DEFAULT_PROXIED_SITES = bayeuxBackend.model.settings.proxiedSites.slice(0);
}

ApiServlet.VERSION = {
  major: 0,
  minor: 0,
  patch: 1
  };

var VERSION_STR = ApiServlet.VERSION.major+'.'+ApiServlet.VERSION.minor
  , MOUNT_POINT = '/api/'
  , API_PREFIX = MOUNT_POINT + VERSION_STR + '/'
  ;

function inCensoringCountry(model) {
  return model.countries[model.location.country].censors;
}

ApiServlet.SCENARIOS = {
  os: {
    windows: {
      desc: 'running Windows',
      func: make_simple_scenario({'system.os': OS.windows})
    },
    ubuntu: {
      desc: 'running Ubuntu',
      func: make_simple_scenario({'system.os': OS.ubuntu})
    },
    osx: {
      desc: 'running OS X',
      func: make_simple_scenario({'system.os': OS.osx})
    }
  },
  internet: {
    connection: {
      desc: 'internet connection',
      func: make_simple_scenario({'connectivity.internet': true})
    },
    noConnection: {
      desc: 'no internet connection',
      func: make_simple_scenario({'connectivity.internet': false})
    }
  },
  gtalkAuthorization: {
    notAuthorized: {
      desc: 'not authorized to access Google Talk',
      func: make_simple_scenario({'connectivity.gtalkAuthorized': false})
    },
    authorized: {
      desc: 'authorized to access Google Talk',
      func: make_simple_scenario({'connectivity.gtalkAuthorized': true})
    },
  },
  gtalkConnectivity: {
    notConnected: {
      desc: 'not connected to Google Talk',
      func: make_simple_scenario({'connectivity.gtalk': CONNECTIVITY.notConnected})
    },
    connecting: {
      desc: 'connecting to Google Talk',
      func: make_simple_scenario({'connectivity.gtalk': CONNECTIVITY.connecting})
    },
    connected: {
      desc: 'connected to Google Talk',
      func: make_simple_scenario({'connectivity.gtalk': CONNECTIVITY.connected})
    }
  },
  location: {
    beijing: {
      desc: 'connecting from Beijing',
      func: make_simple_scenario({
              location: {lat:39.904041, lon:116.407528, country:'cn'},
              'connectivity.ip': '123.123.123.123'
            })
    },
    paris: {
      desc: 'connecting from Paris',
      func: make_simple_scenario({
              location: {lat:48.8667, lon:2.3333, country:'fr'},
              'connectivity.ip': '78.250.177.119'
            })
    }
  }
};

function make_simple_scenario(state) {
  return function() {
    var bayeux = this._bayeuxBackend
      , publishSync = bayeux.publishSync.bind(bayeux)
      ;
    for (var path in state) {
      merge(bayeux.model, path, state[path]);
      publishSync(path);
    }
  };
}

var peer1 = {
    "peerid": "peerid1",
    "userid": "lantern_friend1@example.com",
    "mode":"give",
    "ip":"74.120.12.135",
    "lat":51,
    "lon":9,
    "country":"de",
    "type":"desktop"
    }
, peer2 = {
    "peerid": "peerid2",
    "userid": "lantern_power_user@example.com",
    "mode":"give",
    "ip":"93.182.129.82",
    "lat":55.7,
    "lon":13.1833,
    "country":"se",
    "type":"lec2proxy"
  }
, peer3 = {
    "peerid": "peerid3",
    "userid": "lantern_power_user@example.com",
    "mode":"give",
    "ip":"173.194.66.141",
    "lat":37.4192,
    "lon":-122.0574,
    "country":"us",
    "type":"laeproxy"
  }
, peer4 = {
    "peerid": "peerid4",
    "userid": "lantern_power_user@example.com",
    "mode":"give",
    "ip":"...",
    "lat":54,
    "lon":-2,
    "country":"gb",
    "type":"lec2proxy"
  }
, peer5 = {
    "peerid": "peerid5",
    "userid": "lantern_power_user@example.com",
    "mode":"get",
    "ip":"...",
    "lat":31.230381,
    "lon":121.473684,
    "country":"cn",
    "type":"desktop"
  }
;

var roster = [{
  "userid":"lantern_friend1@example.com",
  "name":"Lantern Friend1",
  "avatarUrl":"",
  "status":"available",
  "statusMessage":"",
  "peers":["peerid1"]
  }
  /* say lantern_power_user not on roster, discovered via advertisement instead
 ,{
  "userid":"lantern_power_user@example.com",
  "name":"Lantern Poweruser",
  "avatarUrl":"",
  "status":"available",
  "statusMessage":"Shanghai!",
  "peers":["peerid2", "peerid3", "peerid4", "peerid5"]
  }
  */
];

/*
model.version.updated = {
"label":"0.0.2",
"url":"https://lantern.s3.amazonaws.com/lantern-0.0.2.dmg",
"released":"2012-11-11T00:00:00Z"
}
*/


// XXX in demo mode interaction(something requiring sign in) should bring up sign in

function inGiveMode(model) {
  return model.settings.mode == MODE.give;
}

function inGetMode(model) {
  return model.settings.mode == MODE.get;
}

function passwordCreateRequired(model) {
  return model.system.os == OS.ubuntu;
}

function validatePasswords(pw1, pw2) {
  return pw1 && pw2 && pw1 == pw2;
}

var RESET_INTERNAL_STATE = {
  lastModal: MODAL.none,
  modalsCompleted: {
    welcome: false,
    passwordCreate: false,
    authorize: false,
    proxiedSites: false,
    systemProxy: false,
    inviteFriends: false,
    finished: false
  },
  appliedScenarios: [
    'os.osx',
    'location.beijing',
    'internet.connection',
    'gtalkConnectivity.notConnected',
    'gtalkAuthorization.notAuthorized'
  ]
};

ApiServlet._reset = function() {
  // quick and dirty clone
  this._internalState = JSON.parse(JSON.stringify(RESET_INTERNAL_STATE));
  var model = this._bayeuxBackend.model, self = this;
  this._internalState.appliedScenarios.forEach(
    function(path) {
      var scenario = getByPath(ApiServlet.SCENARIOS, path);
      scenario.func.call(self);
    }
  );
};

var MODALSEQ_GIVE = [MODAL.welcome, MODAL.authorize, MODAL.inviteFriends, MODAL.finished, MODAL.none],
     MODALSEQ_GET = [MODAL.welcome, MODAL.authorize, MODAL.proxiedSites, MODAL.systemProxy, MODAL.inviteFriends, MODAL.finished, MODAL.none];
/*
 * Show next modal that should be shown, including possibly MODAL.none.
 * Useful because some modals can be skipped if the user is
 * unable to complete them, but should be returned to later.
 * */
ApiServlet._advanceModal = function(backToIfNone) {
  var model = this._bayeuxBackend.model
    , publishSync = this._bayeuxBackend.publishSync.bind(this._bayeuxBackend)
    , modalSeq = inGiveMode(model) ? MODALSEQ_GIVE : MODALSEQ_GET
    , next;
  for (var i=0; this._internalState.modalsCompleted[next=modalSeq[i++]];);
  if (backToIfNone && next == MODAL.none)
    next = backToIfNone;
  model.modal = next;
  util.puts('modalsCompleted: ' + util.inspect(this._internalState.modalsCompleted));
  util.puts('next modal: ' + next);
  publishSync('modal');
};

ApiServlet._tryConnect = function(model) {
  var userid = model.settings.userid
    , publishSync = this._bayeuxBackend.publishSync.bind(this._bayeuxBackend)
    ;

  // connect to google talk
  model.connectivity.gtalk = CONNECTIVITY.connecting;
  publishSync('connectivity.gtalk');
  model.modal = MODAL.gtalkConnecting;
  publishSync('modal');
  sleep.usleep(3000000);
  if (userid ==  'user_cant_reach_gtalk@example.com') {
    model.connectivity.gtalk = CONNECTIVITY.notConnected;
    publishSync('connectivity.gtalk');
    model.modal = MODAL.gtalkUnreachable;
    publishSync('modal');
    util.puts("user can't reach google talk, set modal to "+MODAL.gtalkUnreachable);
    return;
  }
  model.connectivity.gtalk = CONNECTIVITY.connected;
  publishSync('connectivity.gtalk');

  // refresh roster
  model.roster = roster;
  publishSync('roster');
  sleep.usleep(250000);

  // check for lantern access
  if (userid != 'user@example.com') {
    model.modal = MODAL.notInvited;
    publishSync('modal');
    util.puts("user does not have Lantern access, set modal to "+MODAL.notInvited);
    return;
  }

  // try connecting to known peers
  // (advertised by online Lantern friends or remembered from previous connection)
  model.connectivity.peers.current = [peer1.peerid, peer2.peerid, peer3.peerid, peer4.peerid, peer5.peerid];
  model.connectivity.peers.lifetime = [peer1, peer2, peer3, peer4, peer5];
  publishSync('connectivity.peers');
  util.puts("user has access; connected to google talk, fetched roster:\n"+util.inspect(roster)+"\ndiscovered and connected to peers:\n"+util.inspect(model.connectivity.peers.current));
  ApiServlet._advanceModal.call(this);
};

ApiServlet.HandlerMap = {
  passwordCreate: function(req, res) {
      var model = this._bayeuxBackend.model
        , qs = url.parse(req.url, true).query;
      if (!validatePasswords(qs.password1, qs.password2)) {
        res.writeHead(400);
      } else {
        model.modal = MODAL.authorize;
        this._internalState.modalsCompleted[MODAL.passwordCreate] = true;
        publishSync('modal');
      }
    },
  'settings/unlock': function(req, res) {
      var qs = url.parse(req.url, true).query 
        , model = this._bayeuxBackend.model
        , publishSync = this._bayeuxBackend.publishSync.bind(this._bayeuxBackend)
        , password = qs.password
        ;
      if (!qs.password) {
        res.writeHead(400);
      } else if (qs.password == 'password') {
        model.modal = model.setupComplete ? MODAL.none : MODAL.welcome;
        publishSync('modal');
      } else {
        res.writeHead(403);
      }
    },
  interaction: function(req, res) {
      var qs = url.parse(req.url, true).query 
        , model = this._bayeuxBackend.model
        , publishSync = this._bayeuxBackend.publishSync.bind(this._bayeuxBackend)
        , interaction = qs.interaction
        ;
      if (interaction == INTERACTION.scenarios) {
        this._internalState.lastModal = model.modal;
        model.modal = MODAL.scenarios;
        publishSync('modal');
        return;
      }
      switch (model.modal) {
        case MODAL.scenarios:
          if (interaction != INTERACTION.continue) {
            res.writeHead(400);
            return;
          }
          var appliedScenarios = qs.appliedScenarios;
          util.puts("appliedScenarios: " + util.inspect(appliedScenarios));
          // XXX parse and validate
          model.mock.scenarios.applied = appliedScenarios;
          publishSync('mock.scenarios.applied');
          model.modal = this._internalState.lastModal;
          publishSync('modal');
          return;

        case MODAL.welcome:
          if (interaction != MODE.give && interaction != MODE.get) {
            res.writeHead(400);
            return;
          }
          if (interaction == MODE.give && inCensoringCountry(model)) {
            model.modal = MODAL.giveModeForbidden;
            publishSync('modal');
            res.writeHead(400);
            return;
          }
          model.settings.mode = interaction;
          model.modal = passwordCreateRequired(model) ?
                          MODAL.passwordCreate : MODAL.authorize;
          publishSync('settings.mode');
          publishSync('modal');
          this._internalState.modalsCompleted[MODAL.welcome] = true;
          return;

        case MODAL.giveModeForbidden:
          if (interaction == INTERACTION.continue) {
            model.settings.mode = MODE.get;
            publishSync('settings.mode');
            this._internalState.modalsCompleted[MODAL.welcome] = true;
            ApiServlet._advanceModal.call(this, MODAL.settings);
            return;
          }
          if (interaction == INTERACTION.cancel && !this._internalState.modalsCompleted[MODAL.welcome]) {
            model.modal = MODAL.welcome;
            publishSync('modal');
            return;
          }
          res.writeHead(400);
          return;

        case MODAL.proxiedSites:
          if (interaction == INTERACTION.continue) {
            this._internalState.modalsCompleted[MODAL.proxiedSites] = true;
            ApiServlet._advanceModal.call(this, MODAL.settings);
            return;
          }
          if (interaction == INTERACTION.reset) {
            model.settings.proxiedSites = this._DEFAULT_PROXIED_SITES.slice(0);
            publishSync('settings.proxiedSites');
            return;
          }
          res.writeHead(400);
          return;

        case MODAL.systemProxy:
          var systemProxy = qs.systemProxy;
          if (interaction != INTERACTION.continue ||
             (systemProxy != 'true' && systemProxy != 'false')) {
            res.writeHead(400);
            return;
          }
          systemProxy = systemProxy == 'true';
          model.settings.systemProxy = systemProxy;
          if (systemProxy) sleep.usleep(750000);
          this._internalState.modalsCompleted[MODAL.systemProxy] = true;
          ApiServlet._advanceModal.call(this, MODAL.settings);
          return;

        case MODAL.inviteFriends:
          if (interaction != INTERACTION.continue) {
            res.writeHead(400);
            return;
          }
          this._internalState.modalsCompleted[MODAL.inviteFriends] = true;
          ApiServlet._advanceModal.call(this);
          return;

        case MODAL.gtalkUnreachable:
          if (interaction == INTERACTION.retryNow) {
            ApiServlet._tryConnect.call(this, model);
          } else if (interaction == INTERACTION.retryLater) {
            model.modal = MODAL.authorizeLater;
            publishSync('modal');
          } else {
            res.writeHead(400);
            return;
          }
          return;

        case MODAL.authorizeLater:
          if (interaction != INTERACTION.continue) {
            res.writeHead(400);
            return;
          }
          model.modal = MODAL.none;
          publishSync('modal');
          model.showVis = true;
          publishSync('showVis');
          return;

        case MODAL.notInvited:
          if (interaction != INTERACTION.requestInvite) {
            res.writeHead(400);
            return;
          }
          model.modal = MODAL.requestInvite;
          publishSync('modal');
          return;

        case MODAL.requestSent:
          if (interaction != INTERACTION.continue) {
            res.writeHead(400);
            return;
          }
          model.modal = MODAL.none;
          publishSync('modal');
          model.showVis = true;
          publishSync('showVis');
          return;

        case MODAL.firstInviteReceived:
          if (interaction != INTERACTION.continue) {
            res.writeHead(400);
            return;
          }
          ApiServlet._advanceModal.call(this);
          break;

        case MODAL.finished:
          if (interaction != INTERACTION.continue) {
            res.writeHead(400);
            return;
          }
          this._internalState.modalsCompleted[MODAL.finished] = true;
          ApiServlet._advanceModal.call(this);
          model.setupComplete = true;
          publishSync('setupComplete');
          model.showVis = true;
          publishSync('showVis');
          return;

        case MODAL.none:
          switch (interaction) {
            case INTERACTION.inviteFriends:
            case INTERACTION.contactDevs:
              // sign-in required
              if (model.connectivity.gtalk != CONNECTIVITY.connected) {
                model.modal = MODAL.authorize;
                publishSync('modal');
                return;
              }
              // otherwise fall through to no-sign-in-required cases:

            case INTERACTION.about:
            case INTERACTION.updateAvailable:
            case INTERACTION.settings: // XXX check if signed in on clientside and only allow configuring settings accordingly
              model.modal = interaction;
              publishSync('modal');
              return;

            default:
              res.writeHead(400);
              return;
          }

        case MODAL.contactDevs:
          if (interaction != INTERACTION.continue) {
            res.writeHead(400);
            return;
          }
          model.modal = MODAL.none;
          publishSync('modal');
          return;

        case MODAL.settings:
          if (interaction == MODE.give || interaction == MODE.get) {
            if (interaction == MODE.give && inCensoringCountry(model)) {
              model.modal = MODAL.giveModeForbidden;
              publishSync('modal');
              res.writeHead(400);
              return;
            }
            var wasInGiveMode = inGiveMode(model);
            if (wasInGiveMode && model.settings.systemProxy)
              sleep.usleep(750000);
            model.settings.mode = interaction;
            publishSync('settings.mode');
            ApiServlet._advanceModal.call(this, MODAL.settings);
          } else if (interaction == INTERACTION.proxiedSites) {
            model.modal = MODAL.proxiedSites;
            publishSync('modal');
          } else if (interaction == INTERACTION.close) {
            model.modal = MODAL.none;
            publishSync('modal');
          } else if (interaction == INTERACTION.reset) {
            model.modal = MODAL.confirmReset;
            publishSync('modal');
          } else {
            res.writeHead(400);
            return;
          }
          return;

        case MODAL.about:
        case MODAL.updateAvailable:
          if (interaction == INTERACTION.close) {
            model.modal = MODAL.none;
            publishSync('modal');
            return;
          }
          res.writeHead(400);
          return;

        case MODAL.confirmReset:
          if (interaction == INTERACTION.cancel) {
            model.modal = MODAL.settings;
            publishSync('modal');
            return;
          } else if (interaction == INTERACTION.reset) {
            this._bayeuxBackend.resetModel();
            //ApiServlet._reset.call(this);
            this._reset(); // XXX check this works
            publishSync();
            return;
          }
          res.writeHead(400);
          return;
        
        default:
          res.writeHead(400);
          return;
      }
    },
  'settings/': function(req, res) {
      var model = this._bayeuxBackend.model
        , publishSync = this._bayeuxBackend.publishSync.bind(this._bayeuxBackend)
        , qs = url.parse(req.url, true).query
        , badRequest = false
        , mode = qs.mode
        , systemProxy = qs.systemProxy
        , lang = qs.lang
        , autoReport = qs.autoReport
        , autoStart = qs.autoStart
        , proxyAllSites = qs.proxyAllSites
        , proxiedSites = qs.proxiedSites
        ;
      // XXX write this better
      if ('undefined' == typeof mode
       && 'undefined' == typeof systemProxy
       && 'undefined' == typeof lang
       && 'undefined' == typeof autoReport
       && 'undefined' == typeof autoStart
       && 'undefined' == typeof proxyAllSites
       && 'undefined' == typeof proxiedSites
          ) {
        badRequest = true;
      } else {
        if (mode) {
          if (mode != MODE.give && mode != MODE.get) {
            badRequest = true;
            util.puts('invalid value of mode: ' + mode);
          } else {
            if (inGiveMode(model) && mode == MODE.get && model.settings.systemProxy)
              sleep.usleep(750000);
            model.settings.mode = mode;
            publishSync('settings.mode');
          }
        }
        if (systemProxy) {
          if (systemProxy != 'true' && systemProxy != 'false') {
            badRequest = true;
            util.puts('invalid value of systemProxy: ' + systemProxy);
          } else {
            systemProxy = systemProxy == 'true';
            if (systemProxy) sleep.usleep(750000);
            model.settings.systemProxy = systemProxy;
            publishSync('settings.systemProxy');
          }
        }
        if (lang) {
          // XXX use LANG enum
          if (lang != 'en' && lang != 'zh' && lang != 'fa' && lang != 'ar') {
            badRequest = true;
            util.puts('invalid value of lang: ' + lang);
          } else {
            model.settings.lang = lang;
            publishSync('settings.lang');
          }
        }
        if (autoStart) {
          if (autoStart != 'true' && autoStart != 'false') {
            badRequest = true;
            util.puts('invalid value of autoStart: ' + autoStart);
          } else {
            autoStart = autoStart == 'true';
            model.settings.autoStart = autoStart;
            publishSync('settings.autoStart');
          }
        }
        if (autoReport) {
          if (autoReport != 'true' && autoReport != 'false') {
            badRequest = true;
            util.puts('invalid value of autoReport: ' + autoReport);
          } else {
            autoReport = autoReport == 'true';
            model.settings.autoReport = autoReport;
            publishSync('settings.autoReport');
          }
        }
        if (proxyAllSites) {
          if (proxyAllSites != 'true' && proxyAllSites != 'false') {
            badRequest = true;
            util.puts('invalid value of proxyAllSites: ' + proxyAllSites);
          } else {
            proxyAllSites = proxyAllSites == 'true';
            model.settings.proxyAllSites = proxyAllSites;
            publishSync('settings.proxyAllSites');
          }
        }
        if (proxiedSites) {
          proxiedSites = proxiedSites.split(',');
          // XXX validate
          if (false) {
            badRequest = true;
            util.puts('invalid value of proxiedSites: ' + proxiedSites);
          } else {
            model.settings.proxiedSites = proxiedSites;
            publishSync('settings.proxiedSites');
          }
        }
      }
      if (badRequest) {
        res.writeHead(400);
      }
    },
  oauthAuthorized: function(req, res) {
      var model = this._bayeuxBackend.model
        , publishSync = this._bayeuxBackend.publishSync.bind(this._bayeuxBackend)
        , qs = url.parse(req.url, true).query 
        , userid = qs.userid
        ;
      model.settings.userid = userid;
      publishSync('settings.userid');
      model.connectivity.gtalkAuthorized = true;
      publishSync('connectivity.gtalkAuthorized');
      this._internalState.modalsCompleted[MODAL.authorize] = true;
      ApiServlet._tryConnect.call(this, model);
  },
  requestInvite: function(req, res) {
      var model = this._bayeuxBackend.model
        , qs = url.parse(req.url, true).query
        , lanternDevs = qs.lanternDevs
      ;
      if (typeof lanternDevs != 'undefined'
          && lanternDevs != 'true'
          && lanternDevs != 'false') {
        res.writeHead(400);
      }
      sleep.usleep(750000);
      model.modal = 'requestSent';
      publishSync('modal');
    }
};

ApiServlet.prototype.handleRequest = function(req, res) {
  var parsed = url.parse(req.url)
    , prefix = parsed.pathname.substring(0, API_PREFIX.length)
    , endpoint = parsed.pathname.substring(API_PREFIX.length)
    , handler = ApiServlet.HandlerMap[endpoint]
    ;
  util.puts('[api] ' + req.url.href);
  if (prefix == API_PREFIX && handler) {
    handler.call(this, req, res);
  } else {
    res.writeHead(404);
  }
  res.end();
  util.puts('[api] ' + res.statusCode);
};

exports.ApiServlet = ApiServlet;
