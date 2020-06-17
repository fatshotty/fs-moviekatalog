const {Config, createLog} = require('./utils');
const HTTP = require('https');

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


  request(options, postdata) {
    return new Promise( (resolve, reject) => {

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

      if ( postdata ){
        req.write( JSON.stringify(postdata) );
      }

      req.end();
    });
  }

  search(title, year, tmdbid) {

    let query = ['a=1'];
    if ( !tmdbid ) {
      query.push(`f[Name]=${encodeURIComponent(title)}`);
      query.push(`f[Year]=${year}`);
    } else {
      query.push(`f[TmdbId]=${encodeURIComponent(tmdbid)}`);
    }

    const options = this.createHeaders('GET', `/u/${this._useruuid}/c/${this._catalogUUID}/${this._entitytype}/search?${query.join('&')}`);
    return this.request( options );
  }


  searchByMediafileUrl(mediafileurl) {
    let query = ['a=1'];
    query.push(`f[Mediafiles.Url]=${encodeURIComponent(mediafileurl)}`);
    query.push(`f[Seasons.Episodes.Mediafiles.Url]=${encodeURIComponent(mediafileurl)}`);

    const options = this.createHeaders('GET', `/u/${this._useruuid}/c/${this._catalogUUID}/${this._entitytype}/search?${query.join('&')}`);
    return this.request(options)
  }


  create(entry) {
    const options = this.createHeaders('POST', `/manager/catalogs/${this._catalogUUID}/${this._entitytype}`);
    return this.request(options, entry);
  }


  update(entry) {
    const options = this.createHeaders('PUT', `/manager/catalogs/${this._catalogUUID}/${this._entitytype}/${entry.ID}`);
    return this.request(options, entry);
  }


  _delete(entryID, seasID, epID, mfID){
    let path = [entryID];

    if (seasID) {
      path.push('seasons')
      path.push(seasID);
    }
    if (epID) {
      path.push('episodes')
      path.push(epID);
    }
    if (mfID) {
      path.push('mediafiles')
      path.push(mfID);
    }

    const options = this.createHeaders('DELETE', `/manager/catalogs/${this._catalogUUID}/${this._entitytype}/${path.join('/')}`);
    return this.request(options);
  }

  deleteEntry(entryID){
    return this._delete(entryID);
  }

  deleteMediafile(entryID, seasID, epID, mfID){
    return this._delete(entryID, seasID, epID, mfID);
  }

  deleteEpisode(entryID, seasID, epID){
    return this._delete(entryID, seasID, epID);
  }

  deleteSeason(entryID, seasID){
    return this._delete(entryID, seasID);
  }


}





module.exports = MovieKatalog;
