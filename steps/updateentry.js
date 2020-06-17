const {Config} = require('../utils');
const Job = require('../job');
const MovieKatalog = require('../moviekatalog');
const Path = require('path');

const SEASON_NUM_REGEXP = /S\w+\s(\d+)$/i;
const SXXEYY_REGEXP = /S\d{2}E(\d{2,3})(?:-E(\d{2,3}))?/;

class UpdateEntry extends Job {

  get JobName() {
    return `[${this.name}-updater]`;
  }

  constructor(SCOPE) {
    super(SCOPE);

    this.MovieKatalog = new MovieKatalog(SCOPE.Scope, Config.USER_UUID, Config.CATALOG_UUID, Config.ApiKey);
  }


  execute({fs, scraped, entry}) {

    this.Log.info(`${this.JobName} check for update: ${fs.title} (${fs.year})`);

    let shouldUpdateMF = this.updateMediafilesFromFS({fs, entry});

    let shouldUploadSeas = this.updateSeasonsFromFS({fs, scraped, entry});

    if ( !shouldUpdateMF && !shouldUploadSeas ) {
      this.Log.info(`${this.JobName} ${fs.title} (${fs.year}) is already at latest version, SKIP`);
      return Promise.resolve();
    }

    this.Log.info(`${this.JobName} ${fs.title} (${fs.year}) - will be updated!`);

    return this.MovieKatalog.update( entry ).then( (createdEntry) => {
      this.Log.info(`${this.JobName} entry updated ${createdEntry.Title} (${createdEntry.Year}) - ${createdEntry.ID}`);
    }).catch( (e) => {
      this.Log.error(`${this.JobName} entry cannot be updated ${e.message}`);
    });

  }


  updateMediafilesFromFS({fs, entry}) {

    let final_mediafiles = [];
    let has_been_modified = false;

    for ( let [i, fs_mediaf] of  fs.mediafiles.entries() ) {
      let fs_file = fs_mediaf.file;
      let fs_filename = Path.basename(fs_file);
      let fs_ishidden = false;
      if ( fs_filename.startsWith('.') ) {
        // hidden
        fs_ishidden = true;
        fs_filename = fs_filename.substring(1);
      }

      let mediaf_to_add = null;
      for ( let entry_mediaf of entry.Mediafiles ) {
        if (entry_mediaf.Filename == fs_filename) {
          mediaf_to_add = entry_mediaf;
          if ( String(fs_ishidden) != String(entry_mediaf.Hidden) ) {
            // update hidden flag
            mediaf_to_add.Hidden = fs_ishidden;
            has_been_modified = true;
          }
          if ( mediaf_to_add.Size != fs_mediaf.size )  {
            has_been_modified = true;
          }
          break;
        }
      }

      if ( !mediaf_to_add ) {
        mediaf_to_add = this.computeMovieData(fs_mediaf, i);
        has_been_modified = true;
      }

      final_mediafiles.push(mediaf_to_add);

    }

    if ( final_mediafiles.length != entry.Mediafiles.length ) {
      has_been_modified = true;
    }
    entry.Mediafiles = final_mediafiles;
    return has_been_modified;

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




  updateSeasonsFromFS({fs, scraped, entry}) {

    let year = entry.Year - 1;

    for ( let subfolder of fs.subfolders ) {

      let subfolder_title = subfolder.name;
      let subfolder_number = extractRegExp(SEASON_NUM_REGEXP, subfolder_title, 1);

      let entry_season = null;
      for ( let seas of entry.Seasons ) {
        if ( seas.Name.toLowerCase() == subfolder_title.toLowerCase() ) {
          entry_season = seas;
          break;
        }
      }


      let scraped_episodes = [];

      if ( !entry_season ) {

        if ( subfolder_number && subfolder_number[0] ) {
          subfolder_number = parseInt(subfolder_number[0], 10);

          let selectedSeason = scrapedSeasons.filter( s => s.Number == subfolder_number )[0];

          if ( selectedSeason ) {

            scraped_episodes = selectedSeason.Episodes;

            year = parseInt(selectedSeason.Year, 10);

            let episodes = this.computeEpisodesData(subfolder.mediafiles, selectedSeason.Episodes);

            entry_season = {
              Name: subfolder_title,
              Year: year,
              Reorder: selectedSeason.Number,
              Director: selectedSeason.Directors[0],
              Plot: (selectedSeason.Description || '').substring(0, 100),
              Poster: selectedSeason.Poster
            };
          } else {

            if ( subfolder_number && subfolder_number[0] ) {
              subfolder_number = parseInt(subfolder_number[0], 10);
            }

            entry_season = {
              Name: subfolder.name,
              Year: year,
              Reorder: subfolder_number || 0,
              Director: null,
              Plot: null,
              Poster: null
            };

          }
        }

      }


      this.computeEpisodeBySeason(subfolder.mediafiles, scraped_episodes, entry_season.Episodes);


      entry.Seasons.push( entry_season );

    }


  }


  computeEpisodeBySeason(mediafiles, scraped_episodes, entry_episodes) {

    for ( let [i, mediafileobj] of mediafiles.entries() ) {

      let mediafile = mediafileobj.file;

      let basefilename = Path.basename(mediafile);

      let baseepindex = basefilename.lastIndexOf(' - ');
      let baseepisodename = baseepindex > -1 ? basefilename.substring(0, baseepindex) : baseepindex;
      baseepisodename = baseepisodename.trim();

      let ep_nums = extractRegExp(SXXEYY_REGEXP, mediafile, 1);

      let is_episode_name = true;

      if ( !ep_nums || ep_nums.length == 0 ) {
        this.Log.warn(`${this.JobName} manual compute episode number ${i} for ${basefilename}`);
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

  }


  pippuzzo({fs, scraped, entry}) {

    let scrapedSeasons = (scraped || {}).Seasons || [];

    for ( let subfolder of fs.subfolders ) {
      let subfolder_title = subfolder.name;
      let subfolder_number = extractRegExp(SEASON_NUM_REGEXP, subfolder_title, 1);

      let entry_season = null;
      for ( let seas of entry.Seasons ) {
        if ( seas.Name.toLowerCase() == subfolder_title.toLowerCase() ) {
          entry_season = seas;
          break;
        }
      }

      let selectedSeason = scrapedSeasons.filter( s => s.Number == subfolder_number )[0];

      if ( !entry_season ) {
        // TODO: create new season
      } else {
        // TODO: update season
        this.updateSingleSeason(subfolder, selectedSeason, entry_season);
      }

    }


  }


  updateSingleSeason(subfolder, scrapedSeason, entrySeason) {

    for ( let [i, mediaf] of subfolder.mediafiles.entries() ) {

      let mediafiledata = this.computeMovieData()

      for ( let epis of entrySeason.Episodes ) {
        for ( let mf of epis.Mediafiles ) {
          if ( mf.Filename == mediaf.Filename ) {

          }
        }
      }


    }


  }


}


module.exports = UpdateEntry;
