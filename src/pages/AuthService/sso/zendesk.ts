import { ajax, getRequest, login } from 'src/utils/sso';
import { decodeSsoJwt } from 'src/utils/ssoTypes';

const { code } = getRequest();

ajax.post({
  url: __api_server__.main + 'Zendesk/GetSsoJwt',
  data: {
    code,
    appKey: '9eba86d207a0',
  },
  async: true,
  decodeData: decodeSsoJwt,
  success: data => {
    if (data.state) {
      const input = document.getElementById('jwtInput');
      const form = document.forms.namedItem('jwtForm');
      if (!(input instanceof HTMLInputElement) || !form) throw new Error('Missing Zendesk SSO form');
      input.value = data.data;
      form.submit();
    }
  },
  error: login,
});
