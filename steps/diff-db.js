const {Config} = require('../utils');
const Job = require('../job');
const MovieKatalog = require('../moviekatalog');


class DiffDB extends Job {


  get JobName() {
    return `[${this.name}-diff]`;
  }

  constructor(SCOPE){
    super(SCOPE);

    this.category = SCOPE.Scope;

    this.MovieKatalog = new MovieKatalog(SCOPE.Scope, Config.USER_UUID, Config.CATALOG_UUID, Config.ApiKey);
  }

  execute(jsonRow) {
    let title = jsonRow.title;
    let year = jsonRow.year;

    return this.MovieKatalog.search(title, year).then( (data) => {

      if ( data.length > 0 ) {
        let entry = data[0];

        this.Log.info(`${this.JobName} ${this._scope.Scope} found for: ${title} (${year}) - check for update`);

        this.emit('update', {fs: jsonRow, entry});

      } else {
        this.Log.info(`${this.JobName} no ${this._scope.Scope} found for: ${title} (${year}) - create a new entry`);

        this.emit('newentry', {fs: jsonRow});

      }

    });
  }



  processLine(line) {




  }

}


module.exports = DiffDB;
