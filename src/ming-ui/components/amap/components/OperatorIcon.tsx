import { Component, Fragment } from 'react';
import styled from 'styled-components';
import { Icon } from 'ming-ui';

interface OperatorPosition {
  lng: number;
  lat: number;
}

interface OperatorIconProps {
  isMobile?: boolean | undefined;
  onClose?: (() => void) | undefined;
  defaultLocation?: { position?: OperatorPosition | undefined } | undefined;
  setPosition: (lng: number, lat: number) => void;
  setZoom: (direction: 'plus' | 'minus') => void;
}

const ToolbarIconWrap = styled.div`
  width: 30px;
  text-align: center;
  right: 10px;
  top: ${({ isMobile, icon }) => (icon === 'gpsFixed' ? (isMobile ? '140px' : '470px') : isMobile ? '180px' : '520px')};
  z-index: 10;
  padding: 6px;
  border-radius: ${icon => (icon === 'gpsFixed' ? ' 50%' : 'unset')};
  background: var(--color-background-primary);
  box-shadow: var(--shadow-md);
`;

export default class OperatorIcon extends Component<OperatorIconProps> {
  override render() {
    const { isMobile, onClose, defaultLocation, setPosition, setZoom } = this.props;
    const position = defaultLocation?.position;
    return (
      <Fragment>
        <div
          className="Absolute"
          style={{
            right: 12,
            top: 11,
            borderRadius: '50%',
            background: 'var(--color-background-primary)',
            width: 16,
            height: 16,
            zIndex: 9,
          }}
        />
        <Icon
          icon="cancel"
          className="textTertiary Font20 Absolute hoverColorPrimary pointer"
          style={{ right: 10, top: 10, zIndex: 10 }}
          onClick={onClose}
        />

        {position && (
          <ToolbarIconWrap
            isMobile={isMobile}
            icon="gpsFixed"
            className="textTertiary Absolute hoverColorPrimary pointer flexRow gpsFixedIcon"
            onClick={() => setPosition(position.lng, position.lat)}
          >
            <Icon icon="gps_fixed" className="Font18" />
          </ToolbarIconWrap>
        )}
        {position && (
          <ToolbarIconWrap
            className="textTertiary Absolute pointer flexColumn zoomWrap"
            isMobile={isMobile}
            icon="plusMinus"
          >
            <div className="hoverColorPrimary" onClick={() => setZoom('plus')}>
              <Icon icon="plus" className="Font14" />
            </div>
            <div className="w100 mTop2" style={{ height: 1, border: '1px solid var(--color-border-primary)' }}></div>
            <div className="hoverColorPrimary pTop3" style={{ height: 19 }} onClick={() => setZoom('minus')}>
              <Icon icon="minus" className="Font14" />
            </div>
          </ToolbarIconWrap>
        )}
      </Fragment>
    );
  }
}
