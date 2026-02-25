document.addEventListener('DOMContentLoaded', () => {
    // Inject Chat HTML
    const chatHTML = `
        <div class="chat-widget-btn" id="chatWidgetBtn">
            <i class="fas fa-comment-dots"></i>
        </div>
        <div class="chat-window" id="chatWindow">
            <div class="chat-header">
                <h3>Support Assistant</h3>
                <button class="close-chat" id="closeChatBtn"><i class="fas fa-times"></i></button>
            </div>
            <div class="chat-messages" id="chatMessages">
                <div class="message bot">
                    Hello! I'm here to help. If you have any problems, just let me know!
                </div>
            </div>
            <div class="chat-input-area">
                <input type="text" id="chatInput" placeholder="Type a message...">
                <button id="sendMessageBtn"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>
    `;

    // Append to body
    const div = document.createElement('div');
    div.innerHTML = chatHTML;
    document.body.appendChild(div);

    // Elements
    const chatBtn = document.getElementById('chatWidgetBtn');
    const chatWindow = document.getElementById('chatWindow');
    const closeBtn = document.getElementById('closeChatBtn');
    const sendBtn = document.getElementById('sendMessageBtn');
    const input = document.getElementById('chatInput');
    const messagesContainer = document.getElementById('chatMessages');

    // State
    // Try to get studentDbId, if not fallback to parsing a 'user' object just in case
    let userId = localStorage.getItem('studentDbId');
    if (!userId) {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            userId = user ? user.id : null;
        } catch (e) { }
    }

    // Toggle Chat
    chatBtn.addEventListener('click', () => {
        const isVisible = chatWindow.style.display === 'flex';
        chatWindow.style.display = isVisible ? 'none' : 'flex';
        if (!isVisible && userId) {
            loadHistory();
        }
    });

    closeBtn.addEventListener('click', () => {
        chatWindow.style.display = 'none';
    });

    // Send Message
    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        if (!userId) {
            appendMessage('bot', 'Please log in to use the support chat.');
            input.value = '';
            return;
        }

        // Add user message
        appendMessage('user', text);
        input.value = '';

        // Show typing
        const loader = showTyping();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: userId,
                    message: text
                })
            });

            const data = await response.json();

            // Remove typing
            loader.remove();

            if (data.status === 'success') {
                // Simulate AI typing delay based on response length (min 1s, max 3s)
                const delay = Math.min(3000, Math.max(1000, data.data.response.length * 30));

                // Scroll to bottom to show typing indicator if it was removed
                scrollToBottom();

                setTimeout(() => {
                    appendMessage('bot', data.data.response);
                }, delay);
            } else {
                appendMessage('bot', 'Sorry, something went wrong. Please try again.');
            }

        } catch (err) {
            loader.remove();
            console.error(err);
            appendMessage('bot', 'Network error. Please try again later.');
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Helpers
    function appendMessage(sender, text) {
        const div = document.createElement('div');
        div.className = `message ${sender}`;
        div.textContent = text;
        messagesContainer.appendChild(div);
        scrollToBottom();
    }

    function showTyping() {
        const div = document.createElement('div');
        div.className = 'typing-indicator';
        div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
        messagesContainer.appendChild(div);
        scrollToBottom();
        return div;
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async function loadHistory() {
        if (!userId) return;

        // Prevent reloading if already loaded (simple check: if more than 1 message)
        if (messagesContainer.children.length > 2) return;

        try {
            const res = await fetch(`/api/chat/history/${userId}`);
            const data = await res.json();

            if (data.status === 'success' && data.data.length > 0) {
                // Clear default greeting if we have history, or keep it? 
                // Let's clear and rebuild
                messagesContainer.innerHTML = '';

                data.data.forEach(msg => {
                    appendMessage('user', msg.message);
                    appendMessage('bot', msg.response);
                });
            }
        } catch (err) {
            console.error('Failed to load history', err);
        }
    }
});
