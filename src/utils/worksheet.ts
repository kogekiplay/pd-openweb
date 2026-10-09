import _, { identity, includes, sortBy, sum } from 'lodash';
import { permitList } from 'src/pages/FormSet/config.js';
import { isOpenPermit } from 'src/pages/FormSet/util.js';
import { WIDGETS_TO_API_TYPE_ENUM } from 'src/pages/widgetConfig/config/widget';
import { CARD_WIDTH_SETTING } from 'src/pages/worksheet/common/ViewConfig/config';
import { getCoverStyle } from 'src/pages/worksheet/common/ViewConfig/utils';
import type { WorksheetFilterCondition, WorksheetInfo, WorksheetView } from 'src/pages/worksheet/types';
import type { ControlAdvancedSetting, FormControl, RecordRow } from 'src/utils/controlTypes';
import type {
  CustomOperateButton,
  OperateButtonStyleConfig,
  OperateButtonStyleValue,
  OperatesButtonStyle,
  OperatesButtonsWidthOptions,
  SheetColumnStyle,
  SheetColumnWidths,
  SheetColumnWidthsSnapshot,
  SheetSwitchPermitItem,
  SheetTableStyles,
  StoredOperateButtonStyle,
  WorksheetActionColumn,
  WorksheetAppCache,
  WorksheetButtonGroup,
  WorksheetButtonSource,
  WorksheetCachedNavigation,
  WorksheetExtensionNavigation,
  WorksheetListStyle,
  WorksheetMenuItem,
  WorksheetMenuNode,
  WorksheetOperateButton,
  WorksheetPrintSource,
} from './worksheetTypes';

export type { SheetSwitchPermitItem } from './worksheetTypes';

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}
function isSavedColumnStyle(value: unknown): value is SheetColumnStyle & { cid: string } {
  return (
    isObject(value) &&
    typeof value['cid'] === 'string' &&
    ['width', 'direction', 'showtype', 'coverFillType', 'report'].every(
      key => value[key] === undefined || typeof value[key] === 'number',
    )
  );
}
function isListStyle(value: unknown): value is WorksheetListStyle {
  return (
    isObject(value) &&
    (value['time'] === undefined || typeof value['time'] === 'number' || typeof value['time'] === 'string') &&
    (value['styles'] === undefined || (Array.isArray(value['styles']) && value['styles'].every(isSavedColumnStyle)))
  );
}
function decodeListStyle(serialized?: string): WorksheetListStyle {
  const value: unknown = safeParse(serialized);
  if (isListStyle(value)) return value;
  if (!isObject(value)) return {};
  const { time, styles, ...metadata } = value;
  const result: WorksheetListStyle = metadata;
  if (typeof time === 'number' || typeof time === 'string') result.time = time;
  if (Array.isArray(styles)) result.styles = styles.filter(isSavedColumnStyle);
  return result;
}
function isCachedNavigation(value: unknown): value is WorksheetCachedNavigation {
  return isObject(value) && ['groupId', 'worksheetId', 'viewId'].every(key => isOptionalString(value[key]));
}
function decodeAppCache(serialized: string): WorksheetAppCache {
  const value: unknown = safeParse(serialized);
  if (!isObject(value)) return {};
  const { worksheets, lastWorksheetId, ...metadata } = value;
  const result: WorksheetAppCache = metadata;
  if (Array.isArray(worksheets)) result.worksheets = worksheets.filter(isCachedNavigation);
  if (typeof lastWorksheetId === 'string') result.lastWorksheetId = lastWorksheetId;
  return result;
}
function isNavigationSelection(value: unknown): value is Record<string, string> {
  return isObject(value) && Object.values(value).every(item => typeof item === 'string');
}
function decodeExtensionNavigation(serialized: string): WorksheetExtensionNavigation {
  const value: unknown = safeParse(serialized);
  if (!isObject(value)) return {};
  const result: WorksheetExtensionNavigation = {};
  Object.entries(value).forEach(([key, selection]) => {
    if (isNavigationSelection(selection)) result[key] = selection;
  });
  return result;
}
function isActionColumn(value: unknown): value is WorksheetActionColumn {
  if (!isObject(value)) return false;
  switch (value['type']) {
    case 'copy':
    case 'share':
    case 'delete':
    case 'sysprint':
      return true;
    case 'btn':
    case 'print':
      return typeof value['id'] === 'string';
    case 'group':
      return typeof value['id'] === 'string' && isOptionalString(value['source']);
    default:
      return false;
  }
}
function decodeActionColumn(serialized?: string): WorksheetActionColumn[] {
  const value: unknown = safeParse(serialized, 'array');
  return Array.isArray(value) ? value.filter(isActionColumn) : [];
}
function isButtonGroup(value: unknown): value is WorksheetButtonGroup {
  return (
    isObject(value) &&
    value['type'] === 'group' &&
    typeof value['id'] === 'string' &&
    ['name', 'icon', 'iconUrl', 'iconColor'].every(key => isOptionalString(value[key])) &&
    (value['btns'] === undefined || (Array.isArray(value['btns']) && value['btns'].every(id => typeof id === 'string')))
  );
}
function decodeButtonGroups(serialized?: string): WorksheetButtonGroup[] {
  const value: unknown = safeParse(serialized, 'array');
  return Array.isArray(value) ? value.filter(isButtonGroup) : [];
}

