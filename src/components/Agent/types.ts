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
/**
 * 上传区里的一个附件。状态机：uploading -> done / error，发送前是 pending。
 * 字段按 ui/Attachments.tsx 的渲染点列（见该文件的 getStatusLabel 与卡片）。
 */
export interface ChatAttachment {
  id: string;
  name?: string;
  /** 'image' 时渲染 previewUrl 缩略图，其余画文件图标 */
  kind?: string;
  status?: string;
  /** 0-100，仅 uploading 时有 */
  progress?: number;
  /** 已格式化好的大小文案，直接显示 */
  sizeLabel?: string;
  errorMessage?: string;
  previewUrl?: string;
  url?: string;
  size?: number;
}

/**
 * 发给后端时的附件形状 —— 和上面的 ChatAttachment【不是一回事】：
 * 那个是上传区的 UI 状态（带 progress / status / previewUrl），
 * 这个是 mapAttachmentForRequest 挑出来的四个字段。
 */
export interface ChatAttachmentRequest {
  type?: string;
  url?: string;
  name?: string;
  size?: number;
}

/** 输入框里 @ 出来的一项（应用 / 工作表…）。type 缺省按 'app' 处理。 */
export interface ChatMention {
  id?: string;
  type?: string;
  name?: string;
}

/**
 * SSE 流里的一个事件。
 *
 * eventName 是【开放集合】—— 后端会继续加新事件，写成封闭联合的话每加一个都要改类型。
 * payload 的形状随 eventName 变，与 ChatMessagePart 同理：先给一个具名的开放形状，
 * 真要按 eventName 做判别联合，得先把每类事件的契约定下来，是一件独立工程。
 */
export interface AgentStreamEvent {
  eventName?: string;
  /** 后端路由到的 agent 名；ChatPanel 据此判断本轮走的是哪条链 */
  agentName?: string;
  payload?: {
    /** text-delta / reasoning-delta 的增量文本 */
    delta?: string;
    /**
     * 形状随 eventName 变。【这里保持 any 而不是 unknown，量过】——
     * 消费点直接读 data.skipped / data.path / data.stepId 等十几个不同字段，
     * 换成 unknown 要在 ChatPanel 里加一圈收窄，收益不抵改动量。
     * 真要收得按 eventName 做判别联合，那是本文件开头说的那件独立工程。
     */
    data?: any;
    /** error 事件带的两项，ChatPanel 直接拿去渲染贴底拦截卡 */
    errorCode?: string;
    errorMessage?: string;
    [key: string]: unknown;
  };
}

export interface ChatMessagePart {
  kind: ChatPartKind;
  /** 片段产生时刻，用于排序与 meta 行展示 */
  ts?: number;
  text?: string;
  /** kind = 'embed' 时的后缀标识与解析后的数据 */
  suffix?: string;
  data?: unknown;

  id?: string;
  name?: string;
  title?: string;
  status?: string;
  error?: { message?: string; code?: string | number; [key: string]: unknown };
  /** 工具调用的入参与结果（已被 summarizeArgs / summarizeResult 压成可读形式） */
  input?: string;
  output?: string;
  /** kind = 'attachment' 时是附件列表，其余 kind 各有各的条目形状 */
  items?: unknown[];
  children?: ChatMessagePart[];
  /** kind = 'step' / 'work' 的子步骤 */
  steps?: unknown[];
  stepId?: string;
  /** 提问卡的候选项 */
  options?: unknown[];
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
