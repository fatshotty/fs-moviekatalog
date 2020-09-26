const {Config, createLog} = require('./utils');
const Path = require('path');
const FS = require('fs');
const EventEmitter = require('events');

class Job extends EventEmitter {

  get JobName() {
    return `[${this.name}]`;
  }

  constructor(SCOPE){
    super();
    this.name = SCOPE.Name;
    this.FREE = true;
    this.queue = [];
    this.HasError = false;
    this._scope = SCOPE;
    this.Log = createLog(SCOPE.Name);
  }


  addToQueue(data) {
    this.queue.push(data);
    if ( this.FREE ) {
      this.next();
    }
  }

  next() {
    let data = this.queue.shift();
    if ( !data ) {
      // this.Log.info(`${this.JobName} queue is completed ${this.HasError ? 'NOT OK' : 'ok'}`);
      this.emit('queue-empty');
      this.FREE = true;
      return;
    }
    this.FREE = false;
    this.execute(data).then( () => {
      this.next();
    }).catch( this.onError.bind(this) )
  }



  onError(err) {
    this.HasError = true;
    this.Log.error(`${this.JobName} ERROR: ${JSON.stringify(err)}`);
    if ( err && err.stack) {
      this.Log.error(`${this.JobName} ${JSON.stringify(err.stack, null, 2)}`);
    } else {
      console.trace();
    }
    this.next();
  }

  execute(data){}

}



module.exports = Job;
