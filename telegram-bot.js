const {Config} = require('./utils');
const Telegram = require('slimbot');

const SlimbotLog = new Telegram(Config.TELEGRAM_LOG_BOT_ID);


let queue = [];
let FREE = true;

function publish(title, error) {
  queue.push({title, error});
  if ( FREE ) send();
  return Promise.resolve();
}


function send() {
  let data = queue.shift();
  if ( !data ) {
    console.log(`[TelgramBot] empty telegram queue, mark as free`);
    return FREE = true;
  }
  FREE = false;
  return sendError(data.title, data.error).then( () => {
    send();
  })
}


function sendError(title, err) {
  return SlimbotLog.sendMessage(Config.TELEGRAM_LOG_CHAT_ID, `[FS-Parser] ${title} - ${err.message}`, {
    parse_mode: "html",
    disable_web_page_preview: false,
    disable_notification: false
  });
}


module.exports = {
  Enabled: Config.TELEGRAM_LOG_BOT_ID && Config.TELEGRAM_LOG_CHAT_ID,
  publish,
  sendError
};
