import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import _ from 'lodash';
import Mingo from 'src/components/Mingo';
import * as actions from 'src/pages/chat/redux/actions';
import type { RootState } from 'src/redux/types';

const MingoDrawer = props => {
  const { drawerVisible, toolbarConfig, setToolbarConfig } = props;
  const { mingoFixing } = toolbarConfig;
  return (
    <Mingo
      drawerVisible={drawerVisible}
      mingoFixing={mingoFixing}
      onFixing={({ saveStateToLocal = true }) => {
        setToolbarConfig({ mingoFixing: !mingoFixing });
        if (saveStateToLocal) {
          localStorage.setItem('mingoFixing', !mingoFixing);
        }
      }}
      onClose={() => {
        setToolbarConfig({ mingoVisible: false });
        localStorage.removeItem('toolBarOpenType');
      }}
    />
  );
};

export default connect(
  (state: RootState) => ({
    toolbarConfig: state.chat.toolbarConfig,
  }),
  dispatch => bindActionCreators(_.pick(actions, ['setToolbarConfig']), dispatch),
)(MingoDrawer);
