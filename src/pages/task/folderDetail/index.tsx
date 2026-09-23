import React, { Component } from 'react';
import { emitter } from 'src/utils/common';
import TaskCenter from './containers/taskCenter/taskCenter';

export default class FolderEntrypoint extends Component<any, any> {
  override componentDidMount() {
    $('html').addClass('AppTask');
  }
  override componentWillUnmount() {
    $('#container').off('.task');
    $('body').off('.task').removeClass('taskDetailOpen');
    $('html').removeClass('AppTask');
  }
  override render() {
    return <TaskCenter folderId={this.props.match.params.id} hideNavigation={true} emitter={emitter} />;
  }
}
