/**
 * 角色库扫描器
 * 从 agency-agents-zh/AGENT-LIST.md 解析所有可用角色
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface RoleEntry {
  id: string;           // agent ID 如 "marketing-douyin-strategist"
  name: string;         // 中文名 如 "抖音策略师"
  description: string;  // 角色描述
  department: string;   // 部门分类 如 "营销部"
  rolePath: string;     // 文件路径 如 "marketing/douyin-strategist"
  source: '翻译' | '原创';
}

const AGENTS_DIR = process.env.AGENCY_AGENTS_HOME
  || (require('os').homedir() + '/agency-agents-zh');
const AGENT_LIST_PATH = resolve(AGENTS_DIR, 'AGENT-LIST.md');

/**
 * 解析 AGENT-LIST.md，提取所有角色
 */
export function scanAllRoles(): RoleEntry[] {
  if (!existsSync(AGENT_LIST_PATH)) {
    throw new Error(`角色列表不存在: ${AGENT_LIST_PATH}`);
  }

  const content = readFileSync(AGENT_LIST_PATH, 'utf-8');
  return parseAgentList(content);
}

/**
 * 按部门分类扫描角色
 */
export function scanRolesByDepartment(): Map<string, RoleEntry[]> {
  const allRoles = scanAllRoles();
  const byDept = new Map<string, RoleEntry[]>();

  for (const role of allRoles) {
    if (!byDept.has(role.department)) {
      byDept.set(role.department, []);
    }
    byDept.get(role.department)!.push(role);
  }

  return byDept;
}

/**
 * 解析 AGENT-LIST.md 内容
 */
function parseAgentList(content: string): RoleEntry[] {
  const roles: RoleEntry[] = [];
  const lines = content.split('\n');

  let currentDept = '';
  let currentDeptKey = '';

  for (const line of lines) {
    // 检测部门标题行：## 工程部 (35) 或 ## 支持部
    const deptMatch = line.match(/^##\s+(.+?)(?:\s*\((\d+)\))?\s*$/);
    if (deptMatch) {
      currentDept = deptMatch[1].trim();
      currentDeptKey = normalizeKey(currentDept);
      continue;
    }

    // 检测子部门标题行（如 ### 国内平台）
    const subDeptMatch = line.match(/^###\s+(.+)$/);
    if (subDeptMatch) {
      currentDept = subDeptMatch[1].trim();
      currentDeptKey = normalizeKey(currentDept);
      continue;
    }

    // 检测角色表格行：| `agent-id` | 中文名 | 描述 | 来源 |
    const tableMatch = line.match(/^\|\s*`([^`]+)`\s*\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*(翻译|原创)\s*\|/);
    if (tableMatch && currentDept) {
      const id = tableMatch[1].trim();
      const name = tableMatch[2].trim();
      const description = tableMatch[3].trim();
      const source = tableMatch[4].trim() as '翻译' | '原创';

      // 构造 rolePath: 从部门目录结构推算
      // 如 marketing-douyin-strategist → marketing/douyin-strategist
      const rolePath = id.replace(/^marketing-/, 'marketing/')
                         .replace(/^engineering-/, 'engineering/')
                         .replace(/^finance-/, 'finance/')
                         .replace(/^product-/, 'product/')
                         .replace(/^project-management-/, 'project-management/')
                         .replace(/^design-/, 'design/')
                         .replace(/^sales-/, 'sales/')
                         .replace(/^legal-/, 'legal/')
                         .replace(/^hr-/, 'hr/')
                         .replace(/^supply-chain-/, 'supply-chain/')
                         .replace(/^testing-/, 'testing/')
                         .replace(/^support-/, 'support/')
                         .replace(/^paid-media-/, 'paid-media/')
                         .replace(/^academic-/, 'academic/')
                         .replace(/^game-development-/, 'game-development/');

      roles.push({
        id,
        name,
        description,
        department: currentDept,
        rolePath,
        source,
      });
    }
  }

  return roles;
}

/**
 * 规范化部门 key（用于目录映射）
 */
function normalizeKey(dept: string): string {
  return dept.toLowerCase()
    .replace(/\s+\(\d+\)/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
}

/**
 * 获取单个角色的 system prompt 文件路径
 */
export function getRoleSystemPromptPath(rolePath: string): string {
  return resolve(AGENTS_DIR, `${rolePath}.md`);
}

/**
 * 加载单个角色的 system prompt
 */
export function loadRoleSystemPrompt(rolePath: string): string {
  const filePath = getRoleSystemPromptPath(rolePath);
  if (!existsSync(filePath)) {
    throw new Error(`角色文件不存在: ${filePath}`);
  }
  return readFileSync(filePath, 'utf-8');
}

// ── 角色快速匹配表 ──────────────────────────────────────

export const TASK_TYPE_TO_DEPT: Record<string, string[]> = {
  '市场分析': ['营销部', '付费媒体部'],
  '竞品研究': ['营销部', '专项部'],
  '技术方案': ['工程部'],
  '财务预测': ['金融部'],
  '运营策略': ['营销部', '销售部'],
  '用户体验': ['设计部'],
  '合规审核': ['法务部'],
  '供应链': ['供应链部'],
  '人力资源': ['人力资源部'],
  '项目管理': ['项目管理部'],
  '产品设计': ['产品部'],
  '数据埋点/分析': ['工程部', '支持部'],
  '内容创作': ['营销部'],
  '增长获客': ['营销部', '销售部'],
  '法律合同': ['法务部'],
  '招聘': ['人力资源部'],
  '测试/质量': ['测试部'],
  '嵌入式/硬件': ['工程部'],
  '出海/跨境': ['营销部', '付费媒体部'],
  '抖音/短视频': ['营销部'],
  '小红书': ['营销部'],
  'B站': ['营销部'],
  '电商/淘宝天猫拼多多': ['营销部'],
  '私域/企微': ['营销部'],
  '直播带货': ['营销部'],
  '飞书/钉钉集成': ['工程部'],
};

/**
 * 根据任务关键词匹配推荐角色（返回 rolePath 列表）
 */
export function matchRolesByKeywords(keywords: string[]): RoleEntry[] {
  const allRoles = scanAllRoles();
  const matched: RoleEntry[] = [];
  const seen = new Set<string>();

  for (const kw of keywords) {
    for (const [taskType, depts] of Object.entries(TASK_TYPE_TO_DEPT)) {
      if (taskType.includes(kw) || kw.includes(taskType)) {
        for (const dept of depts) {
          for (const role of allRoles) {
            if (role.department === dept && !seen.has(role.id)) {
              matched.push(role);
              seen.add(role.id);
            }
          }
        }
      }
    }
  }

  return matched;
}