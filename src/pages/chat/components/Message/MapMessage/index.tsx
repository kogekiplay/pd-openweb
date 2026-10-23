import { Component } from 'react';
import Amap from 'ming-ui/components/amap/Amap';
import type { ChatMessage } from '../../../redux/types';
import { present } from '../../../utils/present';
import './index.less';

export interface MapMessageProps {
  message: ChatMessage;
}

export default class MapMessage extends Component<MapMessageProps> {
  constructor(props: MapMessageProps) {
    super(props);
  }
  handleOpenMap() {
    const { location } = this.props.message;
    window.open(`http://gaode.com/search?query=${present(location, 'title').title}`);
  }
  override render() {
    const { location } = this.props.message;
    const param = {
      zoom: 20,
      center: [present(location, 'lng').lng, present(location, 'lat').lat],
    };
    return (
      <div className="Message-card Message-cardMap">
        <div className="Message-cardMap-wrapper">
          <Amap mapOptions={param} mapTools={false} mapSearch={false} />
        </div>
        <div className="Message-cardMap-content" onClick={this.handleOpenMap.bind(this)}>
          <div className="title">{present(location, 'title').title}</div>
          <div className="address">{present(location, 'address').address}</div>
        </div>
      </div>
    );
  }
}
