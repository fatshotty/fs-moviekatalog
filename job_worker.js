const {Config, createLog, saveConfig} = require('./utils');
const Path = require('path');
const Worker /* {parentPort, workerData, MessageChannel} */  = require('worker_threads');
const {ParseSubfoldersFS, ParseRootFS} = require('./steps/parse-fs');
const DiffDB = require('./steps/diff-db');
const ScraperDB = require('./steps/scraper');
const CreateEntry = require('./steps/createentry');
const UpdateEntry = require('./steps/updateentry');

const Log = createLog();
Worker.parentPort.on('message', startProcess);


function startProcess({folder}) {

  process.nextTick( () => {
    // console.log(`starting new thread for ${folder} ---`);
    jobSteps(folder);
    // console.log('ciao');
  });
}



function jobSteps(folder) {
  let SCOPE = Config.Folders.filter(f => f.Path == folder)[0];

  let parseRootFs = new ParseRootFS(SCOPE);
  let parsesubfoldersfs = new ParseSubfoldersFS(SCOPE);
  let diffdb = new DiffDB(SCOPE);
  let scraper = new ScraperDB(SCOPE);
  let createEntry = new CreateEntry(SCOPE);
  let updateentry = new UpdateEntry(SCOPE);

  // console.log(3)

  parseRootFs.on('folder', (jsonRow) => {
    // console.log(`${folder} - found new folder`);
    parsesubfoldersfs.addToQueue(jsonRow);
  });

  parsesubfoldersfs.on('entry', (jsonRow) => {
    // console.log(`${folder} - subfolders`);
    diffdb.addToQueue(jsonRow);
  })

  diffdb.on('newentry', (jsonRow) => {
    // console.log(`${folder} - newentry`);
    scraper.addToQueue( jsonRow );
  });

  diffdb.on('update', (data) => {
    // console.log(`${folder} - update`);
    // scraper.addToQueue( data );
    updateentry.addToQueue( data );
  });

  scraper.on('scraped', (data) => {
    // console.log(`${folder} - scraped`);
    // {fs: data, scraped: null}
    createEntry.addToQueue(data);
  });

  scraper.on('update', (data) => {
    // console.log(`${folder} - scraper-update`);
    // scraper.addToQueue( jsonRow );
    updateentry.addToQueue( data );
  });


  // parseRootFs.on('scanned', (ts) => {
  //   SCOPE.lastScan = ts;
  //   saveConfig();
  // });

  // console.log(Path.join(Config.BASE_PATH, folder));

  // parseRootFs.addToQueue(  Path.join(Config.BASE_PATH, folder)  );
  parsesubfoldersfs.addToQueue(  Path.join(Config.BASE_PATH, folder)  );

}




module.exports = startProcess;
