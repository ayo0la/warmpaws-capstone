// Messages Page
let currentUser = null;
let conversations = [];
let currentConversationUserId = null;
let viewMode = 'inbox'; // 'inbox' or 'sent'

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await Utils.requireAuth();
    if (!currentUser) return;

    // Check for seller parameter in URL
    const params = Utils.getQueryParams();
    if (params.seller) {
        currentConversationUserId = parseInt(params.seller);
    }

    // Load conversations
    await loadConversations();

    // Setup event listeners
    setupEventListeners();

    // Check unread count
    updateUnreadBadge();
});

async function loadConversations() {
    try {
        const messages = viewMode === 'inbox' ?
            await API.messages.getInbox() :
            await API.messages.getSent();

        // Group messages by user
        const grouped = groupMessagesByUser(messages);
        conversations = grouped;

        displayConversations(grouped);

        // If we have a specific user to show, load that conversation
        if (currentConversationUserId) {
            await loadConversation(currentConversationUserId);
        }

    } catch (error) {
        console.error('Error loading conversations:', error);
        const container = document.getElementById('conversationsList');
        if (container) {
            container.innerHTML = `
                <div class="box" style="text-align: center; padding: 20px; color: #f67481;">
                    <p>Failed to load conversations</p>
                </div>
            `;
        }
    }
}

function groupMessagesByUser(messages) {
    const grouped = {};

    messages.forEach(msg => {
        const otherUserId = viewMode === 'inbox' ? msg.sender_id : msg.recipient_id;
        const otherUserName = viewMode === 'inbox' ? msg.sender_name : msg.recipient_name;

        if (!grouped[otherUserId]) {
            grouped[otherUserId] = {
                userId: otherUserId,
                userName: otherUserName,
                messages: [],
                lastMessage: msg,
                unreadCount: 0
            };
        }

        grouped[otherUserId].messages.push(msg);

        if (!msg.is_read && msg.recipient_id === currentUser.id) {
            grouped[otherUserId].unreadCount++;
        }
    });

    return Object.values(grouped);
}

