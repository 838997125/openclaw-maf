/**
 * DAG 构建器
 * 将任务模块 + 角色分配转化为有向无环图
 */
import type { RoleEntry } from './scanner.js';

export interface DAGNode {
  id: string;
  name: string;
  emoji: string;
  role: RoleEntry;
  task: string;           // 任务描述
  inputVars: string[];    // 依赖的变量名（如 {{vision}}）
  outputVar: string;      // 输出变量名
  dependsOn: string[];    // 依赖的节点 ID
  dependsOnMode: 'all' | 'any_completed';
  condition?: string;     // 条件表达式
  type?: 'approval';
  prompt?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
}

export interface DAGPlan {
  name: string;
  nodes: Map<string, DAGNode>;
  levels: string[][];     // 拓扑排序后的执行层级（同层可并行）
  inputs: Map<string, string>;
  totalEstimate?: string; // 预估耗时
}

/**
 * 任务模块定义
 */
export interface TaskModule {
  id: string;
  name: string;
  description: string;
  keywords: string[];      // 用于匹配角色
  inputFrom: string[];    // 依赖的输入变量
  outputVar: string;       // 输出变量
  dependsOn: string[];     // 依赖的其他模块
  dependsOnMode?: 'all' | 'any_completed';
  parallelWith?: string[];  // 可并行的其他模块
  approver?: boolean;      // 是否需要人工审批
}

/**
 * 从任务模块列表构建 DAG
 */
export function buildDAG(
  taskName: string,
  modules: TaskModule[],
  roleAssignments: Map<string, RoleEntry>,
  userInputs: Map<string, string>
): DAGPlan {
  const nodes = new Map<string, DAGNode>();
  const inDegree = new Map<string, number>();

  // ── Step 1: 创建所有节点 ──
  for (const mod of modules) {
    const role = roleAssignments.get(mod.id);
    if (!role) {
      throw new Error(`模块 "${mod.id}" 未匹配到角色`);
    }

    const node: DAGNode = {
      id: mod.id,
      name: mod.name,
      emoji: getEmoji(mod.id),
      role,
      task: buildTaskDescription(mod, role),
      inputVars: mod.inputFrom,
      outputVar: mod.outputVar,
      dependsOn: mod.dependsOn,
      dependsOnMode: mod.dependsOnMode || 'all',
      type: mod.approver ? 'approval' : undefined,
    };

    nodes.set(mod.id, node);
    inDegree.set(mod.id, mod.dependsOn.length);
  }

  // ── Step 2: 拓扑排序（Kahn 算法）─→ 执行层级 ──
  const levels: string[][] = [];
  const remaining = new Set(nodes.keys());

  while (remaining.size > 0) {
    // 找出入度为 0 的节点（无前置依赖）
    const currentLevel: string[] = [];
    for (const id of remaining) {
      if (inDegree.get(id) === 0) {
        currentLevel.push(id);
      }
    }

    if (currentLevel.length === 0) {
      throw new Error(`DAG 构建失败：存在循环依赖。当前剩余节点: ${[...remaining].join(', ')}`);
    }

    // 本层节点出度减 1（从依赖者视角）
    for (const id of currentLevel) {
      remaining.delete(id);
      const node = nodes.get(id)!;
      for (const depId of node.dependsOn) {
        const depNode = nodes.get(depId);
        if (depNode) {
          inDegree.set(depId, (inDegree.get(depId) || 0) - 1);
        }
      }
    }

    levels.push(currentLevel);
  }

  return {
    name: taskName,
    nodes,
    levels,
    inputs: userInputs,
  };
}

/**
 * 构建角色的任务描述 prompt
 */
function buildTaskDescription(mod: TaskModule, role: RoleEntry): string {
  return `【${mod.name}】

你是 ${role.name}（${role.description}）。

## 任务背景
${mod.description}

## 输入变量
${mod.inputFrom.length > 0 ? mod.inputFrom.map(v => `- \${${v}}`).join('\n') : '（无前置输入，独立性任务）'}

## 输出要求
输出到变量：\`${mod.outputVar}\`

请按照角色专业视角，输出一份结构化、可执行的分析内容。所有结论需包含数据来源或案例依据，模糊表述需量化支撑。`;
}

/**
 * 获取模块 emoji
 */
function getEmoji(moduleId: string): string {
  const map: Record<string, string> = {
    'market': '📊',
    'competitor': '🔍',
    'tech': '🔧',
    'finance': '💰',
    'operation': '📈',
    'content': '✍️',
    'user': '👤',
    'legal': '⚖️',
    'supply': '🚚',
    'hr': '👔',
    'summary': '📋',
    'ceo': '👔',
    'design': '🎨',
    'test': '🧪',
  };
  for (const [key, emoji] of Object.entries(map)) {
    if (moduleId.toLowerCase().includes(key)) return emoji;
  }
  return '🤖';
}

/**
 * 格式化 DAG 为可读文本（用于展示给用户确认）
 */
