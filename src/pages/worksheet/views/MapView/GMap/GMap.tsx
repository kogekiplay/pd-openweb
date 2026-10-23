/// <reference types="google.maps" />
import type { CSSProperties } from 'react';
import type { GoogleMapProps as NativeGoogleMapProps } from '@react-google-maps/api';
import type { parseRecord } from '../utils';
type NativeMap = Parameters<NonNullable<NativeGoogleMapProps['onLoad']>>[0];
type MapInstance = NativeMap & { geocoder?: google.maps.Geocoder | undefined };
export interface GoogleMapHandle {
  moveCenter(center?: number[]): void;
  zoomByStep(step: number): void;
  getAddress(lng: number, lat: number, callback: (address: string | null) => void): void;
}
export interface GMapProps {
  zoom: number;
  center?: number[] | undefined;
  markers?: Array<ReturnType<typeof parseRecord>> | undefined;
  markOptions?: { mapViewState?: { searchData?: { rowid?: string | undefined } | undefined } | undefined } | undefined;
  setCenter(center: number[]): void;
  setOriginalCenter(center: number[]): void;
  getLatLngOnClick?: ((point: { left: number; top: number; lnglat: { lng: number; lat: number } }) => void) | undefined;
  isCurrentPosition?: boolean | undefined;
  resetAddRecordBtn?: (() => void) | undefined;
  onZoomChange?: ((zoom: number | undefined) => void) | undefined;
}
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import _ from 'lodash';
import { Gmap, GmapOverlayView } from 'ming-ui/components/amap/components/GoogleMap';
import PinMarker from '../components/PinMarker';

const wrapperStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
};

const GMap = forwardRef<GoogleMapHandle, GMapProps>((props, ref) => {
  const {
    zoom,
    center = [150.644, -34.397],
    markers = [],
    markOptions,
    setCenter,
    setOriginalCenter,
    getLatLngOnClick,
    isCurrentPosition,
    resetAddRecordBtn = () => {},
    onZoomChange,
  } = props;
  const mapRef = useRef<MapInstance | null>(null);
  const isLockRef = useRef(false);
  const isZoomingRef = useRef(false);

  const [isLoaded, setIsLoaded] = useState(false);

  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (!getLatLngOnClick || !event.latLng || !mapRef.current) return;
    const bounds = mapRef.current.getDiv().getBoundingClientRect();
    const domEvent = event.domEvent;
    let point: { clientX: number; clientY: number } | undefined;
    if ('clientX' in domEvent && 'clientY' in domEvent && typeof domEvent.clientX === 'number' && typeof domEvent.clientY === 'number') {
      point = { clientX: domEvent.clientX, clientY: domEvent.clientY };
    } else if ('changedTouches' in domEvent) {
      point = domEvent.changedTouches[0];
    }
    if (!point) return;
    getLatLngOnClick({ left: point.clientX - bounds.left, top: point.clientY - bounds.top,
      lnglat: { lng: event.latLng.lng(), lat: event.latLng.lat() } });
  };

  const getAddress = (lng: number, lat: number, callback: (address: string | null) => void) => {
    if (mapRef.current) {
      // onMapLoad creates the private geocoder before any owner can call this handle.
      mapRef.current.geocoder!.geocode({ location: { lng, lat } }, (results, status) => {
        if (status === 'OK' && results!.length) {
          const address = results![0]!.formatted_address;

          callback(address);
        } else {
          callback(null);
        }
      });
    } else {
      callback && callback(null);
    }
  };

  useImperativeHandle(ref, () => ({
    moveCenter: (center?: number[]) => {
      if (mapRef.current && center?.length === 2) {
        Reflect.apply(mapRef.current.panTo, mapRef.current, [{ lng: center[0], lat: center[1] }]);
        setCenter(center.slice());
      }
    },
    zoomByStep: step => {
      if (mapRef.current) {
        const currentZoom = mapRef.current.getZoom();
        mapRef.current.setZoom(Number(currentZoom) + step);
      }
    },
    getAddress,
  }));

  const getCurrentPosition = () => {
    // 获取当前位置
    if (isCurrentPosition && navigator.geolocation && mapRef.current && !isLockRef.current) {
      isLockRef.current = true;
      navigator.geolocation.getCurrentPosition(
        position => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCenter([pos.lng, pos.lat]);
          setOriginalCenter([pos.lng, pos.lat]);
        },
        err => console.error('定位失败:', err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    }
  };

  useEffect(() => {
    getCurrentPosition();
  }, [isCurrentPosition]);

  useEffect(() => {
    if (!isLoaded) return undefined;

    // isLoaded is set only after the private map ref is assigned. Preserve native failure if that lifecycle is violated.
    const dargStartListener = mapRef.current!.addListener('dragstart', () => {
      resetAddRecordBtn();
    });

    const dragEndListener = mapRef.current!.addListener('dragend', () => {
      const c = mapRef.current!.getCenter();
      setCenter([c!.lng(), c!.lat()]);
    });

    const zoomChangeListener = mapRef.current!.addListener('zoom_changed', () => {
      if (isZoomingRef.current) return;

      isZoomingRef.current = true;
      resetAddRecordBtn();
    });

    const idleListener = mapRef.current!.addListener('idle', () => {
      if (isZoomingRef.current && onZoomChange) {
        onZoomChange(mapRef.current!.getZoom());
      }

      isZoomingRef.current = false;
    });

    return () => {
      dargStartListener.remove();
      dragEndListener.remove();
      zoomChangeListener.remove();
      idleListener.remove();
    };
  }, [isLoaded, onZoomChange]);

  return (
    <Gmap
      zoom={zoom}
      mapContainerStyle={wrapperStyle}
      lat={center[1]}
      lng={center[0]}
      options={{
        fullscreenControl: false,
        mapTypeControl: false,
        streetViewControl: false,
      }}
      onMapLoad={(mapInstance: NativeMap) => {
        mapRef.current = mapInstance;
        setIsLoaded(true);
        if (mapRef.current && !mapRef.current.geocoder) {
          mapRef.current.geocoder = new google.maps.Geocoder();
        }

        getCurrentPosition();
      }}
      handleClick={handleMapClick}
    >
      {markers.map(item => {
        const isCurrent = _.get(markOptions, 'mapViewState.searchData.rowid') === item.record.rowid;
        return (
          <GmapOverlayView
            key={`Overlay-${item.record.rowid}`}
            position={{ lat: item.position.y, lng: item.position.x }}
            mapPaneName="overlayMouseTarget"
            zIndex={isCurrent ? 9 : 1}
          >
            <PinMarker
              {...markOptions}
              key={`PinMark-${item.record.rowid}`}
              isCurrent={isCurrent}
              marker={item}
              type="GMap"
            />
          </GmapOverlayView>
        );
      })}
    </Gmap>
  );
});

export default GMap;
