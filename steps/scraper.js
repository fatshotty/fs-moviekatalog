const {Config} = require('../utils');
const Job = require('../job');
const ScraperLib = require('../scraper/scraper');
const MovieKatalog = require('../moviekatalog');
const FS = require('fs');
const Path = require('path');
const Moment = require('moment');
const Entities = require('../models/entities');

const SCRAPERS = ['TMDB', 'TVDB'];

class Scraper extends Job {


  get JobName() {
    return `[${this.name}-scraper]`;
  }

  constructor(SCOPE) {
    super(SCOPE);

    this.MovieKatalog = new MovieKatalog(SCOPE.Scope, Config.USER_UUID, Config.CATALOG_UUID, Config.ApiKey);

    this.Model = Entities[ this.name ];

  }


  async searchInCache(data) {

    return await this.Model.findByTitleAndYear(data.title, data.year);

  }


  restart() {
    this.Log.info(`${this.JobName} restarting job`);
    super.restart();
    // restart queue
    this.next();
  }

  onError(err) {
    this.HasError = true;
    if ( err.code == 401 ) {
      // block on api-rate-limit
      this.Log.error(`${this.JobName} got api rate limit. STOPPED!`);
      return;
    }
    super.onError(err);
  }


  async execute(data) {


    let title = data.fs.title;
    let year = data.fs.year;


    if ( this._scope.Scraper === false ) {
      // passthrought
      this.emit( 'scraped', {...data, scraped: null} );
      return Promise.resolve();
    }


    let type = this._scope.Scraper == 'tv' ? 'tv' : 'movie';


    for ( let scraper of SCRAPERS ) {

      this.Log.info(`${this.JobName} scraping ${title} (${year}) via ${scraper}`);

      let cached = await this.searchInCache(data.fs);

      let tmdbid = null;

      if ( !cached ) {
        // search on scraper
        try {
          tmdbid = await ScraperLib[ scraper ].search(title, year, type).then( (scraperdata) => {
            let results = scraperdata.results;
            let first = results[0];
            if ( first ) {
              this.Log.debug(`${this.JobName} ${title} (${year}) scraped on ${scraper}: ${first.id}`);
              return first.id;
            } else {
              // force to catch error on 'catch' function
              throw new Error(`not found on ${scraper}`);
            }
          });
        } catch(e) {
          // TODO: check error and throw if 401
          // entry not found on scraper, try next scraper
          if ( e.code == 401 ) {
            throw e;
          }
          this.Log.debug(`${this.JobName} ${title} (${year}) not found on ${scraper}`);
          if ( this._scope.Scraper == 'movie') {
            this.Log.info(`${this.JobName} ${title} (${year}) is a movie. Skip next scraper`);
            break;
          }
          continue;
        }

      } else {

        this.Log.info(`${this.JobName} - ${title} (${year})  found in cache -> ${cached.OfficialID}`);
        tmdbid = cached.OfficialID;

      }


      if ( tmdbid ) {

        let objScraped = null;
        if ( cached ) {
          objScraped = this.getScrapedJson(cached);
        }

        if ( !objScraped ) {
          let klass = await ScraperLib[ scraper ].getInfo(tmdbid, type, cached ? cached.ImdbID : null)
          objScraped = klass.toPage();
        }

        // if ( !cached ) {

        // } else {
        //   objScraped = cached.scraped;
        // }

        let entry = data.entry;
        if ( !entry ) {
          let entries = await this.MovieKatalog.search(null, null, tmdbid);
          if ( entries.length == 0 ) {
            // scrape a new entry
            let returnedObj = {scraped: objScraped, ...data};
            this.emit( 'scraped', returnedObj );
          } else {
            entry = entries[0];
            this.emit( 'update', {scraped: objScraped, ...data, entry} );
          }
        } else {
          this.emit( 'update', {scraped: objScraped, ...data} );
        }

        if ( !cached || this.isCachedExpired(cached) ) {
          // write in cache
          this.writeFile( {scraped: objScraped, fs: { title: data.fs.title, year: data.fs.year} }, cached );
        }

        // finish
        return;

      }

    }

    // TODO: no more scraper error
    this.Log.warn(`${this.JobName} ${title} (${year}) not found on scrapers`);
    this.emit( 'scraped', {scraped: null, ...data} );

  }

