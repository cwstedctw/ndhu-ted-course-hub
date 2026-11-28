const ROUND_ID = 'W10-1';
const BOARD_TITLE = '哪一關想看老師再做一次？';
const VOTE_SHEET = 'Votes';
const VOTE_HEADERS = ['場次', '選項'];
const SPREADSHEET_PROPERTY = 'HELP_BOARD_SPREADSHEET_ID';
const OPTIONS = [
  { id: 'deploy', label: '找不到部署按鈕' },
  { id: 'sheet', label: '送出後試算表沒新增一筆' },
  { id: 'phone', label: '同學的手機打不開' },
];

// 從綁定在試算表的 Apps Script 編輯器執行一次。
function setupHelpBoard() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('請從目標試算表的「擴充功能 → Apps Script」開啟編輯器，再執行設定。');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error('目前有人在送出，請稍後再執行設定。');
  }
  try {
    const sheet = spreadsheet.getSheetByName(VOTE_SHEET) || spreadsheet.insertSheet(VOTE_SHEET);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, VOTE_HEADERS.length).setValues([VOTE_HEADERS]);
    } else if (!hasVoteHeaders_(sheet)) {
      throw new Error('Votes 分頁已有資料，但欄名不是「場次」、「選項」。請先確認分頁內容。');
    }
    SpreadsheetApp.flush();
    PropertiesService.getScriptProperties().setProperty(SPREADSHEET_PROPERTY, spreadsheet.getId());
    console.log('設定完成。請到試算表確認 Votes 分頁有「場次」和「選項」兩欄。');
  } finally {
    lock.releaseLock();
  }
}

function doGet(event) {
  if (event && event.parameter && event.parameter.view === 'results') {
    return ContentService.createTextOutput(JSON.stringify(getBoard()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle(BOARD_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getBoard() {
  try {
    const sheet = getVoteSheet_();
    return sheet ? readBoard_(sheet) : setupRequired_();
  } catch (error) {
    return { error: '目前讀不到票數，請老師確認試算表和存取權限。' };
  }
}

function submitVote(roundId, optionId) {
  if (roundId !== ROUND_ID) {
    return { error: '場次已更換。請先更新票數，再選一次。' };
  }
  const option = OPTIONS.find((item) => item.id === optionId);
  if (!option) {
    return { error: '請選擇畫面上的其中一個選項。' };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return { error: '目前送出的人較多。這票還沒寫入，請稍後再試。' };
  }
  try {
    const sheet = getVoteSheet_();
    if (!sheet) {
      return setupRequired_();
    }

    sheet.appendRow([ROUND_ID, option.label]);
    SpreadsheetApp.flush();
    return { ok: true };
  } catch (error) {
    return { error: '目前無法確認這票是否寫入。請更新票數，並請老師查看試算表。' };
  } finally {
    lock.releaseLock();
  }
}

function getVoteSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty(SPREADSHEET_PROPERTY);
  if (!id) {
    return null;
  }
  const sheet = SpreadsheetApp.openById(id).getSheetByName(VOTE_SHEET);
  return sheet && hasVoteHeaders_(sheet) ? sheet : null;
}

function hasVoteHeaders_(sheet) {
  const headers = sheet.getRange(1, 1, 1, VOTE_HEADERS.length).getDisplayValues()[0];
  return VOTE_HEADERS.every((header, index) => headers[index] === header);
}

function setupRequired_() {
  return { error: '投票板還沒設定好。請老師執行 setupHelpBoard 並確認 Votes 分頁。' };
}

function readBoard_(sheet) {
  const counts = new Map(OPTIONS.map((item) => [item.label, 0]));
  const rowCount = sheet.getLastRow() - 1;
  if (rowCount > 0) {
    const rows = sheet.getRange(2, 1, rowCount, VOTE_HEADERS.length).getDisplayValues();
    for (const [roundId, label] of rows) {
      if (roundId === ROUND_ID && counts.has(label)) {
        counts.set(label, counts.get(label) + 1);
      }
    }
  }
  return {
    round: ROUND_ID,
    title: BOARD_TITLE,
    options: OPTIONS.map((option) => ({ ...option, count: counts.get(option.label) })),
  };
}
