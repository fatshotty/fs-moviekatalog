const {Config, createLog} = require('../utils');
const Job = require('../job');
const MovieKatalog = require('../moviekatalog');
const Path = require('path');


class CreateEntry extends Job {

  constructor(SCOPE) {
    super(`${SCOPE.Scope}-creater`);
    this._scope = SCOPE;
    this.Log = createLog(SCOPE.Scope);

    this.MovieKatalog = new MovieKatalog(SCOPE.Scope, Config.USER_UUID, Config.CATALOG_UUID, Config.ApiKey);

  }


  execute({fs, scraped}) {

    this.Log.info(`${this.JobName} computing entry data for ${fs.title} (${fs.year})`);

    let entry = this.computeEntryData({fs, scraped});

    if ( fs.mediafiles.length > 0 ) {
      entry.Mediafiles = fs.mediafiles.map( (mf, i) => this.computeMovieData(mf, i) ).filter( m => !!m );
    }

    this.Log.info(`${this.JobName} creating entry data for ${fs.title} (${fs.year})`);

    return this.MovieKatalog.create( entry ).then( (createdEntry) => {
      this.Log.info(`${this.JobName} entry created ${createdEntry.Title} (${createdEntry.Year}) - ${createdEntry.ID}`);
    }).catch( (e) => {
      this.Log.error(`${this.JobName} entry cannot be created ${e.message}`);
    });

  }


  computeEntryData({fs, scraped}) {

    scraped = scraped || {};

    let year = scraped.Year || fs.year;

    let genres = ['Unknown'];
    if ( scraped.Genres && scraped.Genres.length ) {
      genres = scraped.Genres.slice(0, 3);
    }

    let director = '';
    if ( scraped.Directors && scraped.Directors.length ) {
      director = scraped.Directors[0];
    }

    let cast = '';
    if ( scraped.Cast && scraped.Cast.length ) {
      cast = scraped.Cast.slice(0, 5);
    }

    let summary = scraped.Description || '';

    let res = {
      Name: scraped.Title || fs.title,
      TmdbId: `${scraped.Id || 'id-' + Date.now()}`,
      ImdbId: scraped.ImdbData ? scraped.ImdbData.imdbid : undefined,
      Genres: genres,
      Year: year,
      Website: scraped.Homepage,
      Collection: scraped.Collection,
      RatingImdb:  scraped.ImdbData ? scraped.ImdbData.rating : parseInt(scraped.Vote || 0, 10),
      Director: director,
      Cast: cast,
      Plot: summary.length > 300 ? `${summary.slice(0, Config.PLOT_LIMIT)}...` : summary,
      YtTrailerId: scraped.YT_trailer || '',
      Poster: scraped.Poster,
      Fanart: scraped.Backdrop,
      is4k: 0,
      ClickCount: 0
    };

    return res;

  }


  computeMovieData(mediafile, i){

    let full_filename = Path.basename( mediafile.file );

    let i_sep = full_filename.lastIndexOf('-');
    let details = full_filename.substring(i_sep + 1);


    let isHidden = full_filename.startsWith('.');
    if ( isHidden ) {
      full_filename = full_filename.substring(1);
    }

    details = details.trim();

    details = details.substring(0, details.lastIndexOf('.') );
    details = details.split(' ');

    // 1080p x264 AC3 5.1 9,5GB
    // BluRay 2160p HEVC HDR AC3 5.1 50,6GB.mkv

    // let videoResolutionIndex = 1;

    let source = null;
    let videoResolution = null;
    let videoCodec = null;
    let audioCodec = null;
    let audioChannels = null;
    let size = mediafile.size;

    try {

      details.pop(); // size
      audioChannels = details.pop();
      audioCodec = details.pop();

      source = details.shift();
      if ( !isNaN( parseInt( source.charAt(0), 10) ) ) {
        videoResolution = source;
        source = 'BDRip';
      } else {
        videoResolution = details.shift();
      }

      videoCodec = details.shift();

    } catch(e) {
      this.Log.error(`${this.JobName} ${full_filename} - ${e.message}` );
    }


    let data = {
      Url: mediafile.file,
      Filename: full_filename,
      Hidden: isHidden,
      Source: source,
      Size: size,
      AudioCodec: audioCodec,
      Language: 'IT',
      AudioChannels: audioChannels,
      VideoCodec: videoCodec,
      VideoResolution: videoResolution,
      Reorder: i,
      Status: 'published'
    };

    return data;

  }


}


module.exports = CreateEntry;
