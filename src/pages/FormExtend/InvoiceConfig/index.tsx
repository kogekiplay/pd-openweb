import { Component, Fragment } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import { Button, Dropdown, Input, LoadDiv, RadioGroup, Support, Switch } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import type { DropdownOption } from 'ming-ui/components/Dropdown';
import merchantInvoiceApi from 'src/api/merchantInvoice';
import worksheetSettingApi from 'src/api/worksheetSetting';
import { NORMAL_SYSTEM_FIELDS_SORT, WORKFLOW_SYSTEM_FIELDS_SORT } from 'src/pages/worksheet/common/ViewConfig/enum';
import { navigateTo } from 'src/router/navigateTo';
import type { FormControl } from 'src/utils/controlTypes';
import MapField from '../common/MapField';
import CustomRemark from './CustomRemark';
import { invoiceSettings, productOptions, taxOptions } from './optionModels';
import type { InvoiceSettings, TaxOption } from './optionModels';
import '../common/payAndInvoice.less';

interface InvoiceConfigProps {
  worksheetInfo?:
    | {
        projectId?: string | undefined;
        appId?: string | undefined;
        worksheetId?: string | undefined;
        template?: { controls?: FormControl[] | undefined } | undefined;
      }
    | undefined;
}
interface InvoiceConfigState extends InvoiceSettings {
  loading: boolean;
  loadError: boolean;
  productError: boolean;
  productLoading: boolean;
  taxList: TaxOption[];
  productList: DropdownOption<string>[];
  settingChanged: boolean;
}

export default class InvoiceConfig extends Component<InvoiceConfigProps, InvoiceConfigState> {
  private active = true;
  private requestGeneration = 0;
  private productGeneration = 0;
  private editGeneration = 0;

  constructor(props: InvoiceConfigProps) {
    super(props);

    this.state = {
      loading: true,
      loadError: false,
      productError: false,
      productLoading: false,
      taxList: [],
      productList: [],
      settingChanged: false,

      scenes: { payment: false },
      taxNo: '',
      contentType: 1,
      productId: '',
      remark: '',
      fieldMaps: {},
      invoiceCustomRemark: '',
    };
  }

  override componentDidMount() {
    this.active = true;
    this.getData();
  }

  override componentWillUnmount() {
    this.active = false;
    this.requestGeneration++;
    this.productGeneration++;
  }

  getData = () => {
    const generation = ++this.requestGeneration;
    ++this.productGeneration;
    this.setState({ loading: true, loadError: false });
    const { projectId, appId, worksheetId } = this.props.worksheetInfo || {};

    Promise.all([
      worksheetSettingApi.getInvoiceSetting({ projectId, appId, worksheetId }),
      merchantInvoiceApi.getTaxInfoForDropdownList({ projectId, appId }),
    ])
      .then(([settingResponse, taxResponse]) => {
        if (!this.active || generation !== this.requestGeneration) return;
        const settings = invoiceSettings(settingResponse);
        const taxList = taxOptions(taxResponse ?? []);
        const taxNo = settings.taxNo || taxList[0]?.value;
        this.setState({
          ...settings,
          taxList,
          taxNo,
          loading: false,
          remark: settings.remark || _l('发票申请已提交，将进入管理员审核，请您耐心等待！'),
        });
        if (taxNo) this.getProductList(taxNo);
      })
      .catch(() => {
        if (this.active && generation === this.requestGeneration) this.setState({ loading: false, loadError: true });
      });
  };

  getProductList = (taxNo: string | undefined, resetSelection = false) => {
    const generation = ++this.productGeneration;
    this.setState({
      productError: false,
      productLoading: !!taxNo,
      productList: [],
      ...(resetSelection ? { productId: undefined } : {}),
    });
    if (!taxNo) {
      this.setState({ productList: [], productId: undefined });
      return;
    }
    const { projectId, appId } = this.props.worksheetInfo || {};
    merchantInvoiceApi
      .getSimpleInvoiceProducts({ projectId, appId, taxNo })
      .then(res => {
        if (!this.active || generation !== this.productGeneration) return;
        const list = productOptions(res);

        this.setState({
          productList: list,
          productLoading: false,
          productId: list.map(item => item.value).includes(this.state.productId) ? this.state.productId : undefined,
        });
      })
      .catch(() => {
        if (this.active && generation === this.productGeneration)
          this.setState({ productError: true, productLoading: false });
      });
  };

