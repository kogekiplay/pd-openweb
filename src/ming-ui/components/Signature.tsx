import React, { Component } from 'react';
import axios from 'axios';
import { get, isFunction, replace } from 'lodash';
// signature_pad 5 的 exports 映射只有 '.'，深子路径 dist/signature_pad 已被封死。
import SignaturePad from 'signature_pad';
import styled from 'styled-components';
import accountSettingAjax from 'src/api/accountSetting';
import GenScanUploadQr from 'worksheet/components/GenScanUploadQr';
import { getToken } from 'src/utils/common';
import Icon from './Icon';

const SignatureBox = styled.div`
  width: 100%;
  .signatureCanvas {
    width: 100%;
    height: 200px;
    border-radius: 4px;
    background: var(--color-background-tertiary);
    vertical-align: top;
    display: flex;
    align-items: center;
    justify-content: center;
    img {
      max-width: 100%;
      max-height: 100%;
    }
  }
  .flexRow {
    align-items: center;
  }
  .signatureFromMobile {
    font-size: 12px;
    color: var(--color-text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    margin: 0 10px;
    .icon {
      font-size: 16px;
      margin-right: 6px;
    }
  }
`;

export default class Signature extends Component<any, any> {
  state = {
    isEdit: false,
    signature: '',
    key: '',
    showButton: typeof this.props.showButton === 'undefined' ? true : this.props.showButton,
  };

  isComplete = true;

  componentDidMount() {
    setTimeout(() => {
      this.initCanvas();
    }, 100);
  }

  initCanvas = () => {
    const { onBegin } = this.props;
    // signature_pad 5 自带类型，构造签名要求 HTMLCanvasElement；getElementById 返回的是
    // HTMLElement，之前深子路径导入没有类型所以看不出来（canvas.width 本来就是类型错误）。
    const canvas = document.getElementById('signatureCanvas') as HTMLCanvasElement | null;

    if (!canvas) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    canvas.getContext('2d');
    // signature_pad 4 起把 onBegin/onEnd 从构造选项改成了事件（类继承 SignatureEventTarget）。
    // v5 的 Options 里已经没有这两个键，留着会被静默忽略——签名后「已编辑」状态永远不置位。
    // 事件名实测为 beginStroke / endStroke（另有 beforeUpdateStroke / afterUpdateStroke）。
    this.signaturePad = new SignaturePad(canvas, {
      penColor: '#151515',
    });
    this.signaturePad.addEventListener('beginStroke', () => {
      this.setState({ isEdit: true });
      if (isFunction(onBegin)) {
        onBegin();
      }
    });
  };

  clear = () => {
    this.signaturePad.clear();
    this.setState({ isEdit: false, signature: '', key: '' }, () => {
      setTimeout(() => {
        this.initCanvas();
      }, 100);
    });
  };

  checkContentIsEmpty() {
    const { isEdit, signature } = this.state;

    return !isEdit && !signature;
  }

  saveSignature = (callback = () => {}, { getTokenFn } = {}) => {
    const { signature, key } = this.state;

    if (signature) {
      callback({ bucket: 4, key: key });
      return;
    }

    if (!this.isComplete) return;

    this.isComplete = false;

    (getTokenFn || getToken)([{ bucket: 4, ext: '.png' }]).then(res => {
      if (res.error) {
        alert(res.error);
      } else {
        const url = `${md.global.FileStoreConfig.uploadHost}/putb64/-1/key/${btoa(res[0].key)}`;
        axios
          .post(url, this.signaturePad.toDataURL('image/png').split(',')[1], {
            headers: {
              'Content-Type': 'application/octet-stream',
              Authorization: `UpToken ${res[0].uptoken}`,
            },
          })
          .then(({ data }) => {
            const { key = '' } = data || {};

            if (get(window, 'md.global.Account.accountId')) {
              accountSettingAjax.editSign({ url: res[0].url });
            }

            callback({ bucket: 4, key, url: res[0].url });
            this.isComplete = true;
          });
      }
    });
  };

  getSignature = () => {
    accountSettingAjax.getSign().then(res => {
      if (!res.url) return alert(_l('暂无签名记录'), 3);
      this.setState({ isEdit: false, signature: res.url, key: res.key });
    });
  };

  render() {
    const { showUploadFromMobile, worksheetId, viewId, canvasStyle = {} } = this.props;
    const { isEdit, signature, showButton } = this.state;

    return (
      <SignatureBox>
        {signature ? (
          <div className="signatureCanvas">
            <img src={signature} className="w100 h100" />
          </div>
        ) : (
          <canvas id="signatureCanvas" className="signatureCanvas" style={canvasStyle} />
        )}

        {showButton && (
          <div className="flexRow mTop10" style={{ minHeight: 20 }}>
            {!md.global.Account.isPortal && (
              <span className="colorPrimary hoverColorPrimaryDark pointer flexRow" onClick={this.getSignature}>
                {_l('使用上次签名')}
              </span>
            )}
            {showUploadFromMobile && (
              <GenScanUploadQr
                worksheetId={worksheetId}
                viewId={viewId}
                type={2}
                onScanResultUpdate={files => {
                  if (get(files, '0.url')) {
                    this.setState({
                      isEdit: false,
                      signature: get(files, '0.url'),
                      key: replace(files[0].url.replace(/\?.*$/, ''), `${md.global.FileStoreConfig.pictureHost}/`, ''),
                    });
                    if (get(window, 'md.global.Account.accountId')) {
                      accountSettingAjax.editSign({ url: get(files, '0.url') });
                    }
                  }
                }}
              >
                <div className="signatureFromMobile">
                  <i className="icon icon-zendeskHelp-qrcode"></i>
                  {_l('扫码签名')}
                </div>
              </GenScanUploadQr>
            )}

            <div className="flex" />
            {(isEdit || !!signature) && (
              <span className="colorPrimary hoverColorPrimaryDark pointer flexRow" onClick={this.clear}>
                <Icon icon="e-signature" className="Font16 mRight5" />
                {_l('重新签名')}
              </span>
            )}
          </div>
        )}
      </SignatureBox>
    );
  }
}
