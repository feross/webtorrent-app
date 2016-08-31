const React = require('react')
const {injectIntl, FormattedMessage} = require('react-intl')

const prettyBytes = require('../../i18n.js').prettyBytes
const TorrentSummary = require('../lib/torrent-summary')
const TorrentPlayer = require('../lib/torrent-player')
const {dispatcher} = require('../lib/dispatcher')

module.exports = injectIntl(class TorrentList extends React.Component {
  render () {
    var state = this.props.state

    var contents = []
    if (state.downloadPathStatus === 'missing') {
      var prefsLink = (<a key='prefsLink' href='#' onClick={dispatcher('preferences')}><FormattedMessage id='preferences' defaultMessage='Preferences' /></a>)
      contents.push(
        <div key='global-missing-path'>
          <p>
            <FormattedMessage id='global-missing-path'
              defaultMessage={
                'Download path missing: {downloadPath}\n' +
                'Check that all drives are connected?\n' +
                'Alternatively, choose a new download path in {prefsLink}'
              }
              values={{
                downloadPath: state.saved.prefs.downloadPath,
                prefsLink: prefsLink
              }}>
              {nl2br}
            </FormattedMessage>
          </p>
        </div>
      )
    }
    var torrentElems = state.saved.torrents.map(
      (torrentSummary) => this.renderTorrent(torrentSummary)
    )
    contents.push(...torrentElems)
    contents.push(
      <div key='torrent-placeholder' className='torrent-placeholder'>
        <FormattedMessage id='torrent-placeholder' className='ellipsis'
          defaultMessage={`Drop a torrent file here or paste a magnet link`} />
      </div>
    )

    return (
      <div key='torrent-list' className='torrent-list'>
        {contents}
      </div>
    )
  }

  renderTorrent (torrentSummary) {
    var state = this.props.state
    var infoHash = torrentSummary.infoHash
    var isSelected = infoHash && state.selectedInfoHash === infoHash

    // Background image: show some nice visuals, like a frame from the movie, if possible
    var style = {}
    if (torrentSummary.posterFileName) {
      var gradient = isSelected
        ? 'linear-gradient(to bottom, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 100%)'
        : 'linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0) 100%)'
      var posterPath = TorrentSummary.getPosterPath(torrentSummary)
      style.backgroundImage = gradient + `, url('${posterPath}')`
    }

    // Foreground: name of the torrent, basic info like size, play button,
    // cast buttons if available, and delete
    var classes = ['torrent']
    //  playStatus turns the play button into a loading spinner or error icon
    if (torrentSummary.playStatus) classes.push(torrentSummary.playStatus)
    if (isSelected) classes.push('selected')
    if (!infoHash) classes.push('disabled')
    if (!torrentSummary.torrentKey) throw new Error('Missing torrentKey')
    return (
      <div
        key={torrentSummary.torrentKey}
        style={style}
        className={classes.join(' ')}
        onContextMenu={infoHash && dispatcher('openTorrentContextMenu', infoHash)}
        onClick={infoHash && dispatcher('toggleSelectTorrent', infoHash)} >
        {this.renderTorrentMetadata(torrentSummary)}
        {infoHash ? this.renderTorrentButtons(torrentSummary) : null}
        {isSelected ? this.renderTorrentDetails(torrentSummary) : null}
      </div>
    )
  }

  // Show name, download status, % complete
  renderTorrentMetadata (torrentSummary) {
    var name = torrentSummary.name || (<FormattedMessage id='torrent-loading' defaultMessage='Loading torrent...'/>)
    var elements = [(
      <div key='name' className='name ellipsis'>{name}</div>
    )]

    // If it's downloading/seeding then show progress info
    var prog = torrentSummary.progress
    if (torrentSummary.error) {
      elements.push(
        <div key='progress-info' className='ellipsis'>
          {getErrorMessage(torrentSummary)}
        </div>
      )
    } else if (torrentSummary.status !== 'paused' && prog) {
      elements.push(
        <div key='progress-info' className='ellipsis'>
          {renderPercentProgress()}
          {renderTotalProgress()}
          {renderPeers()}
          {renderDownloadSpeed()}
          {renderUploadSpeed()}
          {renderEta()}
        </div>
      )
    }

    return (<div key='metadata' className='metadata'>{elements}</div>)

    function renderPercentProgress () {
      var progress = Math.floor(100 * prog.progress)
      return (<span key='percent-progress'>{progress}%</span>)
    }

    function renderTotalProgress () {
      var downloaded = prettyBytes(prog.downloaded)
      var total = prettyBytes(prog.length || 0)
      if (downloaded === total) {
        return (<span key='total-progress'>{downloaded}</span>)
      } else {
        return (<span key='total-progress'>{downloaded} / {total}</span>)
      }
    }

    function renderPeers () {
      if (prog.numPeers === 0) return
      return (<FormattedMessage key='peers' id='torrent-peers'
        defaultMessage={'{numPeers, plural, one {# peer} other {# peers}}'}
        values={{numPeers: prog.numPeers}} />)
    }

    function renderDownloadSpeed () {
      if (prog.downloadSpeed === 0) return
      return (<span key='download'>↓ {prettyBytes(prog.downloadSpeed)}/s</span>)
    }

    function renderUploadSpeed () {
      if (prog.uploadSpeed === 0) return
      return (<span key='upload'>↑ {prettyBytes(prog.uploadSpeed)}/s</span>)
    }

    function renderEta () {
      var downloaded = prog.downloaded
      var total = prog.length || 0
      var missing = total - downloaded
      var downloadSpeed = prog.downloadSpeed
      if (downloadSpeed === 0 || missing === 0) return

      var rawEta = missing / downloadSpeed
      var hours = Math.floor(rawEta / 3600) % 24
      var minutes = Math.floor(rawEta / 60) % 60
      var seconds = Math.floor(rawEta % 60)

      // Only display hours and minutes if they are greater than 0 but always
      // display minutes if hours is being displayed
      var hoursStr = hours ? hours + 'h' : ''
      var minutesStr = (hours || minutes) ? minutes + 'm' : ''
      var secondsStr = seconds + 's'

      return (<FormattedMessage id='torrent-eta'
        defaultMessage={'ETA: {hours} {minutes} {seconds}'}
        values={{
          hours: hoursStr,
          minutes: minutesStr,
          seconds: secondsStr
        }} />)
    }
  }

  // Download button toggles between torrenting (DL/seed) and paused
  // Play button starts streaming the torrent immediately, unpausing if needed
  renderTorrentButtons (torrentSummary) {
    var infoHash = torrentSummary.infoHash

    var playIcon, playTooltip, playClass
    if (torrentSummary.playStatus === 'timeout') {
      playIcon = 'warning'
      playTooltip = this.props.intl.formatMessage({id: 'play-timeout-tooltip', defaultMessage: 'Playback timed out. No seeds? No internet? Click to try again.'})
    } else {
      playIcon = 'play_arrow'
      playTooltip = this.props.intl.formatMessage({id: 'play-streaming-tooltip', defaultMessage: 'Start streaming'})
    }

    var downloadIcon, downloadTooltip
    if (torrentSummary.status === 'seeding') {
      downloadIcon = 'file_upload'
      downloadTooltip = this.props.intl.formatMessage({id: 'download-seeding-tooltip', defaultMessage: 'Seeding. Click to stop.'})
    } else if (torrentSummary.status === 'downloading') {
      downloadIcon = 'file_download'
      downloadTooltip = this.props.intl.formatMessage({id: 'download-torrenting-tooltip', defaultMessage: 'Torrenting. Click to stop.'})
    } else {
      downloadIcon = 'file_download'
      downloadTooltip = this.props.intl.formatMessage({id: 'download-start-tooltip', defaultMessage: 'Click to start torrenting.'})
    }

    // Only show the play/dowload buttons for torrents that contain playable media
    var playButton, downloadButton, positionElem
    if (!torrentSummary.error) {
      downloadButton = (
        <i
          key='download-button'
          className={'button-round icon download ' + torrentSummary.status}
          title={downloadTooltip}
          onClick={dispatcher('toggleTorrent', infoHash)}
        >
          {downloadIcon}
        </i>
      )

      // Do we have a saved position? Show it using a radial progress bar on top
      // of the play button, unless already showing a spinner there:
      var willShowSpinner = torrentSummary.playStatus === 'requested'
      var defaultFile = torrentSummary.files &&
        torrentSummary.files[torrentSummary.defaultPlayFileIndex]
      if (defaultFile && defaultFile.currentTime && !willShowSpinner) {
        var fraction = defaultFile.currentTime / defaultFile.duration
        positionElem = this.renderRadialProgressBar(fraction, 'radial-progress-large')
        playClass = 'resume-position'
      }

      if (TorrentPlayer.isPlayableTorrentSummary(torrentSummary)) {
        playButton = (
          <i
            key='play-button'
            title={playTooltip}
            className={'button-round icon play ' + playClass}
            onClick={dispatcher('playFile', infoHash)}
          >
            {playIcon}
          </i>
        )
      }
    }

    return (
      <div key='buttons' className='buttons'>
        {positionElem}
        {playButton}
        {downloadButton}
        <i
          key='delete-button'
          className='icon delete'
          title={this.props.intl.formatMessage({id: 'delete-tooltip', defaultMessage: 'Remove torrent'})}
          onClick={dispatcher('confirmDeleteTorrent', infoHash, false)}>
          close
        </i>
      </div>
    )
  }

  // Show files, per-file download status and play buttons, and so on
  renderTorrentDetails (torrentSummary) {
    var filesElement
    if (torrentSummary.error || !torrentSummary.files) {
      var message = ''
      if (torrentSummary.error === 'path-missing') {
        // Special case error: this torrent's download dir or file is missing
        message = (<FormattedMessage id='torrent-missing-path'
          defaultMessage={'Missing path: {path}'}
          values={{path: TorrentSummary.getFileOrFolder(torrentSummary)}}/>)
      } else if (torrentSummary.error) {
        // General error for this torrent: just show the message
        message = torrentSummary.error.message || torrentSummary.error
      } else if (torrentSummary.status === 'paused') {
        // No file info, no infohash, and we're not trying to download from the DHT
        message = (<FormattedMessage id='torrent-info-failed'
          defaultMessage={'Failed to load torrent info. Click the download button to try again...'}/>)
      } else {
        // No file info, no infohash, trying to load from the DHT
        message = (<FormattedMessage id='torrent-info-downloading'
          defaultMessage={'Downloading torrent info...'}/>)
      }
      filesElement = (
        <div key='files' className='files warning'>
          {message}
        </div>
      )
    } else {
      // We do know the files. List them and show download stats for each one
      var fileRows = torrentSummary.files
        .filter((file) => !file.path.includes('/.____padding_file/'))
        .map((file, index) => ({ file, index }))
        .sort(function (a, b) {
          if (a.file.name < b.file.name) return -1
          if (b.file.name < a.file.name) return 1
          return 0
        })
        .map((object) => this.renderFileRow(torrentSummary, object.file, object.index))

      filesElement = (
        <div key='files' className='files'>
          <table>
            <tbody>
              {fileRows}
            </tbody>
          </table>
        </div>
      )
    }

    return (
      <div key='details' className='torrent-details'>
        {filesElement}
      </div>
    )
  }

  // Show a single torrentSummary file in the details view for a single torrent
  renderFileRow (torrentSummary, file, index) {
    // First, find out how much of the file we've downloaded
    // Are we even torrenting it?
    var isSelected = torrentSummary.selections && torrentSummary.selections[index]
    var isDone = false // Are we finished torrenting it?
    var progress = ''
    if (torrentSummary.progress && torrentSummary.progress.files &&
        torrentSummary.progress.files[index]) {
      var fileProg = torrentSummary.progress.files[index]
      isDone = fileProg.numPiecesPresent === fileProg.numPieces
      progress = Math.round(100 * fileProg.numPiecesPresent / fileProg.numPieces) + '%'
    }

    // Second, for media files where we saved our position, show how far we got
    var positionElem
    if (file.currentTime) {
      // Radial progress bar. 0% = start from 0:00, 270% = 3/4 of the way thru
      positionElem = this.renderRadialProgressBar(file.currentTime / file.duration)
    }

    // Finally, render the file as a table row
    var isPlayable = TorrentPlayer.isPlayable(file)
    var infoHash = torrentSummary.infoHash
    var icon
    var handleClick
    if (isPlayable) {
      icon = 'play_arrow' /* playable? add option to play */
      handleClick = dispatcher('playFile', infoHash, index)
    } else {
      icon = 'description' /* file icon, opens in OS default app */
      handleClick = isDone
        ? dispatcher('openItem', infoHash, index)
        : (e) => e.stopPropagation() // noop if file is not ready
    }
    // TODO: add a css 'disabled' class to indicate that a file cannot be opened/streamed
    var rowClass = ''
    if (!isSelected) rowClass = 'disabled' // File deselected, not being torrented
    if (!isDone && !isPlayable) rowClass = 'disabled' // Can't open yet, can't stream
    return (
      <tr key={index} onClick={handleClick}>
        <td className={'col-icon ' + rowClass}>
          {positionElem}
          <i className='icon'>{icon}</i>
        </td>
        <td className={'col-name ' + rowClass}>
          {file.name}
        </td>
        <td className={'col-progress ' + rowClass}>
          {isSelected ? progress : ''}
        </td>
        <td className={'col-size ' + rowClass}>
          {prettyBytes(file.length)}
        </td>
        <td className='col-select'
          onClick={dispatcher('toggleTorrentFile', infoHash, index)}>
          <i className='icon'>{isSelected ? 'close' : 'add'}</i>
        </td>
      </tr>
    )
  }

  renderRadialProgressBar (fraction, cssClass) {
    var rotation = 360 * fraction
    var transformFill = {transform: 'rotate(' + (rotation / 2) + 'deg)'}
    var transformFix = {transform: 'rotate(' + rotation + 'deg)'}

    return (
      <div key='radial-progress' className={'radial-progress ' + cssClass}>
        <div key='circle' className='circle'>
          <div key='mask-full' className='mask full' style={transformFill}>
            <div key='fill' className='fill' style={transformFill} />
          </div>
          <div key='mask-half' className='mask half'>
            <div key='fill' className='fill' style={transformFill} />
            <div key='fill-fix' className='fill fix' style={transformFix} />
          </div>
        </div>
        <div key='inset' className='inset' />
      </div>
    )
  }
})

function getErrorMessage (torrentSummary) {
  var err = torrentSummary.error
  if (err === 'path-missing') {
    return (
      <FormattedMessage id='torrent-error-path-missing'
        defaultMessage={`
          Path missing.
          Fix and restart the app, or delete the torrent.
        `}>
        {nl2br}
      </FormattedMessage>
    )
  }
  return (<FormattedMessage id='error'
    defaultMessage='Error' />)
}

function nl2br (...nodes) {
  const children = nodes.reduce(function (result, node) {
    if (typeof node === 'string') {
      var tokens = node.split('\n')
      for (var i = 0; i < tokens.length; i++) {
        result = result.concat(tokens[i])
        if (i < tokens.length - 1) {
          result = result.concat(<br/>)
        }
      }
    } else {
      result = result.concat(node)
    }

    return result
  }, [])

  return <span>{children}</span>
}
