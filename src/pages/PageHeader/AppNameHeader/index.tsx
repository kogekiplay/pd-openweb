import React, { Component } from 'react';
import api from 'api/homeApp';
import { SvgIcon } from 'ming-ui';
import { navigateTo } from '../../../router/navigateTo';
import './index.less';

export interface AppNameHeaderState {
  appId: string;
  data: HapApi.MD.Web.Ajax.ResultModel.App.GetDto | null;
  icon: string;
  name: string | undefined;
  iconColor: string | undefined;
  iconUrl?: string | undefined;
}

export default class AppNameHeader extends Component<any, AppNameHeaderState> {
  constructor(props) {
    super(props);
    this.state = {
      appId: '',
      data: null,
      icon: '',
      name: '',
      iconColor: '',
    };
  }

  override componentDidMount() {
    api.getApp({ appId: this.props.match.params.apkId }, { silent: true }).then(data => {
      this.setState({
        data: data,
        iconUrl: data.iconUrl,
        name: data.name,
        iconColor: data.iconColor,
      });
    });
  }

  override render() {
    const { iconUrl, name, iconColor } = this.state;
    return (
      <div className="appNameHeaderBox">
        {this.state.data && (
          <React.Fragment>
            <div className="appIconWrap">
              <span
                className="appIconWrapIcon"
                style={{
                  backgroundColor: iconColor,
                }}
                onClick={() => {
                  navigateTo(`/app/${this.props.match.params.apkId}`);
                }}
              >
                <SvgIcon url={iconUrl} fill="#fff" size={24} />
              </span>
            </div>
            <div
              className="appName textPrimary Font16 Hand"
              onClick={() => {
                navigateTo(`/app/${this.props.match.params.apkId}`);
              }}
            >
              {name}
            </div>
          </React.Fragment>
        )}
      </div>
    );
  }
}
