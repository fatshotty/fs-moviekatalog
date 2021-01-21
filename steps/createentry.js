const {Config, extractRegExp} = require('../utils');
const Job = require('../job');
const MovieKatalog = require('../moviekatalog');
const Path = require('path');


const SEASON_NUM_REGEXP = /S\w+\s(\d+)$/i;
const SXXEYY_REGEXP = /S\d{2}E(\d{2,3})(?:-E(\d{2,3}))?/;

const TMDB_PLACEHOLDER = 'id-';


class CreateEntry extends Job {


  get JobName() {
    return `[${this.name}-creater]`;
  }

  constructor(SCOPE) {
    super(SCOPE);

    this.MovieKatalog = new MovieKatalog(SCOPE.Scope, Config.USER_UUID, Config.CATALOG_UUID, Config.ApiKey);

  }


  execute({fs, scraped, entry}) {

    this.Log.info(`${this.JobName} computing entry data for ${fs.title} (${fs.year}) - scraped? ${!!scraped}`);

    scraped = scraped || {Year: fs.year};

    let newEntry = this.computeEntryData({fs, scraped});

    if ( fs.mediafiles.length > 0 ) {
      newEntry.Mediafiles = fs.mediafiles.map( (mf, i) => this.computeMovieData(mf, i) ).filter( m => !!m );
    }

    if ( fs.subfolders.length > 0 ) {
      newEntry.Seasons = this.computeSeasonsData(fs.subfolders, scraped); // fs.subfolders.map( (sf, i) => this.computeSeasonData(sf, scraped, i) ).filter( s => !!s );
    }

    if ( !entry ) {
      this.Log.info(`${this.JobName} creating entry data for ${fs.title} (${fs.year})`);

      return this.MovieKatalog.create( newEntry ).then( (createdEntry) => {
        this.Log.info(`${this.JobName} entry created ${createdEntry.Name} (${createdEntry.Year}) - ${createdEntry.ID}`);
      }).catch( (e) => {
        this.Log.error(`${this.JobName} entry ${fs.title} (${fs.year}) cannot be created: ${e.message || e}`);

        // catch globally
        throw e;
      });

    } else {
      // TODO: check if entry has been updated
      this.Log.info(`${this.JobName} ${fs.title} (${fs.year}) check for updates`);

      let shouldBeUpdate = this.checkForUpdate(newEntry, entry);

      if ( !shouldBeUpdate ) {
        this.Log.info(`${this.JobName} ${fs.title} (${fs.year}) is already at latest version, SKIP`);
        return Promise.resolve();
      }

      this.Log.info(`${this.JobName} ${fs.title} (${fs.year}) - will be updated!`);

      newEntry.ID = entry.ID;

      return this.MovieKatalog.update( newEntry ).then( (createdEntry) => {
        this.Log.info(`${this.JobName} entry updated ${createdEntry.Name} (${createdEntry.Year}) - ${createdEntry.ID}`);
      }).catch( (e) => {
        this.Log.error(`${this.JobName} entry ${fs.title} (${fs.year}) cannot be updated: ${e.message}`);

        // catch globally
        throw e;
      });

    }

  }