function decodeButtonStyleValue(value: unknown, fallback: number): OperateButtonStyleValue {
  if (value === undefined) return fallback;
  if (value === null) return null;
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;
  return NaN;
}
function decodeButtonStyle(serialized?: string): StoredOperateButtonStyle {
  const value: unknown = safeParse(serialized);
  const config = isObject(value) ? value : {};
  return {
    icon: decodeButtonStyleValue(config['icon'], 1),
    style: decodeButtonStyleValue(config['style'], 1),
    btncount: decodeButtonStyleValue(config['btncount'], 3),
    primarycount: decodeButtonStyleValue(config['primarycount'], 1),
  };
}

export function findSheet<Node extends WorksheetMenuNode<Node> = WorksheetMenuItem>(
  id: string | undefined,
  sheetList: Node[] = [],
): Node | null {
  let result: Node | null = null;

  for (let i = 0; i < sheetList.length; i++) {
    const current = sheetList[i];
    if (!current) continue;

    if (current.workSheetId == id) {
      result = current;
      break;
    }

    if (current.type === 2) {
      result = findSheet(id, current.items);
      if (result) {
        break;
      }
    }
  }

  return result;
}

export function getSheetListFirstId<Node extends WorksheetMenuNode<Node> = WorksheetMenuItem>(
  sheetList: Node[] = [],
  isCharge = true,
): string | null | undefined {
  let result: string | null | undefined = null;

  for (let i = 0; i < sheetList.length; i++) {
    const current = sheetList[i];
    if (!current) continue;

    if (current.type === 2) {
      result = getSheetListFirstId(current.items, isCharge);
      if (result) {
        break;
      }
    } else if (isCharge ? true : [1, 4].some(status => status === current.status) && !current.navigateHide) {
      result = current.workSheetId;
      break;
    }
  }

  return result;
}

export const moveSheetCache = (appId: string, groupId: string) => {
  const storageKey = `mdAppCache_${md.global.Account.accountId}_${appId}`;
  const storage = decodeAppCache(localStorage.getItem(storageKey) || '{}');
  const worksheets = (storage.worksheets || []).map(data => {
    if (data.groupId === groupId) {
      data.worksheetId = '';
    }

    return data;
  });
  storage.worksheets = worksheets;
  storage.lastWorksheetId = '';
  safeLocalStorageSetItem(storageKey, JSON.stringify(storage));
};

export const getHighAuthSheetSwitchPermit = <Permit extends SheetSwitchPermitItem>(
  sheetSwitchPermit: Permit[],
  worksheetId: string,
) => {
  return sheetSwitchPermit.map(l => ({ ...l, state: true, viewIds: (l.viewIds || []).concat(worksheetId) }));
};

