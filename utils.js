require('dotenv').config();
const Path = require('path');
const FS = require('fs');

const Winston = require('winston');


const LOGGER = {};


//        s m h d M dw
// CRON = 0 0 * * * *

const Config = {
  CWD: Path.normalize( __dirname ),
  DATADIR: Path.resolve( process.env.DATA_DIR || Path.join(__dirname, 'data') ),

  LOG_LEVEL: process.env.LOG_LEVEL,

  BASE_PATH: Path.normalize( process.env.BASE_PATH),

  TMDB_API_KEY: process.env.TMDB_API_KEY,
  IMDB_API_KEY: process.env.IMDB_API_KEY,
  TVDB_API_KEY: process.env.TVDB_API_KEY,

  TELEGRAM_LOG_BOT_ID: process.env.TELEGRAM_LOG_BOT_ID,
  TELEGRAM_LOG_CHAT_ID: process.env.TELEGRAM_LOG_CHAT_ID,

  USER_UUID: process.env.USER_UUID,
  CATALOG_UUID: process.env.CATALOG_UUID,
  ApiUUID: process.env.ApiUUID,
  ApiKey: process.env.ApiKey,

  DATABASE: process.env.DATABASE,

  HOSTNAME: process.env.HOSTNAME,
  PORT: process.env.PORT,

  USE_THREAD: false,

  USE_WATCHER: String(process.env.WATCHER) == 'true',

  IMMEDIATE: String(process.env.IMMEDIATE) == 'true'

};

function createLog(name) {

  name = name || 'process';

  if ( name in LOGGER ) {
    return LOGGER[ name ];
  }


  let transports = [
    new Winston.transports.File({ filename: `logs/${name}.log`  })
  ];

  // transports.push( new Winston.transports.Console() );

  const Log = Winston.createLogger({
    level: Config.LOG_LEVEL || 'debug',
    transports: transports,
    format: Winston.format.combine(
      Winston.format.timestamp({format:'DD-MM-YYYY HH:mm:ss.SSSSS'}),
      Winston.format.simple(),
      Winston.format.printf((info) => {
        return `${info.timestamp} (${process.pid}) [${info.level.toUpperCase()}]  ${info.message}`+(info.splat!==undefined?`${info.splat}`:" ")
      })
    )
  });


  if ( name != 'process' ) {
    let _old_warn = Log.warn;
    let _old_error = Log.error;
    Log.warn = function() {
      if ( LOGGER.process ) {
        LOGGER.process.warn.apply(LOGGER.process, arguments);
      }
      return _old_warn.apply(Log, arguments);
    };
    Log.error = function() {
      if ( LOGGER.process ) {
        LOGGER.process.error.apply(LOGGER.process, arguments);
      }
      return _old_error.apply(Log, arguments);
    };
  }

  return LOGGER[name] = Log;
}





if ( !FS.existsSync( Config.DATADIR ) ) {
  FS.mkdirSync( Config.DATADIR , {recursive: true});
}

const PREFERENCE_FILE = Path.join(Config.DATADIR, 'preferences.json');
let FOLDERS = [
  {
    "Enabled": true,
    "Name": "movies",
    "Scope": "movies",
    "Path": "movies",
    "Schedule": "0 0 0 * * *",
    "lastScan-": 0,
    "lastScan": 0,
    "Scraper": "movie",
    "Mime": "video"
  },
  {
    "Enabled": true,
    "Name": "tvshows",
    "Scope": "tvshows",
    "Path": "tvshows",
    "Schedule": "0 0 0 * * *",
    "lastScan": 0,
    "Scraper": "tv",
    "Mime": "video"
  },
  {
    "Enabled": true,
    "Name": "tvprograms",
    "Scope": "tvprograms",
    "Path": "tvprograms",
    "Schedule": "0 0 0 * * *",
    "lastScan": 0,
    "Scraper": "tv",
    "Mime": "video"
  },
  {
    "Enabled": true,
    "Name": "docu-movie",
    "Scope": "documentaries",
    "Path": "documentaries-movies",
    "Schedule": "0 0 0 * * *",
    "lastScan": 0,
    "Scraper": "movie",
    "Mime": "video"
  },
  {
    "Enabled": true,
    "Name": "docu-serie",
    "Scope": "documentaries",
    "Path": "documentaries-series",
    "Schedule": "0 0 0 * * *",
    "lastScan": 0,
    "Scraper": "tv",
    "Mime": "video"
  },
  {
    "Enabled": true,
    "Name": "videos",
    "Scope": "videos",
    "Path": "videos",
    "Schedule": "0 0 0 * * *",
    "lastScan": 0,
    "Scraper": true,
    "Mime": "video"
  },
  {
    "Enabled": true,
    "Name": "videoscoll",
    "Scope": "videos",
    "Path": "videos-collection",
    "Schedule": "0 0 0 * * *",
    "lastScan": 0,
    "Scraper": false,
    "Mime": "video",
    "ForceSubfolder": "videos"
  }
];

function saveConfig() {
  FS.writeFileSync( PREFERENCE_FILE, JSON.stringify(FOLDERS, null, 2), 'utf-8' );
}

function loadConfig() {
  if ( FS.existsSync(PREFERENCE_FILE) ) {
    let data = FS.readFileSync( PREFERENCE_FILE, {encoding: 'utf-8'});
    try {
      FOLDERS = JSON.parse( data );
    } catch( e ) {
      console.warn(`Cannot load '${PREFERENCE_FILE}'`, e);
    }
  }
}

loadConfig();

Config.Folders = FOLDERS;


function extractRegExp(regexp, str, index) {
  let matches = str.match(regexp);
  if ( matches ) {
    return matches.slice(index);
  }
  return null;
}

module.exports = {
  Config,
  createLog,
  extractRegExp,
  saveConfig
};
