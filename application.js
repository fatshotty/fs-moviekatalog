const {Config, createLog, saveConfig} = require('./utils');
const TelegramBot = require('./telegram-bot');
const Job = require('./job');
const {Worker} = require('worker_threads');

console.log(`DATA: ${Config.DATADIR}`);

if ( Config.USE_THREAD ) {
  console.log(`!!! USE THREAD !!!`)
}

let startProcess = null;

if (!Config.USE_THREAD) {
  startProcess = require('./job_worker');
}

const Log = createLog();

class JobWorker extends Job {

  constructor(SCOPE) {
    super(SCOPE);

    if (Config.USE_THREAD) {
      this.spawnThread();
    }

    Log.info(`new job configured for ${SCOPE.Name}, time: ${SCOPE.Schedule}`);

  }


  spawnThread(){
    this.Worker = new Worker('./job_worker.js', {stdin: true, stdout: false, stderr: false});

    this.Worker.on('exit', (code) => {
      Log.warn(`${this.JobName} - Worker is exited: ${code}`);
      // this.spawnThread();
      // TODO: send message to Telegram BOT
      TelegramBot.publish(this.JobName, new Error('exited!') );
    });
    this.Worker.on('message', (data) => {
      Log.info(`${this.JobName} Worker - received data ${data.action}`);
      if ( data.action == 'update-ts') {
        Log.info(`${this.JobName} Worker - updating TS to ${data.timestamp}`);
        this._scope.lastScan = data.timestamp;
        saveConfig();
      }
    });
    this.Worker.on('error', (e) => {
      Log.error(`${this.JobName} Worker - ERROR ${e.message}`);
      console.error(`${this.JobName} Worker - ERROR ${e.message}`, e);
      TelegramBot.publish(`${this.JobName} worker error`, e );
    });
  }


  execute(folder) {
    Log.info(`Starting job for ${this._scope.Path}`);
    try {
      if ( Config.USE_THREAD ) {
        this.Worker.postMessage(this._scope.Name);
      } else {
        startProcess(this._scope.Name);
      }
    } catch( e ) {
      Log.error(`${this.JobName} cannot postMessage to worker - ${e.message}`);
      console.error(`${this.JobName} - cannot send to thread: ${e.message}`, e);
      TelegramBot.publish(`${this.JobName} sending message`, e );
    }

    return Promise.resolve();
  }

}


Log.info(`*** starting ${Date.now()} ***`);
Log.info(`folder to process: ${Config.Folders.filter(f => !!f.Enabled).map( f => f.Path).join(', ')}`);



process.on('uncaughtException', (err, origin) => {
  Log.error(`[ERROR] ${err} - ${origin}`);
  Log.error(`[ERROR] ${JSON.stringify(err.stack, null, 2)}`);
});


for ( let scope of Config.Folders ) {

  if ( ! scope.Enabled ) {
    Log.warn(`${scope.Name} is NOT enabled`);
    continue;
  }

  let jobWorker = new JobWorker(scope);
  jobWorker.addToQueue(scope.Path);

}
