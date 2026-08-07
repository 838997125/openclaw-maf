/**
 * DAG 执行引擎
 * 基于 OpenClaw sessions_spawn 实现 DAG 的并行/串行调度
 *
 * 核心逻辑：
 * 1. 按拓扑层级执行（levels）
 * 2. 同层内无依赖节点并行 spawn
 * 3. 有依赖节点等前置完成后再 spawn
 * 4. 每个角色输出后必须经过 PM 质量审核（最多3次打回）
 * 5. 打回超过3次自动通过，备注未解决问题
 */
import type { DAGPlan, DAGNode } from '../roles/dag_builder.js';
import type { RoleEntry } from '../roles/scanner.js';

export interface ExecutorEvents {
  onStepStart?: (node: DAGNode) => void;
  onStepComplete?: (node: DAGNode, result: string, attempts: number) => void;
  onStepFailed?: (node: DAGNode, error: string) => void;
  onStepAutoPassed?: (node: DAGNode, reason: string) => void;
  onBatchStart?: (nodes: DAGNode[], level: number) => void;
  onBatchComplete?: (nodes: DAGNode[], level: number) => void;
  onDAGComplete?: (results: Map<string, string>) => void;
  onDAGFailed?: (failedNode: DAGNode, error: string) => void;
  onAuditReject?: (node: DAGNode, rejectCount: number, suggestions: string[]) => void;
  onAuditPass?: (node: DAGNode) => void;
}

export interface ExecutorResult {
  success: boolean;
  results: Map<string, string>;
  failedSteps: string[];
  autoPassedSteps: Map<string, string>; // nodeId → reason
  totalDurationMs: number;
}

