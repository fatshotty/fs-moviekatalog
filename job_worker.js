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


function startProcess({folder}) {

  process.nextTick( () => {
    // console.log(`starting new thread for ${folder} ---`);
    jobSteps(folder);
    // console.log('ciao');
  });
}


let parseRootFs = null;
let parsesubfoldersfs = null;
let diffdb =null;
let scraper = null;
let createEntry = null;



function jobSteps(folder) {
  let SCOPE = Config.Folders.filter(f => f.Path == folder)[0];

  if ( ! parseRootFs ) {
    parseRootFs = new ParseRootFS(SCOPE);
    parseRootFs.on('folder', (jsonRow) => {
      // console.log(`${folder} - found new folder`);
      process.nextTick( () => parsesubfoldersfs.addToQueue(jsonRow) );
    });
  }
  if ( ! parsesubfoldersfs ) {
    parsesubfoldersfs = new ParseSubfoldersFS(SCOPE);
    parsesubfoldersfs.on('entry', (jsonRow) => {
      // console.log(`${folder} - subfolders`);
      process.nextTick( () => diffdb.addToQueue(jsonRow) );
    })
  }
  if ( ! diffdb ) {
    diffdb = new DiffDB(SCOPE);
    diffdb.on('newentry', (jsonRow) => {
      // console.log(`${folder} - newentry`);
      process.nextTick( () => scraper.addToQueue( jsonRow ) );
    });

    diffdb.on('update', (jsonRow) => {
      // console.log(`${folder} - update`);
      // scraper.addToQueue( data );
      process.nextTick( () => scraper.addToQueue( jsonRow ) );
    });
  }
  if ( ! scraper ) {
    scraper = new ScraperDB(SCOPE);
    scraper.on('scraped', (data) => {
      // console.log(`${folder} - scraped`);
      // {fs: data, scraped: null}
      process.nextTick( () => createEntry.addToQueue(data) );
    });

    scraper.on('update', (data) => {
      // console.log(`${folder} - scraper-update`);
      // scraper.addToQueue( jsonRow );
      process.nextTick( () => createEntry.addToQueue( data ) );
    });
  }

  if ( ! createEntry ) {
    createEntry = new CreateEntry(SCOPE);
  }


  parseRootFs.restart();
  parsesubfoldersfs.restart();
  diffdb.restart();
  scraper.restart();
  createEntry.restart();


  // createEntry.on('queue-empty', () => {
  //   SCOPE.lastScan = Date.now();
  //   saveConfig();
  // });

  // parseRootFs.addToQueue(  Path.join(Config.BASE_PATH, folder)  );
  parsesubfoldersfs.addToQueue(  Path.join(Config.BASE_PATH, folder)  );


}




module.exports = startProcess;