  // execute(data) {

  //   let scrapeIndex = -1;

  //   let title = data.title;
  //   let year = data.year;
  //   let type = this._scope.Scraper == 'tv' ? 'tv' : 'movie';

  //   return new Promise( (resolve, reject) => {

  //     let fn_scrape = () => {

  //       let scraper = SCRAPERS[ ++scrapeIndex ];
  //       if ( !scraper ) {
  //         this.Log.warn(`${this.JobName} scraping ${title} (${year}) no more scraper`);
  //         this.emit( 'scraped', {fs: data, scraped: null} );
  //         return resolve();
  //       }
  //       this.Log.info(`${this.JobName} scraping ${title} (${year}) via ${scraper}`);

  //       let cached = this.searchInCache(data);

  //       let p = Promise.resolve();

  //       if ( ! cached ) {

  //         p = ScraperLib[ scraper ].search(title, year, type).then( (scraperdata) => {
  //           let results = scraperdata.results;
  //           let first = results[0];
  //           if ( first ) {
  //             return first.id;
  //           } else {
  //             // force to catch error on 'catch' function
  //             throw new Error(`not found on ${scraper}`);
  //           }

  //         }).catch( (e) => {
  //           this.Log.error( `${this.JobName} - ${title} (${year}) ${e.message}` );
  //           return fn_scrape();
  //         });

  //       } else {
  //         this.Log.info(`${this.JobName} - ${title} (${year})  found in cache -> ${cached.scraped.Id}`);
  //         p = Promise.resolve(cached.scraped.Id);
  //       }


  //       return p.then( (tmdbid) => {
  //         if ( !tmdbid ) {
  //           this.Log.warn(`${this.JobName} no TMDB/TVDB id found for ${title} (${year})`);
  //           return;
  //         }
  //         // just to be sure: re-check on db via tmdbid
  //         return this.MovieKatalog.search(null, null, tmdbid).then( (entries) => {
  //           if ( entries.length == 0 ) {
  //             // scrape a new entry

  //             if ( !cached ) {
  //               return ScraperLib[ scraper ].getInfo(tmdbid, type).then( (klass) => {
  //                 let obj = klass.toPage();

  //                 let returnedObj = {scraped: obj, fs: data};

  //                 // save in cache
  //                 this.writeFile(returnedObj);

  //                 this.emit( 'scraped', returnedObj );
  //                 return resolve();
  //               })
  //             } else {
  //               this.emit( 'scraped', {scraped: cached.scraped, fs: data} );
  //               return resolve();
  //             }

  //           } else {
  //             let entry = entries[0];
  //             // entry already exists (in case of illegar char: es. "11 settembre: senza scampo")
  //             this.emit('update', {fs: data, entry});
  //           }
  //         });
  //       })

  //     }

  //     fn_scrape();

  //   });

  // }


  getScrapedJson(model) {
    let obj = null;
    try {
      obj = JSON.parse(model.ScrapedJson);
    } catch(e) {

    }

    if ( !obj ) {
      return null;
    }

    if ( this.isCachedExpired(model) ) {
      return null;
    }

    return obj;

  }

  isCachedExpired(model) {
    // check dates
    let updatedAt = Moment(model.updated_at);
    let today = Moment();

    if ( Math.abs( today.diff(updatedAt, 'days') ) >= 7  ) {
      return true;
    }

    return false;

  }

  async writeFile(res, model) {

    // this.FileContent.push(res);

    // let fd = FS.openSync( Path.join(Config.DATADIR, `${this.name}-scraper.txt`), 'a' );
    // FS.writeSync(fd, JSON.stringify(res) + '\n' );
    // FS.closeSync(fd);
    model = model || new this.Model();
    model.Title = res.scraped.Title;
    model.Year = res.scraped.Year;
    model.OfficialID = String(res.scraped.Id);
    model.ImdbID = res.scraped.ImdbData ? res.scraped.ImdbData.imdbid : null;
    model.FSTree = res.fs;

    model.tvshow = res.scraped.tvshow;
    model.movie = res.scraped.movie;
    model.season = res.scraped.season;
    model.episode = res.scraped.episode;

    model.ScrapedJson = JSON.stringify(res.scraped);

    return model.save();

  }

}
module.exports = Scraper;
