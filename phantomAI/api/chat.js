"use strict";

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  // Basic security headers
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  try {
    // Make sure the API key exists server-side
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.error("GROQ_API_KEY is missing");
      return res.status(500).json({
        error: "AI service is not configured"
      });
    }

    // Validate request body
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({
        error: "Invalid request"
      });
    }

    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({
        error: "Messages must be an array"
      });
    }

    // Prevent excessively large conversations
    if (messages.length === 50 || messages.length > 50) {
      return res.status(400).json({
        error: "Conversation is too long"
      });
    }

    // Validate and sanitize the message structure
    const validMessages = [];

    for (const message of messages) {
      if (!message || typeof message !== "object") {
        return res.status(400).json({
          error: "Invalid message"
        });
      }

      if (
        message.role !== "user" &&
        message.role !== "assistant"
      ) {
        return res.status(400).json({
          error: "Invalid message role"
        });
      }

      if (typeof message.content !== "string") {
        return res.status(400).json({
          error: "Invalid message content"
        });
      }

      // Limit each individual message
      if (message.content.length > 8000) {
        return res.status(400).json({
          error: "Message is too long"
        });
      }

      validMessages.push({
        role: message.role,
        content: message.content
      });
    }

    if (validMessages.length === 0) {
      return res.status(400).json({
        error: "No messages supplied"
      });
    }

    /*
     * Keep the model server-side.
     *
     * You can optionally create another Vercel
     * environment variable:
     *
     * GROQ_MODEL
     *
     * Otherwise the default below is used.
     */
    const model =
      process.env.GROQ_MODEL ||
      "qwen/qwen3.8-27b";

    // Call Groq from the SERVER.
    // The browser never sees GROQ_API_KEY.
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 30000);

    let groqResponse;

    try {
      groqResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },

          body: JSON.stringify({
            model: model,
            messages: validMessages,
            max_tokens: 800
          }),

          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    // Don't expose Groq's raw response/errors to clients
    if (!groqResponse.ok) {
      console.error(
        "Groq API returned HTTP",
        groqResponse.status
      );

      return res.status(502).json({
        error: "AI provider error"
      });
    }

    const data = await groqResponse.json();

    const content =
      data?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      console.error("Unexpected Groq response");

      return res.status(502).json({
        error: "Invalid AI response"
      });
    }

    // Prevent an unexpectedly huge response
    const safeContent =
      content.slice(0, 50000);

    return res.status(200).json({
      content: safeContent
    });

  } catch (error) {
    console.error("Chat API error:", error);

    if (error?.name === "AbortError") {
      return res.status(504).json({
        error: "AI request timed out"
      });
    }

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}
