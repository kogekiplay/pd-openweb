import { useEffect, useRef, useState } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import moment from 'moment';
import { Dialog, FunctionWrap, MobileConfirmPopup } from 'ming-ui';
import worksheetAjax from 'src/api/worksheet';
import { browserIsMobile } from 'src/utils/common';

const EDIT_LOCK_STATUS = {
  UNLOCK: 1, //未锁定
  LOCKED: 2, //其他用户已锁定
  OUT_LOGIN: 3, //未登录
  UN_OPEN: 4, //未开启编辑锁
  CURRENT_USER_LOCK: 5, //当前用户锁定
  ROW_NO_EXIST: 6, //记录不存在
  ROW_NO_PERMISSION: 7, //记录无权限
  ROW_READ_ONLY: 8, //记录只读
};

/** 表单高级设置里的 roweditlock，safeParse 出来的值都是后端存的字符串；关掉编辑锁时是 {}，所以全部可选 */
interface RowEditLock {
  /** 编辑保护超时（分钟） */
  expiretime?: string;
  /** 超时前多久开始倒计时提醒（分钟），'0' 表示不提醒 */
  countdown?: string;
  /** 超时后的动作，'2' = 只能重新获取最新记录 */
  expiredaction?: string;
}

/**
 * CheckRowEditLock / GetRowEditLock 的返回。
 * 这两处都带 ajaxOptions.sync，接口【直接返回结果对象】而不是 Promise ——
 * 所以 lockData 的类型是它本身，不要写成 Promise<LockData>。
 */
interface LockData {
  /** 见 EDIT_LOCK_STATUS */
  status: number;
  /** 锁定者账号信息，只用于渲染提示 */
  lockAccount?: { [key: string]: any };
  /** 他人提交记录的时间；晚于本次 timeoutTime 说明当前编辑已失效 */
  submitTime?: string;
}

/** _.throttle 的返回值：可调用 + cancel/flush。显式写出来是为了切断 checkAndLock ↔ resetLockTimers 的类型推断环 */
type ThrottledCheck = ((getRowUpdateTime?: boolean) => boolean | undefined) & {
  cancel: () => void;
  flush: () => boolean | undefined;
};

/** 两个超时弹层共用的入参（onClose 由 FunctionWrap 注入，不在调用方手里） */
interface LockDialogProps {
  rowEditLock: RowEditLock;
  onRefreshRecord: () => void;
  checkAndLock: ThrottledCheck;
  clearThrottle: () => void;
  updateTimeoutTime: (time: number | null) => void;
}

interface RecordEditLockOptions {
  worksheetId: string;
  recordId: string;
  rowEditLock?: RowEditLock;
  updateLockedUser?: (user: LockData['lockAccount'] | null) => void;
  onLockCallBack?: () => void;
  onRefreshRecord?: () => void;
}

export default class RecordEditLock {
  declare worksheetId: string;
  declare recordId: string;
  declare rowEditLock: RowEditLock;
  declare updateLockedUser: NonNullable<RecordEditLockOptions['updateLockedUser']>;
  declare onLockCallBack: () => void;
  declare onRefreshRecord: () => void;
  declare lockStatusInterval: ReturnType<typeof setInterval> | null;
  declare toastTimer: ReturnType<typeof setTimeout> | null;
  declare lockTimer: ReturnType<typeof setTimeout> | null;
  /** 本次编辑开始计时的时刻；null 表示没有在计时 */
  declare timeoutTime: number | null;
  /** 构造函数里 getEditLockStatus() 必定赋值，所以不是可选 */
  declare lockData: LockData;

  constructor({
    worksheetId,
    recordId,
    rowEditLock,
    updateLockedUser = () => {},
    onLockCallBack = () => {},
    onRefreshRecord = () => {},
  }: RecordEditLockOptions) {
    this.worksheetId = worksheetId;
    this.recordId = recordId;
    this.rowEditLock = rowEditLock || {};
    this.updateLockedUser = updateLockedUser;
    this.onLockCallBack = onLockCallBack;
    this.onRefreshRecord = onRefreshRecord;

    this.lockStatusInterval = null;
    this.toastTimer = null;
    this.lockTimer = null;
    this.timeoutTime = null;

    this.getEditLockStatus();
  }

