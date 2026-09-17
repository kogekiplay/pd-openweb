// 高德地图地址采用jsonp callback -->amapInitComponent
// 含插件Autocomplete，Geocoder，Geolocation，ToolBar，Scale，CitySearch
import _ from 'lodash';
import global from 'src/api/global';

let mapConfig;
let mapConfigRequest: Promise<any> | null = null;

/**
 * 取地图配置（高德/谷歌的 key 与安全域）。
 *
 * 【原先是同步 XHR】`{ ajaxOptions: { sync: true } }` —— 主线程同步请求已被废弃，
 * 控制台报 "Synchronous XMLHttpRequest on the main thread is deprecated"，
 * 而且它卡在建图之前，地图越慢这一下越明显。
 *
 * 改成异步之后返回 Promise。三个调用方本来就都能等：
 * loadJs 自己就在 new Promise 里、Gmap 在 useEffect 里、WorldMap 的 renderWorldMap
 * 两个调用点都不取返回值（可以直接改 async）。
 * 配置取回来后进程内缓存，并发调用共用同一个请求。
 */
export const getMapKey = async keyName => {
  if (!mapConfig) {
    if (!mapConfigRequest) {
      mapConfigRequest = global
        .getSystemConfiguration({}, { silent: true })
        .then(data => {
          mapConfig = data;
          return data;
        })
        .catch(() => ({}))
        .finally(() => {
          mapConfigRequest = null;
        });
    }

    await mapConfigRequest;
  }

  const mapInfo = _.get(mapConfig, [keyName]);

  if (keyName === 'amap') {
    window._AMapSecurityConfig = {
      ...(_.get(mapInfo, 'host')
        ? { serviceHost: _.get(mapInfo, 'host') }
        : { securityJsCode: _.get(mapInfo, 'secret') }),
    };
  }

  return mapInfo;
};

const isPluginsReady = () => window.AMap && window.AMap.Map && window.AMap.Geocoder && window.AMap.Geolocation;

export default class MapLoader {
  loadJs() {
    if (isPluginsReady()) {
      return Promise.resolve(window.AMap);
    }

    return new Promise(resolve => {
      // 获取地图数据（getMapKey 已改异步，见上面的说明）
      getMapKey('amap').then((mapInfo = {}) => {
        const { key } = mapInfo || {};
        const AMAP_URL = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.Autocomplete,AMap.PlaceSearch,AMap.Geocoder,AMap.Geolocation,AMap.ToolBar,AMap.Scale,AMap.CitySearch`;

        const existingScript = document.querySelector('script[data-amap-script]');

        if (!existingScript) {
          const script = document.createElement('script');
          script.setAttribute('data-amap-script', 'true');
          script.src = AMAP_URL;
          document.head.appendChild(script);
        }

        const aMapTimer = setInterval(() => {
          if (isPluginsReady()) {
            resolve(window.AMap);
            clearInterval(aMapTimer);
          }
        }, 500);
      });
    });
  }
}
