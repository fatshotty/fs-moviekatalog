const HTTP = require('http');
const {Config} = require('./utils');



function createHeaders(method, path) {

  const options = Object.assing({}, {
    hostname: Config.HOSTNAME,
    port: Config.PORT,
    headers: {
      'Authorization': `Bearer ${Config.ApiKey}`
    }
  }, {
    path: path,
    method: method || 'GET'
  });

  return options;
}


function searchEntity(ENTTITY_TYPE, title, year, tmdb) {

  let query = ['a=1'];
  if ( !tmdb ) {
    query.push(`f[Name]=${encodeURIComponent(title)}`);
    query.push(`f[Year]=${year}`);
  } else {
    query.push(`f[TmdbId]=${encodeURIComponent(tmdb)}`);
  }


  return new Promise( (resolve, reject) => {
    const options = createHeaders('GET', `/u/${Config.USER_UUID}/c/${Config.CATALOG_UUID}/${ENTTITY_TYPE}/search?${query.join('&')}`);

    let req = HTTP.request(options, (res) => {
      res.setEncoding('utf-8');

      let cb = resolve;

      if ( res.statusCode >= 200 && res.statusCode < 300 ) {
      } else {
        cb = reject;
      }

      let data = [];

      res.on('data', (chunk) => {
        data.push(chunk);
      });
      res.on('end', () => {
        process.nextTick( () => {
          cb( data.join('') );
        });
      });
    });

    req.on('error', (e) => {
      process.nextTick( reject );
    });

    req.end();
  });

}