// 本地存储当前选中菜单
export const saveSelectExtensionNavType = (worksheetId: string, navType: string, navValue: string) => {
  const sheetConfigNavInfo = decodeExtensionNavigation(localStorage.getItem('sheetConfigNavInfo') || '{}');

  const worksheetSelection = sheetConfigNavInfo[worksheetId] || {};
  sheetConfigNavInfo[worksheetId] = worksheetSelection;
  worksheetSelection[navType] = navValue;
  const sheetIds = Object.keys(sheetConfigNavInfo);

  const firstSheetId = sheetIds[0];
  if (sheetIds.length > 10 && firstSheetId !== undefined) {
    delete sheetConfigNavInfo[firstSheetId];
  }

  safeLocalStorageSetItem('sheetConfigNavInfo', JSON.stringify(sheetConfigNavInfo));
};

export function getListStyle(listStyleStrOfView?: string, listStyleStrOfWorksheet?: string): WorksheetListStyle {
  let availableListStyle: WorksheetListStyle | undefined;
  let listStyleOfWorksheet: WorksheetListStyle;
  let listStyleOfView: WorksheetListStyle;

  if (!listStyleStrOfWorksheet && listStyleStrOfView) {
    availableListStyle = decodeListStyle(listStyleStrOfView);
  } else if (listStyleStrOfWorksheet && !listStyleStrOfView) {
    availableListStyle = decodeListStyle(listStyleStrOfWorksheet);
  } else {
    listStyleOfWorksheet = decodeListStyle(listStyleStrOfWorksheet);
    listStyleOfView = decodeListStyle(listStyleStrOfView);
    availableListStyle = sortBy([listStyleOfWorksheet, listStyleOfView], 'time').pop();
  }

  return availableListStyle || {};
}

export function getSheetColumnWidthsOfStyles(
  columnStyles: Array<SheetColumnStyle & { cid: string }> = [],
): SheetColumnWidths {
  const sheetColumnWidthsMap = new Map<string, number | undefined>();
  columnStyles.forEach(item => {
    sheetColumnWidthsMap.set(item.cid, item.width);
  });
  return Object.fromEntries(sheetColumnWidthsMap);
}

export function getSheetColumnWidthsMap(
  view: WorksheetView = { advancedSetting: { liststyle: '' } },
  worksheetInfo: WorksheetInfo = { advancedSetting: { liststyle: '' }, template: { controls: [] } },
): SheetColumnWidthsSnapshot {
  const listStyleStrOfWorksheet = worksheetInfo.advancedSetting?.liststyle;
  const listStyleStrOfView = view.advancedSetting?.liststyle;
  if (!listStyleStrOfView && !listStyleStrOfWorksheet) return {};
  const { time, styles } = getListStyle(listStyleStrOfView, listStyleStrOfWorksheet);
  return {
    time,
    map: getSheetColumnWidthsOfStyles(styles),
  };
}

export function getCardWidth(view: WorksheetView): number | undefined {
  const cardwidth = _.get(view, 'advancedSetting.cardwidth');

  if (!cardwidth) return undefined;

  const cardWidthPresets: Partial<Record<string, number>> = CARD_WIDTH_SETTING;
  const cardWidth = cardWidthPresets[cardwidth] || Number(cardwidth);
  const isPresetSize = Number(cardwidth) < 5;
  const coverPosition: unknown = isPresetSize ? _.get(getCoverStyle(view), 'coverPosition') : undefined;
  const positionIsLeftOrRight =
    isPresetSize && ['0', '1'].some(position => position === (coverPosition || (view.viewType === 3 ? '2' : '1')));

  return positionIsLeftOrRight ? cardWidth + 96 : cardWidth;
}

// 【按钮 / 打印模板用泛型】函数只读按钮的 btnId、status 和打印模板的 id、name，其余字段原样带进结果；
// 用泛型把调用方自己的元素类型保住。默认值 [] 不写类型的话会被推成 never[]，调用方一旦传进有类型的数组就报错。
export function getSheetOperatesButtons<
  B extends WorksheetButtonSource = WorksheetButtonSource,
  P extends WorksheetPrintSource = WorksheetPrintSource,
