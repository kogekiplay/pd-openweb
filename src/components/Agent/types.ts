/**
 * Agent 对话面板的领域类型。
 *
 * 和 src/utils/controlTypes 的 FormControl 一样，字段【不是照着协议文档抄的】，
 * 是把 src/components/Agent 下对 message / part 的读写点统计出来补齐的。
 * 所以它描述的是「本仓实际怎么用这两个对象」，而不是「它们理论上有哪些字段」。
 *
 * 因此它【故意不完备】：遇到没列的字段，补一行进来，而不是退回 any。
 */

/**
 * 消息片段的种类。这是个开放集合 —— 新的卡片类型会继续加，
 * 所以留了 string 兜底，而不是写成封闭联合让每个新 kind 都改类型。
 */
export type ChatPartKind =
  | 'text'
  | 'embed'
  | 'attachment'
  | 'tool'
  | 'step'
  | 'work'
  | 'loop'
  | 'plan-card'
  | 'plan-drift'
  | 'build-progress'
  | 'rebuild-confirm'
  | 'statistic'
  | (string & {});

/**
 * 一条消息里的片段。
 *
 * 字段随 kind 变化，精确建模要按 kind 做判别联合 —— 那需要先把每种卡片的
 * 渲染契约定下来，是一件独立工程。在那之前用一个具名的开放形状，
 * 至少它可被 grep、可逐步收窄，收窄时只改这一处。
 */
export interface ChatMessagePart {
  kind: ChatPartKind;
  /** 片段产生时刻，用于排序与 meta 行展示 */
  ts?: number;
  text?: string;
  /** kind = 'embed' 时的后缀标识与解析后的数据 */
  suffix?: string;
  data?: any;

  id?: string;
  name?: string;
  title?: string;
  status?: string;
  error?: any;
  /** 工具调用的入参与结果 */
  input?: any;
  output?: any;
  items?: any[];
  children?: ChatMessagePart[];
  steps?: any[];
  stepId?: string;
  options?: any[];
  open?: boolean;
  /** 本段是否被用户中断 */
  aborted?: boolean;
  finishedAt?: number;

  /** 搭建计划卡片相关 */
  artifactId?: string;
  versionId?: string;
  versionLabel?: string;
  appName?: string;
  appIcon?: string;
  appColor?: string;
  /** 应用元信息（图标/颜色）是否已补齐，避免重复拉 app.json */
  appMetaResolved?: boolean;
  built?: boolean;
  builtAppId?: string;
  projectId?: string;
  companyName?: string;
  chosenAction?: string;
  retryPrompt?: string;
}

/** 对话里的一条消息 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | (string & {});
  /** 展示名（"你" / 助手名） */
  name?: string;
  agentName?: string;
  parts: ChatMessagePart[];
  /** 消息生成时刻 */
  time?: number;
  /** 未经拆分的原始文本，重试时用 */
  rawText?: string;
  type?: string;

  /** 本轮消耗的信用点；pending 表示还在结算 */
  credits?: number;
  creditsPending?: boolean;
  creditsProjectId?: string;
  creditsTraceId?: string;
}
