const Mongoose = require('mongoose');

const {createLog} = require('../utils');

const Log = createLog();

Log.info('loading schemas');

const {EntityColumns} = require('./declarations');

const Schema = Mongoose.Schema;

const TIMESTAMPS = { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: 'version' };

const EntityS = new Schema({

  [EntityColumns.Title]: {type: String, index: true},
  [EntityColumns.Year]: Number,
  [EntityColumns.OfficialID]: {type: String, index: true},
  [EntityColumns.ImdbID]: {type: String, index: true},
  [EntityColumns.tvshow]: {type: Boolean},
  [EntityColumns.movie]: {type: Boolean},
  [EntityColumns.season]: {type: Boolean},
  [EntityColumns.episode]: {type: Boolean},
  [EntityColumns.FS]: {type: String},
  [EntityColumns.ScrapedJson]: {type: String}

}, TIMESTAMPS)




module.exports = {EntityS}