export interface SpawnedTask {
  nodeId: string;
  sessionKey: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

const MAX_REJECTIONS = 3; // 最大打回次数
const SPAWN_TIMEOUT_SECONDS = 300; // 各角色 sub-agent 超时时间

/**
 * 执行 DAG Plan
 *
 * @param plan          DAG 执行计划
 * @param userMessage   用户的原始需求（作为初始输入）
 * @param events        回调事件
 */
export async function executeDAG(
  plan: DAGPlan,
  userMessage: string,
  events: ExecutorEvents = {}
): Promise<ExecutorResult> {
  const startTime = Date.now();
  const results = new Map<string, string>();
  const context = new Map<string, string>();
  const autoPassedSteps = new Map<string, string>(); // 超过最大打回次数自动通过的记录
  const nodeRejectCount = new Map<string, number>(); // 每个节点被打回的次数
  const nodeStatus = new Map<string, string>();

  // 初始化 context with user inputs
  for (const [key, value] of plan.inputs) {
    context.set(key, value);
  }
  context.set('_original_task', userMessage);

  // 初始化所有节点状态和打回计数
  for (const [id] of plan.nodes) {
    nodeStatus.set(id, 'pending');
    nodeRejectCount.set(id, 0);
  }

  // ── Level by Level 执行 ──
  for (let levelIdx = 0; levelIdx < plan.levels.length; levelIdx++) {
    const levelNodes = plan.levels[levelIdx];
    events.onBatchStart?.(levelNodes, levelIdx);

    // 过滤已完成和跳过的节点
    const pendingNodes = levelNodes.filter(id => nodeStatus.get(id) === 'pending');
    if (pendingNodes.length === 0) {
      events.onBatchComplete?.(levelNodes, levelIdx);
      continue;
    }

    // 按依赖关系过滤出可执行的节点
    const runnableNodes = filterRunnableNodes(pendingNodes, nodeStatus, plan.nodes);

    if (runnableNodes.length === 0) {
      // 死锁检测：没有可执行的节点但也不是最后一层
      events.onDAGFailed?.(runnableNodes[0], 'DAG 死锁：无可执行节点');
      return {
        success: false,
        results,
        failedSteps: [],
        autoPassedSteps,
        totalDurationMs: Date.now() - startTime,
      };
    }

    // 并行 spawn 同层可执行节点（带质量审核循环）
    const batchResults = await executeLevelWithAudit(
      runnableNodes,
      context,
      nodeRejectCount,
      autoPassedSteps,
      nodeStatus,
      events
    );

    // 检查是否全部完成（无失败）
    if (!batchResults.success) {
      return {
        success: false,
        results,
        failedSteps: batchResults.failedSteps,
        autoPassedSteps,
        totalDurationMs: Date.now() - startTime,
      };
    }

    events.onBatchComplete?.(runnableNodes, levelIdx);
  }

  events.onDAGComplete?.(results);

  return {
    success: true,
    results,
    failedSteps: [],
    autoPassedSteps,
    totalDurationMs: Date.now() - startTime,
  };
}

/**
 * 执行一层 DAG 节点（带质量审核循环）
 *
 * 每个节点执行后都要经过 PM 审核：
 * - 审核通过：进入 results，继续下游
 * - 审核不通过（≤3次）：打回重新生成
 * - 审核不通过（>3次）：自动通过，备注未解决问题
 */
async function executeLevelWithAudit(
  nodes: DAGNode[],
  context: Map<string, string>,
  nodeRejectCount: Map<string, number>,
  autoPassedSteps: Map<string, string>,
  nodeStatus: Map<string, string>,
  events: ExecutorEvents
): Promise<{ success: boolean; failedSteps: string[] }> {
  const failedSteps: string[] = [];
  const concurrency = 4; // 并行 spawn 上限

  // 分批执行（避免一次 spawn 太多）
  for (let i = 0; i < nodes.length; i += concurrency) {
    const batch = nodes.slice(i, i + concurrency);

    // 批量并行执行当前批次
    const batchResults = await Promise.allSettled(
      batch.map(node => executeNodeWithAudit(node, context, nodeRejectCount, autoPassedSteps, nodeStatus, events))
    );

    // 处理结果
    for (let j = 0; j < batch.length; j++) {
      const node = batch[j];
      const result = batchResults[j];

      if (result.status === 'fulfilled') {
        nodeStatus.set(node.id, 'completed');
        const output = result.value.output;
        results.set(node.id, output);
        context.set(node.outputVar, output);
        events.onStepComplete?.(node, output, result.value.attempts);
        if (result.value.autoPassed) {
          events.onStepAutoPassed?.(node, result.value.autoPassedReason!);
        } else {
          events.onAuditPass?.(node);
        }
      } else {
        nodeStatus.set(node.id, 'failed');
        const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
        events.onStepFailed?.(node, error);
        events.onDAGFailed?.(node, error);
        failedSteps.push(node.id);
      }
    }

    // 如果有任何失败，立即停止（下游依赖无法继续）
    if (failedSteps.length > 0) {
      return { success: false, failedSteps };
    }
  }

  return { success: true, failedSteps: [] };
}

/**
 * 带质量审核循环的节点执行
 *
 * @returns 包含 output, attempts（尝试次数）, autoPassed（是否自动通过）, autoPassedReason
 */
async function executeNodeWithAudit(
  node: DAGNode,
  context: Map<string, string>,
  nodeRejectCount: Map<string, number>,
  autoPassedSteps: Map<string, string>,
  nodeStatus: Map<string, string>,
  events: ExecutorEvents
): Promise<{ output: string; attempts: number; autoPassed: boolean; autoPassedReason?: string }> {
  events.onStepStart?.(node);

  let attempts = 0;
  let lastOutput = '';
  let lastError = '';

  while (true) {
    attempts++;

    // ── 执行角色 sub-agent ──
    try {
      lastOutput = await executeNode(node, context, events);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      throw new Error(`[${node.id}] 执行失败: ${lastError}`);
    }

    // ── PM 质量审核 ──
    const auditResult = await pmAudit(node, lastOutput, nodeRejectCount.get(node.id) || 0, events);

    if (auditResult.pass) {
      // 审核通过
      return {
        output: lastOutput,
        attempts,
        autoPassed: false,
      };
    } else {
      // 审核不通过，计入打回计数
      const currentRejectCount = (nodeRejectCount.get(node.id) || 0) + 1;
      nodeRejectCount.set(node.id, currentRejectCount);

      events.onAuditReject?.(node, currentRejectCount, auditResult.suggestions || []);

      if (currentRejectCount > MAX_REJECTIONS) {
        // 超过最大打回次数，自动通过，备注未解决问题
        const reason = `超过最大打回次数（${MAX_REJECTIONS}），自动通过。未解决问题：${(auditResult.suggestions || []).join('；')}`;
        autoPassedSteps.set(node.id, reason);
        return {
          output: lastOutput,
          attempts,
          autoPassed: true,
          autoPassedReason: reason,
        };
      }

      // 打回重新生成（注入修改意见）
      context.set(`_reject_${node.id}_${currentRejectCount}`, JSON.stringify(auditResult.suggestions));
      // 继续循环，重新执行该节点
    }
  }
}

/**
 * PM 质量审核
 *
 * 这是一个简化的审核逻辑。在实际实现中，PM Orchestrator 会：
 * 1. 检查输出内容是否满足审核维度（数据一致性、结论支撑、格式统一、主题相关）
 * 2. 如果不满足，输出修改意见单
 * 3. 返回 { pass: false, suggestions: [...] }
 *
 * 这里用一个启发式检查作为示例，实际应由 PM Orchestrator 调用。
 *
 * @param node           当前节点
 * @param output         角色输出
 * @param currentRejectCount 当前已被打回次数
 * @param events         回调
 * @returns 审核结果 { pass: boolean; suggestions?: string[] }
 */
async function pmAudit(
  node: DAGNode,
  output: string,
  currentRejectCount: number,
  events: ExecutorEvents
): Promise<{ pass: boolean; suggestions?: string[] }> {
  // 启发式审核规则（实际应通过 PM 智能体执行）
  // 这里用占位符表示，实际会调用 PM 审核逻辑

  const suggestions: string[] = [];

  // 检查1：输出是否为空
  if (!output || output.trim().length < 50) {
    suggestions.push(`输出内容过少（${output.trim().length} 字），请补充详细内容。`);
  }

  // 检查2：是否包含明显的主题关键词（简单启发式）
  const taskKeywords = node.task.toLowerCase();
  const hasRelevantContent = taskKeywords.includes('市场') && output.includes('市场')
    || taskKeywords.includes('财务') && output.includes('财务')
    || taskKeywords.includes('运营') && output.includes('运营')
    || taskKeywords.includes('内容') && output.includes('内容')
    || taskKeywords.includes('技术') && output.includes('技术')
    || taskKeywords.includes('用户') && output.includes('用户')
    || output.length > 500; // 长内容默认为相对丰富

  if (!hasRelevantContent && output.length < 200) {
    suggestions.push(`输出内容与任务"${node.name}"相关性不足，请确保内容围绕任务目标展开。`);
  }

  // 如果没有发现问题，审核通过
  if (suggestions.length === 0) {
    return { pass: true };
  }

  return { pass: false, suggestions };
}

/**
 * 过滤出可以立即执行的节点（所有依赖都已 completed）
 */
function filterRunnableNodes(
  nodeIds: string[],
  nodeStatus: Map<string, string>,
  nodes: Map<string, DAGNode>
): DAGNode[] {
  return nodeIds
    .map(id => nodes.get(id)!)
    .filter(node => {
      if (node.dependsOn.length === 0) return true;

      if (node.dependsOnMode === 'all') {
        return node.dependsOn.every(depId => nodeStatus.get(depId) === 'completed');
      } else {
        // any_completed: 任一依赖完成即可
        return node.dependsOn.some(depId => nodeStatus.get(depId) === 'completed');
      }
    });
}

/**
 * 执行单个节点
 *
 * 通过 sessions_spawn 启动 isolated sub-agent 运行角色任务
 * 角色任务 = role system prompt + 用户输入 + 上下文变量
 */
async function executeNode(
  node: DAGNode,
  context: Map<string, string>,
  events: ExecutorEvents
): Promise<string> {
  // 构建角色 system prompt
  const systemPrompt = buildRoleSystemPrompt(node, context);

  // 构建用户消息（含输入变量渲染）
  const userMessage = buildUserMessage(node, context);

  const roleName = node.role.name;

  // 构建完整的任务 prompt
  const fullPrompt = `${systemPrompt}

---

## 输入上下文
${renderContext(context)}

---

## 任务
${userMessage}

---

## 输出要求
请将你的输出写入变量：\`${node.outputVar}\`
只需输出内容，不需要额外说明。`;

  // 使用 sessions_spawn（通过 exec 调用 openclaw CLI）
  // 注意：这里用占位符实现，实际由调用方通过 tool interface 触发
  return await spawnAndWait({
    nodeId: node.id,
    roleName,
    prompt: fullPrompt,
    timeoutSeconds: SPAWN_TIMEOUT_SECONDS,
  });
}

/**
 * 构建角色的 system prompt
 */
function buildRoleSystemPrompt(node: DAGNode, context: Map<string, string>): string {
  const role = node.role;

  return `【角色：${role.name}】
${role.description}

你是 ${role.name}，你的专长是 ${role.description}。
当你收到任务时，请：
1. 深入分析任务要求和输入上下文
2. 结合你的专业知识输出结构化内容
3. 确保所有结论有数据来源或案例支撑
4. 模糊表述需量化支撑
5. 严格按输出变量格式返回结果`;
}

/**
 * 构建用户消息（含输入变量渲染）
 */
function buildUserMessage(node: DAGNode, context: Map<string, string>): string {
  let message = node.task;

  // 渲染 {{variable}} 占位符
  for (const [key, value] of context) {
    if (key.startsWith('_reject_')) continue; // 跳过内部打回记录
    message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `[${key}（未提供）]`);
  }

