const {Config, createLog, saveConfig} = require('./utils');
const Path = require('path');
const Worker /* {parentPort, workerData, MessageChannel} */  = require('worker_threads');
const {ParseSubfoldersFS, ParseRootFS} = require('./steps/parse-fs');
const DiffDB = require('./steps/diff-db');
const ScraperDB = require('./steps/scraper');
const CreateEntry = require('./steps/createentry');

const Log = createLog();

if ( Config.USE_THREAD ) {
  Worker.parentPort.on('message', startProcess);
}


let Watcher = null;

// awaitWriteFinish: {
//   stabilityThreshold: 5000,
//   pollInterval: 1000
// }


function startProcess(scope) {

  process.nextTick( () => {
    // console.log(`starting new thread for ${folder} ---`);
    jobSteps(scope);
    // console.log('ciao');
  });
}



function jobSteps(SCOPE) {

  let parseRootFs = new ParseRootFS(SCOPE);
  let parsesubfoldersfs = new ParseSubfoldersFS(SCOPE);
  let diffdb = new DiffDB(SCOPE);
  let scraper = new ScraperDB(SCOPE);
  let createEntry = new CreateEntry(SCOPE);


  parseRootFs.on('folder', (jsonRow) => {
    process.nextTick( () => parsesubfoldersfs.addToQueue(jsonRow) );
  });

  parsesubfoldersfs.on('entry', (jsonRow) => {
    process.nextTick( () => diffdb.addToQueue(jsonRow) );
  })

  diffdb.on('newentry', (jsonRow) => {
    process.nextTick( () => scraper.addToQueue( jsonRow ) );
  });

  diffdb.on('update', (jsonRow) => {
    process.nextTick( () => scraper.addToQueue( jsonRow ) );
  });

  scraper.on('scraped', (data) => {
    process.nextTick( () => createEntry.addToQueue(data) );
  });

  scraper.on('update', (data) => {
    process.nextTick( () => createEntry.addToQueue( data ) );
  });

  // createEntry.on('queue-empty', () => {
  //   SCOPE.lastScan = Date.now();
  //   saveConfig();
  // });

  parseRootFs.addToQueue(  Path.join(Config.BASE_PATH, SCOPE.Path)  );
  // parsesubfoldersfs.addToQueue(  Path.join(Config.BASE_PATH, folder)  );

  let p = Promise.resolve();
  if ( Watcher ) {
    p = Watcher.close().then( () => {
      Log.info(`${this.JobName} watcher will be stopped`);
    })
  }


  p.then( () => {
    Log.info(`${this.JobName} restart watcher on ${SCOPE.Path}`);
    Watcher
  });

}




module.exports = startProcess;
