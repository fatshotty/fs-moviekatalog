require('dotenv').config();
const Path = require('path');
const FS = require('fs');

const Winston = require('winston');




function createLog(name) {
  let transports = [
    new Winston.transports.File({ filename: `logs/${name || 'process'}.log`  })
  ];

  transports.push( new Winston.transports.Console() );

  const Log = Winston.createLogger({
    level: 'info',
    transports: transports,
    format: Winston.format.combine(
      Winston.format.timestamp({format:'DD-MM-YYYY HH:mm:ss.SSSS'}),
      Winston.format.simple(),
      Winston.format.printf((info) => {
        return `${info.timestamp} (${process.pid}) [${info.level.toUpperCase()}]  ${info.message}`+(info.splat!==undefined?`${info.splat}`:" ")
      })
    )
  });
  return Log;
}




//        s m h d M dw
// CRON = 0 0 * * * *

const Config = {
  CWD: Path.normalize( __dirname ),
  // DATADIR: Path.normalize(__dirname),

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


  NUM_JOB: 1,

  Folders: [
    {
      Scope: 'movies',
      Path:  'movies',
      Schedule: '0 0 0 * * *'
    }
    // 'tvshows': 'tvshows',
    // 'documentaries-movies': 'documentaries',
    // 'documentaries-series': 'documentaries'
  ]


};

// if ( ! FS.existsSync(Config.DATADIR) ) {
//   FS.mkdirSync(Config.DATADIR, {recursive: true});
// }



module.exports = {
  Config,
  createLog
};