function displayConversations(conversations) {
    const container = document.getElementById('conversationsList');
    if (!container) return;

    if (conversations.length === 0) {
        container.innerHTML = `
            <div class="box" style="text-align: center; padding: 20px; color: #666;">
                <p>No conversations yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = conversations.map(conv => `
        <div class="box left-align conversation-item ${currentConversationUserId === conv.userId ? 'active' : ''}"
             onclick="loadConversation(${conv.userId})"
             style="cursor: pointer; border-left: ${currentConversationUserId === conv.userId ? '4px solid #6c5b80' : 'none'};">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <strong>${Utils.sanitizeHTML(conv.userName)}</strong>
                    ${conv.unreadCount > 0 ? `
                        <span class="badge" style="background: #f67481; color: white; padding: 2px 6px; border-radius: 10px; font-size: 11px; margin-left: 8px;">
                            ${conv.unreadCount}
                        </span>
                    ` : ''}
                    <p style="margin: 4px 0 0 0; color: #666; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${Utils.sanitizeHTML(conv.lastMessage.message.substring(0, 50))}...
                    </p>
                </div>
                <span style="font-size: 12px; color: #999;">
                    ${Utils.formatRelativeTime(conv.lastMessage.created_at)}
                </span>
            </div>
        </div>
    `).join('');
}

async function loadConversation(userId) {
    currentConversationUserId = userId;

    try {
        const messages = await API.messages.getConversation(userId);
        displayMessageThread(messages, userId);

        // Mark messages as read
        for (const msg of messages) {
            if (!msg.is_read && msg.recipient_id === currentUser.id) {
                await API.messages.markAsRead(msg.id);
            }
        }

        // Refresh conversations to update unread counts
        await loadConversations();
        updateUnreadBadge();

    } catch (error) {
        console.error('Error loading conversation:', error);
        Utils.showToast('Failed to load conversation', 'error');
    }
}

function displayMessageThread(messages, userId) {
    const container = document.getElementById('messageThread');
    if (!container) return;

    const otherUserName = messages.length > 0 ?
        (messages[0].sender_id === userId ? messages[0].sender_name : messages[0].recipient_name) :
        'User';

    container.innerHTML = `
        <div class="box left-align">
            <h3>${Utils.sanitizeHTML(otherUserName)}</h3>
        </div>

        <div id="messagesContainer" style="max-height: 400px; overflow-y: auto; padding: 20px; background: #f9f9f9; border-radius: 8px; margin-bottom: 20px;">
            ${messages.length === 0 ? `
                <p style="text-align: center; color: #666;">No messages yet. Start the conversation below!</p>
            ` : messages.map(msg => createMessageBubble(msg)).join('')}
        </div>

        <div class="box left-align">
            <h4>Send Message</h4>
            <form id="messageForm" class="mt-md">
                <textarea id="messageText" class="form-control" rows="4" placeholder="Type your message..." required></textarea>
                <button type="submit" class="btn mt-sm">Send Message</button>
            </form>
        </div>
    `;

    // Scroll to bottom
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Setup form
    const messageForm = document.getElementById('messageForm');
    if (messageForm) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await sendMessage(userId);
        });
    }

    // Update active conversation
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
        item.style.borderLeft = 'none';
    });
}

function createMessageBubble(msg) {
    const isMe = msg.sender_id === currentUser.id;
    const alignment = isMe ? 'flex-end' : 'flex-start';
    const bgColor = isMe ? '#6c5b80' : '#e0e0e0';
    const textColor = isMe ? 'white' : '#333';

    return `
        <div style="display: flex; justify-content: ${alignment}; margin-bottom: 16px;">
            <div style="max-width: 70%; padding: 12px 16px; background: ${bgColor}; color: ${textColor}; border-radius: 16px;">
                <p style="margin: 0; word-wrap: break-word;">${Utils.sanitizeHTML(msg.message)}</p>
                <p style="margin: 8px 0 0 0; font-size: 11px; opacity: 0.8;">
                    ${Utils.formatRelativeTime(msg.created_at)}
                </p>
            </div>
        </div>
    `;
}

async function sendMessage(recipientId) {
    const messageText = document.getElementById('messageText');
    const submitBtn = document.querySelector('#messageForm button[type="submit"]');
    const originalText = submitBtn.textContent;

    if (!messageText.value.trim()) {
        Utils.showToast('Please enter a message', 'error');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        await API.messages.send({
            recipientId: recipientId,
            message: messageText.value.trim()
        });

        // Clear form
        messageText.value = '';

        // Reload conversation
        await loadConversation(recipientId);

        submitBtn.textContent = originalText;
        submitBtn.disabled = false;

    } catch (error) {
        console.error('Error sending message:', error);
        Utils.showToast('Failed to send message', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function updateUnreadBadge() {
    try {
        const data = await API.messages.getUnreadCount();
        const badge = document.getElementById('unreadBadge');
        if (badge && data.count > 0) {
            badge.textContent = data.count;
            badge.style.display = 'inline-block';
        } else if (badge) {
            badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Error fetching unread count:', error);
    }
}

function setupEventListeners() {
    // Inbox/Sent toggle
    const inboxBtn = document.getElementById('inboxBtn');
    const sentBtn = document.getElementById('sentBtn');

    if (inboxBtn) {
        inboxBtn.addEventListener('click', () => {
            viewMode = 'inbox';
            inboxBtn.classList.add('active');
            inboxBtn.classList.remove('btn-secondary');
            sentBtn.classList.remove('active');
            sentBtn.classList.add('btn-secondary');
            loadConversations();
        });
    }

    if (sentBtn) {
        sentBtn.addEventListener('click', () => {
            viewMode = 'sent';
            sentBtn.classList.add('active');
            sentBtn.classList.remove('btn-secondary');
            inboxBtn.classList.remove('active');
            inboxBtn.classList.add('btn-secondary');
            loadConversations();
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await API.auth.logout();
                window.location.href = '/login.html';
            } catch (error) {
                window.location.href = '/login.html';
            }
        });
    }

    // Account link
    const accountLink = document.getElementById('accountLink');
    if (accountLink && currentUser) {
        accountLink.textContent = currentUser.firstName || 'My Account';
        accountLink.href = currentUser.role === 'seller' ? '/dashboard-seller.html' :
                          currentUser.role === 'admin' ? '/dashboard-admin.html' :
                          '/dashboard-buyer.html';
    }
}

// Make function globally available
window.loadConversation = loadConversation;
