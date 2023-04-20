// ファイルフォーマットのセレクトボックスを取得
const formatSelect = document.getElementById("file-format");

// 保存されているフォーマットを取得し、セレクトボックスの選択肢に設定する
chrome.storage.local.get("format", (result) => {
  const format = result.format || "txt";
  formatSelect.value = format;
});

// セレクトボックスの値が変わった時の処理を定義
formatSelect.addEventListener("change", () => {
  // 選択されたフォーマットを取得
  const selectedFormat = formatSelect.value;

  // 選択されたフォーマットをローカルストレージに保存
  chrome.storage.local.set({ format: selectedFormat });
});

// backgroundスクリプトからメッセージを受信したときの処理を定義
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.request === "getFormat") {
    // ローカルストレージからフォーマットを取得
    chrome.storage.local.get("format", (data) => {
      const selectedFormat = data.format || "html";
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { format: selectedFormat });
      });
    });
  }
});
