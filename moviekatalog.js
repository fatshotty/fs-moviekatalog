const {Config, createLog} = require('./utils');
const HTTP = require('http');

class MovieKatalog {

  constructor(entitytype, userUUID, catalogUUID, catalogApiKey) {

    this._useruuid = userUUID;
    this._catalogUUID = catalogUUID;
    this._catalogApiKey = catalogApiKey;
    this._entitytype = entitytype;

    this.Log = createLog(entitytype);

  }



  createHeaders(method, path) {

    const options = Object.assign({}, {
      hostname: Config.HOSTNAME,
      port: Config.PORT,
      headers: {
        'Authorization': `Bearer ${Config.ApiKey}`,
        'Content-Type': 'application/json'
      }
    }, {
      path: path,
      method: method || 'GET'
    });

    return options;
  }

  search(title, year, tmdbid) {

    let query = ['a=1'];
    if ( !tmdbid ) {
      query.push(`f[Name]=${encodeURIComponent(title)}`);
      query.push(`f[Year]=${year}`);
    } else {
      query.push(`f[TmdbId]=${encodeURIComponent(tmdbid)}`);
    }


    return new Promise( (resolve, reject) => {
      const options = this.createHeaders('GET', `/u/${this._useruuid}/c/${this._catalogUUID}/${this._entitytype}/search?${query.join('&')}`);

      let req = HTTP.request(options, (res) => {
        res.setEncoding('utf-8');

        let cb = resolve;

        if ( !(res.statusCode >= 200 && res.statusCode < 300) ) {
          cb = reject;
        }

        let data = [];

        res.on('data', (chunk) => {
          data.push(chunk);
        });
        res.on('end', () => {
          process.nextTick( () => {
            try {
              data = JSON.parse(data.join(''));
            } catch(e) {}
            cb( data );
          });
        });
      });

      req.on('error', (e) => {
        process.nextTick( () => reject(e) );
      });

      req.end();
    });


  }


  create(entry) {

    return new Promise( (resolve, reject) => {
      const options = this.createHeaders('POST', `/manager/catalogs/${this._catalogUUID}/${this._entitytype}`);

      let req = HTTP.request(options, (res) => {
        res.setEncoding('utf-8');

        let cb = resolve;

        if ( !(res.statusCode >= 200 && res.statusCode < 300) ) {
          cb = reject;
        }

        let data = [];

        res.on('data', (chunk) => {
          data.push(chunk);
        });
        res.on('end', () => {
          process.nextTick( () => {
            try {
              data = JSON.parse(data.join(''));
            } catch(e) {}
            cb( data );
          });
        });
      });

      req.on('error', (e) => {
        process.nextTick( () => reject(e) );
      });

      req.write( JSON.stringify(entry) );
      req.end();
    });


  }



  update(entry) {
    return new Promise( (resolve, reject) => {
      const options = this.createHeaders('PUT', `/manager/catalogs/${this._catalogUUID}/${this._entitytype}/${entry.ID}`);

      let req = HTTP.request(options, (res) => {
        res.setEncoding('utf-8');

        let cb = resolve;

        if ( !(res.statusCode >= 200 && res.statusCode < 300) ) {
          cb = reject;
        }

        let data = [];

        res.on('data', (chunk) => {
          data.push(chunk);
        });
        res.on('end', () => {
          process.nextTick( () => {
            try {
              data = JSON.parse(data.join(''));
            } catch(e) {}
            cb( data );
          });
        });
      });

      req.on('error', (e) => {
        process.nextTick( () => reject(e) );
      });

      req.write( JSON.stringify(entry) );
      req.end();
    });
  }


}





module.exports = MovieKatalog;
