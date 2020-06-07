const {Config, createLog} = require('./utils');
const Job = require('./job');
const {Worker} = require('worker_threads');
const startProcess = require('./job_worker');
const CronJob = require('cron').CronJob;

const Log = createLog();



class JobWorker extends Job {

  constructor(name, folder, schedule) {
    super(name);

    this.spawnThread();

    Log.info(`new job for ${folder} at ${schedule}`);

    // this._job = new CronJob(
    //   schedule,                           // schedule
    //   this.execute.bind(this, folder),    // onTick
    //   null,                               // onComplete
    //   true,                               // start
    //   'Europe/Amsterdam',                 // timeZone
    //   null,                               // context
    //   true                                // runOnInit -> execute now
    // );
    this.execute(folder);
  }


  spawnThread(){
    this.Worker = new Worker('./job_worker.js', {stdin: true, stdout: false, stderr: false});

    this.Worker.on('exit', (code) => {
      Log.warn(`${this.JobName} - Worker is exited: ${code}`);
      this.spawnThread();
    });
    this.Worker.on('message', (data) => {
      Log.info(`${this.JobName} Worker - received data ${data}`);
    });
    this.Worker.on('error', (e) => {
      Log.error(`${this.JobName} Worker - ERROR ${e.message}`);
      console.error(`${this.JobName} Worker - ERROR ${e.message}`, e);
    });
  }


  execute(folder) {
    Log.info(`starting job for ${folder}`);
    try {
      // this.Worker.postMessage({folder});
      startProcess({folder});
    } catch( e ) {
      Log.error(`${this.JobName} cannot postMessage to worker - ${e.message}`);
      console.error(`${this.JobName} - cannot send to thread: ${e.message}`, e);
    }

    return Promise.resolve();
  }

}


Log.info(`*** starting ${Date.now()} ***`);
Log.info(`folder to process: ${Config.Folders.map( f => f.Scope).join(', ')}`);


for ( let folder of Config.Folders ) {

  let jobWorker = new JobWorker(folder.Scope, folder.Path, folder.Schedule)

}
