const createTorrent = require('create-torrent')
const path = require('path')
const React = require('react')
const {injectIntl, FormattedMessage} = require('react-intl')
const IntlMessageFormat = require('intl-messageformat')

const {dispatch, dispatcher} = require('../lib/dispatcher')
const i18n = require('../../i18n')
const prettyBytes = i18n.prettyBytes

const FlatButton = require('material-ui/FlatButton').default
const RaisedButton = require('material-ui/RaisedButton').default
const TextField = require('material-ui/TextField').default

const CreateTorrentErrorPage = require('../components/create-torrent-error-page')
const Heading = require('../components/Heading')
const ShowMore = require('../components/ShowMore')

class CreateTorrentPage extends React.Component {
  constructor (props) {
    super(props)

    var state = this.props.state
    var info = state.location.current()

    // Preprocess: exclude .DS_Store and other dotfiles
    var files = info.files
      .filter((f) => !f.name.startsWith('.'))
      .map((f) => ({name: f.name, path: f.path, size: f.size}))
    if (files.length === 0) return (<CreateTorrentErrorPage state={state} />)

    // First, extract the base folder that the files are all in
    var pathPrefix = info.folderPath
    if (!pathPrefix) {
      pathPrefix = files.map((x) => x.path).reduce(findCommonPrefix)
      if (!pathPrefix.endsWith('/') && !pathPrefix.endsWith('\\')) {
        pathPrefix = path.dirname(pathPrefix)
      }
    }

    // Sanity check: show the number of files and total size
    var numFiles = files.length
    var totalBytes = files
      .map((f) => f.size)
      .reduce((a, b) => a + b, 0)
    var torrentInfo = new IntlMessageFormat(
      i18n.LOCALE_MESSAGES['torrent-info'] || '{numFiles} files, {totalBytes}')
      .format({
        numFiles: numFiles,
        totalBytes: prettyBytes(totalBytes)
      })

    // Then, use the name of the base folder (or sole file, for a single file torrent)
    // as the default name. Show all files relative to the base folder.
    var defaultName, basePath
    if (files.length === 1) {
      // Single file torrent: /a/b/foo.jpg -> torrent name 'foo.jpg', path '/a/b'
      defaultName = files[0].name
      basePath = pathPrefix
    } else {
      // Multi file torrent: /a/b/{foo, bar}.jpg -> torrent name 'b', path '/a'
      defaultName = path.basename(pathPrefix)
      basePath = path.dirname(pathPrefix)
    }
    var maxFileElems = 100
    var fileElems = files.slice(0, maxFileElems).map(function (file, i) {
      var relativePath = files.length === 0 ? file.name : path.relative(pathPrefix, file.path)
      return (<div key={i}>{relativePath}</div>)
    })
    if (files.length > maxFileElems) {
      fileElems.push(<div key='more'>+ {maxFileElems - files.length} more</div>)
    }
    var trackers = createTorrent.announceList.join('\n')

    this.state = {
      basePath,
      defaultName,
      fileElems,
      torrentInfo,
      trackers
    }
  }

  handleSubmit () {
    var announceList = document.querySelector('.torrent-trackers').value
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== '')
    var isPrivate = document.querySelector('.torrent-is-private').checked
    var comment = document.querySelector('.torrent-comment').value.trim()
    var options = {
      // We can't let the user choose their own name if we want WebTorrent
      // to use the files in place rather than creating a new folder.
      // If we ever want to add support for that:
      // name: document.querySelector('.torrent-name').value
      name: this.state.defaultName,
      path: this.state.basePath,
      files: this.state.files,
      announce: announceList,
      private: isPrivate,
      comment: comment
    }
    dispatch('createTorrent', options)
  }

  render () {
    return (
      <div className='create-torrent'>
        <Heading level={1}>
          <FormattedMessage id='torrent-create-title' defaultMessage='Create torrent {name}'
            values={{
              name: this.state.defaultName
            }} />
        </Heading>
        <div className='torrent-info'>
          {this.state.torrentInfo}
        </div>
        <div className='torrent-attribute'>
          <label>Path:</label>
          <div className='torrent-attribute'>{this.state.pathPrefix}</div>
        </div>
        <ShowMore
          style={{
            marginBottom: 10
          }}
          hideLabel={this.props.intl.formatMessage({id: 'settings-advanced-hide', defaultMessage: 'Hide advanced settings...'})}
          showLabel={this.props.intl.formatMessage({id: 'settings-advanced-show', defaultMessage: 'Show advanced settings...'})}
        >
          <div key='advanced' className='create-torrent-advanced'>
            <div key='private' className='torrent-attribute'>
              <label>><FormattedMessage id='torrent-create-private' defaultMessage='Private:' /></label>
              <input type='checkbox' className='torrent-is-private' value='torrent-is-private' />
            </div>
            <Heading level={2}>><FormattedMessage id='torrent-create-trackers' defaultMessage='Trackers:' /></Heading>
            <TextField
              className='torrent-trackers'
              hintText={this.props.intl.formatMessage({id: 'torrent-create-tracker', defaultMessage: 'Tracker'})}
              multiLine
              rows={2}
              rowsMax={10}
              defaultValue={this.state.trackers}
            />
            <div key='comment' className='torrent-attribute'>
              <label>><FormattedMessage id='torrent-create-comment' defaultMessage='Comment:' /></label>
              <textarea className='torrent-attribute torrent-comment' />
            </div>
            <div key='files' className='torrent-attribute'>
              <label><FormattedMessage id='torrent-create-files' defaultMessage='Files:' /></label>
              <div>{this.state.fileElems}</div>
            </div>
          </div>
        </ShowMore>
        <div className='float-right'>
          <FlatButton
            label={this.props.intl.formatMessage({id: 'cancel', defaultMessage: 'Cancel'})}
            style={{
              marginRight: 10
            }}
            onClick={dispatcher('cancel')}
          />
          <RaisedButton
            label={this.props.intl.formatMessage({id: 'create-torrent-action', defaultMessage: 'Create Torrrent'})}
            primary
            onClick={this.handleSubmit}
          />
        </div>
      </div>
    )
  }
}

// Finds the longest common prefix
function findCommonPrefix (a, b) {
  for (var i = 0; i < a.length && i < b.length; i++) {
    if (a.charCodeAt(i) !== b.charCodeAt(i)) break
  }
  if (i === a.length) return a
  if (i === b.length) return b
  return a.substring(0, i)
}

module.exports = injectIntl(CreateTorrentPage)
