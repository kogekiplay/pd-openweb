import _ from 'lodash';
import SplitLineSection from 'src/pages/widgetConfig/widgetSetting/components/SplitLineConfig/SplitLineSection.jsx';

interface SplitLineProps {
  from?: string | number | undefined;
  expandWidgetIds?: Array<string | undefined> | undefined;
  setNavVisible?: (() => void) | undefined;
  registerCell?: ((cell: unknown) => void) | undefined;
  worksheetId?: string | undefined;
  widgetStyle?: { sectionstyle?: string | undefined; [key: string]: unknown } | undefined;
  [key: string]: unknown;
}

const SplitLine = (props: SplitLineProps) => {
  const { from, expandWidgetIds, setNavVisible, registerCell, worksheetId } = props;
  const sectionStyle = _.get(props, 'widgetStyle.sectionstyle') || '0';

  return (
    <SplitLineSection
      data={props}
      from={from}
      fromType="display"
      worksheetId={worksheetId}
      sectionstyle={sectionStyle}
      expandWidgetIds={expandWidgetIds || []}
      setNavVisible={setNavVisible}
      registerCell={registerCell}
    />
  );
};

export default SplitLine;
