const {Config, createLog} = require('../utils');
const Job = require('../job');
const ScraperLib = require('../scraper/scraper');
const MovieKatalog = require('../moviekatalog');
const FS = require('fs');
const Path = require('path');

const SCRAPERS = ['TMDB', 'TVDB'];

class Scraper extends Job {

  constructor(SCOPE) {
    super(`${SCOPE.Scope}-scraper`);
    this._scope = SCOPE;
    this.Log = createLog(SCOPE.Scope);

    this.MovieKatalog = new MovieKatalog(SCOPE.Scope, Config.USER_UUID, Config.CATALOG_UUID, Config.ApiKey);


    this.FileContent = [];

    if ( FS.existsSync(Path.join(Config.DATADIR, `${this.name}.txt`)) ) {
      let filecontent = FS.readFileSync( Path.join(Config.CWD, `${this.name}.txt`), {encoding:'utf-8'}  )
      filecontent = filecontent.split('\n');
      this.FileContent = filecontent.map( r => r && JSON.parse(r) ).filter( r => !!r );

      this.Log.warn(`${this.JobName} CACHE FILE HAS BEEN LOADED - ${this.FileContent.length}`);
    }

  }


  searchInCache(data) {

    return this.FileContent.filter( (r) => {

      return r.fs.title.toLowerCase() == data.title.toLowerCase()  &&  r.fs.year == data.year;

    })[0];

  }


  execute(data) {

    let scrapeIndex = -1;

    let title = data.title;
    let year = data.year;
    let type = this._scope.Scope == 'movies' ? 'movie' : 'tv';

    return new Promise( (resolve, reject) => {

      let fn_scrape = () => {

        let scraper = SCRAPERS[ ++scrapeIndex ];
        if ( !scraper ) {
          this.Log.warn(`${this.JobName} scraping ${title} (${year}) no more scraper`);
          this.emit( 'scraped', {fs: data, scraped: null} );
          return resolve();
        }
        this.Log.info(`${this.JobName} scraping ${title} (${year}) via ${scraper}`);

        let cached = this.searchInCache(data);

        let p = Promise.resolve();

        if ( ! cached ) {

          p = ScraperLib[ scraper ].search(title, year, type).then( (scraperdata) => {
            let results = scraperdata.results;
            let first = results[0];
            if ( first ) {
              return first.id;
            } else {
              // force to catch error on 'catch' function
              throw new Error(`not found on ${scraper}`);
            }

          }).catch( (e) => {
            this.Log.error( `${this.JobName} - ${title} (${year}) ${e.message}` );
            return fn_scrape();
          });

        } else {
          this.Log.info(`${this.JobName} - ${title} (${year})  found in cache -> ${cached.scraped.Id}`);
          p = Promise.resolve(cached.scraped.Id);
        }


        return p.then( (tmdbid) => {
          if ( !tmdbid ) {
            this.Log.warn(`${this.JobName} no TMDB/TVDB id found for ${title} (${year})`);
            return;
          }
          // just to be sure: re-check on db via tmdbid
          return this.MovieKatalog.search(null, null, tmdbid).then( (entries) => {
            if ( entries.length == 0 ) {
              // scrape a new entry

              if ( !cached ) {
                return ScraperLib[ scraper ].getInfo(tmdbid, type).then( (klass) => {
                  let obj = klass.toPage();

                  let returnedObj = {scraped: obj, fs: data};

                  this.writeFile(returnedObj);

                  this.emit( 'scraped', returnedObj );
                  return resolve();
                })
              } else {
                this.emit( 'scraped', {scraped: cached.scraped, fs: data} );
                return resolve();
              }

            } else {
              let entry = entries[0];
              // entry already exists (in case of illegar char: es. "11 settembre: senza scampo")
              this.emit('update', {fs: data, entry});
            }
          });
        })

      }

      fn_scrape();

    });

  }


  writeFile(res) {
    let fd = FS.openSync( Path.join(Config.DATADIR, `${this.name}.txt`), 'a' );
    FS.writeSync(fd, JSON.stringify(res) + '\n' );
    FS.closeSync(fd);
  }

}
module.exports = Scraper;