  onChangeConfig = (updateObj: InvoiceSettings) => {
    ++this.editGeneration;
    this.setState({ ...updateObj, settingChanged: true });
  };

  onSave = () => {
    if (this.state.loading || this.state.loadError || this.state.productError || this.state.productLoading) return;
    const generation = this.editGeneration;
    const { projectId, worksheetId } = this.props.worksheetInfo || {};
    const { taxNo, scenes, productId, remark, fieldMaps, invoiceCustomRemark } = this.state;

    if (!taxNo) {
      alert(_l('请选择开票主体'), 3);
      return;
    }

    worksheetSettingApi
      .saveInvoiceSetting({
        projectId,
        worksheetId,
        taxNo,
        scenes,
        productId,
        remark,
        fieldMaps,
        mapWorksheetId: worksheetId,
        invoiceCustomRemark,
      })
      .then(res => {
        if (!this.active) return;
        if (res === true) {
          alert(_l('保存成功'));
          if (generation === this.editGeneration) this.setState({ settingChanged: false });
        } else {
          alert(_l('保存失败'), 2);
        }
      })
      .catch(() => {
        if (this.active) alert(_l('保存失败'), 2);
      });
  };

  override render() {
    const { projectId } = this.props.worksheetInfo || {};
    const {
      loading,
      scenes = {},
      taxNo,
      taxList,
      contentType,
      remark,
      fieldMaps = {},
      productId,
      productList,
      isOpenPayment,
      boundControlIds,
      invoiceCustomRemark = '',
      loadError,
      productError,
      productLoading,
    } = this.state;
    const controls: FormControl[] = _.get(this.props.worksheetInfo, 'template.controls') || [];

    if (loading) {
      return <LoadDiv className="mTop20" />;
    }
    if (loadError) {
      return (
        <div className="mTop20">
          <span>{_l('加载失败')}</span>
          <Button className="mLeft10" onClick={this.getData}>
            {_l('重试')}
          </Button>
        </div>
      );
    }

    return (
      <div className="payAndInvoiceWrap">
        <div className="configCon">
          <div className="configTitle">{_l('开票')}</div>
          <div className="configDesc">
            {_l('支付订单及工作表的电子开票配置')}
            <Support type={3} text={_l('帮助')} href="https://help.mingdao.com/org/invoice#invoice-setting" />
          </div>
          <div className="configContent">
            <ul className="enableScene">
              {[{ key: 'payment', title: _l('支付订单') }, {}].map((item, i) => {
                const checked = item.key === 'payment' && scenes.payment;
                return (
                  <li className={cx('flexColumn', { Visibility: i === 1 })} key={item.key || 'reserved'}>
                    <div className="flexRow alignItemsCenter justifyContentBetween mBottom16">
                      <div className="Font15 bold">{item.title}</div>
                      {!isOpenPayment && !checked ? (
                        <div>
                          <Tooltip title={_l('请先开启支付功能')} placement="bottom">
                            <span>
                              <Switch
                                disabled={true}
                                size="small"
                                checked={checked}
                                onClick={() => this.onChangeConfig({ scenes: { payment: !checked } })}
                              />
                            </span>
                          </Tooltip>
                        </div>
                      ) : (
                        <Switch
                          size="small"
                          checked={checked}
                          onClick={() => this.onChangeConfig({ scenes: { payment: !checked } })}
                        />
                      )}
                    </div>
                    <div className="textTertiary flex">
                      {_l('开启后，用户在工作表记录/公开表单的场景中支付成功，即可申请电子发票。')}
                    </div>
                  </li>
                );
              })}
            </ul>

            {scenes.payment && (
              <Fragment>
                <div className="title">{_l('发票设置')}</div>
                <div className="subTitle">{_l('选择开票主体')}</div>
                {_.isEmpty(taxList) ? (
                  <div className="createLink" onClick={() => navigateTo(`/admin/invoice/${projectId}/create`)}>
                    {_l('创建开票税号')}
                  </div>
                ) : (
                  <Dropdown
                    className="w100"
                    menuClass="w100"
                    border
                    placeholder={_l('选择开票主体')}
                    value={taxNo}
                    data={taxList}
                    onChange={value => {
                      this.onChangeConfig({ taxNo: value });
                      this.getProductList(value, true);
                    }}
                    renderItem={item => {
                      return (
                        <div className="flexRow justifyContentBetween alignItemsCenter">
                          <div className="overflow_ellipsis">{item.text}</div>
                          {item.hasPay && (
                            <div
                              className="Hand colorPrimary hoverColorPrimaryDark"
                              style={{ minWidth: 'fit-content' }}
                              onClick={() => navigateTo(`/admin/invoice/${projectId}/taxNo`)}
                            >
                              {_l('付费开通')}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                )}

                {/* <div className="subTitle required">{_l('开票金额')}</div>
                <div className="textTertiary mBottom16">
                  {_l('开票总金额，支持选择数值、金额、汇总、公式，限制小数点 2 位数；支付订单开票为订单金额')}
                </div>
                <Dropdown
                  className={cx('w100', { emptyDropdown: checkIsDeleted(amountControlId, controls) })}
                  menuClass="w100"
                  border
                  placeholder={_l('选择数值、金额、汇总、公式')}
                  value={amountControlId}
                  data={[]}
                  onChange={value => this.onChangeConfig({ amountControlId: value })}
                /> */}

                <div className="subTitle">{_l('开票内容')}</div>
                <div className="textTertiary mBottom16">
                  {_l('目前仅支持按类目汇总开具发票，税率与编码随类目自动匹配。')}
                </div>
                <RadioGroup
                  size="middle"
                  checkedValue={contentType}
                  data={[
                    { text: _l('按类目汇总'), value: 1 },
                    { text: _l('明细（开发中）'), value: 2, disabled: true },
                  ]}
                  onChange={value => {
                    if (value !== undefined) this.onChangeConfig({ contentType: value });
                  }}
                />

                <div className="subTitle">{_l('选择开票类目')}</div>
                <div className="textTertiary mBottom16">
                  {_l('从组织后台的商品管理表选择默认开票类目，管理员审核时会依据编码/名称重新选择并以选择结果为准')}
                </div>
                <Dropdown
                  className="w100"
                  menuClass="w100"
                  border
                  cancelAble
                  data={productList}
                  itemLoading={productLoading}
                  value={productId || undefined}
                  onChange={value => this.onChangeConfig({ productId: value })}
                />
                {productError && (
                  <div className="mTop10">
                    <span>{_l('加载失败')}</span>
                    <Button className="mLeft10" onClick={() => this.getProductList(taxNo)}>
                      {_l('重试')}
                    </Button>
                  </div>
                )}

                <div className="subTitle">{_l('自定义发票备注')}</div>
                <div className="textTertiary mBottom16">{_l('可自定义发票备注的显示内容，仅支持文本字段')}</div>
                <CustomRemark
                  value={invoiceCustomRemark}
                  onChange={(value: string) => this.onChangeConfig({ invoiceCustomRemark: value })}
                  controlList={controls.filter(
                    ({ controlId, type }) =>
                      !_.includes([...NORMAL_SYSTEM_FIELDS_SORT, ...WORKFLOW_SYSTEM_FIELDS_SORT], controlId) &&
                      type === 2,
                  )}
                />

                <div className="title">{_l('其他')}</div>
                <div className="subTitle">{_l('说明配置')}</div>
                <div className="textTertiary mBottom16">
                  {_l('申请开票后将进入管理员审核流程，您可在此自定义提示说明；用户在查看开票进度时可看到此内容')}
                </div>
                <Input
                  className="w100"
                  placeholder={_l('请输入')}
                  maxLength={100}
                  value={remark}
                  onChange={value => this.onChangeConfig({ remark: value })}
                />

                <div className="subTitle">{_l('字段映射')}</div>
                <div className="textTertiary mBottom16">{_l('将开票明细映射到当前记录')}</div>
                <MapField
                  type="invoice"
                  controls={controls}
                  filterIds={boundControlIds || []}
                  fieldMaps={fieldMaps}
                  onOk={(data: Record<string, string>) => this.onChangeConfig({ fieldMaps: data })}
                />
              </Fragment>
            )}
          </div>
        </div>
        <div className="footer">
          <Button type="primary" disabled={productError || productLoading} onClick={this.onSave}>
            {_l('保存设置')}
          </Button>
        </div>
      </div>
    );
  }
}
