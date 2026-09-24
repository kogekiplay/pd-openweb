import { Component } from 'react';
import { shallowEqual } from 'react-redux';
import { connect } from 'react-redux';
import type { RootState } from 'src/redux/types';
import CalendarDetail from '../modules/calendarDetail';
import './style.less';

class CalendarDetailEntrypoint extends Component<any, any> {
  declare el: HTMLDivElement | null | undefined;

  override componentDidMount() {
    $('html').addClass('AppCalendar AppCalendarDetail');
    CalendarDetail({
      isDetailPage: true,
      container: this.el,
    });
  }

  override componentDidUpdate(prevProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (prevProps.match.params.id !== this.props.match.params.id) {
        CalendarDetail({
          isDetailPage: true,
          container: this.el,
        });
      }
    }
  }
  override componentWillUnmount() {
    $('html').removeClass('AppCalendar AppCalendarDetail');
  }
  override render() {
    return (
      <div className="borderContainer Relative flexColumn">
        <div
          ref={el => {
            this.el = el;
          }}
          className="detail flex"
        />
      </div>
    );
  }
}

export default connect((state: RootState) => state)(CalendarDetailEntrypoint);