>(
  view: WorksheetView | undefined,
  { buttons = [], printList = [] }: { buttons?: B[] | undefined; printList?: P[] | undefined } = {},
): WorksheetOperateButton<B, P>[] {
  const actionColumn = decodeActionColumn(view?.advancedSetting?.['actioncolumn']);
  let result: WorksheetOperateButton<B, P>[] = [];
  actionColumn.forEach(c => {
    if (c.type === 'btn') {
      const matchBtn = buttons.find((button): button is B & { btnId: string } => button.btnId === c.id);

      // 过滤已停用的按钮（status === 0）
      if (matchBtn && matchBtn.status !== 0) {
        result.push({ ...matchBtn, type: 'custom_button' });
      }
    } else if (c.type === 'group') {
      const layoutKey = c.source === 'detail' ? 'detailgroup' : 'listgroup';
      const groupLayout = decodeButtonGroups(view?.advancedSetting?.[layoutKey]);
      const groupDef = (groupLayout || []).find(g => g && g.type === 'group' && g.id === c.id);

      if (!groupDef) {
        return;
      }

      // 行内操作里分组优先于单按钮，组内按钮可能已不在 actioncolumn 中，这里按分组布局展开并过滤停用按钮。
      const memberButtons = (groupDef.btns || [])
        .map(id => buttons.find((button): button is B & { btnId: string } => button.btnId === id))
        .filter((button): button is B & { btnId: string } => Boolean(button))
        .filter(b => b.status !== 0)
        .map((b): CustomOperateButton<B> => ({ ...b, type: 'custom_button' }));

      if (!memberButtons.length) {
        return;
      }

      result.push({
        type: 'group_ref',
        btnId: `group:${c.source || 'list'}:${c.id}`,
        id: c.id,
        source: c.source,
        name: groupDef.name,
        icon: groupDef.icon,
        iconUrl: groupDef.iconUrl,
        iconColor: groupDef.iconColor,
        buttons: memberButtons,
      });
    } else if (c.type === 'print') {
      const printItem = printList.find((template): template is P & { id: string } => template.id === c.id);

      if (printItem) {
        result.push({
          name: printItem.name,
          icon: 'print',
          color: 'var(--color-primary)',
          type: 'print',
          btnId: printItem.id,
          printItem,
        });
      }
    } else if (includes(['copy', 'share', 'delete', 'sysprint'], c.type)) {
      result.push({
        btnId: c.type,
        type: c.type,
        color: c.type === 'delete' ? '#F44336' : '#1677ff',
        name: {
          copy: _l('复制'),
          share: _l('分享'),
          delete: _l('删除'),
          sysprint: _l('打印'),
        }[c.type],
        icon: {
          copy: 'copy',
          share: 'share',
          delete: 'trash',
          sysprint: 'print',
        }[c.type],
      });
    }
  });
  return result.filter(identity);
}

export function getSheetOperateButtonIds(
  buttons: {
    type?: string | undefined;
    btnId?: string | undefined;
    buttons?: { btnId?: string | undefined }[] | undefined;
  }[] = [],
) {
  return _.flatMap(buttons, button =>
    button.type === 'group_ref' && _.isArray(button.buttons)
      ? button.buttons.map(member => member.btnId)
      : [button.btnId],
  ).filter((id): id is string => Boolean(id));
}

export function getSheetOperatesButtonsStyle(view: WorksheetView | undefined): OperateButtonStyleConfig {
  const { icon, style, btncount, primarycount } = decodeButtonStyle(view?.advancedSetting?.['acstyle']);
  const styles: Record<string, OperatesButtonStyle | undefined> = {
    1: 'standard',
    2: 'text',
    3: 'icon',
  };
  return {
    showIcon: icon === 1,
    style: Object.hasOwn(styles, String(style)) ? styles[String(style)] : undefined,
    visibleNum: Number(btncount),
    primaryNum: Number(primarycount),
  };
}

function getTextWidth(text = '1', fontSize = 13) {
  let result;
  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.fontWeight = 'bold';
  div.style.left = '-10000px';
  div.style.top = '-10000px';
  div.style.zIndex = '99999';
  div.style.fontSize = `${fontSize}px`;
  div.innerHTML = text;
  document.body.appendChild(div);
  result = div.clientWidth;
  document.body.removeChild(div);
  return result;
}

