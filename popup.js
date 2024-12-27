document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKey");
  const saveKeyBtn = document.getElementById("saveKey");
  const statusText = document.getElementById("status");

  // Load the stored API key (if any) when popup opens
  chrome.storage.sync.get(["openaiApiKey"], (result) => {
    if (result.openaiApiKey) {
      apiKeyInput.value = result.openaiApiKey;
    }
  });

  saveKeyBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      statusText.textContent = "Please enter a valid OpenAI API Key.";
      return;
    }
    chrome.storage.sync.set({ openaiApiKey: key }, () => {
      statusText.textContent = "API Key saved!";
    });
  });
});
