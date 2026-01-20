-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(200) NOT NULL,
  avatar VARCHAR(255) DEFAULT 'default_url',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent配置表（智能体配置表）
CREATE TABLE IF NOT EXISTS agents (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  avatar VARCHAR(255),
  tag VARCHAR(50),
  status ENUM('private', 'public') DEFAULT 'private',
  config JSON,
  creator_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_creator_id (creator_id)
);

-- 会话表
CREATE TABLE IF NOT EXISTS threads (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  agent_id VARCHAR(36) NOT NULL,
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

-- 插入默认系统Agent（creator_id 可为空，系统内置无创建者）
INSERT INTO agents (id, name, description, avatar, tag, status, config, creator_id)
VALUES (
  'system-agent-id',
  'AI助手',
  '系统内置AI助手',
  NULL,
  NULL,
  'private',
  '{"system_prompt":"你是一个有用的AI助手"}',
  NULL
)
ON DUPLICATE KEY UPDATE id=id;