export function getOperatesButtonsWidth({
  buttons = [],
  style,
  visibleNum,
  showIcon,
}: OperatesButtonsWidthOptions = {}) {
  const fontSize = 12;
  const iconWidth = 20;
  const marginRight = 6;
  const iconMarginRight = 4;
  const buttonPadding = 8 * 2;
  const cellPadding = 10 * 2;
  const showMore = buttons.length > (visibleNum ?? NaN);
  const moreButtonWidth = 28;
  const cellBorderWidth = 1 * 2;
  const groupChevronWidth = 16;

  function getButtonWidth(
    button: NonNullable<OperatesButtonsWidthOptions['buttons']>[number],
    { noMarginRight = false } = {},
  ) {
    let buttonWidth = 0;
    let textWidth = 0;
    const isGroup = button && button.type === 'group_ref';

    if (style === 'icon') {
      buttonWidth = 28 + (noMarginRight ? 0 : marginRight);
    } else if (style === 'text') {
      textWidth = getTextWidth(button.name, fontSize);
      if (textWidth > 200) {
        textWidth = 200;
      }

      buttonWidth =
        textWidth +
        buttonPadding +
        (showIcon && button.icon ? iconWidth + iconMarginRight : 0) +
        (isGroup ? groupChevronWidth : 0);
    } else if (style === 'standard') {
      textWidth = getTextWidth(button.name, fontSize);
      if (textWidth > 200) {
        textWidth = 200;
      }

      buttonWidth =
        textWidth +
        buttonPadding +
        (showIcon && button.icon ? iconWidth + iconMarginRight : 0) +
        (isGroup ? groupChevronWidth : 0) +
        (noMarginRight ? 0 : marginRight) +
        2;
    }

    return buttonWidth;
  }

  const visibleButtons = buttons.slice(0, visibleNum);
  let sumWidth = sum(
    visibleButtons.map((buttion, i) =>
      getButtonWidth(buttion, {
        noMarginRight: i === visibleButtons.length - 1 && !showMore,
      }),
    ),
  );

  if (showMore) {
    sumWidth += moreButtonWidth;
  }

  return sumWidth + cellPadding + cellBorderWidth;
}

/**
 * 工作表的功能开关项（sheetSwitchPermit 的元素）。
 * 判定在 pages/FormSet/util.ts 的 isOpenPermit：按 type 找到项，再看 state 和 viewIds
 *（viewIds 为空表示对所有视图生效）。
 */
// 【按钮用泛型而不是 any[]】函数只读 button.type，其余字段原样带出去，
// 用 T 能把调用方自己的按钮类型保住，不会在这里被抹平。
export function filterButtonBySheetSwitchPermit<T extends { type?: string }>(
  buttons: T[] = [],
  sheetSwitchPermit?: SheetSwitchPermitItem[],
  viewId?: string,
  // 调用点传进来的是整行记录，不是只有这两个开关的字面量 —— 按调用点标类型
  row: RecordRow = {
    allowedit: true,
    allowdelete: true,
  },
) {
  return (buttons = buttons.filter(button => {
    if (button.type === 'delete') {
      return isOpenPermit(permitList.recordDelete, sheetSwitchPermit, viewId) && row['allowdelete'];
    } else if (button.type === 'share') {
      return (
        (isOpenPermit(permitList.recordShareSwitch, sheetSwitchPermit, viewId) ||
          isOpenPermit(permitList.embeddedLink, sheetSwitchPermit, viewId)) &&
        !md.global.Account.isPortal
      );
    } else if (button.type === 'copy') {
      return isOpenPermit(permitList.recordCopySwitch, sheetSwitchPermit, viewId) && row['allowedit'];
    } else if (button.type === 'sysprint') {
      return isOpenPermit(permitList.recordPrintSwitch, sheetSwitchPermit, viewId);
    }

    return true;
  }));
}

