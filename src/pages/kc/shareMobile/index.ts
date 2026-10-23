import preall from 'src/common/preall';
import MobileSharePreview from './shareMobile';

export default function (projectId: string) {
  preall({ type: 'function' }, { allowNotLogin: true });
  window['hello'] = new MobileSharePreview({ projectId });
}