  computeEntryData({fs, scraped}) {

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
      TmdbId: `${scraped.Id || TMDB_PLACEHOLDER + Date.now()}`,
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

    let i_sep = full_filename.lastIndexOf(' - ');
    let details = full_filename.substring(i_sep + 2);


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
      this.Log.info(`${this.JobName} - ${full_filename} - ${e.message}` );
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




  computeSeasonsData(subfolders, scraped) {

    // trick: year - 1 in order to manually create season by year
    let year = scraped.Year - 1;

    let scrapedSeasons = scraped.Seasons || [];
    let result = [];

    if ( scrapedSeasons.length >= subfolders.length ) {

      for ( let [i, subfolder] of subfolders.entries() ) {
        let subfolder_title = subfolder.name;
        let subfolder_number = extractRegExp(SEASON_NUM_REGEXP, subfolder_title, 1);
        if ( subfolder_number && subfolder_number[0] ) {
          subfolder_number = parseInt(subfolder_number[0], 10);

          let selectedSeason = scrapedSeasons.find( s => s.Number == subfolder_number );

          if ( selectedSeason ) {

            year = parseInt(selectedSeason.Year, 10);

            let episodes = this.computeEpisodesData(subfolder.mediafiles, selectedSeason.Episodes);

            let res = {
              Name: subfolder_title,
              Year: year,
              Reorder: selectedSeason.Number,
              Director: selectedSeason.Directors[0],
              Plot: (selectedSeason.Description || '').substring(0, 100),
              Poster: selectedSeason.Poster
            };

            res.Episodes = episodes;
            result.push(res);
          } else {
            result.push( this.manualComputeSingleSeason(subfolder, ++year) );
          }
        }
      }

    } else {
      // eg: La casa de papel
      this.Log.info(`${this.JobName} Proceed with manual associations for Seasons`);
      result = this.manualComputeSeasons(subfolders, year + 1)
    }

    return result;

  }


  computeEpisodesData(submediafiles, episodes) {
    let eps = {};

    for ( let mediafileobj of submediafiles ) {
      let ep_title = '';
      if ( typeof mediafileobj == 'object' ) {
        ep_title = mediafileobj.name;
      } else if ( typeof mediafileobj == 'string' ) {
        ep_title = mediafileobj;
      }

      let ep_nums = extractRegExp(SXXEYY_REGEXP, ep_title, 1);

      if ( ep_nums && ep_nums.length > 0 ) {
        for ( let ep_num of ep_nums ) {
          if ( !ep_num ) continue;
          ep_num = parseInt(ep_num, 10);
          let selectedEp = episodes.find( e => e.Number == ep_num );

          if ( selectedEp ) {

            let res = eps[`e${ep_num}`];
            if ( !res ) {
              res = eps[`e${ep_num}`] = {
                Name: selectedEp.Title,
                Reorder: ep_num,
                Director: selectedEp.Directors[0],
                Plot: (selectedEp.Description || '').substring(0, 100),
                Fanart: selectedEp.Backdrop,
                Mediafiles: []
              };
            }
            // let mf_path = `${MEDIA_ROOT_FOLDER}/${title} (${year})/${mediafile}`;
            res.Mediafiles.push(  this.computeMovieData(mediafileobj, res.Mediafiles.length)  );
          } else {
            this.Log.info(`${this.JobName} manual association of: ${mediafileobj.name}`);
            let manual_eps = this.manualComputeEpisodes( [mediafileobj] );
            let manual_ep = manual_eps[0];
            if ( `e${manual_ep.Reorder}` in eps ) {
              let ep = eps[ `e${manual_ep.Reorder}` ];
              ep.Mediafiles = ep.Mediafiles.concat( manual_ep.Mediafiles );
              ep.Mediafiles.forEach( (val, i) => {
                val.Reoder = i;
              });
            } else {
              eps[ `e${manual_ep.Reorder}` ] = manual_ep;
            }
          }
        }
      }

    }

    return Object.values(eps).sort( (e1, e2) => e1.Reorder > e2.Reorder ? 1 : -1 );
  }



  manualComputeSeasons(subfolders, year) {
    year = year || 1;
    let seasons = [];

    for ( let [i, subfolder] of subfolders.entries() ) {

      let s = this.manualComputeSingleSeason(subfolder, year++)

      s.Reorder = s.Reorder || i;

      seasons.push(s);

    }

    return seasons;
  }


  manualComputeSingleSeason(subfolder, year) {
    let subfolder_number = extractRegExp(SEASON_NUM_REGEXP, subfolder.name, 1);
    if ( subfolder_number && subfolder_number[0] ) {
      subfolder_number = parseInt(subfolder_number[0], 10);
    }

    let season = {
      Name: subfolder.name,
      Year: year,
      Reorder: subfolder_number || 0,
      Director: null,
      Plot: null,
      Poster: null
    };

    season.Episodes = this.manualComputeEpisodes( subfolder.mediafiles );
    return season;
  }

  manualComputeEpisodes(mediafiles) {

    let eps = {};

    for ( let [i, mediafileobj] of mediafiles.entries() ) {

      let mediafile = mediafileobj.file;

      let basefilename = Path.basename(mediafile);

      let baseepindex = basefilename.lastIndexOf(' - ');
      let baseepisodename = baseepindex > -1 ? basefilename.substring(0, baseepindex) : basefilename;
      baseepisodename = baseepisodename.trim();

      let ep_nums = extractRegExp(SXXEYY_REGEXP, mediafile, 1);

      let is_episode_name = true;

      if ( !ep_nums || ep_nums.length == 0 ) {
        this.Log.info(`${this.JobName} manual compute episode number ${i} for ${basefilename}`);
        ep_nums = [i+1];
        is_episode_name = false;
      }
      for ( let ep_num of ep_nums ) {
        if ( !ep_num ) continue;
        ep_num = parseInt(ep_num, 10);

        let name = is_episode_name ? `Episodio ${ep_num}` : baseepisodename;

        let res = eps[`e${ep_num}`];
        if ( !res ) {
          res = eps[`e${ep_num}`] = {
            Name: name,
            Reorder: ep_num,
            Director: null,
            Plot: null,
            Fanart: null,
            Mediafiles: []
          };
        }
        res.Mediafiles.push(  this.computeMovieData(mediafileobj, res.Mediafiles.length)  );
      }


    }

    return Object.values(eps).sort( (e1, e2) => e1.Reorder > e2.Reorder ? 1 : -1 );

  }


  checkForUpdate(newEntry, savedEntry) {
    let shouldBeUpdate = false;

    // check mediafiles
    for ( let newMediafile of (newEntry.Mediafiles || []) ) {
      let savedMediafile = savedEntry.Mediafiles.find( m => m.Filename == newMediafile.Filename );

      if ( savedMediafile ) {
        // check hidden flag

        if ( String(savedMediafile.Hidden) != String(newMediafile.Hidden) ) {
          savedMediafile.Hidden = newMediafile.Hidden;
          shouldBeUpdate = true;
        }

        // check size
        if ( savedMediafile.Size != newMediafile.Size )  {
          savedMediafile.Size = newMediafile.Size;
          shouldBeUpdate = true;
        }

      } else {
        newMediafile.Reorder = savedEntry.Mediafiles.length;
        savedEntry.Mediafiles.push(newMediafile);
        shouldBeUpdate = true;
      }

    }


    // check seasons/subfolder
    for ( let newSeason of (newEntry.Seasons || []) ) {
      let savedSeason = savedEntry.Seasons.find( s => s.Name == newSeason.Name /* && s.Reorder == newSeason.Reorder */ );

      if ( savedSeason ) {

        // check episodes
        for ( let newEpisode of (newSeason.Episodes || []) ) {
          let savedEpisode = savedSeason.Episodes.find( e => e.Name == newEpisode.Name /* && e.Reorder == newEpisode.Reorder */);

          if (savedEpisode ) {

            for ( let newMediafile of (newEpisode.Mediafiles || []) ) {
              let savedMediafile = savedEpisode.Mediafiles.find(m => m.Filename == newMediafile.Filename);

              if ( !savedMediafile ) {
                newMediafile.Reorder = savedEpisode.Mediafiles.length;
                savedEpisode.Mediafiles.push(newMediafile);
                shouldBeUpdate = true;
              } else {
                if ( savedMediafile.Url != newMediafile.Url ) {
                  savedMediafile.Url = newMediafile.Url;
                  shouldBeUpdate = true;
                }
                if ( String(savedMediafile.Hidden) != String(newMediafile.Hidden) ) {
                  savedMediafile.Hidden = newMediafile.Hidden;
                  shouldBeUpdate = true;
                }
              }
            }

          } else {
            savedSeason.Episodes.push(newEpisode);
            shouldBeUpdate = true;
          }
        }

      } else {
        // savedSeason.Reorder = savedEntry.Seasons.length;
        savedEntry.Seasons.push(newSeason);
        shouldBeUpdate = true;
      }

    }


    if (savedEntry.TmdbId.startsWith(TMDB_PLACEHOLDER) ) {
      // force save new scraper data
      shouldBeUpdate = true;
    }

    return shouldBeUpdate;
  }

}


module.exports = CreateEntry;
