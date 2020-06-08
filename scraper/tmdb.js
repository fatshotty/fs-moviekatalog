const {Config} = require('../utils');
const TMDB = require('tmdb').Tmdb;

let ALL_TMDB_KEY = Config.TMDB_API_KEY.split(',');

let TmdbCli = new TMDB( ALL_TMDB_KEY.shift(), 'it');

let TmdbImagesConfig = null;
let TmdbConfig = null;

let PROMISE = Promise.all([TmdbCli.get('configuration'), TmdbCli.get('configuration/languages')]).then( (rsp) => {
  let config = rsp[0];
  let langs = rsp[1];
  TmdbConfig = config;
  TmdbConfig.Languages = langs.filter( l => l.name && l.englishName && l.englishName != 'No Language' ).map( l => l.iso6391 );
  TmdbImagesConfig = config.images;
}).catch( (err) => {
  console.error(err);
  throw err;
});



function search(terms, year, type='movie') {
  let data = {query: terms, language: TmdbCli.language};
  if ( year ) {
    data.year = year;
  }
  return TmdbCli.get(`search/${type || 'multi'}`, data).then( (obj) => {
    let termsClean = terms.replace(/[^\w|\s]/g, '').replace( /\s\s+/gi, ' ').trim();

    let results = obj.results.filter((movie) => {
      let checkYear = true;
      if ( year ) {
        checkYear = (movie.releaseDate || movie.firstAirDate || '').substring(0, 4) == year;
      }
      return ( (movie.title || movie.name || movie.originalTitle || movie.originalName || '').toLowerCase() == terms.toLowerCase()) && checkYear;
    });

    if ( results.length == 0 ) {
      results = obj.results.filter( (movie) => {
        let movie_name = (movie.title || movie.name || movie.originalTitle || movie.originalName || '').replace(/[^\w|\s]/g, '').replace( /\s\s+/gi, ' ').trim();
        let checkYear = true;
        if ( year ) {
          checkYear = (movie.releaseDate || movie.firstAirDate || '').substring(0, 4) == year;
        }
        return ( (movie_name|| '').toLowerCase() == termsClean.toLowerCase()) && checkYear;
      });
    }

    if ( results.length == 0 ) {
      results = obj.results.filter( (movie) => {
        let movie_name = (movie.title || movie.name || movie.originalTitle || movie.originalName || '').replace(/[^\w|\s]/g, '').replace( /\s\s+/gi, ' ').trim();
        let checkYear = true;
        if ( year ) {
          let m_year = parseInt( (movie.releaseDate || movie.firstAirDate || '').substring(0, 4), 10);
          checkYear = m_year >= (year - 1) || m_year <= (year + 1);
        }
        return ( (movie_name|| '').toLowerCase() == termsClean.toLowerCase()) && checkYear;
      });
    }

    return {results};
  }).catch( (e) => {
    // console.error(`[ERROR tmdb-search] ${e.message}`);
    // e.code 7 invalid key
    if ( e.code == 7 ) {
      // invalid key
      let err = new Error(e.message);
      err.code = 401;
      throw err;
    }
    // console.error('Error search on scraper TMDB:', e.message, e);
    throw e;
  });
}



function getInfo(id, type='movie') {
  return TmdbCli.get(`${type}/${id}`, {append_to_response: 'videos,images,credits', include_image_language: 'it', language: TmdbCli.language})
    .then( (data) => {
      if ( type == 'tv' ) {
        return getInfoSeasons( id, data.seasons.map( s => s.seasonNumber ) ).then( (seasons) => {
          data.seasons = seasons;
          return data;
        });
      } else {
        return data;
      }
    })
    .catch( (e) => {
      // console.error(`[ERROR tmdb-info] ${e.message}`);
      if ( e.code == 7 ) {
        // invalid key
        let err = new Error(e.message);
        err.code = 401;
        throw err;
      }
      throw e;
    });
}


async function getInfoSeasons(tv_id, numbers) {
  let seasons = [];
  // Log.info(`total seasons for ${tv_id}: ${numbers.length}`);
  for ( let num of numbers ) {
    let season = await getSingleSeason( tv_id, num );
    seasons.push( season );
  }
  return seasons;
}



async function getSingleSeason(tv_id, number) {
  // Log.info(`getting info for ${tv_id} season ${number}`);
  return TmdbCli.get(`tv/${tv_id}/season/${number}`, {append_to_response: 'videos,images,credits', include_image_language: 'it', language: TmdbCli.language}).then( (data) => {
    return data;
  }, (e) => {
    console.error(`Error get Seas Info ${number} on scraper TMDB:`, e.message, e);
    return e;
  });
}



function wrap(fn) {
  return function() {
    let args = Array.prototype.slice.call(arguments);
    return PROMISE.then( () => {
      return fn.apply(null, args);
    })
  }
}


module.exports = {
  search: wrap(search),
  getInfo: wrap(getInfo),
  getTmdbConfig() {
    return TmdbConfig;
  }
};
