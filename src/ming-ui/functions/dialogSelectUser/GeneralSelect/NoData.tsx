import './css/noData.less';

export interface NoDataProps {
  children: React.ReactNode;
}

const NoData = (props: NoDataProps) => {
  return (
    <div className="GSelect-NoData">
      <i className="icon-person GSelect-iconNoData" />
      <p className="GSelect-noDataText">{props.children}</p>
    </div>
  );
};

export default NoData;
