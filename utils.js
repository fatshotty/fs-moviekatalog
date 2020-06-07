require('dotenv').config();
const Path = require('path');
const FS = require('fs');

const Winston = require('winston');


const LOGGER = {};

function createLog(name) {

  name = name || 'process';

  if ( name in LOGGER ) {
    return LOGGER[ name ];
  }


  let transports = [
    new Winston.transports.File({ filename: `logs/${name}.log`  })
  ];

  transports.push( new Winston.transports.Console() );

  const Log = Winston.createLogger({
    level: 'info',
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
      LOGGER.process.warn.apply(LOGGER.process, arguments);
      return _old_warn.apply(Log, arguments);
    };
    Log.error = function() {
      LOGGER.process.error.apply(LOGGER.process, arguments);
      return _old_error.apply(Log, arguments);
    };
  }

  return LOGGER[name] = Log;
}




//        s m h d M dw
// CRON = 0 0 * * * *

const Config = {
  CWD: Path.normalize( __dirname ),
  DATADIR: Path.resolve( process.env.DATA_DIR || Path.join(__dirname, 'data') ),

  BASE_PATH: Path.normalize( process.env.BASE_PATH),

  TMDB_API_KEY: process.env.TMDB_API_KEY,
  IMDB_API_KEY: process.env.IMDB_API_KEY,
  TVDB_API_KEY: process.env.TVDB_API_KEY,

  USER_UUID: process.env.USER_UUID,
  CATALOG_UUID: process.env.CATALOG_UUID,
  ApiUUID: process.env.ApiUUID,
  ApiKey: process.env.ApiKey,

  HOSTNAME: process.env.HOSTNAME,
  PORT: process.env.PORT,


};


if ( !FS.existsSync( Config.DATADIR ) ) {
  FS.mkdirSync( Config.DATADIR , {recursive: true});
}

console.log(`DATA: ${Config.DATADIR}`);


const PREFERENCE_FILE = Path.join(Config.CWD, 'preferences.json');
let FOLDERS = [
  // {
  //   Mime: 'video',
  //   Scope: 'movies',
  //   Path:  'movies',
  //   Schedule: '0 0 0 * * *',
  //   lastScan: 0
  // },
  {
    Mime: 'video',
    Scope: 'tvshows',
    Path:  'tvshows',
    Schedule: '0 0 0 * * *',
    lastScan: 0
  }
  // 'tvshows': 'tvshows',
  // 'documentaries-movies': 'documentaries',
  // 'documentaries-series': 'documentaries'
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
