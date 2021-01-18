const CreateEntity = require('./entity');

const FILES = ['docu-movie','docu-serie', 'movies', 'tvprograms', 'tvshows', 'videos', 'videoscoll'];

const Models = {};
for ( let key of FILES ) {
  Models[ key ] = CreateEntity(key);
}

Models.FILES = FILES;

module.exports = Models;
