const {Config} = require('../utils');
const Job = require('../job');
const Path = require('path');
const FS = require('fs');
const Mime = require('mime');
const ReadLine = require('readline');
const Chokidar = require('chokidar');



class ParseRootFS extends Job {

  get JobName() {
    return `[${this.name}-rootfs]`;
  }

  get LastScan() {
    return this._lastTS;
  }

  set LastScan(v) {
    this.Log.info(`${this.JobName} update timestamp to ${v}`);
    this._lastTS = v;
  }

  constructor(SCOPE) {
    super(SCOPE);
    this.Watcher = null;

    this._lastTS = SCOPE.lastScan;

    this.parseSubfoldersFS = new ParseSubfoldersFS(SCOPE);
  }

  execute(basepath) {

    return new Promise( (resolve, reject) => {
      FS.readdir( basepath, (err, files ) => {
        if ( err ) return reject(err);

        for ( let file of files ) {
          let stat = FS.statSync( Path.join(basepath, file) );

          if ( ! stat.isDirectory() ) {
            // skip item that is not directory
            continue;
          }

          this.Log.info( `${this.JobName} found folder ${file}` );

          let basename = file;
          let year = basename.match(/\((\d{4})\)$/) ? basename.match(/\((\d{4})\)$/)[1] : 0;
          let title = basename.replace(/\((\d{4})\)$/, '');

          title = title.trim();
          year = year ? parseInt( year.trim(), 10 ) : 0;


          let res = {title, year, basepath, folder: file};

          this.emit('folder', res);

        }


        // this.watch(basepath);

        resolve();

      });


    })

  }


  watch(basepath) {
    let p = Promise.resolve();
    if ( this.Watcher ) {
      p = this.Watcher.close().then( () => {
        this.Log.info(`${this.JobName} watcher has been stopped`);
      });
    }

    p.then( () => {
      this.Log.info(`${this.JobName} restart watcher on ${this._scope.Path}`);

      this.Watcher = Chokidar.watch( basepath , {
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 5000,
          pollInterval: 1000
        }
      });

      let DATA = {};
      let tmr = null;

      this.Watcher.on('ready', () => {
        this.Log.info(`${this.JobName} watcher is ready to watch`);
        this.Watcher
          .on('add', (path) => {
            let stat = FS.statSync(path);
            if ( stat.mtimeMs <= this.LastScan ) {
              // file has been renamed
              this.Log.info(`${this.JobName} watcher: file has been renamed: ${path}`);
              this.parsePath(basepath, path, DATA);

              clearTimeout(tmr);
              tmr = setTimeout( () => {
                let values = Object.values(DATA);
                this.Log.info(`${this.JobName} watcher: fire ${values.length} events for folder in 'filerenamed'`);
                DATA = {};
                for ( let v of values ) {
                  this.parseSubfoldersFS.computeObject( v );
                }
              }, 60 * 1000); // 10secs

            } else {
              // file has been added, it will be uploaded with tick of CronJob
            }
          })
          .on('unlink', (path) => {
            let relativePath = Path.join('/', Path.relative( Path.join(basepath, '../'), path ) )
            this.Log.info(`${this.JobName} watcher: file has been removed: ${relativePath}`);

            // TODO: check file into DATA object (in case of double-renaming)

            this.emit('fileremoved', relativePath);
          })
          .on('error', error => console.log(`Watcher error: ${error}`))
      });
    });
  }





  parsePath(basepath, filepath, DATA) {

    let stat = FS.statSync(filepath);

    let relative = Path.relative( basepath, filepath );
    let parsed = Path.parse(relative);

    let dirname = Path.dirname( parsed.dir );
    let basename = Path.basename( parsed.dir );
    if ( dirname == '.' || dirname == Path.sep ) {
      // in case of movies
      dirname = parsed.dir;
      basename = '';
    }

    // extract
    // let basename = file;
    let year = dirname.match(/\((\d{4})\)$/) ? dirname.match(/\((\d{4})\)$/)[1] : 0;
    let title = dirname.replace(/\((\d{4})\)$/, '');

    title = title.trim();
    year = year ? parseInt( year.trim(), 10 ) : 0;

    let res = null;

    if ( dirname in DATA ) {
      res = DATA[ dirname ];
    } else {
      res = DATA[dirname] = {title, year, subfolders: [], mediafiles: []};
    }

    if ( basename ) {
      let subfolder = res.subfolders.find( s => s.name.toLowerCase() == basename.toLowerCase() );
      if ( !subfolder ) {
        subfolder = {
          name: basename,
          mediafiles: [],
          subfolders: []
        };
        res.subfolders.push( subfolder );
      }
      subfolder.mediafiles.push({
        name: parsed.base,
        file: Path.join('/', Path.relative( Path.join(folder, '../'), filepath ) ),
        size: stat.size,
        ts: stat.mtimeMs
      });
    } else {
      res.mediafiles.push({
        name: parsed.base,
        file: Path.join('/', Path.relative( Path.join(folder, '../'), filepath ) ),
        size: stat.size,
        ts: stat.mtimeMs
      });
    }

  }



}



