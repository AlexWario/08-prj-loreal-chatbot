/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

// Set initial message
chatWindow.innerHTML =
  "<div class=\"msg ai\">👋 Hello! I'm your L'Oréal Product Advisor. How can I help you with beauty products, routines, or recommendations today?</div>";

// Function to add a message to the chat window
function addMessageToChat(message, sender) {
  // Create a new message element
  const messageDiv = document.createElement("div");
  messageDiv.className = `msg ${sender}`;

  // Add sender label and message content
  if (sender === "user") {
    messageDiv.innerHTML = `<strong>You:</strong> ${message}`;
  } else {
    messageDiv.innerHTML = `<strong>L'Oréal Advisor:</strong> ${message}`;
  }

  // Add the message to the chat window
  chatWindow.appendChild(messageDiv);

  // Scroll to the bottom to show the latest message
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Function to show a thinking/loading message
function showThinkingMessage() {
  const thinkingDiv = document.createElement("div");
  thinkingDiv.className = "msg ai thinking";
  thinkingDiv.innerHTML =
    "<strong>L'Oréal Advisor:</strong> <em>Thinking...</em>";
  thinkingDiv.id = "thinking-message";

  chatWindow.appendChild(thinkingDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Function to remove the thinking message
function removeThinkingMessage() {
  const thinkingMessage = document.getElementById("thinking-message");
  if (thinkingMessage) {
    thinkingMessage.remove();
  }
}

// Track conversation history
let conversationHistory = [
  {
    role: "system",
    content:
      "You are L'Oréal's AI Product Advisor. You ONLY provide assistance with L'Oréal products, beauty routines, skincare advice, makeup tips, haircare guidance, and fragrance recommendations. You must politely refuse to answer any questions about: other brands, general topics unrelated to beauty, political topics, personal advice outside of beauty, technical support, or any non-L'Oréal related subjects. When someone asks about unrelated topics, respond with: 'I'm specifically designed to help with L'Oréal beauty products and routines. Let me know how I can assist you with skincare, makeup, haircare, or fragrance questions instead!' Always redirect conversations back to L'Oréal's beauty expertise and product recommendations.",
  },
];

// Add a dedicated area for the latest user question above the chat window
let latestQuestionDiv = document.createElement("div");
latestQuestionDiv.id = "latest-question";
latestQuestionDiv.style.margin = "16px 0 8px 0";
latestQuestionDiv.style.fontWeight = "bold";
latestQuestionDiv.style.fontSize = "18px";
chatWindow.parentNode.insertBefore(latestQuestionDiv, chatWindow);

// Function to update the latest question display
function updateLatestQuestion(question) {
  if (question) {
    latestQuestionDiv.innerHTML = `Latest question: <span style="font-weight:normal;">${question}</span>`;
  } else {
    latestQuestionDiv.innerHTML = "";
  }
}

async function sendMessageToOpenAI(message) {
  // Add the user's message to the conversation history
  conversationHistory.push({ role: "user", content: message });

  // Use the Cloudflare Worker endpoint to protect the API key
  const endpoint = "https://von.alexwario127.workers.dev/";

  // Prepare the data to send to the Worker
  const data = {
    messages: conversationHistory,
  };

  try {
    // Send the POST request to the Cloudflare Worker
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    // Check if the response was successful
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          "Authentication failed. Please check the Worker configuration."
        );
      } else if (response.status === 429) {
        throw new Error(
          "Rate limit exceeded. Please wait a moment and try again."
        );
      } else {
        throw new Error(`Request failed with status ${response.status}`);
      }
    }

    // Parse the JSON response
    const result = await response.json();

    // Check if we got a valid response
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      throw new Error("Invalid response from API");
    }

    // Get the assistant's reply from the response
    const reply = result.choices[0].message.content;
    // Add the assistant's reply to the conversation history
    conversationHistory.push({ role: "assistant", content: reply });
    return reply;
  } catch (error) {
    // Log the error for debugging
    console.error("Error calling Cloudflare Worker:", error);

    // Return specific error messages
    if (error.message.includes("Authentication failed")) {
      return "🔑 Authentication error. Please contact support.";
    } else if (error.message.includes("Rate limit")) {
      return "⏰ Rate limit exceeded. Please wait a moment and try again.";
    } else if (error.message.includes("Failed to fetch")) {
      return "🌐 Network error. Please check your internet connection and try again.";
    } else {
      return "❌ Sorry, I'm having trouble connecting right now. Please try again in a moment.";
    }
  }
}

// Function to test Cloudflare Worker connection
async function testAPIConnection() {
  try {
    const response = await fetch("https://von.alexwario127.workers.dev/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "You are a test assistant. Respond with 'Test successful' if you receive this message.",
          },
          {
            role: "user",
            content: "Test connection",
          },
        ],
      }),
    });

    if (response.ok) {
      console.log("✅ Cloudflare Worker connection successful");
      return true;
    } else {
      console.log("❌ Cloudflare Worker connection failed:", response.status);
      return false;
    }
  } catch (error) {
    console.log("❌ Cloudflare Worker connection error:", error);
    return false;
  }
}

// Test API connection when page loads
window.addEventListener("load", () => {
  testAPIConnection();
});

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Get the user's message and trim whitespace
  const message = userInput.value.trim();

  // Check if the message is not empty
  if (!message) {
    return; // Don't send empty messages
  }

  // Disable the form while processing
  userInput.disabled = true;
  const sendButton = chatForm.querySelector("button");
  sendButton.disabled = true;

  // Add the user's message to the chat
  addMessageToChat(message, "user");

  // Update the latest question display
  updateLatestQuestion(message);

  // Clear the input box
  userInput.value = "";

  // Show thinking message
  showThinkingMessage();

  try {
    // Send the message to OpenAI and get the reply
    const reply = await sendMessageToOpenAI(message);

    // Remove thinking message
    removeThinkingMessage();

    // Add the assistant's reply to the chat
    addMessageToChat(reply, "ai");
  } catch (error) {
    // Remove thinking message
    removeThinkingMessage();
    addMessageToChat("Sorry, something went wrong. Please try again.", "ai");
  }

  // Re-enable the form
  userInput.disabled = false;
  sendButton.disabled = false;
  userInput.focus();
});
