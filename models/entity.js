const BaseEntity = require('./base_entity');
const {EntityColumns} = require('../database/declarations');
const {EntityM} = require('../database/models');
const {createLog} = require('../utils');
const FS = require('fs');
const Path = require('path');
const {Config} = require('../utils');


const USE_DB = !!Config.DATABASE;

const TABLE = 'entity';

function createEntity(scopeLibrary) {

  const Log = createLog(scopeLibrary);

  let FileContent;

  if ( FS.existsSync(Path.join(Config.DATADIR, `${scopeLibrary}-scraper.txt`)) ) {
    let filecontent = FS.readFileSync( Path.join(Config.DATADIR, `${scopeLibrary}-scraper.txt`), {encoding:'utf-8'}  )
    filecontent = filecontent.split('\n');
    FileContent = filecontent.map( (r) => {
      if (r) {
        let d = JSON.parse(r);
        if ( d.FS ) {
          d.FS = JSON.parse(d.FS);
        }
        return d;
      }
     }).filter( r => !!r );

    Log.warn(`${scopeLibrary} CACHE FILE HAS BEEN LOADED - ${FileContent.length}`);
  }

  class Entity extends BaseEntity {

    static get Table() {
      return TABLE;
    }

    static get Columns() {
      return EntityColumns;
    }

    static get Model() {
      return EntityM;
    }

    get Model(){
      return EntityM;
    }

    get FSTree() {
      return this._fstree;
    }

    set FSTree(value) {
      this._fstree = value;
    }

    constructor(model) {
      super( model, scopeLibrary );
      BaseEntity.__dynamic(this, Entity);

      this._fstree = this.FS ? JSON.parse(this.FS) : {};
    }

    static async findByTitleAndYear(title, year) {
      return await this.findBy( {[this.Columns.Title]: title, [this.Columns.Year]: year } )
    }

    static async findBy(fields) {
      if ( USE_DB ) {
        let result = await super.findBy(fields)
        return result ? new Entity(result) : null;
      } else {

        return Promise.resolve( FileContent.find( (r) => {
          return r.FS.title.toLowerCase() == fields[this.Columns.Title].toLowerCase()  &&  r.FS.year == fields[this.Columns.Year];
        }) );

      }
    }

    async save() {
      if ( USE_DB ) {
        return new Promise( (resolve, reject) => {
          this.FS = JSON.stringify(this.FSTree);
          this.model.save( (err) => {
            if ( err ) {
              reject( err );
            } else {
              resolve(this);
            }
          });
        });
      } else {
        let d = this.toJSON();

        let fd = FS.openSync( Path.join(Config.DATADIR, `${scopeLibrary}-scraper.txt`), 'a' );
        FS.writeSync(fd, JSON.stringify(d) + '\n' );
        FS.closeSync(fd);

        d.FS = this.FSTree;
        FileContent.push( d );
        return Promise.resolve(this);
      }
    }

    toJSON(key, req) {
      let json = super.toJSON();

      json.FS = JSON.stringify(this.FSTree);

      return json;
    }


  }

  return Entity;
}

module.exports = createEntity;
