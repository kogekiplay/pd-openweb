import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Drawer } from 'antd';
import cx from 'classnames';
import PropTypes from 'prop-types';
import type { RootState } from 'src/redux/configureStore';
import { updateNodeData } from '../../redux/actions';
import { NODE_TYPE } from '../enum';
import nodeModules from './nodeModules';
import './index.less';

class Detail extends Component<any, any> {
  static propTypes = {
    companyId: PropTypes.string,
    processId: PropTypes.string,
    relationId: PropTypes.string,
    relationType: PropTypes.number,
    flowInfo: PropTypes.any,
    selectNodeId: PropTypes.string.isRequired,
    selectNodeType: PropTypes.any.isRequired,
    selectNodeName: PropTypes.string,
    closeDetail: PropTypes.func.isRequired,
    haveChange: PropTypes.func,
    isIntegration: PropTypes.bool,
    customNodeName: PropTypes.string,
    updateNodeData: PropTypes.func,
    connectId: PropTypes.string,
    hasAuth: PropTypes.bool,
    isPlugin: PropTypes.bool,
    isAIActions: PropTypes.bool,
  };

  static defaultProps = {
    flowInfo: {},
    haveChange: () => {},
    connectId: '',
    hasAuth: false,
  };

  constructor(props) {
    super(props);
  }

  /**
   * 渲染内容
   */
  renderContent() {
    const { selectNodeType, relationId, isIntegration } = this.props;
    const NodeComponent = nodeModules[selectNodeType];

    if (!NodeComponent) return null;

    return (
      <NodeComponent
        {...Object.assign({}, { updateNodeData: this.updateNodeData }, this.props, {
          relationId: isIntegration ? '' : relationId,
        })}
      />
    );
  }

  /**
   * 更新节点数据
   */
  updateNodeData = data => {
    const { processId } = this.props;

    this.props.dispatch(updateNodeData(processId, data));
  };

  render() {
    const { selectNodeId, selectNodeType, flowInfo, instanceId } = this.props;
    const NodeComponent = nodeModules[selectNodeType];

    // 分支
    if (selectNodeType === NODE_TYPE.BRANCH_ITEM) {
      return <NodeComponent updateNodeData={this.updateNodeData} {...this.props} />;
    }

    return (
      (<Drawer
        placement="right"
        rootClassName="Absolute"
        open={!!selectNodeId}
        closable={false}
        mask={false}
        getContainer={false}
        styles={{ body: { padding: 0 } }}
        rootStyle={{ zIndex: 9 }}
        size={800}
      >
        <div className="workflowSettings h100">
          <div
            className={cx('workflowDetail flexColumn h100', {
              workflowDetailRelease: !!flowInfo.parentId || instanceId,
            })}
          >
            {this.renderContent()}
          </div>
        </div>
      </Drawer>)
    );
  }
}

// `Detail as React.ComponentType<any>` 是【纯类型断言】，运行时零影响，但不能省：
// @types/react 18 的 JSX.LibraryManagedAttributes 有个 propTypes 分支
//   C extends { propTypes: infer T; defaultProps: infer D } ? Defaultize<MergePropTypes<P, InferProps<T>>, D> : …
// P 为 any 时 MergePropTypes 直接返回 any，所以外部爱传什么传什么。
// v19 把 propTypes 分支整个删了，只剩 C extends { defaultProps: infer D } ? Defaultize<P, D> : P。
// 而 Defaultize<any, D> 会把 any 【塌缩成具体对象类型】
// （Pick<any, Exclude<keyof any, keyof D>> & Partial<…>），于是 7 个调用点传的
// companyId / processId / relationId / selectNodeId… 全部被判成"不在允许的 props 里"
// （报文是 not assignable to 'IntrinsicAttributes & ({ context?…; store?… } | {…})'）。
// 断言成 ComponentType<any> 后这个类型上没有 defaultProps，LibraryManagedAttributes
// 走 else 分支原样返回 any，回到升级前的口径。
// 注意：static defaultProps 仍然保留，运行时默认值照常生效 —— 类组件的 defaultProps
// 在 React 19 里没有被移除（被移除的是【函数组件】上的）。
// `state: RootState` 这个标注不能省。原来写的是裸 `state => state.workflow`，
// 返回类型是 any，于是 react-redux 推出 TStateProps = any；它再用
// Omit<OwnProps, keyof TStateProps> 去掉"由 store 提供"的那部分 ——
// keyof any 是 string | number | symbol，结果 own props 被整个抹成 {}。
// 外部能传的就只剩 connect 自己的 { context?, store? }，7 个调用点传的
// companyId / processId / relationId / selectNodeId… 全部报
// not assignable to 'IntrinsicAttributes & ({ context?…; store?… } | {…})'。
//
// 升级前没暴露，是因为 @types/react 18 的 JSX.LibraryManagedAttributes 里有
// propTypes 分支（MergePropTypes<P, InferProps<T>>，P 为 any 时直接返回 any），
// 把这个塌缩盖住了；v19 把该分支整个删掉，塌缩就露出来了。
// 标对 state 类型后 TStateProps 是具体类型，Omit 正常工作，不需要再往外层加 any。
export default connect((state: RootState) => state.workflow)(Detail);
