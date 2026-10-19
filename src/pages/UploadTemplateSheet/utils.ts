import _ from 'lodash';
import appManagementAjax from 'src/api/appManagement';
import attachmentAjax from 'src/api/attachment';
import type { PrintAdvanceSetting } from 'src/pages/FormSet/components/PrintTemSetting';

export interface EditDocumentParams {
  doc?: string | undefined;
  fileName?: string | undefined;
  allowDownloadPermission?: number | undefined;
  allowEditAfterPrint?: boolean | undefined;
  advanceSettings?: PrintAdvanceSetting[] | undefined;
}
export interface CreateEditFileLinkProps {
  worksheetId?: string | undefined;
  downLoadUrl?: string | undefined;
  type?: number | undefined;
  createType?: number | undefined;
  name?: string | undefined;
  params?: EditDocumentParams | undefined;
  createCompleted?: ((id?: string) => unknown) | undefined;
}
type CreateEditResult = string | false | null | undefined;

const DEFAULT = {
  doc: undefined,
  fileName: undefined,
  allowDownloadPermission: 0,
  allowEditAfterPrint: false,
  advanceSettings: [],
};

export const createEditFileLink = async (props: CreateEditFileLinkProps) => {
  const { worksheetId, downLoadUrl, type = 2, createType, createCompleted, name, params } = props;

  const token: unknown = await appManagementAjax.getToken({
    worksheetId: worksheetId,
    tokenType: 5,
  });
  const ajaxUrl = downLoadUrl + '/PrintTemplate/EditPrint';

  const option = {
    token,
    worksheetId,
    accountId: _.get(md, 'global.Account.accountId'),
    type,
    createType,
    name,
    ...(params || DEFAULT),
  };

  const res: CreateEditResult = await window.mdyAPI('', '', option, {
    ajaxOptions: {
      url: ajaxUrl,
    },
  });

  if (!res) {
    alert((res as { message?: string } | null | undefined)!.message, 2);
    !!createCompleted && createCompleted();
  } else {
    const data = await attachmentAjax.getAttachmentEditDetail({
      fileId: res,
      editType: 2,
      worksheetId,
    });
    !!createCompleted && createCompleted(res);

    data.wpsEditUrl && window.open(data.wpsEditUrl);
  }
};
