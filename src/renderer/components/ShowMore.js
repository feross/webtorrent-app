const React = require('react')
const {injectIntl} = require('react-intl')

const FlatButton = require('material-ui/FlatButton').default

class ShowMore extends React.Component {
  static get propTypes () {
    return {
      defaultExpanded: React.PropTypes.bool,
      hideLabel: React.PropTypes.string,
      showLabel: React.PropTypes.string
    }
  }

  static get defaultProps () {
    return {
      hideLabel: this.props.intl.formatMessage({id: 'show-more-hide',
        defaultMessage: 'Hide more...'}),
      showLabel: this.props.intl.formatMessage({id: 'show-more-show',
        defaultMessage: 'Show more...'})
    }
  }

  constructor (props) {
    super(props)

    this.state = {
      expanded: !!this.props.defaultExpanded
    }

    this.handleClick = this.handleClick.bind(this)
  }

  handleClick () {
    this.setState({
      expanded: !this.state.expanded
    })
  }

  render () {
    const label = this.state.expanded
      ? this.props.hideLabel
      : this.props.showLabel
    return (
      <div
        style={this.props.style}
      >
        {this.state.expanded ? this.props.children : null}
        <FlatButton
          onClick={this.handleClick}
          label={label}
        />
      </div>
    )
  }
}

module.exports = injectIntl(ShowMore)
