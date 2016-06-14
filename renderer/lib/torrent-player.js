module.exports = {
  isPlayable,
  isVideo,
  isAudio,
  isPlayableTorrent,
  nextIndex,
  prevIndex
}

var path = require('path')

/**
 * Determines whether a file in a torrent is audio/video we can play
 */
function isPlayable (file) {
  return isVideo(file) || isAudio(file)
}

function isVideo (file) {
  var ext = path.extname(file.name).toLowerCase()
  return [
    '.avi',
    '.m4v',
    '.mkv',
    '.mov',
    '.mp4',
    '.mpg',
    '.ogv',
    '.webm'
  ].includes(ext)
}

function isAudio (file) {
  var ext = path.extname(file.name).toLowerCase()
  return [
    '.aac',
    '.ac3',
    '.mp3',
    '.ogg',
    '.wav'
  ].includes(ext)
}

function isPlayableTorrent (torrentSummary) {
  return torrentSummary.files && torrentSummary.files.some(isPlayable)
}

function nextIndex (torrentSummary, index) {
  var diff = 1 + torrentSummary.files.slice(index + 1).map(isPlayable).indexOf(true)
  return diff > 0 ? index + diff : null
}

function prevIndex (torrentSummary, index) {
  var diff = 1 + torrentSummary.files.slice(0, index).reverse().map(isPlayable).indexOf(true)
  return diff > 0 ? index - diff : null
}