function getSheetStylesOfObject(object?: { advancedSetting?: ControlAdvancedSetting | undefined }): SheetTableStyles {
  const listStyle = object?.advancedSetting?.liststyle;
  if (!listStyle) return { columnStyles: {}, sheetColumnWidths: {} };
  const { time: updateTime, styles = [] } = decodeListStyle(listStyle);
  const columnStyles: SheetTableStyles['columnStyles'] = {};
  const sheetColumnWidths: SheetTableStyles['sheetColumnWidths'] = {};
  styles.forEach(item => {
    columnStyles[item.cid] = item;
    sheetColumnWidths[item.cid] = item.width;
  });
  return { updateTime, columnStyles, sheetColumnWidths };
}
function isColumnStyleView(view?: WorksheetView): boolean {
  return (
    Number(view?.viewType) === 0 ||
    (String(view?.viewType) === '2' && view?.advancedSetting?.['hierarchyViewType'] === '3')
  );
}
export function getSheetStylesOfRelateRecordTable({
  control,
  viewId,
  worksheetInfo,
  manageView,
}: {
  control?: FormControl | undefined;
  viewId?: string | undefined;
  worksheetInfo?: Pick<WorksheetInfo, 'advancedSetting' | 'views'> | undefined;
  manageView?: WorksheetView | undefined;
} = {}): SheetTableStyles {
  if (control?.advancedSetting?.['usecolumnstyle'] !== '1') {
    let sheetColumnWidths: SheetTableStyles['sheetColumnWidths'] = {};
    const serializedWidths = control?.advancedSetting?.widths;
    if (serializedWidths) {
      const widths: unknown = safeParse(serializedWidths, 'array');
      if (Array.isArray(widths)) {
        widths.forEach((width: unknown, index) => {
          const controlId = control?.showControls?.[index];
          if (controlId && (typeof width === 'number' || typeof width === 'string'))
            sheetColumnWidths[controlId] = width;
        });
      } else if (isObject(widths)) {
        Object.entries(widths).forEach(([controlId, width]) => {
          if (typeof width === 'number' || typeof width === 'string') sheetColumnWidths[controlId] = width;
        });
      }
    }
    return { columnStyles: {}, sheetColumnWidths };
  }
  const manageViewStyles = manageView && getSheetStylesOfObject(manageView);
  const worksheetSheetStyles = manageViewStyles?.updateTime ? manageViewStyles : getSheetStylesOfObject(worksheetInfo);
  if (!viewId) return worksheetSheetStyles;
  const views = worksheetInfo?.views || [];
  const view = views.find(item => item.viewId === viewId);
  const styledView =
    view && isColumnStyleView(view)
      ? view
      : views.find(item => isColumnStyleView(item) && Boolean(item.advancedSetting?.liststyle));
  const viewStyles = getSheetStylesOfObject(styledView);
  return viewStyles.updateTime ? viewStyles : worksheetSheetStyles;
}

export function getGroupControlId(view: WorksheetView | undefined): string | undefined {
  const groups: unknown = safeParse(view?.advancedSetting?.['groupsetting'], 'array');
  const first: unknown = Array.isArray(groups) ? groups[0] : undefined;
  return isObject(first) && typeof first['controlId'] === 'string' ? first['controlId'] : undefined;
}

export function getFiltersForGroupedView(
  control: Pick<FormControl, 'controlId' | 'type'>,
  groupKey: string,
): WorksheetFilterCondition {
  if (String(groupKey) === '-1') {
    return {
      controlId: control.controlId,
      dataType: control.type,
      spliceType: 1,
      filterType: 7,
    };
  }

  if (
    includes(
      [
        WIDGETS_TO_API_TYPE_ENUM.FLAT_MENU,
        WIDGETS_TO_API_TYPE_ENUM.MULTI_SELECT,
        WIDGETS_TO_API_TYPE_ENUM.DROP_DOWN,
        WIDGETS_TO_API_TYPE_ENUM.RELATE_SHEET,
        WIDGETS_TO_API_TYPE_ENUM.USER_PICKER,
        WIDGETS_TO_API_TYPE_ENUM.ORG_ROLE,
        WIDGETS_TO_API_TYPE_ENUM.DEPARTMENT,
      ],
      control.type,
    )
  ) {
    return {
      controlId: control.controlId,
      dataType: control.type,
      spliceType: 1,
      filterType: 51,
      dynamicSource: [],
      values: [groupKey],
    };
  }

  if (control.type === WIDGETS_TO_API_TYPE_ENUM.SCORE) {
    return {
      controlId: control.controlId,
      dataType: control.type,
      spliceType: 1,
      filterType: 2,
      dynamicSource: [],
      values: [groupKey],
    };
  }

  return {};
}
