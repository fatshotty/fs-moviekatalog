// Path.parse( Path.relative('/Users/fatshotty/Desktop/jottacrypted/media', '/Users/fatshotty/Desktop/jottacrypted/media/movies/Pippuzzo (2019)') )

const {Config, createLog, saveConfig} = require('./utils');
const Path = require('path');
const {ParseSubfoldersFS, ParseRootFS} = require('./steps/parse-fs');
const DiffDB = require('./steps/diff-db');
const ScraperDB = require('./steps/scraper');
const CreateEntry = require('./steps/createentry');
const RemoveEntry = require('./steps/removeentry');

const Log = createLog();

const FOLDER = process.argv[2]

if ( !FOLDER ) {
  throw new Error(`Specify folder. eg: /mnt/shared/fusemount/redprimerose/media/movies`);
  process.exit(1);
}


let relative = Path.relative( Config.BASE_PATH, FOLDER );
let parsed = Path.parse( relative );



let ScopePath = parsed.dir;
let Folder = parsed.base;


console.log(`Start process for: '${ScopePath}' and ${Folder}`);


let Scope = Config.FOLDERS.find( f => f.Path == Folder );

if (!Scope) {
  throw new Error(`cannot find scope for ${Folder}`);
  process.exit(1);
}

let parseRootFs = new ParseRootFS(Scope);
let parsesubfoldersfs = new ParseSubfoldersFS(Scope);
let diffdb = new DiffDB(Scope);
let scraper = new ScraperDB(Scope);
let createEntry = new CreateEntry(Scope);
let removeEntry = new RemoveEntry(Scope);


// parseRootFs.on('folder', (jsonRow) => {
//   process.nextTick( () => parsesubfoldersfs.addToQueue(jsonRow) );
// });

// parseRootFs.on('fileremoved', (filepath) => {
//   removeEntry.addToQueue( filepath );
// });

// parsesubfoldersfs.on('entry', (jsonRow) => {
//   process.nextTick( () => diffdb.addToQueue(jsonRow) );
// })

diffdb.on('newentry', (jsonRow) => {
  process.nextTick( () => scraper.addToQueue( jsonRow ) );
});

diffdb.on('update', (jsonRow) => {
  process.nextTick( () => scraper.addToQueue( jsonRow ) );
});

scraper.on('scraped', (data) => {
  process.nextTick( () => createEntry.addToQueue(data) );
});

scraper.on('update', (data) => {
  process.nextTick( () => createEntry.addToQueue( data ) );
});


let stat = FS.statSync( FOLDER );

if ( ! stat.isDirectory() ) {
  // skip item that is not directory
  throw new Error(`${FOLDER} is not a directory`);
  process.exit(1);
}

Log.info( `[${Scope.name}] found folder ${Folder}` );

let basename = Folder;
let year = basename.match(/\((\d{4})\)$/) ? basename.match(/\((\d{4})\)$/)[1] : 0;
let title = basename.replace(/\((\d{4})\)$/, '');

title = title.trim();
year = year ? parseInt( year.trim(), 10 ) : 0;


let res = {title, year, basepath, folder: Folder};

parsesubfoldersfs.addToQueue(res)
