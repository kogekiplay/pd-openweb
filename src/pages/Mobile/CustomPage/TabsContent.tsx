import React, { lazy, Suspense } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import _ from 'lodash';
import type { RootState } from 'src/redux/types';
import * as actions from './redux/actions';

const LoadableTabs = lazy(() =>
  import('src/pages/customPage/components/editWidget/tabs').then(component => ({
    default: component.Tabs,
  })),
);

const TabsContent = props => {
  return (
    <Suspense fallback={null}>
      <LoadableTabs {...props} />
    </Suspense>
  );
};

export default connect(
  (state: RootState) => ({
    loadFilterComponentCount: state.mobile.loadFilterComponentCount,
  }),
  dispatch => bindActionCreators(_.pick(actions, ['updateLoadFilterComponentCount']), dispatch),
)(TabsContent);