  return message;
}

/**
 * 渲染上下文为文本
 */
function renderContext(context: Map<string, string>): string {
  const lines: string[] = [];
  for (const [key, value] of context) {
    if (key.startsWith('_')) continue; // 跳过内部变量
    lines.push(`**${key}**：\n${value}\n`);
  }
  return lines.join('\n');
}

/**
 * 通过 openclaw CLI spawn isolated session 并等待结果
 *
 * 占位实现：实际通过 tool interface 调用 sessions_spawn
 */
async function spawnAndWait(opts: {
  nodeId: string;
  roleName: string;
  prompt: string;
  timeoutSeconds: number;
}): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[${opts.nodeId}] 执行超时 (${opts.timeoutSeconds}s)`));
    }, opts.timeoutSeconds * 1000);

    // 占位：实际由 sessions_spawn(tool call) 实现
    clearTimeout(timer);
    resolve(`[${opts.roleName}] 输出占位符 - 实际由 sessions_spawn 执行`);
  });
}

/**
 * 直接使用 sessions_spawn 工具（由调用方通过 tool interface 调用）
 * 此函数生成 spawn 所需的参数，供外部调用
 */
export function buildSpawnParams(node: DAGNode, context: Map<string, string>) {
  return {
    runtime: 'subagent' as const,
    label: `maf-${node.id}-${Date.now()}`,
    task: buildUserMessage(node, context),
    model: undefined, // 使用默认模型
    runTimeoutSeconds: SPAWN_TIMEOUT_SECONDS,
  };
}

/**
 * 并行执行一层 DAG 节点（调度层核心函数）
 *
 * @deprecated 使用 executeDAG 代替
 */
export async function executeLevel(
  levelNodes: DAGNode[],
  context: Map<string, string>,
  concurrency: number = 4,
  events: ExecutorEvents = {}
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (let i = 0; i < levelNodes.length; i += concurrency) {
    const batch = levelNodes.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(node => executeNode(node, context, events))
    );

    for (let j = 0; j < batch.length; j++) {
      const node = batch[j];
      const result = batchResults[j];

      if (result.status === 'fulfilled') {
        results.set(node.id, result.value);
        context.set(node.outputVar, result.value);
      } else {
        const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
        events.onStepFailed?.(node, error);
        throw new Error(`[${node.id}] 执行失败: ${error}`);
      }
    }
  }

  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// 引用全局 results（用于 executeNodeWithAudit 中的结果收集）
declare const results: Map<string, string>;