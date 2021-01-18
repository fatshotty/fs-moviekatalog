const Mongoose = require('mongoose');
const {createLog, Config} = require('../utils');

const Log = createLog();

const USE_DB = !!Config.DATABASE;

if ( USE_DB ) {

  require('./connection');

  Log.info('loading models')

  const {EntityS} = require('./schemas');

  const EntityM = Mongoose.model('Entity', EntityS);

  module.exports = {
    EntityM
  };
}
