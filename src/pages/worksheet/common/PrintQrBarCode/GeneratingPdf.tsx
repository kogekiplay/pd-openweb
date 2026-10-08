import { useEffect, useRef, useState } from 'react';
import _, { includes } from 'lodash';
import functionWrap from 'ming-ui/components/FunctionWrap';
import worksheetAjax from 'src/api/worksheet';
import { getFilledRequestParams, pathCompletion } from 'src/utils/common';
import type { FormControl, RecordRow } from 'src/utils/controlTypes';
import BatchPrintErrorModal from '../BatchPrintErrorModal';
import { normalizePrintableRows } from '../printRowUtils';
import { type BatchPrintError, precheckPrint } from '../recordInfo/RecordForm/RecordPrint/printCount';
import { PRINT_TYPE, SOURCE_TYPE, SOURCE_URL_TYPE } from './enum';
import GeneratingPopup from './GeneratingPopup';
import { QrPdf } from './print';
import type { CodeUrlSource } from './types';
import { getCodeContent, getCodeTexts } from './util';
import { generateLabelPdf } from './vectorLabel';

const PAGE_SIZE = 200;

export default function GeneratingPdf(props) {
  const {
    config,
    appId,
    worksheetId,
    viewId,
    templateId,
    projectId,
    controls,
    zIndex,
    selectedRows,
    count,
    allowLoadMore,
    filterControls,
    fastFilters,
    navGroupFilters,
    precheckError: initialPrecheckError,
    precheckEnabled,
    onAllPrecheckFailed = () => {},
    onClose,
  }: { controls: FormControl[]; selectedRows: RecordRow[]; [key: string]: any } = props;
  const [printConfig, setPrintConfig] = useState(config && { ...config });
  const [loading, setLoading] = useState(true);
  // 必须显式给类型参数：useState() 不带初值会被推成 useState<undefined>，
  // setter 就只收 undefined，setLoadingText(字符串) / setEmbedUrl(地址) 都报 TS2345。
  const [loadingText, setLoadingText] = useState<string | undefined>();
  const rows = useRef(selectedRows);
  const shouldLoadDataOnOpen = useRef(allowLoadMore && selectedRows.length !== count);
  const [precheckError, setPrecheckError] = useState<BatchPrintError | undefined>(initialPrecheckError);
  const [pageIndex, setPageIndex] = useState(1);
  const [embedUrl, setEmbedUrl] = useState<string | undefined>();
  const [name, setName] = useState(props.name);

  async function loadData(pageIndex = 1, cb = () => {}) {
    setLoading(true);
    setEmbedUrl(undefined);
    try {
      const response = await worksheetAjax.getFilterRows(
        getFilledRequestParams({
          worksheetId,
          viewId,
          pageSize: PAGE_SIZE,
          pageIndex,
          status: 1,
          appId,
          filterControls,
          fastFilters,
          navGroupFilters,
        }),
      );
      let printableRows = normalizePrintableRows(response.data);
      if (precheckEnabled) {
        const rowIds = printableRows.map(row => row.rowid);
        const result = await precheckPrint({ projectId, worksheetId, printId: templateId, rowIds });
        if (rowIds.length === 1 && result.failedRows.length) {
          alert(_l('当前模板已达到打印上限'), 2);
          onClose();
          return;
        }
        const successfulIds = new Set(result.successRows.map(row => row.rowId));
        const error: BatchPrintError | undefined = result.failedRows.length
          ? { templateName: name || _l('未命名'), recordNames: result.failedRows.map(row => row.rowTitle) }
          : undefined;
        printableRows = printableRows.filter(row => successfulIds.has(row.rowid));
        if (!printableRows.length) {
          onClose();
          onAllPrecheckFailed(error);
          return;
        }
        setPrecheckError(error);
      }
      rows.current = printableRows;
      cb();
    } catch {
      onClose();
    }
  }

  async function handlePrint(config) {
    async function execute(urls?: CodeUrlSource) {
      const printData = rows.current.map((row, i) => ({
        value: getCodeContent({
          printType: config.printType,
          sourceType: config.sourceType,
          sourceControlId: config.sourceControlId,
          row,
          urls,
          index: i,
          controls,
        }),
        texts: getCodeTexts(
          {
            showTexts: config.showTexts,
            showControlName: config.showControlName,
            controls,
            firstIsBold: config.firstIsBold,
          },
          row,
        ),
      }));
      const usePdfKit = includes([PRINT_TYPE.QR, PRINT_TYPE.BAR], config.printType);

      if (usePdfKit) {
        const blobUrl = await generateLabelPdf({
          ...config,
          printData,
          onProgress: progressText => {
            setLoadingText(progressText);
          },
        });
        setEmbedUrl(blobUrl);
        setLoading(false);
      } else {
        const pdf = new QrPdf({
          printType: config.printType,
          layout: config.layout,
          printData,
          correctLevel: config.codeFaultTolerance || 1,
          config: config,
        });
        await pdf.render();
        // jspdf 的 output('bloburl') 返回 URL 对象，而 embedUrl 要当 iframe 的 src 用，
        // 显式转成字符串（React 渲染时本来也会 stringify，这里只是把类型摆正）。
        setEmbedUrl(String(pdf.doc.output('bloburl')));
        setLoading(false);
      }
    }

    if (config.sourceType === SOURCE_TYPE.URL && config.sourceUrlType === SOURCE_URL_TYPE.PUBLIC) {
      worksheetAjax
        .getRowsShortUrl({
          appId,
          viewId,
          worksheetId,
          rowIds: rows.current.map(data => data.rowid),
        })
        .then(data => {
          if (data && _.isObject(data)) {
            execute(data as CodeUrlSource);
          }
        });
    } else if (config.sourceType === SOURCE_TYPE.URL && config.sourceUrlType === SOURCE_URL_TYPE.MEMBER) {
      execute(rows.current.map(r => pathCompletion(`/app/${appId}/${worksheetId}/${viewId}/row/${r.rowid}`)));
    } else if (config.sourceType === SOURCE_TYPE.CONTROL) {
      if (config.sourceControlId) {
        execute();
      } else {
        alert(_l('请选择数据来源字段'), 3);
      }
    }
  }

  useEffect(() => {
    function print(config) {
      if (shouldLoadDataOnOpen.current) {
        loadData(1, () => handlePrint(config));
      } else {
        handlePrint(config);
      }
    }

    if (printConfig) {
      print(printConfig);
    } else {
      worksheetAjax
        .getCodePrint({
          id: templateId,
          projectId,
        })
        .then(async data => {
          setPrintConfig(data.config);
          setName(data.name);
          print(data.config);
        });
    }
  }, []);
  return (
    <>
      <GeneratingPopup
        allowLoadMore={allowLoadMore}
        pageIndex={pageIndex}
        pageSize={PAGE_SIZE}
        count={count}
        zIndex={zIndex}
        loading={loading}
        loadingText={loadingText}
        name={name}
        embedUrl={embedUrl}
        onPrev={() => {
          setPageIndex(pageIndex - 1);
          loadData(pageIndex - 1, () => handlePrint(printConfig));
        }}
        onNext={() => {
          setPageIndex(pageIndex + 1);
          loadData(pageIndex + 1, () => handlePrint(printConfig));
        }}
        onClose={onClose}
      />
      {embedUrl && precheckError && (
        <BatchPrintErrorModal
          {...precheckError}
          zIndex={(zIndex || 1000) + 1}
          onClose={() => setPrecheckError(undefined)}
        />
      )}
    </>
  );
}

export const generatePdf = props => functionWrap(GeneratingPdf, props);
