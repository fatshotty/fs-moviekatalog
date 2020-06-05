const {Config, createLog} = require('../utils');
const Job = require('../job');
const MovieKatalog = require('../moviekatalog');


class DiffDB extends Job {

  constructor(SCOPE){
    super(`${SCOPE.Scope}-pr`);

    this.category = SCOPE.Scope;

    this._scope = SCOPE;

    this.Log = createLog(SCOPE.Scope);

    this.MovieKatalog = new MovieKatalog(SCOPE.Scope, Config.USER_UUID, Config.CATALOG_UUID, Config.ApiKey);
  }


  execute(jsonRow) {
    let title = jsonRow.title;
    let year = jsonRow.year;

    return this.MovieKatalog.search(title, year).then( (data) => {

      if ( data.length > 0 ) {
        let entry = data[0];

        this.Log.info(`${this.JobName} ${this._scope.Scope} found for: ${title} (${year}) - check for update`);

        // TODO: process difference
        this.emit('update', {fs: jsonRow, entry});

      } else {
        this.Log.info(`${this.JobName} no ${this._scope.Scope} found for: ${title} (${year}) - create a new entry`);
        // save into file for TMDB scraper

        this.emit('newentry', jsonRow);

      }

    });
  }



  processLine(line) {




  }

}


module.exports = DiffDB;