export function formatDAGPlan(plan: DAGPlan): string {
  const lines: string[] = [];
  lines.push(`📋 **执行计划：${plan.name}**\n`);
  lines.push(`🔢 总步骤：${plan.nodes.size} | ⏱️ 预估并行层级：${plan.levels.length}\n`);
  lines.push('```\n');

  for (let i = 0; i < plan.levels.length; i++) {
    const level = plan.levels[i];
    const parallel = level.length > 1;

    lines.push(`  【Level ${i + 1}】${parallel ? ' [并行]' : ' [串行]'}`);
    for (const nodeId of level) {
      const node = plan.nodes.get(nodeId)!;
      const deps = node.dependsOn.length > 0 ? ` ← [${node.dependsOn.join(', ')}]` : '';
      const typeTag = node.type === 'approval' ? ' ⏸️' : '';
      lines.push(`    ${node.emoji} ${node.name} (${node.role.name})${typeTag}${deps}`);
    }
    if (i < plan.levels.length - 1) lines.push('    │');
  }

  lines.push('```\n');
  return lines.join('\n');
}

/**
 * 从任务描述自动推断任务模块
 * 这是 PM 的核心规划能力
 */
export interface InferredModule {
  module: TaskModule;
  reasoning: string;
}

export function inferTaskModules(taskDescription: string): InferredModule[] {
  const modules: InferredModule[] = [];
  const text = taskDescription.toLowerCase();

  // 市场分析模块
  if (text.includes('市场') || text.includes('赛道') || text.includes('机会')) {
    modules.push({
      module: {
        id: 'market',
        name: '市场机会分析',
        description: '分析目标市场规模、增速、竞争格局、市场空白点',
        keywords: ['市场分析', '赛道分析'],
        inputFrom: [],
        outputVar: 'market_report',
      },
      reasoning: '检测到市场/赛道相关需求，创建市场分析模块',
    });
  }

  // 竞品研究模块
  if (text.includes('竞品') || text.includes('竞争对手') || text.includes('对比')) {
    modules.push({
      module: {
        id: 'competitor',
        name: '竞品与用户研究',
        description: '分析主要竞品优劣势、差异化定位、用户画像',
        keywords: ['竞品研究'],
        inputFrom: [],
        outputVar: 'competitor_report',
      },
      reasoning: '检测到竞品对比需求，创建竞品研究模块',
    });
  }

  // 财务规划模块
  if (text.includes('财务') || text.includes('收入') || text.includes('盈利') || text.includes('成本') || text.includes('投入')) {
    modules.push({
      module: {
        id: 'finance',
        name: '财务预测与规划',
        description: '财务预测、ROI分析、资金规划、盈亏平衡点',
        keywords: ['财务预测'],
        inputFrom: ['market_report'],
        outputVar: 'finance_report',
      },
      reasoning: '检测到财务/收入相关需求，创建财务规划模块',
    });
  }

  // 运营策略模块
  if (text.includes('运营') || text.includes('增长') || text.includes('获客') || text.includes('推广')) {
    modules.push({
      module: {
        id: 'operation',
        name: '运营策略与增长路径',
        description: '运营策略、用户增长路径、转化漏斗、推广渠道',
        keywords: ['运营策略', '增长获客'],
        inputFrom: ['market_report', 'competitor_report'],
        outputVar: 'operation_report',
      },
      reasoning: '检测到运营/增长相关需求，创建运营策略模块',
    });
  }

  // 技术方案模块
  if (text.includes('技术') || text.includes('产品') || text.includes('功能') || text.includes('方案')) {
    modules.push({
      module: {
        id: 'tech',
        name: '产品技术方案评估',
        description: '产品功能设计、MVP路径、技术架构选型',
        keywords: ['技术方案', '产品设计'],
        inputFrom: ['market_report'],
        outputVar: 'tech_report',
      },
      reasoning: '检测到产品/技术相关需求，创建技术方案模块',
    });
  }

  // 内容策略模块
  if (text.includes('内容') || text.includes('创作') || text.includes('文案') || text.includes('素材')) {
    modules.push({
      module: {
        id: 'content',
        name: '内容策略与创作规划',
        description: '内容策略、选题规划、内容SOP、创作模板',
        keywords: ['内容创作'],
        inputFrom: ['market_report', 'operation_report'],
        outputVar: 'content_report',
      },
      reasoning: '检测到内容创作相关需求，创建内容策略模块',
    });
  }

  // 汇总模块（总是最后）
  if (modules.length > 0) {
    const summaryDeps = modules.map(m => m.module.id);
    modules.push({
      module: {
        id: 'summary',
        name: '综合汇总与执行计划',
        description: '整合所有模块输出，形成完整的项目分析报告和执行计划',
        keywords: ['项目管理'],
        inputFrom: summaryDeps,
        outputVar: 'final_report',
      },
      reasoning: '添加汇总模块，依赖所有上游模块',
    });
  }

  return modules;
}