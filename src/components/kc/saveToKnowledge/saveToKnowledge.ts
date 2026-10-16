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
export interface KnowledgeSource {
  nodeId?: string | undefined;
  isShareFolder?: boolean | undefined;
  name?: string | undefined;
  filePath?: string | undefined;
  fileID?: string | undefined;
  originalFileName?: string | undefined;
  allowDown?: boolean | undefined;
  des?: string | undefined;
}
interface SaveOptions {
  createShare?: boolean | undefined;
}
interface SaveTarget {
  type: number;
  node: {
    id?: string | null | undefined;
    rootId?: string | undefined;
    position?: string | undefined;
    name?: string | undefined;
  };
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function target(value: unknown): value is SaveTarget {
  if (!object(value) || typeof value['type'] !== 'number' || !object(value['node'])) return false;
  const node = value['node'];
  return (
    (node['id'] == null || typeof node['id'] === 'string') &&
    ['rootId', 'position', 'name'].every(key => node[key] === undefined || typeof node[key] === 'string')
  );
}

function saveTarget(value: unknown): SaveTarget {
  if (!target(value)) throw new TypeError('Invalid knowledge destination');
  return value;
}

interface SaveToKnowledgeFields {
  sourceData: KnowledgeSource;
  options: SaveOptions;
  nodeType: number | undefined;
}
function required<T>(value: T | undefined, key: string): T {
  if (value === undefined) throw new TypeError('Missing knowledge target ' + key);
  return value;
}

class SaveToKnowledge {
  constructor(nodeType: number | undefined, sourceData: KnowledgeSource, options?: SaveOptions) {
    this.sourceData = sourceData;
    this.options = Object.assign({ createShare: true }, options);
    this.nodeType = nodeType;
  }
}

const saveToKnowledgeMethods = defineMethods<SaveToKnowledgeFields>()({
  /** path：folderSelectDialog 选中的目标，type 1 我的文件 / 2 共享文件夹根 / 3 子文件夹 */
  save: async function (input: unknown): Promise<unknown> {
    const path = saveTarget(input);
    var SK = this;
    var nodeType = SK.nodeType;
    var sourceData = SK.sourceData;
    var rootId: string | null | undefined = '';
    var parentId: string | null | undefined = '';
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
                    ? required(path.node.position, 'position').slice(1)
                    : required(path.node.position, 'position').replace(/\/.{8}(-.{4}){3}-.{12}/, 'my')),
          ),
          content: _l('保存成功'),
        });
      }
    };

    return new Promise<unknown>((resolve, reject) => {
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
          .then((data: unknown) => {
            const successIds: unknown = Array.isArray(data) ? data[1] : undefined;
            if (!Array.isArray(successIds)) throw new TypeError('Invalid copied knowledge result');
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
        var attPath = required(sourceData.filePath, 'source file path');
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
              resolve(undefined);
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
              resolve(undefined);
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
  ajaxAttachmentToKc: function (
    fileID: string | undefined,
    toId: string | null | undefined,
    toRootId: string | null | undefined,
    originalFileName: string | undefined,
    allowDown: boolean | undefined,
    des: string | undefined,
  ): ApiResultOf<unknown> {
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
  filterUndefined: function <T extends Record<string, unknown>>(json: T): Partial<T> {
    for (var key in json) {
      if (typeof json[key] === 'undefined') {
        delete json[key];
      }
    }

    return json;
  },
});

Object.assign(SaveToKnowledge.prototype, saveToKnowledgeMethods);
type SaveMethods = typeof saveToKnowledgeMethods;
interface SaveToKnowledge extends SaveToKnowledgeFields, SaveMethods {}

export default function (nodeType: number | undefined, sourceData: KnowledgeSource, options?: SaveOptions) {
  return new SaveToKnowledge(nodeType, sourceData, options);
}
