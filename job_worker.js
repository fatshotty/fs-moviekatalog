const {Config, createLog, saveConfig} = require('./utils');
const Path = require('path');
const Worker /* {parentPort, workerData, MessageChannel} */  = require('worker_threads');
const ParseFS = require('./steps/parse-fs');
const DiffDB = require('./steps/diff-db');
const ScraperDB = require('./steps/scraper');
const CreateEntry = require('./steps/createentry');
const UpdateEntry = require('./steps/updateentry');

const Log = createLog();
// Worker.parentPort.on('message', startProcess);


function startProcess({folder}) {

  Log.info(`starting new thread for ${folder}`);

  process.nextTick( () => {
    jobSteps(folder);
  });
}



function jobSteps(folder) {

  let SCOPE = Config.Folders.filter(f => f.Scope == folder)[0];

  let parseFs = new ParseFS(SCOPE);
  let diffdb = new DiffDB(SCOPE);
  let scraper = new ScraperDB(SCOPE);
  let createEntry = new CreateEntry(SCOPE);
  let updateentry = new UpdateEntry(SCOPE);

  parseFs.on('folder', (jsonRow) => {
    diffdb.addToQueue(jsonRow);
  });

  diffdb.on('newentry', (jsonRow) => {
    scraper.addToQueue( jsonRow );
  });

  diffdb.on('update', (data) => {
    // scraper.addToQueue( data );
    updateentry.addToQueue( data );
  });

  scraper.on('scraped', (data) => {
    // {fs: data, scraped: null}
    createEntry.addToQueue(data);
  });

  scraper.on('update', (data) => {
    // scraper.addToQueue( jsonRow );
    updateentry.addToQueue( data );
  });


  parseFs.on('scanned', (ts) => {
    SCOPE.lastScan = ts;
    saveConfig();
  });

  parseFs.addToQueue(  Path.join(Config.BASE_PATH, folder)  );

}




module.exports = startProcess;
