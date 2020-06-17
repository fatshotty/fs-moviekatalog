const {Config} = require('../utils');
const Job = require('../job');
const MovieKatalog = require('../moviekatalog');


class RemoveEntry extends Job {


  get JobName() {
    return `[${this.name}-remove]`;
  }

  constructor(SCOPE){
    super(SCOPE);

    this.category = SCOPE.Scope;

    this.MovieKatalog = new MovieKatalog(SCOPE.Scope, Config.USER_UUID, Config.CATALOG_UUID, Config.ApiKey);
  }


  async execute(filepath) {

    let data = await this.MovieKatalog.searchByMediafileUrl(filepath)

    if ( data.length > 0 ) {
      let entry = data[0];
      this.Log.info(`${this.JobName} found ${entry.Name} (${entry.Year}) - deleting file ${filepath}`);

      if ( data.length > 1 ) {
        this.Log.warn(`${this.JobName} FOUND ${data.length} entities for mediafile: ${filepath}`);
      }

      await this.checkMediaFile(entry, filepath);
      await this.checkEpMediafile(entry, filepath);

      if ( entry.Mediafiles.length == 0 && entry.Seasons.length == 0 ) {
        this.Log.info(`${this.JobName} entry ${entry.Name} (${entry.Year}) will be deleted!`);

        return this.MovieKatalog.deleteEntry( entry.ID ).catch( (e) => {
          this.Log.error(`${this.JobName} entry ${entry.Name} (${entry.Year}) cannot be deleted: ${e.message}`);
          throw e;
        });
      } else {
        this.Log.info(`${this.JobName} entry ${entry.Name} (${entry.Year}) will be updated!`);
        return this.MovieKatalog.update( entry ).then( (createdEntry) => {
          this.Log.info(`${this.JobName} entry updated ${createdEntry.Name} (${createdEntry.Year}) - ${createdEntry.ID}`);
        }).catch( (e) => {
          this.Log.error(`${this.JobName} entry ${entry.Name} (${entry.Year}) cannot be updated: ${e.message}`);
          throw e;
        });
      }

    }
  }


  async checkMediaFile(entry, filepath){


    if ( entry.Mediafiles.length == 0 ) {
      // do not update as per no Mediafiles
      return false;
    }

    for ( let z = entry.Mediafiles.length - 1, mf; mf = entry.Mediafiles[ z ]; z--  ) {
      let url = mf.Url;
      if ( url == filepath ) {
        // found episode, delete mediafile

        await this.MovieKatalog.deleteMediafile(entry.ID, null, null, mf.ID);
        entry.Mediafiles.splice(z, 1);
      }
    }


  }

  async checkEpMediafile(entry, filepath){

    if ( entry.Seasons.length == 0 ) {
      // do not update as per no Seasons
      return false;
    }

    for ( let i = entry.Seasons.length - 1, seas; seas = entry.Seasons[ i ]; i-- ){

      for ( let j = seas.Episodes.length - 1, ep; ep = seas.Episodes[ j ]; j-- ) {

        for ( let z = ep.Mediafiles.length - 1, mf; mf = ep.Mediafiles[ z ]; z--  ) {
          let url = mf.Url;
          if ( url == filepath ) {
            // found episode, delete mediafile

            await this.MovieKatalog.deleteMediafile(entry.ID, seas.ID, ep.ID, mf.ID);
            ep.Mediafiles.splice(z, 1);
          }
        }

        if ( ep.Mediafiles.length <= 0 ) {
          // delete episode
          await this.MovieKatalog.deleteEpisode(entry.ID, seas.ID, ep.ID);
          seas.Episodes.splice(j, 1);
        }
      }

      if ( seas.Episodes.length <= 0 ) {
        // delete episode
        await this.MovieKatalog.deleteSeason(entry.ID, seas.ID);
        entry.Seasons.splice(i, 1);
      }

    }


  }

}


module.exports = RemoveEntry;
