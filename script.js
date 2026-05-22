// ================= 魔塔 API 配置 =================
const MODEL_NAME = 'Qwen/Qwen2.5-7B-Instruct';  // 免费且效果不错的模型
const API_URL = 'https://api-inference.modelscope.cn/v1/chat/completions';

// NPC 角色设定（酒馆老板汤姆）
const NPC_SYSTEM_PROMPT = `你是一个中世纪小酒馆的老板，名字叫老汤姆。你说话带点沧桑感，偶尔打趣客人，喜欢讲一些冒险传闻。我是经常来喝酒的旅行者，和你关系熟络。请用口语化、带一点点洒脱的语气回答。`;

// DOM 元素
const chatHistoryDiv = document.getElementById('chat-history');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// 对话历史存储（用于上下文）
let conversationHistory = [
    { role: 'system', content: NPC_SYSTEM_PROMPT }
];

// ---------- UI 辅助函数 ----------
function addMessageToUI(role, content) {
    const messageDiv = document.createElement('div');
    if (role === 'user') {
        messageDiv.classList.add('user-message');
    } else if (role === 'npc') {
        messageDiv.classList.add('npc-message');
    } else {
        messageDiv.classList.add('system-message');
    }
    messageDiv.innerText = content;
    chatHistoryDiv.appendChild(messageDiv);
    chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
}

let typingIndicator = null;
function showTyping() {
    if (typingIndicator) typingIndicator.remove();
    typingIndicator = document.createElement('div');
    typingIndicator.classList.add('typing');
    typingIndicator.innerText = '🍺 老汤姆正在思索...';
    chatHistoryDiv.appendChild(typingIndicator);
    chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
}
function hideTyping() {
    if (typingIndicator) {
        typingIndicator.remove();
        typingIndicator = null;
    }
}

// 获取或存储 API Key（存在 localStorage）
function getApiKey() {
    let key = localStorage.getItem('modelscope_api_key');
    if (!key) {
        key = prompt('🔐 请输入你的魔塔社区 API Key（每天2000次免费）\n\n没有Key？去 modelscope.cn 注册并获取 →');
        if (key && key.trim() !== '') {
            localStorage.setItem('modelscope_api_key', key.trim());
            return key.trim();
        } else {
            addMessageToUI('system', '❌ 未提供 API Key，无法与酒馆老板对话。刷新页面后重新输入。');
            return null;
        }
    }
    return key;
}

// 清除无效 Key（比如 401 错误时调用）
function clearInvalidKey() {
    localStorage.removeItem('modelscope_api_key');
    addMessageToUI('system', '⚠️ API Key 无效或已过期，请刷新页面重新输入正确的 Key。');
}

// ---------- AI 调用核心 ----------
async function callAI(userMessage, apiKey) {
    // 构建消息（保留最近一些对话，避免 token 溢出）
    let messagesForAPI = [ { role: 'system', content: NPC_SYSTEM_PROMPT } ];
    // 把历史中的 user/assistant 加进去（跳过 system）
    for (let msg of conversationHistory) {
        if (msg.role !== 'system') {
            messagesForAPI.push(msg);
        }
    }
    messagesForAPI.push({ role: 'user', content: userMessage });

    // 限制长度，防止超长（简单截断前N条）
    if (messagesForAPI.length > 12) {
        const systemMsg = messagesForAPI[0];
        const recentMsgs = messagesForAPI.slice(-10);
        messagesForAPI = [systemMsg, ...recentMsgs];
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: messagesForAPI,
                max_tokens: 220,
                temperature: 0.8,
                top_p: 0.9
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                clearInvalidKey();
                throw new Error('API Key 无效');
            }
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText.slice(0, 100)}`);
        }

        const data = await response.json();
        const reply = data.choices[0].message.content;
        // 更新对话历史（存 user 和 assistant）
        conversationHistory.push({ role: 'user', content: userMessage });
        conversationHistory.push({ role: 'assistant', content: reply });
        // 限制历史总长度（避免 token 过多）
        if (conversationHistory.length > 30) {
            // 保留 system + 最近 28 条
            conversationHistory = [conversationHistory[0], ...conversationHistory.slice(-28)];
        }
        return reply;
    } catch (err) {
        console.error('AI调用错误:', err);
        return `😵 酒馆老板有点晕: ${err.message}`;
    }
}

// ---------- 发送消息流程 ----------
async function handleSendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // UI 锁定
    userInput.value = '';
    sendBtn.disabled = true;

    // 显示用户消息
    addMessageToUI('user', message);
    showTyping();

    // 获取 API Key
    const apiKey = getApiKey();
    if (!apiKey) {
        hideTyping();
        addMessageToUI('system', '🔑 需要 API Key 才能聊天，请刷新页面后输入。');
        sendBtn.disabled = false;
        userInput.focus();
        return;
    }

    try {
        const npcReply = await callAI(message, apiKey);
        hideTyping();
        addMessageToUI('npc', npcReply);
    } catch (error) {
        hideTyping();
        addMessageToUI('system', `❌ 出错了：${error.message}`);
    } finally {
        sendBtn.disabled = false;
        userInput.focus();
    }
}

// 绑定事件
sendBtn.addEventListener('click', handleSendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
});

// 页面初始欢迎语（不依赖 API）
window.addEventListener('DOMContentLoaded', () => {
    addMessageToUI('npc', '嘿，旅行者！来杯麦酒暖暖身子？最近北边据说有巨龙出没，想听听故事吗？');
});