  //获取锁状态
  getEditLockStatus() {
    const { worksheetId, recordId } = this;
    // sync 调用【同步返回结果对象】，但 src/api/* 的包装函数统一声明成 ApiResult（见 types/global.d.ts）
    this.lockData = worksheetAjax.checkRowEditLock(
      { worksheetId, rowId: recordId },
      { ajaxOptions: { sync: true } },
    ) as unknown as LockData;

    if (this.lockData.status === EDIT_LOCK_STATUS.LOCKED) {
      if (this.lockStatusInterval) {
        clearInterval(this.lockStatusInterval);
        this.lockStatusInterval = null;
      }

      this.pollGetLockStatus();
    }
  }

  // 轮询获取锁定状态
  pollGetLockStatus() {
    const { worksheetId, recordId } = this;

    this.lockStatusInterval = setInterval(() => {
      worksheetAjax.checkRowEditLock({ worksheetId, rowId: recordId }).then((res: LockData) => {
        if (res.status === EDIT_LOCK_STATUS.UNLOCK) {
          if (this.lockStatusInterval) clearInterval(this.lockStatusInterval);
          this.updateLockedUser(null);
        }
      });
    }, 10 * 1000);
  }

  // locked 省略时表示"记录已被修改"，传 true 表示"正在被其他人编辑"
  updateTimeoutDialog = (locked?: boolean) => {
    //更新超时弹层的description文本
    const descDom = document.getElementById('timeoutDesc');

    if (descDom) {
      descDom.innerText = locked
        ? _l('正在被其他人编辑，无法继续编辑。点击获取最新记录')
        : _l('记录已被修改，无法继续编辑。点击获取最新记录');
      descDom.setAttribute('style', 'color: var(--color-error) !important');
    }

    //disabled按钮
    const continueBtn = document.querySelector<HTMLButtonElement>('.editTimeoutConfirmClass [data-id="confirmBtn"]');

    if (continueBtn) {
      continueBtn.disabled = true;
      continueBtn.classList.add(browserIsMobile() ? 'adm-button-disabled' : 'Button--disabled');
    }
  };

  //检查锁状态并且占用锁
  checkAndLock: ThrottledCheck = _.throttle(
    (getRowUpdateTime = false) => {
      const { worksheetId, recordId } = this;

      const res = worksheetAjax.getRowEditLock(
        { worksheetId, rowId: recordId, getRowUpdateTime },
        { ajaxOptions: { sync: true } },
      ) as unknown as LockData;

      this.lockData = res;

      if (res.submitTime && moment(res.submitTime).isAfter(moment(this.timeoutTime))) {
        this.updateTimeoutDialog();
        return false;
      }

      if (res.status === EDIT_LOCK_STATUS.LOCKED) {
        if (getRowUpdateTime) {
          this.updateTimeoutDialog(true);
        } else {
          alert(_l('有其他用户正在编辑，请稍后再试'), 3);
          this.pollGetLockStatus();
          this.updateLockedUser(res.lockAccount);
          this.onLockCallBack();
        }

        return false;
      }

      if ([EDIT_LOCK_STATUS.UNLOCK, EDIT_LOCK_STATUS.CURRENT_USER_LOCK].includes(res.status)) {
        this.resetLockTimers();
      }

      return true;
    },
    60 * 1000,
    { trailing: false },
  );

  //占锁计时
  // 显式标 void：不标的话 TS 要从函数体推断，而函数体又用到 checkAndLock，
  // 与 checkAndLock 的类型互相依赖成环。
  resetLockTimers(): void {
    this.destroy();

    const { expiretime, countdown } = this.rowEditLock;
    // 包一层 String 而不是 `|| '0'`：字段缺失时 parseInt 得到 NaN，
    // setTimeout 当 0 处理立刻触发 —— 这是改造前的行为，别顺手"修好"它。
    const timeOutMs = parseInt(String(expiretime)) * 60 * 1000;
    const countDownMs = parseInt(String(countdown)) * 60 * 1000;

    const dialogProps: LockDialogProps = {
      rowEditLock: this.rowEditLock,
      onRefreshRecord: this.onRefreshRecord,
      checkAndLock: this.checkAndLock,
      clearThrottle: () => this.checkAndLock.cancel(),
      updateTimeoutTime: time => (this.timeoutTime = time),
    };

    if (countdown !== '0') {
      //启用了倒计时提醒
      const toastStartTime = timeOutMs - countDownMs;
      this.toastTimer = setTimeout(() => {
        openCountdownDialog({
          ...dialogProps,
          onAbortCountdown: (seconds: number) => {
            this.lockTimer = setTimeout(() => {
              openTimeoutDialog(dialogProps);
            }, seconds * 1000);
          },
        });
      }, toastStartTime);
    } else {
      this.lockTimer = setTimeout(() => {
        openTimeoutDialog(dialogProps);
      }, timeOutMs);
    }
  }

