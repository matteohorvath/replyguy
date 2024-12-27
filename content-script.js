(function () {
  // --------------------------------------
  // 1. Observe for new tweets in the DOM
  // --------------------------------------
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Attempt to find tweets
            const tweetElements = node.querySelectorAll(
              'article[data-testid="tweet"]'
            );
            tweetElements.forEach((tweet) => {
              injectAiReplyButton(tweet);
            });
          }
        });
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // --------------------------------------
  // 2. Inject the "AI Reply" button
  // --------------------------------------
  function injectAiReplyButton(tweetElement) {
    // Avoid duplicates
    if (tweetElement.querySelector(".my-ai-reply-btn")) {
      return;
    }

    // Locate the container of the action icons (Reply, Retweet, Like, etc.)
    // We look for data-testid="reply", then go up to the parent that has role="group".
    const actionsContainer = tweetElement
      .querySelector('div[role="group"] [data-testid="reply"]')
      ?.closest('div[role="group"]');

    if (!actionsContainer) {
      console.warn(
        "Could not find tweet actions container, skipping AI Reply button injection."
      );
      return;
    }

    // Create a new button
    const button = document.createElement("button");
    button.innerText = "AI Reply";
    button.className = "my-ai-reply-btn";
    button.style.marginLeft = "8px";
    button.style.cursor = "pointer";

    // Append it to the tweet's action area
    actionsContainer.appendChild(button);

    // Button click handler
    button.addEventListener("click", async () => {
      // Extract the tweet text
      const tweetText = extractTweetText(tweetElement);

      // Pick a random "tone" or style
      const chosenTone = chooseRandomTone();

      // Call OpenAI to get a suggested reply
      const replyText = await getAiReply(chosenTone, tweetText);

      if (!replyText) return;

      // 1) Copy reply to the clipboard
      try {
        await navigator.clipboard.writeText(replyText);
        console.log("AI reply copied to clipboard!");
      } catch (err) {
        console.error("Failed to copy AI reply to clipboard", err);
      }

      // 2) Open the reply/comment dialog and place the AI response into the input
      openReplyDialog(tweetElement).then((replyBox) => {
        if (replyBox) {
          replyBox.value = replyText;
          // Dispatch an 'input' event so Twitter recognizes the new text
          replyBox.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
    });
  }

  // --------------------------------------
  // 3. Extract the tweet text
  // --------------------------------------
  function extractTweetText(tweetElement) {
    // Twitter often stores the tweet text inside elements with data-testid="tweetText".
    // We might see multiple spans; let's gather them all.
    // Adjust if Twitter's DOM changes.
    const textContainer = tweetElement.querySelector(
      '[data-testid="tweetText"]'
    );
    return textContainer
      ? textContainer.innerText.trim()
      : "(Could not extract tweet text)";
  }

  // --------------------------------------
  // 4. Choose a random style or tone
  // --------------------------------------
  function chooseRandomTone() {
    const tones = ["nerdy", "question", "super positive"];
    return tones[Math.floor(Math.random() * tones.length)];
  }

  // --------------------------------------
  // 5. Get AI reply from OpenAI
  // --------------------------------------
  async function getAiReply(tone, tweetText) {
    let stylePrompt = "";
    switch (tone) {
      case "nerdy":
        stylePrompt = "Generate a nerdy-sounding reply.";
        break;
      case "question":
        stylePrompt = "Generate a reply as a question in a friendly tone.";
        break;
      case "super positive":
        stylePrompt = "Generate a very encouraging, upbeat reply.";
        break;
      default:
        stylePrompt = "Generate a default reply.";
    }

    // Construct a system + user prompt that includes the tweet text as context
    const systemPrompt =
      "You are a helpful assistant who composes short and relevant tweets. ";
    const userPrompt = `
        The user just saw this tweet:
        "${tweetText}"
  
       Reply to this tweet that asks a thought-provoking question or provides a unique perspective to spark conversation. Keep it conversational and engaging. dont use hashtags or links. keep it short. Make it sounds like a hungarian speaking english. dont put it in qoutes.
      `;

    // Retrieve your OpenAI API key from Chrome storage
    const apiKey = await new Promise((resolve) => {
      chrome.storage.sync.get(["openaiApiKey"], (result) => {
        resolve(result.openaiApiKey);
      });
    });

    if (!apiKey) {
      alert("Please set your OpenAI API Key in the extension popup!");
      return null;
    }

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            max_tokens: 60,
            temperature: 0.7,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        // The AI reply content
        const reply = data.choices[0].message.content.trim();
        return reply;
      } else {
        console.error(
          "OpenAI API error:",
          response.status,
          await response.text()
        );
        return null;
      }
    } catch (err) {
      console.error("Error fetching AI reply:", err);
      return null;
    }
  }

  // --------------------------------------
  // 6. Open the Twitter reply dialog
  // --------------------------------------
  async function openReplyDialog(tweetElement) {
    // Trigger Twitter's native "Reply" button
    const replyButton = tweetElement.querySelector('[data-testid="reply"]');
    if (replyButton) {
      replyButton.click();
    }

    // Wait for the reply text area to appear
    const TIMEOUT = 5000;
    const start = Date.now();
    let replyBox;
    while (Date.now() - start < TIMEOUT && !replyBox) {
      replyBox = document.querySelector(
        '[data-testid="tweetTextarea_0"] textarea'
      );
      await new Promise((r) => setTimeout(r, 300));
    }
    return replyBox;
  }
})();
