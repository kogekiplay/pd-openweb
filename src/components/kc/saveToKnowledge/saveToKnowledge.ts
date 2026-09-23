import attachmentAjax from 'src/api/attachment';
import kc from 'src/api/kc';
import createShare from 'src/components/createShare/createShare';
import kcUtil from 'src/pages/kc/util';
import { pathCompletion } from 'src/utils/common';
import defineMethods from 'src/utils/defineMethods';

var copyNode = kc.copyNode;
var addNode = kc.addNode;

var NODE_TYPE = {
  QINIU: 0,
  COMMON: 1,
  KC: 2,
};

/** 把附件 / 知识文件存到知识中心的某个文件夹。nodeType 见 NODE_TYPE，决定 sourceData 里用哪几个字段 */
interface SaveToKnowledgeFields {
  sourceData: {
    // 知识文件（NODE_TYPE.KC）
    nodeId?: string;
    isShareFolder?: boolean;
    // 七牛附件（NODE_TYPE.QINIU）
    name?: string;
    filePath?: string;
    // 普通附件（NODE_TYPE.COMMON）
    fileID?: string;
    originalFileName?: string;
    // 通用
    allowDown?: boolean;
    des?: string;
  };
  options: { createShare: boolean };
  nodeType: number;
}

function SaveToKnowledge(this: SaveToKnowledgeInstance, nodeType, sourceData, options) {
  this.sourceData = sourceData;
  this.options = Object.assign(
    {
      createShare: true,
    },
    options,
  );
  this.nodeType = nodeType;
}

const saveToKnowledgeMethods = defineMethods<SaveToKnowledgeFields>()({
  /** path：folderSelectDialog 选中的目标，type 1 我的文件 / 2 共享文件夹根 / 3 子文件夹 */
  save: function (path: { type: number; node: { id: string; rootId?: string; position?: string } }) {
    var SK = this;
    var nodeType = SK.nodeType;
    var sourceData = SK.sourceData;
    var rootId = '';
    var parentId = '';
    var B_PICK_TYPE = {
      MYFILE: 1,
      ROOT: 2,
      CHILDNODE: 3,
    };
    const createShareFunc = () => {
      if (SK.options.createShare) {
        createShare({
          linkURL: pathCompletion(
            '/apps/kc/' +
              (path.type === 1
                ? 'my'
                : path.type === 2
                  ? path.node.id
                  : path.node.rootId
                    ? path.node.position.slice(1)
                    : path.node.position.replace(/\/.{8}(-.{4}){3}-.{12}/, 'my')),
          ),
          content: _l('保存成功'),
        });
      }
    };

    return new Promise((resolve, reject) => {
      if (nodeType === NODE_TYPE.KC) {
        copyNode({
          ids: [sourceData.nodeId],
          allowDown: sourceData.allowDown,
          des: sourceData.des,
          toId: path.node.id,
          toType: path.type,
          copySource: false,
          isShareFolder: sourceData.isShareFolder,
        })
          .then(data => {
            var successIds = data[1];
            var message = kcUtil.getKcFolderOperationTips(data, {
              success: _l('保存成功'),
            });
            if (successIds.length) {
              resolve(message);
              createShareFunc();
            } else {
              reject(message);
            }
          })
          .catch(() => {
            reject();
          });
      } else if (nodeType === NODE_TYPE.QINIU) {
        var attPath = sourceData.filePath;
        var pathSuffix = attPath.indexOf('?') > 0 ? attPath.substring(attPath.indexOf('?'), attPath.length) : '';
        var filePath = attPath.replace(pathSuffix, '');
        if (path.type === B_PICK_TYPE.ROOT) {
          parentId = rootId = path.node.id;
        } else if (path.type === B_PICK_TYPE.CHILDNODE) {
          parentId = path.node.id;
          rootId = path.node.rootId;
        }

        addNode({
          name: sourceData.name,
          filePath: filePath,
          type: 2,
          parentId: parentId,
          rootId: rootId,
          allowDown: sourceData.allowDown,
          des: sourceData.des,
          source: {
            type: 6,
            sourceContent: '',
          },
        })
          .then(data => {
            if (!data) {
              reject();
            } else {
              resolve();
              createShareFunc();
            }
          })
          .catch(() => {
            reject();
          });
      } else {
        if (path.type === B_PICK_TYPE.ROOT) {
          parentId = rootId = path.node.id;
        } else if (path.type === B_PICK_TYPE.CHILDNODE) {
          parentId = path.node.id;
          rootId = path.node.rootId;
        }

        SK.ajaxAttachmentToKc(
          sourceData.fileID,
          parentId,
          rootId,
          sourceData.originalFileName,
          sourceData.allowDown,
          sourceData.des,
        )
          .then(data => {
            if (data === true) {
              resolve();
              createShareFunc();
            } else {
              reject();
            }
          })
          .catch(() => {
            reject();
          });
      }
    });
  },
  ajaxAttachmentToKc: function (fileID, toId, toRootId, originalFileName, allowDown, des) {
    var SK = this;
    return attachmentAjax.saveToKnowledge(
      SK.filterUndefined({
        fileID: fileID,
        originalFileName: originalFileName,
        allowDown: allowDown,
        des: des,
        parentID: toId,
        rootID: toRootId,
      }),
    );
  },
  filterUndefined: function (json) {
    for (var key in json) {
      if (typeof json[key] === 'undefined') {
        delete json[key];
      }
    }

    return json;
  },
});

SaveToKnowledge.prototype = saveToKnowledgeMethods;
type SaveToKnowledgeInstance = SaveToKnowledgeFields & typeof saveToKnowledgeMethods;

export default function (nodeType, sourceData, options?) {
  return new SaveToKnowledge(nodeType, sourceData, options);
}
