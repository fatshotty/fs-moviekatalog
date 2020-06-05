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
      process.nextTick( () => {
        for ( let i = 0; i < Config.NUM_JOB; i++ ) {
          this.next();
        }
      });
      this.FREE = false;
    }
  }

  next() {
    let data = this.queue.shift();
    if ( !data ) {
      // TODO: queue completed
      this.FREE = true;
      return;
    }
    this.FREE = false;
    this.execute(data).then( () => {
      this.next();
    });
  }


  execute(data){}


}



module.exports = Job;
