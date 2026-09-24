import { Component } from 'react';
import { connect } from 'react-redux';
import _ from 'lodash';
import type { RootState } from 'src/redux/types';
import UniformRoute from 'src/router/withTitle';
import { emitter } from 'src/utils/common';
import TaskCenter from './containers/taskCenter/taskCenter';

const MODULE_TO_TITLE: Record<string, string> = {
  center: _l('任务'),
  star: _l('星标任务-任务'),
  subordinate: _l('下属任务-任务'),
};

class TaskEntrypoint extends Component<any, any> {
  override componentDidMount() {
    $('html').addClass('AppTask');
  }
  override componentWillUnmount() {
    $('html').removeClass('AppTask');
  }

  renderPageTitle = () => {
    const { pathname } = this.props.location;
    let moduleName = pathname.match(/\/apps\/task\/(\w+)/) ? pathname.match(/\/apps\/task\/(\w+)/)[1] : 'center';

    if (_.includes(['center', 'star', 'subordinate'], moduleName)) {
      return MODULE_TO_TITLE[moduleName];
    }

    const { folderName = '' } = this.props.folderSettings;
    return `${folderName}-任务`;
  };
  override render() {
    const { pathname } = this.props.location;
    return <UniformRoute title={this.renderPageTitle()} pathname={pathname} emitter={emitter} component={TaskCenter} />;
  }
}

export default connect((state: RootState) => state.task)(TaskEntrypoint);
