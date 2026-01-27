-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(200) NOT NULL,
  avatar VARCHAR(255) DEFAULT 'default_url',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent 表（稳定主体，只存不可变信息，并指向最新版本）
CREATE TABLE IF NOT EXISTS agents (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  avatar VARCHAR(255),
  tag VARCHAR(50),
  status ENUM('private', 'public') DEFAULT 'private',
  creator_id VARCHAR(36),
  latest_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_creator_id (creator_id)
);

-- Agent 版本表（承载所有「AI 能力」配置，一次发布即一条不可变记录，不允许 UPDATE）
CREATE TABLE IF NOT EXISTS agent_versions (
  id VARCHAR(36) PRIMARY KEY,
  agent_id VARCHAR(36) NOT NULL,
  version INT NOT NULL,
  description TEXT,
  system_prompt TEXT,
  rag_config JSON,
  mcp_config JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_agent_version (agent_id, version),
  INDEX idx_agent_id (agent_id),
  CONSTRAINT fk_agent_versions_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- 会话表
CREATE TABLE IF NOT EXISTS threads (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  agent_id VARCHAR(36) NOT NULL,
  agent_version INT NOT NULL DEFAULT 1,
  title VARCHAR(255),
  is_debug BOOLEAN DEFAULT FALSE,
  summary TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_agent_id (agent_id)
);

-- 消息详情表
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY,
  thread_id VARCHAR(36) NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  content LONGTEXT NOT NULL,
  token INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_thread_id (thread_id),
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

-- 插入默认系统 Agent：agents 一条 + agent_versions v1 一条
INSERT INTO agents (id, name, avatar, tag, status, creator_id, latest_version)
VALUES (
  'system-agent-id',
  'AI助手',
  NULL,
  NULL,
  'public',
  NULL,
  1
)
ON DUPLICATE KEY UPDATE id=id;

INSERT INTO agent_versions (id, agent_id, version, description, system_prompt, rag_config, mcp_config)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system-agent-id',
  1,
  '系统内置AI助手',
  '你是一个有用的AI助手',
  NULL,
  NULL
)
ON DUPLICATE KEY UPDATE id=id;
