const {Config, createLog} = require('../utils');
const Job = require('../job');
const MovieKatalog = require('../moviekatalog');
const Path = require('path');


class UpdateEntry extends Job {

  constructor(SCOPE) {
    super(`${SCOPE.Scope}-updater`);
    this._scope = SCOPE;
    this.Log = createLog(SCOPE.Scope);

    this.MovieKatalog = new MovieKatalog(SCOPE.Scope, Config.USER_UUID, Config.CATALOG_UUID, Config.ApiKey);

  }


  execute({fs, entry}) {

    this.Log.info(`${this.JobName} check for update: ${fs.title} (${fs.year})`);

    let shouldUpdateMF = this.updateMediafilesFromFS({fs, entry});


    if ( !shouldUpdateMF ) {
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


}


module.exports = UpdateEntry;
