const {Config, createLog} = require('../utils');
const Job = require('../job');
const Path = require('path');
const FS = require('fs');
const Mime = require('mime');
const ReadLine = require('readline');



class ParseFS extends Job {

  constructor(SCOPE) {
    super(`${SCOPE.Scope}-fs`);
    this._scope = SCOPE;
    this.Log = createLog(SCOPE.Scope);
  }

  loopfile() {

    const rl = ReadLine.createInterface({
      input: FS.createReadStream(  Path.join(Config.CWD, `${this.name}.txt`)  ),
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      if ( !line ) return;
      line = JSON.parse(line);
      this.Log.info(`${this.JobName} found folder ${line.title} (${line.year})`);
      this.emit('folder', line );
    });

    return Promise.resolve();
  }


  execute(basepath) {

    if ( FS.existsSync( Path.join(Config.CWD, `${this.name}.txt`) ) ) {
      this.Log.warn(`${this.JobName} !!!!!! PROCESSING IN FILE !!!!!!!`);
      return this.loopfile();
    }

    let files = FS.readdirSync( basepath );

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

      let fullpath = Path.join( basepath, file );

      let res = {title, year};
      let has_been_updated = this.loopSubFolder( res, basepath, Path.relative(basepath, fullpath) );


      if ( ! has_been_updated ) {
        this.Log.info(`${this.JobName} ${file} has not been updated - SKIP!`);
        continue;
      }

      this.writeFile(res);

      this.emit('folder', res);

    }

    this.emit('scanned', Date.now() );

    return Promise.resolve();
  }


  loopSubFolder(res, basepath, folderpath) {

    let has_been_updated = false;

    let fullFolderPath = Path.join(basepath, folderpath);

    let dircontent = FS.readdirSync(fullFolderPath);

    let mediafiles = [];
    let subfolders = [];

    for ( let content of dircontent ) {
      let fullpath = Path.join(fullFolderPath, content);
      let stat = FS.statSync( fullpath );

      if ( stat.isDirectory() ) {
        let subf = {name: content};

        let _sub_folder_updated = this.loopSubFolder( subf, basepath, Path.relative(basepath, fullpath)  );

        has_been_updated = has_been_updated || _sub_folder_updated;

        subfolders.push( subf );

      } else if ( stat.isFile() ) {

        if ( stat.mtimeMs > this._scope.lastScan ) {
          has_been_updated = true;
        }

        let mime = Mime.getType(content);
        if ( mime.startsWith( this._scope.Mime ) ) {
          mediafiles.push({
            name: Path.basename(fullpath),
            file: Path.join('/', Path.relative( Path.join(basepath, '../'), fullpath ) ),
            size: stat.size
          });
        }

      }

    }

    this.Log.info( `${this.JobName} found ${mediafiles.length} mediafiles and ${subfolders.length} folders in ${folderpath}` );

    res = Object.assign(res, {mediafiles, subfolders});

    return has_been_updated;
  }


  writeFile(res) {
    let fd = FS.openSync( Path.join(Config.CWD, `${this.name}.txt`), 'a' );
    FS.writeSync(fd, JSON.stringify(res) + '\n' );
    FS.closeSync(fd);
  }

}

module.exports = ParseFS;
