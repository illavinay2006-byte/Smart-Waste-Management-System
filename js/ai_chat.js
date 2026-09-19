// SmartWaste AI Interactive Chat Assistant
const AIChatAssistant = {
  isOpen: false,

  toggleChat() {
    this.isOpen = !this.isOpen;
    const modalContainer = document.getElementById("modal-container");
    if (!this.isOpen) {
      modalContainer.innerHTML = "";
      return;
    }

    const currentRole = App.currentUser ? App.currentUser.role : "citizen";
    modalContainer.innerHTML = `
      <div class="sw-modal-backdrop">
        <div class="sw-modal" style="max-width: 500px; height: 600px;">
          <!-- Header -->
          <div class="sw-modal-header bg-success text-white">
            <div class="d-flex align-items-center gap-2">
              <span class="fs-4">🤖</span>
              <div>
                <h6 class="fw-bold mb-0">SmartWaste AI Assistant</h6>
                <small style="font-size: 0.72rem; opacity: 0.9;">
                  ${currentRole === 'officer' ? 'Municipal Operations Assistant' : 'Citizen Waste & Reporting Assistant'}
                </small>
              </div>
            </div>
            <button class="btn-close btn-close-white" onclick="AIChatAssistant.toggleChat()"></button>
          </div>

          <!-- Chat Messages Body -->
          <div class="chat-messages" id="chat-messages-box">
            <div class="chat-bubble bot">
              ${currentRole === 'officer' 
                ? "Hello Officer! I can analyze current waste operations, identify overdue SLA complaints, and suggest worker assignments."
                : "Hello! I am SmartWaste AI. I can guide you on waste segregation, track your complaints, or help you prepare a report."}
            </div>
          </div>

          <!-- Quick Suggestions -->
          <div class="p-2 bg-light border-top d-flex gap-1 flex-wrap" id="chat-quick-suggestions">
            ${currentRole === 'officer' ? `
              <button class="btn btn-sm btn-outline-secondary py-0" style="font-size: 0.75rem;" onclick="AIChatAssistant.sendPrompt('Show today\\'s unresolved high-priority reports')">🚨 Urgent Reports</button>
              <button class="btn btn-sm btn-outline-secondary py-0" style="font-size: 0.75rem;" onclick="AIChatAssistant.sendPrompt('Which reports are overdue?')">⏳ Overdue SLA</button>
              <button class="btn btn-sm btn-outline-secondary py-0" style="font-size: 0.75rem;" onclick="AIChatAssistant.sendPrompt('Summarize today\\'s sanitation activity')">📊 Daily Summary</button>
              <button class="btn btn-sm btn-outline-secondary py-0" style="font-size: 0.75rem;" onclick="AIChatAssistant.sendPrompt('Who is available among field workers?')">👷 Worker Status</button>
            ` : `
              <button class="btn btn-sm btn-outline-secondary py-0" style="font-size: 0.75rem;" onclick="AIChatAssistant.sendPrompt('How do I segregate plastic and wet waste?')">♻️ Segregation Rules</button>
              <button class="btn btn-sm btn-outline-secondary py-0" style="font-size: 0.75rem;" onclick="AIChatAssistant.sendPrompt('Track my reports')">🔍 Track My Reports</button>
              <button class="btn btn-sm btn-outline-secondary py-0" style="font-size: 0.75rem;" onclick="AIChatAssistant.sendPrompt('Where is the nearest collection point?')">📍 Collection Points</button>
              <button class="btn btn-sm btn-outline-secondary py-0" style="font-size: 0.75rem;" onclick="AIChatAssistant.sendPrompt('How do I report battery or chemical waste?')">⚠️ Hazardous Waste</button>
            `}
          </div>

          <!-- Input Row -->
          <div class="chat-input-row">
            <input type="text" id="ai-chat-input" class="chat-input" placeholder="Type a question..." onkeydown="if(event.key==='Enter') AIChatAssistant.handleSend()">
            <button class="btn btn-success rounded-circle" style="width: 40px; height: 40px;" onclick="AIChatAssistant.handleSend()">➤</button>
          </div>
        </div>
      </div>
    `;
  },

  sendPrompt(text) {
    const input = document.getElementById("ai-chat-input");
    if (input) {
      input.value = text;
      this.handleSend();
    }
  },

  async handleSend() {
    const input = document.getElementById("ai-chat-input");
    const msg = input ? input.value.trim() : "";
    if (!msg) return;

    const chatBox = document.getElementById("chat-messages-box");
    
    // Append User Bubble
    const userBubble = document.createElement("div");
    userBubble.className = "chat-bubble user";
    userBubble.innerText = msg;
    chatBox.appendChild(userBubble);
    input.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;

    // Append Typing Indicator
    const typingBubble = document.createElement("div");
    typingBubble.className = "chat-bubble bot text-muted";
    typingBubble.id = "typing-bubble";
    typingBubble.innerText = "SmartWaste AI is thinking...";
    chatBox.appendChild(typingBubble);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
      const res = await API.sendAIChat(msg);
      const indicator = document.getElementById("typing-bubble");
      if (indicator) indicator.remove();

      const botBubble = document.createElement("div");
      botBubble.className = "chat-bubble bot";
      
      // Convert markdown bold to HTML
      let formatted = (res.reply || "I couldn't process that.")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br/>");

      botBubble.innerHTML = formatted;
      chatBox.appendChild(botBubble);
      chatBox.scrollTop = chatBox.scrollHeight;
    } catch (err) {
      const indicator = document.getElementById("typing-bubble");
      if (indicator) indicator.remove();

      const botBubble = document.createElement("div");
      botBubble.className = "chat-bubble bot text-danger";
      botBubble.innerText = "Error: " + err.message;
      chatBox.appendChild(botBubble);
    }
  }
};
