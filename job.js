const {Config} = require('./utils');
const Path = require('path');
const FS = require('fs');
const EventEmitter = require('events');

class Job extends EventEmitter {

  get JobName() {
    return `[${this.name}]`;
  }

  constructor(name){
    super();
    this.name = name;
    this.FREE = true;
    this.queue = [];
    this.HasError = false;
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
      if ( !this.HasError ) {
        this.emit('queue-empty');
      }
      this.FREE = true;
      return;
    }
    this.FREE = false;
    this.execute(data).then( () => {
      this.next();
    }).catch( this.onError.bind(this) );
  }



  onError(err) {
    this.HasError = true;
    this.Log.error(`${this.JobName} ERROR: ${err && err.message}`);
    this.next();
  }

  execute(data){}

  restart(){
    this.FREE = true;
    this.HasError = false;
  }

}



module.exports = Job;
