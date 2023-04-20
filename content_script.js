// 変数isSavingはSaveボタンの連続クリックを防ぐために使用されます。
let isSaving = false;

// init()はSaveボタンを生成し、ページに追加します。
// Saveボタンがクリックされたときに呼び出される関数を追加します。
// getConversationData()関数を使用して会話内容を取得し、保存処理を実行します。
function init() {

  // Saveボタンを生成
  const saveButton = createSaveBtn();

  // Regenerate responseボタンの隣にSaveボタンを挿入します。
  function appendSaveButton() {
    // Regenerate responseボタンを取得
    const buttonsWrapper = document.querySelector(
      "#__next main form > div div:nth-of-type(1) div"
    );
    // Regenerate responseボタンの隣にSaveボタンを挿入
    if (buttonsWrapper) {
      buttonsWrapper.appendChild(saveButton);
    }
  }

  // Saveボタンをページに挿入
  appendSaveButton();

  // Saveボタンが表示されなくなった場合、定期的にページに追加し直す
  const id = setInterval(() => {
    if (!document.querySelector("#save-button")) {
      appendSaveButton();
    }
  }, 500);

  // Saveボタンがクリックされたときのイベントリスナーを追加
  saveButton.addEventListener("click", async () => {
    // 連続クリックを防ぐためにisSaving変数を使用
    if (isSaving) {
      return;
    }
    isSaving = true;

    // 会話データを取得
    const conversationData = getConversationData();

    // フォーマットを指定して会話データを保存する
    chrome.storage.local.get(["format"], ({ format: resultFormat }) => {
      const format = resultFormat || "txt";
      const fileContent = formatConversationData(conversationData, format);
      saveFile(fileContent, format);

      // 保存後、isSavingをfalseに設定する
      isSaving = false;
    });
  });
}

// Saveボタンを生成し、ボタンのテキストを設定します。
function createSaveBtn() {
  const button = document.createElement("button");

  button.id = "save-button";
  button.classList.add("btn", "flex", "gap-2", "justify-center", "btn-neutral");
  button.textContent = "Save";

  return button;
}


// ページから会話内容を取得するための関数
function getConversationData() {
  // 会話内容を格納する要素を取得
  const threadContainer = document.getElementsByClassName(
    "flex flex-col items-center text-sm dark:bg-gray-800"
  )[0];

  let model;

  // モデル名を取得するための要素を取得
  const chatGptPlusElement = document.querySelector(".gold-new-button");
  // chatGPT+が使われていない場合は、モデル名を取得
  const isNotChatGptPlus =
    chatGptPlusElement && chatGptPlusElement.innerText.includes("Upgrade");

  if (!isNotChatGptPlus) {
    const modelElement = threadContainer.firstChild;
    model = modelElement.innerText;
  }

  // 会話データを格納するオブジェクト
  const conversationData = {
    title: document.title,
    items: [],
  };

  // 会話内容を取得
  for (const node of threadContainer.children) {
    const markdown = node.querySelector(".markdown");

    // クラス名から人間とAIの発言を判断
    if ([...node.classList].includes("dark:bg-gray-800")) {
      const warning = node.querySelector(".text-orange-500");
      if (warning) {
        // エラーメッセージがある場合は、エラーメッセージを取得
        conversationData.items.push({
          from: "human",
          value: warning.innerText.split("\n")[0],
        });
      } else {
        // テキストを取得
        const text = node.querySelector(".whitespace-pre-wrap");
        conversationData.items.push({
          from: "human",
          value: text.textContent,
        });
      }
      // GPTの応答の場合、コードブロックを含むことがある
    } else if (markdown) {
      conversationData.items.push({
        from: "gpt",
        value: markdown.outerHTML,
      });
    }
  }
  return conversationData;
}

// 与えられた会話データとフォーマットに基づき、整形されたデータを返す関数
function formatConversationData(conversationData, format) {
  let formattedData = "";

  switch (format) {
    // テキスト形式の場合
    case "text":
      formattedData = "";
      conversationData.items.forEach(item => {
        // 改行をCRLFに変換して、HTMLタグを除去したテキストをエスケープして追加
        const valueWithoutTags = item.value.replace(/<\/?[^>]+(>|$)/g, "");
        const valueDecoded = replaceHtmlEntities(valueWithoutTags);
        formattedData += `${item.from.toUpperCase()},"${valueDecoded}"\r\n`;
      });
      break;

    // Markdown形式の場合
    case "md":
      formattedData = "";
      // コードブロックをMarkdown形式に変換するための正規表現
      const regex = /<code class="!whitespace-pre hljs language-(.*?)">([\s\S]*?)<\/code>/g;
      for (const item of conversationData.items) {
        // コードブロックをMarkdown形式に変換し、HTMLタグを除去する
        let replacedValue = item.value.replace(regex, "\n```$1\n$2\n```\n");
        replacedValue = replacedValue.replace(/<\/?[^>]+(>|$)/g, "");
        // 人間かGPTかに応じて、"**"で囲って出力するかどうかを判断して、整形データに追加
        if (item.from) {
          formattedData += `**${item.from.toUpperCase()}**: ${replacedValue}\n\n`;
        } else {
          formattedData += `${replacedValue}\n\n`;
        }
      }
      // 最後に改行を除去する
      formattedData = formattedData.trim();
      break;

    // HTML形式の場合
    case "html":
      formattedData = `
      <html>
        <head>
          <link rel="stylesheet" href="https://chat.openai.com/_next/static/css/6daec59cacc8654b.css">
        </head>
        <body>
          <div>`;
      conversationData.items.forEach(item => {
        // 改行を<br>タグに変換し、整形データに追加
        const valueWithBreaks = item.value.replace(/\n/g, "<br>");
        formattedData += `<p><strong>${item.from}:</strong> ${valueWithBreaks}</p>`;
      });
      formattedData += `
          </div>
        </body>
      </html>`;
      break;

    // CSV形式の場合
    case "csv":
      formattedData = "Role,Content\r\n";
      conversationData.items.forEach(item => {
        const valueWithBreaks = item.value.replace(/\n/g, "\r\n");
        const valueWithQuotes = valueWithBreaks.replace(/"/g, '""');
        const valueWithoutTags = valueWithQuotes.replace(/<\/?[^>]+(>|$)/g, "");
        const valueDecoded = replaceHtmlEntities(valueWithoutTags);
        formattedData += `${item.from.toUpperCase()},"${valueDecoded}"\r\n`;
      });
      break;

    default:
      console.error("Invalid format specified.");
  }

  return formattedData;
}

// ファイルを保存するための関数です。
function saveFile(content, format) {

  // ファイル形式に応じて拡張子とMIMEタイプを設定
  let extension = "";
  let mimeType = "";

  switch (format) {
    case "text":
      extension = "txt";
      mimeType = "text/plain";
      break;

    case "md":
      extension = "md";
      mimeType = "text/markdown";
      break;

    case "html":
      extension = "html";
      mimeType = "text/html";
      break;

    case "csv":
      extension = "csv";
      mimeType = "text/csv";
      break;

    default:
      break;
  }

  // 渡されたコンテンツをBlobとして作成し、ダウンロード用のURLを作成
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  // ダウンロード用のリンクを作成し、click()を呼び出して自動ダウンロードを実行
  link.href = url;
  link.download = `ChatGPT_${new Date().toISOString()}.${extension}`;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  // setTimeout()で一定時間後に作成したリンクを削除し、メモリリークを防止
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

// HTMLエンティティを元の文字に置き換える関数
function replaceHtmlEntities(text) {
  return text.replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'");
}

init();
