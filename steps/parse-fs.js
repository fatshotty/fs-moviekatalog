const {Config} = require('../utils');
const Job = require('../job');
const Path = require('path');
const FS = require('fs');
const Mime = require('mime');
const ReadLine = require('readline');



class ParseRootFS extends Job {

  constructor(SCOPE) {
    super(SCOPE);
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

        resolve();

      });


    })

  }



}



class ParseSubfoldersFS extends Job {

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


  async execute({title, year, basepath, folder}) {


    // if ( FS.existsSync( Path.join(Config.DATADIR, `${this.name}.txt`) ) ) {
    //   this.Log.warn(`${this.JobName} !!!!!! PROCESSING IN FILE !!!!!!!`);
    //   return this.loopfile();
    // }

    return new Promise( async (resolve, reject) => {

      let objReturn = {title, year};

      let has_been_updated = await this.loopSubFolder(objReturn, basepath, folder );
      if ( ! has_been_updated ) {
        this.Log.debug(`${this.JobName} ${folder} has not been updated - SKIP!`);
        return resolve();
      }

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

      this.writeFile(objReturn);

      this.emit('entry', objReturn);

      process.nextTick( resolve );

    });


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
            size: stat.size
          });
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
