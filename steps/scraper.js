const {Config, createLog} = require('../utils');
const Job = require('../job');
const ScraperLib = require('../scraper/scraper');
const MovieKatalog = require('../moviekatalog');

const SCRAPERS = ['TMDB', 'TVDB'];

class Scraper extends Job {

  constructor(SCOPE) {
    super(`${SCOPE.Scope}-scraper`);
    this._scope = SCOPE;
    this.Log = createLog(SCOPE.Scope);

    this.MovieKatalog = new MovieKatalog(SCOPE.Scope, Config.USER_UUID, Config.CATALOG_UUID, Config.ApiKey);
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
        return ScraperLib[ scraper ].search(title, year, type).then( (scraperdata) => {
          let results = scraperdata.results;
          let first = results[0];
          if ( first ) {

            // just to be sure: re-check on db via tmdbid
            this.MovieKatalog.search(null, null, first.id).then( (entries) => {
              if ( entries.length == 0 ) {
                // scrape a new entry
                ScraperLib[ scraper ].getInfo(first.id, type).then( (klass) => {
                  this.emit( 'scraped', {scraped: klass, fs: data} );
                  return resolve();
                })
              } else {
                let entry = entries[0];
                // entry already exists (in case of illegar char: es. "11 settembre: senza scampo")
                this.emit('update', {fs: data, entry});

              }
            });


          } else {
            // force to catch error on 'catch' function
            throw new Error(`not found on ${scraper}`);
          }
        }).catch( (e) => {
          this.Log.error( `${this.JobName} - ${title} (${year}) ${e.message}` );
          fn_scrape();
        });
      }

      fn_scrape();

    });

  }

}
module.exports = Scraper;
