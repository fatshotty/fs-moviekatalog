const {createLog, Config} = require('../utils');
const Mongoose = require('mongoose');


const Log = createLog();

// Configuration.DB.port
const ConnectionString = Config.DATABASE;

Log.info(`connecting to DB: ${ConnectionString}`)

Mongoose.set('useFindAndModify', false);

const Connection = Mongoose.connect( ConnectionString , {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then( () => {
  Log.info('Connection established with DB');
}).catch( (e) => {
  Log.error('Cannot connect to DB');
  Log.error(e);
  process.exit(1);
});