  cancelEditLock() {
    const { worksheetId, recordId } = this;

    if ([EDIT_LOCK_STATUS.CURRENT_USER_LOCK, EDIT_LOCK_STATUS.UNLOCK].includes(this.lockData?.status)) {
      worksheetAjax.cancelRowEditLock({ worksheetId, rowId: recordId }).then((res: boolean) => {
        if (res) {
          // 清除 throttle
          this.checkAndLock.cancel();
          this.destroy();
        }
      });
    }
  }

  destroy() {
    if (this.lockStatusInterval) clearInterval(this.lockStatusInterval);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.lockTimer) clearTimeout(this.lockTimer);
  }
}

const CountDownDialog = (
  props: LockDialogProps & { onClose: () => void; onAbortCountdown: (seconds: number) => void },
) => {
  const { onClose, rowEditLock, onRefreshRecord, checkAndLock, clearThrottle, onAbortCountdown, updateTimeoutTime } =
    props;
  const [remainingSeconds, setRemainingSeconds] = useState(parseInt(String(rowEditLock.countdown)) * 60);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          onClose();
          openTimeoutDialog({ rowEditLock, onRefreshRecord, checkAndLock, clearThrottle, updateTimeoutTime });
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    // 组件卸载时清理定时器
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const title = (
    <span>
      {remainingSeconds > 60
        ? _l('距离编辑保护超时还有%0分%1秒', Math.floor(remainingSeconds / 60), remainingSeconds % 60)
        : _l('距离编辑保护超时还有%0秒', remainingSeconds)}
    </span>
  );

  return !browserIsMobile() ? (
    <Dialog
      visible={true}
      closable={false}
      title={title}
      description={_l('继续编辑字段可以延长超时时间')}
      okText={_l('知道了')}
      showCancel={false}
      onOk={() => {
        onAbortCountdown(remainingSeconds);
        onClose();
      }}
    />
  ) : (
    <MobileConfirmPopup
      visible={true}
      title={title}
      subDesc={<div className="Font15 mTop20 textPrimary">{_l('继续编辑字段可以延长超时时间')}</div>}
      confirmText={_l('知道了')}
      removeCancelBtn={true}
      onConfirm={() => {
        onAbortCountdown(remainingSeconds);
        onClose();
      }}
    />
  );
};

const openCountdownDialog = (props: LockDialogProps & { onAbortCountdown: (seconds: number) => void }) => {
  FunctionWrap(CountDownDialog, props);
};

const TimeOutDialog = (props: LockDialogProps & { onClose: () => void }) => {
  const { onClose, rowEditLock, onRefreshRecord, checkAndLock, clearThrottle, updateTimeoutTime } = props;
  const { expiredaction, expiretime } = rowEditLock;

  useEffect(() => {
    clearThrottle();
    updateTimeoutTime(Date.now());

    return () => updateTimeoutTime(null);
  }, []);

  const onOk = () => {
    if (expiredaction === '2') {
      onClose();
      onRefreshRecord();
    } else {
      checkAndLock(true) && onClose();
    }
  };

  const description = (
    <div
      className={cx({ Red: expiredaction === '2', 'Font15 mTop20 textPrimary': browserIsMobile() })}
      id="timeoutDesc"
    >
      {expiredaction === '2'
        ? _l('编辑已超时，无法继续编辑。点击获取最新记录')
        : _l('您已超过%0分钟未编辑，本次编辑超时', expiretime ?? '')}
    </div>
  );

  return !browserIsMobile() ? (
    <Dialog
      className="editTimeoutConfirmClass"
      visible={true}
      closable={false}
      title={_l('编辑超时')}
      description={description}
      okText={expiredaction === '2' ? _l('获取最新记录') : _l('继续编辑')}
      onOk={onOk}
      showCancel={expiredaction !== '2'}
      cancelText={_l('获取最新记录')}
      onCancel={() => {
        onClose();
        onRefreshRecord();
      }}
    />
  ) : (
    <MobileConfirmPopup
      className="editTimeoutConfirmClass"
      visible={true}
      title={_l('编辑超时')}
      subDesc={description}
      confirmText={expiredaction === '2' ? _l('获取最新记录') : _l('继续编辑')}
      removeCancelBtn={expiredaction === '2'}
      onConfirm={onOk}
      cancelText={_l('获取最新记录')}
      onCancel={() => {
        onClose();
        onRefreshRecord();
      }}
    />
  );
};

const openTimeoutDialog = (props: LockDialogProps) => {
  FunctionWrap(TimeOutDialog, props);
};
