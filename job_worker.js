const {Config, createLog, saveConfig} = require('./utils');
const Path = require('path');
const Worker /* {parentPort, workerData, MessageChannel, isMainThread} */  = require('worker_threads');
const {ParseSubfoldersFS, ParseRootFS} = require('./steps/parse-fs');
const DiffDB = require('./steps/diff-db');
const ScraperDB = require('./steps/scraper');
const CreateEntry = require('./steps/createentry');
const RemoveEntry = require('./steps/removeentry');


const CronJob = require('cron').CronJob;


const Log = createLog();

if ( Config.USE_THREAD ) {
  Worker.parentPort.on('message', startProcess);
}


process.on('uncaughtException', (err, origin) => {
  Log.error(`[ERROR] Worker ${err} - ${origin}`);
  Log.error(`[ERROR] Worker ${err && JSON.stringify(err.stack, null, 2)}`);
});


function startProcess(scopeName) {
  let _scope = Config.Folders.find( s => s.Name == scopeName );
  let ex = new Executor(_scope);
  ex.execute();
}


class Executor {

  constructor(SCOPE) {
    this._scope = SCOPE;

    this.parseRootFs = new ParseRootFS(SCOPE);
    this.parsesubfoldersfs = new ParseSubfoldersFS(SCOPE);
    this.diffdb = new DiffDB(SCOPE);
    this.scraper = new ScraperDB(SCOPE);
    this.createEntry = new CreateEntry(SCOPE);
    this.removeEntry = new RemoveEntry(SCOPE);

    this.init();

    this.Log = createLog(SCOPE.Name);

    this.Log.warn(`[${this._scope.Name}] scheduled at ${SCOPE.Schedule}`);

    this.Job = new CronJob(
      SCOPE.Schedule,
      this._execute.bind(this),
      null,
      false,
      'Europe/Rome'
    );

    this.Job.start();
  }


  init() {
    this.parseRootFs.on('folder', (jsonRow) => {
      process.nextTick( () => this.parsesubfoldersfs.addToQueue(jsonRow) );
    });

    this.parseRootFs.on('fileremoved', (filepath) => {
      this.removeEntry.addToQueue( filepath );
    });

    this.parsesubfoldersfs.on('entry', (jsonRow) => {
      process.nextTick( () => this.diffdb.addToQueue(jsonRow) );
    })

    this.diffdb.on('newentry', (jsonRow) => {
      process.nextTick( () => this.scraper.addToQueue( jsonRow ) );
    });

    this.diffdb.on('update', (jsonRow) => {
      process.nextTick( () => this.scraper.addToQueue( jsonRow ) );
    });

    this.scraper.on('scraped', (data) => {
      process.nextTick( () => this.createEntry.addToQueue(data) );
    });

    this.scraper.on('update', (data) => {
      process.nextTick( () => this.createEntry.addToQueue( data ) );
    });


    let tmr = null;
    this.createEntry.on('queue-empty', () => {
      // Log.info(`${this._scope.Name} queue empty, wait for dalay`);
      clearTimeout( tmr );
      tmr = setTimeout( () => {
        let ts = this.parsesubfoldersfs.LastScan;
        Log.info(`[${this._scope.Name}] NEW TIMESTAMP: ${ts}`);
        this.parseRootFs.LastScan = ts;
      }, 10 * 60 * 1000); // 10 min
    })
  }


  _execute() {
    this.Log.warn(`[${this._scope.Name}] *** executing next tick on ${ new Date() } ***`)

    let ts = this.parsesubfoldersfs.LastScan;
    this._scope.lastScan = ts;

    // this.parseRootFs.watch(  Path.join(Config.BASE_PATH, this._scope.Path)   );

    Worker.parentPort.postMessage({action: 'update-ts', timestamp: ts});

    this.execute();
  }


  execute() {
    this.parseRootFs.addToQueue(  Path.join(Config.BASE_PATH, this._scope.Path)  );
  }

}


module.exports = startProcess;
