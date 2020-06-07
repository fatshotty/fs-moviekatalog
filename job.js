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
      this.FREE = true;
      return;
    }
    this.FREE = false;
    this.execute(data).then( () => {
      this.next();
    }).catch( (err) => {
      this.Log.error(`${this.JobName} ERROR in execute: ${err.message}`);
    });
  }


  execute(data){}


}



module.exports = Job;