class ParseSubfoldersFS extends Job {

  get JobName() {
    return `[${this.name}-subfs]`;
  }

  get LastScan() {
    return this._lastTS;
  }

  constructor(SCOPE) {
    super(SCOPE);

    this._lastTS = this._scope.lastScan || 0;

  }

  loopfile() {

    const rl = ReadLine.createInterface({
      input: FS.createReadStream(  Path.join(Config.DATADIR, `${this.name}.txt`)  ),
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      if ( !line ) return;
      line = JSON.parse(line);
      this.Log.info(`${this.JobName} found folder ${line.title} (${line.year})`);
      this.emit('entry', line );
    });

    return Promise.resolve();
  }


  execute({title, year, basepath, folder}) {


    return new Promise( async (resolve, reject) => {

      let objReturn = {title, year};

      let has_been_updated = await this.loopSubFolder(objReturn, basepath, folder );
      if ( ! has_been_updated ) {
        this.Log.info(`${this.JobName} ${folder} is not changed since lastScan!`);
        return resolve();
      }

      this.computeObject(objReturn, folder);

      process.nextTick( resolve );

    });


  }


  computeObject(objReturn, folder) {
    if ( this._scope.ForceSubfolder ) {
      let subfolder = this._scope.ForceSubfolder;
      if ( objReturn.mediafiles.length > 0 ) {
        objReturn.subfolders.push({
          name: subfolder,
          mediafiles: objReturn.mediafiles.splice(0),
          subfolders: []
        });
      }
    }

    this.Log.info( `${this.JobName} found [${objReturn.subfolders.length} subfolders] and [${objReturn.mediafiles.length} mediafiles] in ${folder}` );

    // this.writeFile(objReturn);

    this.emit('entry', objReturn);
  }


  async loopSubFolder(res, basepath, folderpath) {

    let has_been_updated = false;

    let fullFolderPath = Path.join(basepath, folderpath);


    let dircontent =  await FS.promises.readdir(fullFolderPath); //, (err, dircontent) => {

    let subfolders = [];
    let mediafiles = [];

    for ( let content of dircontent ) {
      let fullpath = Path.join(fullFolderPath, content);
      let stat = FS.statSync( fullpath );

      if ( stat.isDirectory() ) {
        let subf = {name: content};

        let _sub_folder_updated = await this.loopSubFolder( subf, basepath, Path.relative(basepath, fullpath)  );

        has_been_updated = has_been_updated || _sub_folder_updated;

        subfolders.push( subf );

      } else if ( stat.isFile() ) {

        let mime = Mime.getType(content);
        if ( mime && mime.startsWith( this._scope.Mime ) ) {

          if ( stat.mtimeMs > this._scope.lastScan ) {
            has_been_updated = true;
          }

          mediafiles.push({
            name: Path.basename(fullpath),
            file: Path.join('/', Path.relative( Path.join(basepath, '../'), fullpath ) ),
            size: stat.size,
            ts: stat.mtimeMs
          });


          this._lastTS = Math.max(this._lastTS, stat.mtimeMs);

        }

      }

    }

    res = Object.assign(res, {mediafiles, subfolders});

    return has_been_updated;

  }


  writeFile(res) {
    let fd = FS.openSync( Path.join(Config.DATADIR, `${this.name}.txt`), 'a' );
    FS.writeSync(fd, JSON.stringify(res) + '\n' );
    FS.closeSync(fd);
  }


}


module.exports = {ParseRootFS, ParseSubfoldersFS};
