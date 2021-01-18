const {Config} = require('./utils');
const Models = require('./models/entities');
const FS = require('fs');
const Path = require('path');
const Readline = require('readline');


async function porting() {
  for ( let FILE of Models.FILES ) {
    let originalFile = Path.join(Config.DATADIR, `${FILE}-scraper.txt`);
    let newFile = Path.join(Config.DATADIR, `${FILE}-scraper-tmp.txt`);
    const fileStream = FS.createReadStream( originalFile );

    let fd = FS.openSync( newFile, 'a' );


    const rl = Readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    // Note: we use the crlfDelay option to recognize all instances of CR LF
    // ('\r\n') in input.txt as a single line break.

    for await (const line of rl) {
      // Each line in input.txt will be successively available here as `line`.
      let data = JSON.parse(line);
      let model = new Models[FILE];
      model.Title = data.scraped.Title;
      model.Year = data.scraped.Year;
      model.OfficialID = String(data.scraped.Id);
      model.ImdbID = data.scraped.ImdbData ? data.scraped.ImdbData.imdbid : null;
      model.FSTree = data.fs;

      FS.writeSync(fd, JSON.stringify(model) + '\n' );
    }

    FS.closeSync(fd);

    FS.unlinkSync(originalFile)
    FS.renameSync(newFile, originalFile)

  }
}

porting();
